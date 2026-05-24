<?php

namespace App\Http\Controllers\Api\Course;

use App\Contracts\VideoProviderInterface;
use App\Http\Controllers\Controller;
use App\Models\CourseVideo;
use App\Models\UserVideoProgress;
use App\Models\VideoWatchSession;
use App\Services\CourseAccessService;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;

/**
 * GET /api/videos/{video}/playback
 *
 * Optionally authenticated (no auth middleware on this route).
 * Sanctum resolves the Bearer token when present; $request->user('sanctum') returns
 * null for unauthenticated requests without throwing a 401 automatically.
 *
 * Access rules:
 *   Free preview video  → anyone may request playback metadata.
 *                         Authenticated users also receive progress/resume data.
 *   Paid video          → requires a valid Sanctum token (401 if absent)
 *                         AND active course access (403 if missing).
 *
 * Token coupling (signed mode only):
 *   When the active video provider has signing enabled, paid videos also require
 *   a valid `watch_session_id` query parameter.  Without it the response returns
 *   type=requires_watch_session (url=null) so the frontend knows to start a
 *   watch session first, then re-request with the session ID.
 *   In development mode this coupling is skipped — the placeholder URL is returned
 *   unconditionally (no real content to protect).
 */
class VideoPlaybackController extends Controller
{
    public function __construct(
        private readonly VideoProviderInterface $videoProvider,
        private readonly CourseAccessService    $access,
    ) {}

    // ─── GET /api/videos/{video}/playback ─────────────────────────────────────

    public function show(Request $request, CourseVideo $video): JsonResponse
    {
        $video->loadMissing('category', 'course');

        $isFreePreview = $video->category->is_free_preview;
        $user          = $request->user('sanctum');

        // ── 1. Access gate ──────────────────────────────────────────────────────

        $userHasCourseAccess = false;

        if ($isFreePreview) {
            if ($user !== null) {
                $userHasCourseAccess = $this->access->userHasActiveCourseAccess($user, $video->course);
            }
        } else {
            if ($user === null) {
                return response()->json([
                    'success' => false,
                    'message' => 'Autentificarea este necesară pentru acest video.',
                ], 401);
            }

            $userHasCourseAccess = $this->access->userHasActiveCourseAccess($user, $video->course);

            if (! $userHasCourseAccess) {
                return response()->json([
                    'success' => false,
                    'message' => 'Nu ai acces la acest video.',
                ], 403);
            }
        }

        // ── 2. Build provider context for token generation ──────────────────────

        $context = $this->buildProviderContext($request, $user);

        // ── 3. Playback data (includes token in signed mode when session present) ─

        $playbackData = $this->videoProvider->buildPlaybackData($video, $context);

        // ── 4. Progress / resume data (authenticated users only) ───────────────

        $progress = null;

        if ($user !== null) {
            $record = UserVideoProgress::where('user_id', $user->id)
                ->where('video_id', $video->id)
                ->first();

            $progress = $record
                ? [
                    'last_position_seconds' => (int)   $record->last_position_seconds,
                    'progress_percent'      => (float) $record->progress_percent,
                    'is_completed'          => (bool)  $record->is_completed,
                    'last_watched_at'       => $record->last_watched_at?->toIso8601String(),
                ]
                : [
                    'last_position_seconds' => 0,
                    'progress_percent'      => 0.0,
                    'is_completed'          => false,
                    'last_watched_at'       => null,
                ];
        }

        // ── 5. Response ─────────────────────────────────────────────────────────

        return response()->json([
            'success' => true,
            'message' => 'Acces video permis.',
            'data'    => [
                'video'    => [
                    'id'               => $video->id,
                    'title'            => $video->title,
                    'duration_seconds' => $video->duration_seconds,
                    'thumbnail_url'    => $video->cloudflare_thumbnail_url,
                    // Video UID intentionally omitted from the response — it is an internal
                    // asset identifier that should not be exposed to clients.
                ],
                'playback' => $playbackData,
                'access'   => [
                    'is_free_preview'        => $isFreePreview,
                    'user_has_course_access' => $userHasCourseAccess,
                    'requires_purchase'      => ! $isFreePreview && ! $userHasCourseAccess,
                ],
                'progress' => $progress,
            ],
        ]);
    }

    // ─── Helpers ─────────────────────────────────────────────────────────────

    /**
     * Builds the context array passed to the video provider for token generation.
     *
     * watch_session_id: resolved from the `watch_session_id` query parameter.
     *   Only used when signing is enabled.  The session must belong to the authenticated
     *   user and the given video — if it does not, it is silently ignored (the provider
     *   will return type=requires_watch_session and the frontend will start a real session).
     *
     * ua_hash: SHA-256 of the raw User-Agent string, used as a device-binding signal
     *   in the token's custom claims.  Not used for admission — just for anomaly detection
     *   context when the token is later refreshed.
     */
    private function buildProviderContext(Request $request, $user): array
    {
        $watchSessionId = null;

        if ($user !== null && $this->videoProvider->isSigningEnabled()) {
            $rawSessionId = $request->query('watch_session_id');

            if ($rawSessionId !== null && ctype_digit((string) $rawSessionId)) {
                $session = VideoWatchSession::where('id', (int) $rawSessionId)
                    ->where('user_id', $user->id)
                    ->where('is_active', true)
                    ->first();

                $watchSessionId = $session?->id;
            }
        }

        return [
            'user_id'          => $user?->id,
            'watch_session_id' => $watchSessionId,
            'ua_hash'          => hash('sha256', $request->userAgent() ?? ''),
        ];
    }
}
