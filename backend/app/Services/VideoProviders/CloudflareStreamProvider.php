<?php

namespace App\Services\VideoProviders;

use App\Contracts\VideoProviderInterface;
use App\Models\CourseVideo;

/**
 * Cloudflare Stream signed-URL provider.
 *
 * Produces RS256 JWTs accepted by Cloudflare Stream's signed-URL playback.
 * Reference: https://developers.cloudflare.com/stream/viewing-videos/securing-your-stream/
 *
 * Required env vars:
 *   CLOUDFLARE_ACCOUNT_ID
 *   CLOUDFLARE_STREAM_SIGNING_KEY_ID
 *   CLOUDFLARE_STREAM_SIGNING_PRIVATE_KEY   (base64-encoded RSA private key PEM)
 *   CLOUDFLARE_STREAM_SIGNED_URL_TTL_SECONDS (default 120)
 *
 * In development (signing vars absent) the service operates in placeholder mode and
 * returns stored cloudflare_playback_url values with no signing.
 */
class CloudflareStreamProvider implements VideoProviderInterface
{
    private readonly bool   $signingEnabled;
    private readonly string $keyId;
    private readonly string $privateKey;
    private readonly int    $ttlSeconds;

    public function __construct()
    {
        $this->keyId      = (string) config('services.cloudflare_stream.signing_key_id', '');
        $this->privateKey = (string) config('services.cloudflare_stream.signing_private_key', '');
        // Default TTL: 120 s (2 minutes) — short window limits token reuse after theft.
        $this->ttlSeconds = (int) config('services.cloudflare_stream.signed_url_ttl_seconds', 120);
        $this->signingEnabled = $this->keyId !== '' && $this->privateKey !== '';
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
     *   watch_session_id (int|null) — must be present and non-null when signing is enabled.
     *                                  Without it, returns type=requires_watch_session.
     *   user_id          (int|null)
     *   ua_hash          (string|null)
     */
    public function buildPlaybackData(CourseVideo $video, array $context = []): array
    {
        if (! $this->signingEnabled) {
            return $this->devPlaybackData($video);
        }

        $watchSessionId = $context['watch_session_id'] ?? null;

        if ($watchSessionId === null) {
            // Signing enabled but no watch session yet — frontend must start a session first.
            return [
                'provider'              => 'cloudflare_stream',
                'type'                  => 'requires_watch_session',
                'url'                   => null,
                'expires_at'            => null,
                'token_ttl_seconds'     => $this->ttlSeconds,
                'refresh_at_seconds'    => (int) ($this->ttlSeconds * 0.75), // refresh at 75% of TTL
            ];
        }

        return $this->signedPlaybackData($video, $context);
    }

    // ─── Development mode ─────────────────────────────────────────────────────

    private function devPlaybackData(CourseVideo $video): array
    {
        return [
            'provider'   => 'cloudflare_stream',
            'type'       => 'development',
            'url'        => $video->cloudflare_playback_url,
            'expires_at' => null,
        ];
    }

    // ─── Signed mode ──────────────────────────────────────────────────────────

    private function signedPlaybackData(CourseVideo $video, array $context): array
    {
        $expiresAt = now()->addSeconds($this->ttlSeconds);
        $token     = $this->generateToken(
            videoUid:       $video->cloudflare_video_uid,
            expiresAt:      $expiresAt->timestamp,
            watchSessionId: $context['watch_session_id'] ?? null,
            uaHash:         $context['ua_hash'] ?? null,
        );

        $url = "https://customer-stream.cloudflarestream.com/{$token}/manifest/video.m3u8";

        return [
            'provider'           => 'cloudflare_stream',
            'type'               => 'signed',
            'url'                => $url,
            'expires_at'         => $expiresAt->toIso8601String(),
            'token_ttl_seconds'  => $this->ttlSeconds,
            'refresh_at_seconds' => (int) ($this->ttlSeconds * 0.75),
        ];
    }

    /**
     * Produces the RS256 JWT for Cloudflare Stream signed-URL playback.
     *
     * Header  : {"alg":"RS256","kid":"<key_id>"}
     * Payload : {"sub":"<video_uid>","kid":"<key_id>","exp":<ts>,"accessRules":[...],"nma":{...}}
     *
     * The `nma` custom claims are NOT validated by Cloudflare — they serve as tamper-evident
     * context for our own token refresh validation (watch session + UA binding).
     * Cloudflare validates only `sub`, `kid`, `exp`, and `accessRules`.
     */
    private function generateToken(
        string  $videoUid,
        int     $expiresAt,
        ?int    $watchSessionId,
        ?string $uaHash,
    ): string {
        $header = $this->b64url((string) json_encode([
            'alg' => 'RS256',
            'kid' => $this->keyId,
        ]));

        $payload = $this->b64url((string) json_encode(array_filter([
            'sub' => $videoUid,
            'kid' => $this->keyId,
            'exp' => $expiresAt,
            'iat' => now()->timestamp,
            'accessRules' => [
                ['type' => 'any', 'action' => 'allow'],
            ],
            // Device-binding context stored in custom claim (not Cloudflare-validated).
            'nma' => array_filter([
                'wid' => $watchSessionId,
                'uah' => $uaHash,
            ]),
        ], fn ($v) => $v !== null && $v !== [])));

        $signingInput = "{$header}.{$payload}";

        $rawKey = base64_decode($this->privateKey, strict: true);

        if ($rawKey === false) {
            throw new \RuntimeException('CLOUDFLARE_STREAM_SIGNING_PRIVATE_KEY is not valid base64.');
        }

        $pkey = openssl_pkey_get_private($rawKey);

        if ($pkey === false) {
            throw new \RuntimeException('Could not load Cloudflare Stream signing private key.');
        }

        openssl_sign($signingInput, $signature, $pkey, OPENSSL_ALGO_SHA256);

        return $signingInput . '.' . $this->b64url($signature);
    }

    private function b64url(string $data): string
    {
        return rtrim(strtr(base64_encode($data), '+/', '-_'), '=');
    }
}
