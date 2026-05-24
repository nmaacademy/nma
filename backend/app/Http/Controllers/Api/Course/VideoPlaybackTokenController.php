<?php

namespace App\Http\Controllers\Api\Course;

use App\Contracts\VideoProviderInterface;
use App\Http\Controllers\Controller;
use App\Models\CourseVideo;
use App\Models\VideoWatchSession;
use App\Services\CourseAccessService;
use App\Services\VideoAnomalyService;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;

/**
 * POST /api/user/videos/{video}/playback-token/refresh
 *
 * Issues a fresh signed playback token for an active watch session.
 * The frontend calls this automatically at ~75% of the token TTL (≈90 s for 120 s tokens)
 * so playback continues uninterrupted.
 *
 * Validation:
 *   - User must be authenticated (auth:sanctum middleware)
 *   - watch_session_id must be provided and belong to the authenticated user
 *   - The watch session must be currently active
 *   - The user must still have active course access
 *
 * When signing is not enabled (dev mode), returns a 200 with type=development
 * so the frontend doesn't need to branch on signing status.
 */
class VideoPlaybackTokenController extends Controller
{
    public function __construct(
        private readonly VideoProviderInterface $videoProvider,
        private readonly CourseAccessService    $access,
        private readonly VideoAnomalyService    $anomaly,
    ) {}

    // ─── POST /api/user/videos/{video}/playback-token/refresh ────────────────

    public function refresh(Request $request, CourseVideo $video): JsonResponse
    {
        $video->loadMissing('category', 'course');

        $user        = $request->user();
        $userSession = $request->attributes->get('user_session');

        // ── 1. Validate request body ────────────────────────────────────────────

        $validated = $request->validate([
            'watch_session_id' => ['required', 'integer', 'min:1'],
        ]);

        $watchSessionId = (int) $validated['watch_session_id'];

        // ── 2. Resolve and validate watch session ───────────────────────────────

        $watchSession = VideoWatchSession::where('id', $watchSessionId)
            ->where('user_id', $user->id)
            ->where('video_id', $video->id)
            ->where('is_active', true)
            ->first();

        if (! $watchSession) {
            return response()->json([
                'success' => false,
                'message' => 'Sesiunea de vizionare nu este activă sau nu îți aparține.',
            ], 404);
        }

        // ── 3. Access re-check (course access may have been revoked) ────────────

        if (! $video->category->is_free_preview) {
            if (! $this->access->userHasActiveCourseAccess($user, $video->course)) {
                return response()->json([
                    'success' => false,
                    'message' => 'Accesul la curs a expirat.',
                ], 403);
            }
        }

        // ── 4. UA mismatch anomaly check ────────────────────────────────────────

        $currentUaHash = hash('sha256', $request->userAgent() ?? '');
        $sessionUaHash = hash('sha256', $watchSession->user_agent ?? '');

        if ($currentUaHash !== $sessionUaHash) {
            $this->anomaly->log(
                userId:         $user->id,
                videoId:        $video->id,
                watchSessionId: $watchSession->id,
                userSessionId:  $userSession?->id,
                anomalyType:    'ua_mismatch',
                reason:         'User-Agent changed between watch session start and token refresh',
                details:        [
                    'session_ua_hash'  => $sessionUaHash,
                    'request_ua_hash'  => $currentUaHash,
                    'watch_session_id' => $watchSession->id,
                ],
                request: $request,
            );
            // We do not block — log only, as per configuration decision.
        }

        // ── 5. IP change anomaly check ──────────────────────────────────────────

        if ($watchSession->ip_address && $watchSession->ip_address !== $request->ip()) {
            $this->anomaly->log(
                userId:         $user->id,
                videoId:        $video->id,
                watchSessionId: $watchSession->id,
                userSessionId:  $userSession?->id,
                anomalyType:    'ip_change',
                reason:         'IP address changed between watch session start and token refresh',
                details:        [
                    'session_ip'  => $watchSession->ip_address,
                    'request_ip'  => $request->ip(),
                    'watch_session_id' => $watchSession->id,
                ],
                request: $request,
            );
        }

        // ── 6. Rapid refresh anomaly check ──────────────────────────────────────

        $this->anomaly->checkRapidTokenRefresh($user->id, $video->id, $watchSession->id, $request);

        // ── 7. Issue new token ──────────────────────────────────────────────────

        $context = [
            'user_id'          => $user->id,
            'watch_session_id' => $watchSession->id,
            'ua_hash'          => $currentUaHash,
        ];

        $playbackData = $this->videoProvider->buildPlaybackData($video, $context);

        return response()->json([
            'success' => true,
            'message' => 'Token de redare reînnoit.',
            'data'    => [
                'playback' => $playbackData,
            ],
        ]);
    }
}
