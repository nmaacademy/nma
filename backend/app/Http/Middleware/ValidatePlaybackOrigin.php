<?php

namespace App\Http\Middleware;

use Closure;
use Illuminate\Http\Request;
use Symfony\Component\HttpFoundation\Response;

/**
 * Validates that playback-related API requests originate from the official frontend.
 *
 * Checks the Referer or Origin header against FRONTEND_URL (.env).
 * Requests without either header are allowed (many browsers strip Referer, and
 * legitimate mobile/native clients may not send Origin).
 * Requests with a header that clearly comes from a different origin are rejected.
 *
 * NOTE — CDN-level Referer restriction:
 *   For the actual HLS segments and manifests served by Cloudflare Stream or Bunny Stream,
 *   configure Referer/hotlink protection in their respective dashboards:
 *   - Cloudflare Stream: Stream → Videos → Delivery → Allowed Origins
 *   - Bunny Stream: CDN Pull Zone → Security → Allowed Referers
 *   This middleware only protects our Laravel API endpoints (token issuance/refresh).
 */
class ValidatePlaybackOrigin
{
    public function handle(Request $request, Closure $next): Response
    {
        $frontendUrl = rtrim(config('app.frontend_url', env('FRONTEND_URL', '')), '/');

        if (empty($frontendUrl)) {
            return $next($request);
        }

        $header = $request->header('Origin') ?? $request->header('Referer');

        if ($header === null) {
            // No header present — allow. Browser may have stripped it (privacy settings,
            // HTTPS→HTTP downgrade, same-site navigation). Blocking would break legitimate use.
            return $next($request);
        }

        $parsedFrontend = parse_url($frontendUrl);
        $parsedHeader   = parse_url($header);

        $frontendOrigin = ($parsedFrontend['scheme'] ?? '') . '://' . ($parsedFrontend['host'] ?? '');
        if (isset($parsedFrontend['port'])) {
            $frontendOrigin .= ':' . $parsedFrontend['port'];
        }

        $requestOrigin = ($parsedHeader['scheme'] ?? '') . '://' . ($parsedHeader['host'] ?? '');
        if (isset($parsedHeader['port'])) {
            $requestOrigin .= ':' . $parsedHeader['port'];
        }

        if (strtolower($requestOrigin) !== strtolower($frontendOrigin)) {
            return response()->json([
                'success' => false,
                'message' => 'Cerere respinsă: origine neautorizată.',
            ], 403);
        }

        return $next($request);
    }
}
