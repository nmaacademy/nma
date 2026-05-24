<?php

use App\Http\Controllers\Api\Auth\AuthController;
use App\Http\Controllers\Api\Auth\PasswordResetController;
use App\Http\Controllers\Api\Admin\AdminAnnouncementController;
use App\Http\Controllers\Api\Admin\AdminCourseController;
use App\Http\Controllers\Api\Admin\AdminDashboardController;
use App\Http\Controllers\Api\Course\PublicCourseController;
use App\Http\Controllers\Api\Course\UserCourseController;
use App\Http\Controllers\Api\Course\VideoEventController;
use App\Http\Controllers\Api\Course\VideoPlaybackController;
use App\Http\Controllers\Api\Course\VideoPlaybackTokenController;
use App\Http\Controllers\Api\Course\VideoProgressController;
use App\Http\Controllers\Api\Course\CourseMembersController;
use App\Http\Controllers\Api\Course\CommunityPostController;
use App\Http\Controllers\Api\Course\CommunityReplyController;
use App\Http\Controllers\Api\Course\CourseAnnouncementController;
use App\Http\Controllers\Api\Course\CourseLeaderboardController;
use App\Http\Controllers\Api\Course\WatchSessionController;
use App\Http\Controllers\Api\Payment\NetopiaReturnController;
use App\Http\Controllers\Api\Payment\NetopiaWebhookController;
use App\Http\Controllers\Api\Payment\PaymentController;
use App\Http\Controllers\Api\User\EmailChangeController;
use App\Http\Controllers\Api\User\UserProfileController;
use App\Http\Controllers\Api\User\UserSessionController;
use Illuminate\Support\Facades\Route;

// ─── Health check ─────────────────────────────────────────────────────────────
Route::get('/health', fn () => response()->json(['status' => 'ok', 'version' => '1.0']));

// ─── Public course endpoints ──────────────────────────────────────────────────
Route::get('/courses',        [PublicCourseController::class, 'index']);
Route::get('/courses/{slug}', [PublicCourseController::class, 'show']);

// ─── Video playback access (optionally authenticated) ─────────────────────────
// Free preview videos are accessible without a token.
// Paid videos require a Bearer token + active course access (controller handles 401/403).
// Rate limited: 30 requests/min per user+IP to prevent token farming.
Route::get('/videos/{video}/playback', [VideoPlaybackController::class, 'show'])
    ->middleware(['throttle:video-playback', 'validate.playback.origin']);

Route::match(['get', 'post'], '/payments/netopia/return', NetopiaReturnController::class);
Route::post('/webhooks/netopia', NetopiaWebhookController::class);

// ─── Public auth endpoints ────────────────────────────────────────────────────
Route::prefix('auth')->group(function () {

    Route::post('/register', [AuthController::class, 'register'])
        ->middleware('throttle:register');

    Route::post('/login', [AuthController::class, 'login'])
        ->middleware('throttle:login');

    Route::post('/verify-email-code', [AuthController::class, 'verifyEmailCode'])
        ->middleware('throttle:verify-code');

    Route::post('/resend-verification-code', [AuthController::class, 'resendVerificationCode'])
        ->middleware('throttle:resend-code');

    Route::post('/forgot-password', [PasswordResetController::class, 'forgotPassword'])
        ->middleware('throttle:forgot-password');

    Route::post('/reset-password', [PasswordResetController::class, 'resetPassword'])
        ->middleware('throttle:reset-password');

});

