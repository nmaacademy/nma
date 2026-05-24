<?php

namespace App\Services;

use App\Models\VideoAnomalyLog;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Cache;

/**
 * Detects and logs suspicious video access patterns.
 *
 * Policy (per user decision): log everything, never auto-suspend.
 * Admin dashboard reads video_anomaly_logs grouped by user_id.
 *
 * Anomaly types:
 *   ua_mismatch             — User-Agent changed between watch session start and token refresh
 *   ip_change               — IP changed between watch session start and token refresh
 *   rapid_token_refresh     — More than 10 token refreshes in 60 seconds for same user+video
 *   seek_burst              — More than 15 seek events in 30 seconds (script-like behaviour)
 *   watch_conflict_attempt  — Another device tried to start a watch session while one was active
 *
 * All writes are wrapped in try/catch — anomaly logging must never interrupt the main flow.
 */
class VideoAnomalyService
{
    // ─── Rapid token refresh ──────────────────────────────────────────────────

    private const REFRESH_WINDOW_SECONDS = 60;
    private const REFRESH_MAX_COUNT      = 10;

    /**
     * Increments a per-user+video counter and logs an anomaly when the threshold is exceeded.
     * Uses Cache (not DB) for the counter — fast, no schema changes needed.
     * Counter TTL matches the detection window, so it auto-resets.
     */
    public function checkRapidTokenRefresh(
        int     $userId,
        int     $videoId,
        int     $watchSessionId,
        Request $request,
    ): void {
        try {
            $cacheKey = "token_refresh:{$userId}:{$videoId}";
            $count    = (int) Cache::get($cacheKey, 0) + 1;
            Cache::put($cacheKey, $count, self::REFRESH_WINDOW_SECONDS);

            if ($count === self::REFRESH_MAX_COUNT) {
                // Log once when threshold is first hit (not on every subsequent request).
                $this->log(
                    userId:         $userId,
                    videoId:        $videoId,
                    watchSessionId: $watchSessionId,
                    userSessionId:  null,
                    anomalyType:    'rapid_token_refresh',
                    reason:         "Token refreshed {$count} times in " . self::REFRESH_WINDOW_SECONDS . " seconds",
                    details:        [
                        'refresh_count'    => $count,
                        'window_seconds'   => self::REFRESH_WINDOW_SECONDS,
                        'threshold'        => self::REFRESH_MAX_COUNT,
                        'watch_session_id' => $watchSessionId,
                    ],
                    request: $request,
                );
            }
        } catch (\Throwable) {
            // Anomaly logging must never interrupt the main request.
        }
    }

    // ─── Seek burst ───────────────────────────────────────────────────────────

    private const SEEK_WINDOW_SECONDS = 30;
    private const SEEK_MAX_COUNT      = 15;

    /**
     * Checks for script-like rapid seeking behaviour.
     * Called from VideoEventController when a 'seek' event arrives.
     */
    public function checkSeekBurst(
        int     $userId,
        int     $videoId,
        ?int    $watchSessionId,
        Request $request,
    ): void {
        try {
            $cacheKey  = "seek_burst:{$userId}:{$videoId}";
            $seekCount = (int) Cache::get($cacheKey, 0) + 1;
            Cache::put($cacheKey, $seekCount, self::SEEK_WINDOW_SECONDS);

            if ($seekCount === self::SEEK_MAX_COUNT) {
                $this->log(
                    userId:         $userId,
                    videoId:        $videoId,
                    watchSessionId: $watchSessionId,
                    userSessionId:  null,
                    anomalyType:    'seek_burst',
                    reason:         "Seek event #{$seekCount} in " . self::SEEK_WINDOW_SECONDS . " seconds — possible script",
                    details:        [
                        'seek_count'       => $seekCount,
                        'window_seconds'   => self::SEEK_WINDOW_SECONDS,
                        'threshold'        => self::SEEK_MAX_COUNT,
                        'watch_session_id' => $watchSessionId,
                    ],
                    request: $request,
                );
            }
        } catch (\Throwable) {
            //
        }
    }

    // ─── Watch conflict attempt ───────────────────────────────────────────────

    /**
     * Logs when a second device attempted to start a watch session while another was active.
     */
    public function logWatchConflict(
        int     $userId,
        int     $videoId,
        int     $conflictingWatchSessionId,
        ?int    $userSessionId,
        Request $request,
    ): void {
        try {
            $this->log(
                userId:         $userId,
                videoId:        $videoId,
                watchSessionId: $conflictingWatchSessionId,
                userSessionId:  $userSessionId,
                anomalyType:    'watch_conflict_attempt',
                reason:         'Another device attempted to start a watch session while one was active',
                details:        [
                    'conflicting_watch_session_id' => $conflictingWatchSessionId,
                ],
                request: $request,
            );
        } catch (\Throwable) {
            //
        }
    }

    // ─── Generic log entry ────────────────────────────────────────────────────

    /**
     * Writes a single anomaly log row.
     * Silently swallows exceptions — must never interrupt the main request flow.
     */
    public function log(
        int     $userId,
        ?int    $videoId,
        ?int    $watchSessionId,
        ?int    $userSessionId,
        string  $anomalyType,
        string  $reason,
        array   $details,
        Request $request,
    ): void {
        try {
            VideoAnomalyLog::create([
                'user_id'          => $userId,
                'video_id'         => $videoId,
                'watch_session_id' => $watchSessionId,
                'user_session_id'  => $userSessionId,
                'anomaly_type'     => $anomalyType,
                'reason'           => $reason,
                'details'          => $details ?: null,
                'ip_address'       => $request->ip(),
                'user_agent'       => $request->userAgent(),
            ]);
        } catch (\Throwable) {
            //
        }
    }
}
