<?php

namespace App\Services\VideoProviders;

use App\Contracts\VideoProviderInterface;
use App\Models\CourseVideo;

/**
 * Bunny Stream (bunny.net) signed-URL provider.
 *
 * Bunny Stream uses HMAC-SHA256 token authentication on their CDN edge.
 * This is the recommended provider after the first paying customer, offering
 * significant cost savings over Cloudflare Stream at scale.
 *
 * Required env vars:
 *   VIDEO_PROVIDER=bunny
 *   BUNNY_STREAM_LIBRARY_ID          (integer)
 *   BUNNY_STREAM_API_KEY             (REST API key — for upload/management only)
 *   BUNNY_STREAM_TOKEN_KEY           (CDN security token key — for URL signing)
 *   BUNNY_STREAM_CDN_HOSTNAME        (e.g. vz-abc123.b-cdn.net)
 *   BUNNY_STREAM_SIGNED_URL_TTL_SECONDS (default 120)
 *
 * Token formula (Bunny CDN token authentication v2):
 *   hashableBase = SecurityKey + CDNPath + ExpirationTimestamp
 *   token = base64url( HMAC-SHA256(SecurityKey, hashableBase) )
 *   URL   = https://{cdn_hostname}/{videoGuid}/playlist.m3u8?token={token}&expires={expiry}
 *
 * Reference: https://support.bunny.net/hc/en-us/articles/360016055099
 *
 * IMPORTANT: Verify the exact token formula against Bunny's current docs before going live.
 * The formula above matches the documented v2 token authentication as of 2026.
 */
class BunnyStreamProvider implements VideoProviderInterface
{
    private readonly bool   $signingEnabled;
    private readonly string $tokenKey;
    private readonly string $cdnHostname;
    private readonly string $libraryId;
    private readonly int    $ttlSeconds;

    public function __construct()
    {
        $this->tokenKey    = (string) config('services.bunny_stream.token_key', '');
        $this->cdnHostname = (string) config('services.bunny_stream.cdn_hostname', '');
        $this->libraryId   = (string) config('services.bunny_stream.library_id', '');
        $this->ttlSeconds  = (int)    config('services.bunny_stream.signed_url_ttl_seconds', 120);

        $this->signingEnabled = $this->tokenKey !== '' && $this->cdnHostname !== '';
    }

    // ─── VideoProviderInterface ───────────────────────────────────────────────

    public function isSigningEnabled(): bool
    {
        return $this->signingEnabled;
    }

    public function tokenTtlSeconds(): int
    {
        return $this->ttlSeconds;
    }

    /**
     * Builds the playback block for the API response.
     *
     * Context:
     *   watch_session_id (int|null) — required when signing is enabled.
     *   ua_hash          (string|null)
     */
    public function buildPlaybackData(CourseVideo $video, array $context = []): array
    {
        if (! $this->signingEnabled) {
            return $this->devPlaybackData($video);
        }

        $watchSessionId = $context['watch_session_id'] ?? null;

        if ($watchSessionId === null) {
            return [
                'provider'              => 'bunny_stream',
                'type'                  => 'requires_watch_session',
                'url'                   => null,
                'expires_at'            => null,
                'token_ttl_seconds'     => $this->ttlSeconds,
                'refresh_at_seconds'    => (int) ($this->ttlSeconds * 0.75),
            ];
        }

        return $this->signedPlaybackData($video);
    }

    // ─── Development mode ─────────────────────────────────────────────────────

    private function devPlaybackData(CourseVideo $video): array
    {
        return [
            'provider'   => 'bunny_stream',
            'type'       => 'development',
            'url'        => $video->cloudflare_playback_url, // reuse stored URL field
            'expires_at' => null,
        ];
    }

    // ─── Signed mode ──────────────────────────────────────────────────────────

    private function signedPlaybackData(CourseVideo $video): array
    {
        $videoGuid = $video->cloudflare_video_uid; // same DB column, different provider's GUID
        $expiresAt = now()->addSeconds($this->ttlSeconds);
        $expires   = $expiresAt->timestamp;

        // CDN path that Bunny will serve the HLS manifest from.
        $path = "/{$videoGuid}/playlist.m3u8";

        $token = $this->generateToken($path, $expires);

        $url = "https://{$this->cdnHostname}{$path}?token={$token}&expires={$expires}";

        return [
            'provider'           => 'bunny_stream',
            'type'               => 'signed',
            'url'                => $url,
            'expires_at'         => $expiresAt->toIso8601String(),
            'token_ttl_seconds'  => $this->ttlSeconds,
            'refresh_at_seconds' => (int) ($this->ttlSeconds * 0.75),
        ];
    }

    /**
     * Bunny CDN token formula (v2):
     *   hashableBase = SecurityKey + CDNPath + ExpirationTimestamp
     *   token = base64url( HMAC-SHA256(SecurityKey, hashableBase) )
     */
    private function generateToken(string $cdnPath, int $expires): string
    {
        $hashable = $this->tokenKey . $cdnPath . $expires;
        $raw      = hash_hmac('sha256', $hashable, $this->tokenKey, binary: true);

        return rtrim(strtr(base64_encode($raw), '+/', '-_'), '=');
    }
}