// ─── Protected auth endpoints (token required) ────────────────────────────────
Route::middleware(['auth:sanctum', 'session.activity'])->group(function () {

    Route::post('/auth/logout', [AuthController::class, 'logout']);
    Route::get('/auth/me', [AuthController::class, 'me']);

    // ── User profile ────────────────────────────────────────────────────────
    Route::get('/user/profile',  [UserProfileController::class, 'show']);
    Route::put('/user/profile',  [UserProfileController::class, 'update']);
    Route::post('/user/change-password', [UserProfileController::class, 'changePassword'])
        ->middleware('throttle:change-password');

    // ── User sessions ────────────────────────────────────────────────────────
    Route::get('/user/sessions',        [UserSessionController::class, 'index']);
    Route::delete('/user/sessions/{id}', [UserSessionController::class, 'destroy']);

    // ── Account deletion ─────────────────────────────────────────────────────
    Route::delete('/user/account', [UserProfileController::class, 'deleteAccount'])
        ->middleware('throttle:delete-account');

    // ── Email change ─────────────────────────────────────────────────────────
    Route::post('/user/request-email-change', [EmailChangeController::class, 'request'])
        ->middleware('throttle:request-email-change');
    Route::post('/user/confirm-email-change',  [EmailChangeController::class, 'confirm'])
        ->middleware('throttle:confirm-email-change');
    Route::post('/user/cancel-email-change',   [EmailChangeController::class, 'cancel']);

    // ── User course access ────────────────────────────────────────────────────
    Route::get('/user/courses',                                  [UserCourseController::class, 'index']);
    Route::get('/user/courses/{slug}',                           [UserCourseController::class, 'show']);
    Route::post('/user/courses/{slug}/enroll-test',              [UserCourseController::class, 'enrollTest']);
    Route::get('/user/courses/{slug}/members',                   [CourseMembersController::class, 'index']);
    Route::get('/user/courses/{slug}/announcements',             [CourseAnnouncementController::class, 'index']);
    Route::get('/user/courses/{slug}/leaderboard',               [CourseLeaderboardController::class, 'index']);

    // ── Community posts ───────────────────────────────────────────────────────
    Route::get('/user/courses/{slug}/community/posts',           [CommunityPostController::class, 'index']);
    Route::post('/user/courses/{slug}/community/posts',          [CommunityPostController::class, 'store'])
        ->middleware('throttle:community-post');
    Route::get('/user/courses/{slug}/community/posts/{post}',    [CommunityPostController::class, 'show']);
    Route::delete('/user/courses/{slug}/community/posts/{post}', [CommunityPostController::class, 'destroy']);

    Route::post(
        '/user/courses/{slug}/community/posts/{post}/replies',
        [CommunityReplyController::class, 'store']
    )->middleware('throttle:community-reply');
    Route::delete(
        '/user/courses/{slug}/community/posts/{post}/replies/{reply}',
        [CommunityReplyController::class, 'destroy']
    );

    Route::post('/payments/checkout',                            [PaymentController::class, 'checkout']);
    Route::get('/payments/{orderId}/status',                     [PaymentController::class, 'status']);

    // ── Video progress ────────────────────────────────────────────────────────
    Route::post('/user/videos/{video}/progress',                 [VideoProgressController::class, 'save']);
    Route::get('/user/videos/{video}/progress',                  [VideoProgressController::class, 'show']);

    // ── Video player event log ────────────────────────────────────────────────
    Route::post('/user/videos/{video}/event',                    [VideoEventController::class, 'store']);

    // ── Video watch sessions ──────────────────────────────────────────────────
    Route::post('/user/videos/{video}/watch-session/start',      [WatchSessionController::class, 'start']);
    Route::post('/user/videos/{video}/watch-session/heartbeat',  [WatchSessionController::class, 'heartbeat']);
    Route::post('/user/videos/{video}/watch-session/end',        [WatchSessionController::class, 'end']);

    // ── Playback token refresh ────────────────────────────────────────────────
    // Called by the frontend at ~75% of the token TTL (≈90 s for 120 s tokens).
    // Rate limited: 20 refreshes/min per user — generous for legitimate use, flags abuse via anomaly service.
    Route::post('/user/videos/{video}/playback-token/refresh',   [VideoPlaybackTokenController::class, 'refresh'])
        ->middleware(['throttle:video-token-refresh', 'validate.playback.origin']);

    // â”€â”€ Admin course management â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
    Route::get('/admin/courses',                    [AdminCourseController::class, 'index']);
    Route::post('/admin/courses',                   [AdminCourseController::class, 'store']);
    Route::get('/admin/courses/{course}',           [AdminCourseController::class, 'show']);
    Route::put('/admin/courses/{course}',           [AdminCourseController::class, 'update']);
    Route::post('/admin/courses/{course}/duplicate', [AdminCourseController::class, 'duplicate']);
    Route::post('/admin/courses/{course}/archive',   [AdminCourseController::class, 'archive']);

    // ── Admin announcement management ─────────────────────────────────────────
    Route::get('/admin/courses/{course}/announcements',  [AdminAnnouncementController::class, 'index']);
    Route::post('/admin/courses/{course}/announcements', [AdminAnnouncementController::class, 'store']);
    Route::get('/admin/announcements/{announcement}',    [AdminAnnouncementController::class, 'show']);
    Route::put('/admin/announcements/{announcement}',    [AdminAnnouncementController::class, 'update']);
    Route::delete('/admin/announcements/{announcement}', [AdminAnnouncementController::class, 'destroy']);

    Route::get('/admin/stats',                       [AdminDashboardController::class, 'stats']);
    Route::get('/admin/users',                       [AdminDashboardController::class, 'users']);
    Route::get('/admin/users/{user}',                [AdminDashboardController::class, 'user']);
    Route::put('/admin/users/{user}/status',         [AdminDashboardController::class, 'updateUserStatus']);
    Route::get('/admin/leads',                       [AdminDashboardController::class, 'leads']);
    Route::post('/admin/email-campaigns',            [AdminDashboardController::class, 'sendEmailCampaign']);

});
