<?php

namespace App\Providers;

use App\Contracts\VideoProviderInterface;
use App\Services\VideoProviders\BunnyStreamProvider;
use App\Services\VideoProviders\CloudflareStreamProvider;
use Illuminate\Cache\RateLimiting\Limit;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\RateLimiter;
use Illuminate\Support\ServiceProvider;

class AppServiceProvider extends ServiceProvider
{
    public function register(): void
    {
        // Bind VideoProviderInterface to the provider selected in VIDEO_PROVIDER env var.
        // Adding a new provider: create a class in App\Services\VideoProviders, add a case here.
        $this->app->bind(VideoProviderInterface::class, function () {
            return match (config('services.video.provider', 'cloudflare')) {
                'bunny'  => new BunnyStreamProvider(),
                default  => new CloudflareStreamProvider(),
            };
        });
    }

    public function boot(): void
    {
        $this->configureRateLimiters();
    }

    private function configureRateLimiters(): void
    {
        // Login: 10 attempts per minute per IP (DB-level block handles per-account)
        RateLimiter::for('login', function (Request $request) {
            return Limit::perMinute(10)->by($request->ip());
        });

        // Registration: 5 attempts per minute per IP
        RateLimiter::for('register', function (Request $request) {
            return Limit::perMinute(5)->by($request->ip());
        });

        // Email code verification: 10 attempts per minute per email+IP
        RateLimiter::for('verify-code', function (Request $request) {
            $key = $request->input('email', '') . '|' . $request->ip();
            return Limit::perMinute(10)->by($key);
        });

        // Resend code: 3 attempts per 10 minutes per email+IP
        RateLimiter::for('resend-code', function (Request $request) {
            $key = $request->input('email', '') . '|' . $request->ip();
            return Limit::perMinutes(10, 3)->by($key);
        });

        // Forgot password: 3 requests per 10 minutes per email+IP
        RateLimiter::for('forgot-password', function (Request $request) {
            $key = $request->input('email', '') . '|' . $request->ip();
            return Limit::perMinutes(10, 3)->by($key);
        });

        // Reset password: 5 attempts per minute per IP
        RateLimiter::for('reset-password', function (Request $request) {
            return Limit::perMinute(5)->by($request->ip());
        });

        // Change password (authenticated): 5 attempts per minute per user ID
        RateLimiter::for('change-password', function (Request $request) {
            $key = $request->user()?->id ?? $request->ip();
            return Limit::perMinute(5)->by($key);
        });

        // Request email change: 3 attempts per 10 minutes per user ID
        RateLimiter::for('request-email-change', function (Request $request) {
            $key = $request->user()?->id ?? $request->ip();
            return Limit::perMinutes(10, 3)->by($key);
        });

        // Confirm email change: 10 attempts per minute per user ID
        RateLimiter::for('confirm-email-change', function (Request $request) {
            $key = $request->user()?->id ?? $request->ip();
            return Limit::perMinute(10)->by($key);
        });

        // Delete account: 3 attempts per 10 minutes per user ID
        RateLimiter::for('delete-account', function (Request $request) {
            $key = $request->user()?->id ?? $request->ip();
            return Limit::perMinutes(10, 3)->by($key);
        });

        // Video playback metadata: 30 requests per minute per user/IP.
        // Prevents token farming and video-ID enumeration.
        RateLimiter::for('video-playback', function (Request $request) {
            $key = ($request->user('sanctum')?->id ?? '') . '|' . $request->ip();
            return Limit::perMinute(30)->by($key);
        });

        // Token refresh: 20 refreshes per minute per user.
        // Legitimate use: 1 refresh per ~90 s. 20/min is generous headroom; burst abuse flagged by anomaly service.
        RateLimiter::for('video-token-refresh', function (Request $request) {
            $key = ($request->user()?->id ?? '') . '|' . $request->ip();
            return Limit::perMinute(20)->by($key);
        });

        // Community post creation: 5 posts per 10 minutes per user+course.
        RateLimiter::for('community-post', function (Request $request) {
            $key = ($request->user()?->id ?? $request->ip()) . '|' . $request->route('slug');
            return Limit::perMinutes(10, 5)->by($key);
        });

        // Community reply creation: 10 replies per 10 minutes per user+course.
        RateLimiter::for('community-reply', function (Request $request) {
            $key = ($request->user()?->id ?? $request->ip()) . '|' . $request->route('slug');
            return Limit::perMinutes(10, 10)->by($key);
        });
    }
}
