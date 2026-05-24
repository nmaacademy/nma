<?php

namespace App\Contracts;

use App\Models\CourseVideo;

/**
 * Common contract for video delivery providers.
 *
 * Switch providers by setting VIDEO_PROVIDER=cloudflare|bunny in .env.
 * AppServiceProvider binds the concrete implementation at boot time.
 *
 * Context keys recognised by all implementations:
 *   user_id          (int)         — authenticated user's ID
 *   watch_session_id (int|null)    — active watch session (required for signed tokens on paid videos)
 *   ua_hash          (string|null) — SHA-256 of the request User-Agent (device binding)
 */
interface VideoProviderInterface
{
    /**
     * Builds the `playback` block included in the video playback API response.
     *
     * In development mode (no credentials configured) implementations must return:
     *   ['provider' => '...', 'type' => 'development', 'url' => <stored_url|null>, 'expires_at' => null]
     *
     * In signed mode without a watch_session_id in context:
     *   ['provider' => '...', 'type' => 'requires_watch_session', 'url' => null, 'expires_at' => null]
     *
     * In signed mode with a valid watch_session_id:
     *   ['provider' => '...', 'type' => 'signed', 'url' => <manifest_url>, 'expires_at' => <iso8601>]
     *
     * @param CourseVideo $video
     * @param array{user_id?: int, watch_session_id?: int|null, ua_hash?: string|null} $context
     */
    public function buildPlaybackData(CourseVideo $video, array $context = []): array;

    /**
     * Returns true when the provider has valid signing credentials configured.
     * Returns false in development / placeholder mode.
     */
    public function isSigningEnabled(): bool;

    /**
     * Token TTL in seconds.  Implementations should default to 120 s.
     */
    public function tokenTtlSeconds(): int;
}
