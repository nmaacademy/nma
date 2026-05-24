<?php

namespace App\Http\Controllers\Api\Course;

use App\Http\Controllers\Controller;
use App\Http\Requests\Course\WatchSessionEndRequest;
use App\Http\Requests\Course\WatchSessionHeartbeatRequest;
use App\Mail\AccountSharingWarningMail;
use App\Models\CourseVideo;
use App\Services\VideoAnomalyService;
use App\Services\VideoProgressService;
use App\Services\WatchSessionService;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Cache;
use Illuminate\Support\Facades\Mail;
use Illuminate\Support\Str;

class WatchSessionController extends Controller
{
    public function __construct(
        private readonly WatchSessionService  $watch,
        private readonly VideoProgressService $progress,
        private readonly VideoAnomalyService  $anomaly,
    ) {}

    // ─── POST /api/user/videos/{video}/watch-session/start ────────────────────

    public function start(Request $request, CourseVideo $video): JsonResponse
    {
        $user        = $request->user();
        $userSession = $request->attributes->get('user_session');

        // ── 1. Access check ────────────────────────────────────────────────────
        if (! $this->progress->canAccess($user, $video)) {
            return response()->json([
                'success' => false,
                'message' => 'Nu ai acces la acest video.',
            ], 403);
        }

        // ── 2. Clean up any stale sessions before conflict detection ───────────
        $staleClosed = $this->watch->endStaleSessions($user);

        if ($staleClosed > 0) {
            $this->watch->log($video, $user, $userSession, 'stale_timeout', null, [
                'stale_sessions_closed' => $staleClosed,
            ]);
        }

        // ── 3. Check for a live active session ─────────────────────────────────
        $existing = $this->watch->findActiveSession($user);

        if ($existing) {
            if ($this->watch->belongsToCurrentDevice($existing, $userSession)) {
                // Same device — cleanly replace (user navigated to another video)
                $this->watch->endSession($existing, 'displaced_by_self');
            } else {
                // Different device — new session wins.
                // The OLD session is intentionally left active so its next heartbeat
                // detects the token mismatch and records a strike against the account.
                $this->watch->log($video, $user, $userSession, 'watch_conflict', null, [
                    'conflicting_watch_session_id' => $existing->id,
                ]);
                $this->anomaly->logWatchConflict(
                    $user->id,
                    $video->id,
                    $existing->id,
                    $userSession?->id,
                    $request,
                );
            }
        }

        // ── 4. Generate token, register it on the user, create session ─────────
        $playbackToken = (string) Str::uuid();
        $user->update(['active_playback_session_id' => $playbackToken]);

        $session = $this->watch->createSession($user, $video, $userSession, $request, $playbackToken);

        $this->watch->log($video, $user, $userSession, 'watch_start', null, [
            'watch_session_id' => $session->id,
        ]);

        return response()->json([
            'success' => true,
            'message' => 'Sesiunea de vizionare a fost pornită.',
            'data'    => [
                'watch_session_id'           => $session->id,
                'video_id'                   => $video->id,
                'playback_session_token'     => $playbackToken,
                'heartbeat_interval_seconds' => 30,
            ],
        ]);
    }

    // ─── POST /api/user/videos/{video}/watch-session/heartbeat ────────────────

    public function heartbeat(WatchSessionHeartbeatRequest $request, CourseVideo $video): JsonResponse
    {
        $user        = $request->user();
        $userSession = $request->attributes->get('user_session');

        $session = $this->watch->resolveSession($request->watch_session_id, $user, $video);

        if (! $session) {
            return response()->json([
                'success' => false,
                'message' => 'Sesiunea de vizionare nu a fost găsită sau nu mai este activă.',
            ], 404);
        }

        if (! $this->watch->belongsToCurrentDevice($session, $userSession)) {
            return response()->json([
                'success' => false,
                'message' => 'Sesiunea nu aparține dispozitivului curent.',
            ], 403);
        }

        // ── Displacement check ──────────────────────────────────────────────────
        // If a newer session started on another device, user.active_playback_session_id
        // will no longer match the token stored on this session. Strike the account.
        if ($session->playback_session_token) {
            $user->refresh();
            if ($user->active_playback_session_id !== $session->playback_session_token) {
                $user->increment('strikes');
                $user->refresh();

                // Send warning email at most once per 24 h per user.
                $emailKey = "sharing_warning_email:{$user->id}";
                if (! Cache::has($emailKey)) {
                    Cache::put($emailKey, true, now()->addHours(24));
                    Mail::to($user->email)->queue(new AccountSharingWarningMail(
                        userName:    $user->name,
                        strikeCount: $user->strikes,
                        detectedAt:  now()->format('d.m.Y H:i'),
                    ));
                }

                $this->watch->endSession($session, 'displaced_detected');

                return response()->json([
                    'success' => false,
                    'message' => 'Sesiunea a fost preluată de un alt dispozitiv.',
                    'data'    => [
                        'reason'  => 'DISPLACED_BY_NEW_SESSION',
                        'strikes' => $user->strikes,
                    ],
                ], 403);
            }
        }

        $session->update(['last_heartbeat_at' => now()]);

        // Opportunistically save progress when the player sends current position
        $this->watch->maybeSaveProgress(
            $user,
            $video,
            $request->input('current_time_seconds'),
        );

        return response()->json([
            'success' => true,
            'message' => 'Sesiunea de vizionare este activă.',
            'data'    => [
                'watch_session_id'  => $session->id,
                'last_heartbeat_at' => now()->toIso8601String(),
            ],
        ]);
    }

    // ─── POST /api/user/videos/{video}/watch-session/end ─────────────────────

    public function end(WatchSessionEndRequest $request, CourseVideo $video): JsonResponse
    {
        $user        = $request->user();
        $userSession = $request->attributes->get('user_session');

        $session = $this->watch->resolveSession($request->watch_session_id, $user, $video);

        if (! $session) {
            return response()->json([
                'success' => false,
                'message' => 'Sesiunea de vizionare nu a fost găsită sau nu mai este activă.',
            ], 404);
        }

        if (! $this->watch->belongsToCurrentDevice($session, $userSession)) {
            return response()->json([
                'success' => false,
                'message' => 'Sesiunea nu aparține dispozitivului curent.',
            ], 403);
        }

        $reason = $request->input('ended_reason', 'user_exit');
        $this->watch->endSession($session, $reason);

        // Save final progress if caller sends position + duration
        $this->watch->maybeSaveProgress(
            $user,
            $video,
            $request->input('current_time_seconds'),
            $request->input('duration_seconds'),
        );

        $this->watch->log($video, $user, $userSession, 'watch_end', $request->input('current_time_seconds'), [
            'watch_session_id' => $session->id,
            'ended_reason'     => $reason,
        ]);

        return response()->json([
            'success' => true,
            'message' => 'Sesiunea de vizionare a fost încheiată.',
            'data'    => [
                'watch_session_id' => $session->id,
                'ended_reason'     => $reason,
            ],
        ]);
    }
}
