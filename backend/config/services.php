<?php

return [

    /*
    |--------------------------------------------------------------------------
    | Third Party Services
    |--------------------------------------------------------------------------
    |
    | This file is for storing the credentials for third party services such
    | as Mailgun, Postmark, AWS and more. This file provides the de facto
    | location for this type of information, allowing packages to have
    | a conventional file to locate the various service credentials.
    |
    */

    'postmark' => [
        'key' => env('POSTMARK_API_KEY'),
    ],

    'resend' => [
        'key' => env('RESEND_API_KEY'),
    ],

    'ses' => [
        'key' => env('AWS_ACCESS_KEY_ID'),
        'secret' => env('AWS_SECRET_ACCESS_KEY'),
        'region' => env('AWS_DEFAULT_REGION', 'us-east-1'),
    ],

    'slack' => [
        'notifications' => [
            'bot_user_oauth_token' => env('SLACK_BOT_USER_OAUTH_TOKEN'),
            'channel' => env('SLACK_BOT_USER_DEFAULT_CHANNEL'),
        ],
    ],

    // ─── Video provider selection ─────────────────────────────────────────────
    // Set VIDEO_PROVIDER=cloudflare (default) or VIDEO_PROVIDER=bunny.
    // Switching the env var is sufficient to migrate providers at runtime.
    'video' => [
        'provider' => env('VIDEO_PROVIDER', 'cloudflare'),
    ],

    // ─── Cloudflare Stream ────────────────────────────────────────────────────
    'cloudflare_stream' => [
        'account_id'          => env('CLOUDFLARE_ACCOUNT_ID'),
        'signing_key_id'      => env('CLOUDFLARE_STREAM_SIGNING_KEY_ID'),
        // Base64-encoded RSA private key. Generate: openssl genrsa | base64
        // then register the matching public key in the Cloudflare Stream dashboard.
        'signing_private_key' => env('CLOUDFLARE_STREAM_SIGNING_PRIVATE_KEY'),
        // Default 120 s (2 min). Frontend refreshes at 75% of this value (≈90 s).
        'signed_url_ttl_seconds' => (int) env('CLOUDFLARE_STREAM_SIGNED_URL_TTL_SECONDS', 120),
    ],

    // ─── Bunny Stream ─────────────────────────────────────────────────────────
    // Required when VIDEO_PROVIDER=bunny.
    // Verify the token formula against Bunny's current docs before going live.
    'bunny_stream' => [
        'library_id'             => env('BUNNY_STREAM_LIBRARY_ID'),
        'api_key'                => env('BUNNY_STREAM_API_KEY'),        // management API
        'token_key'              => env('BUNNY_STREAM_TOKEN_KEY'),      // CDN URL signing key
        'cdn_hostname'           => env('BUNNY_STREAM_CDN_HOSTNAME'),   // e.g. vz-abc.b-cdn.net
        'signed_url_ttl_seconds' => (int) env('BUNNY_STREAM_SIGNED_URL_TTL_SECONDS', 120),
    ],

    // Netopia Payments API V2.
    'netopia' => [
        'api_key'             => env('NETOPIA_API_KEY'),
        'signature'           => env('NETOPIA_SIGNATURE'),
        'start_endpoint'      => env('NETOPIA_START_ENDPOINT', 'https://secure.sandbox.netopia-payments.com/payment/card/start'),
    ],

];
