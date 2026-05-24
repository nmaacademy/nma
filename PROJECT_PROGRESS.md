# project_progress.md — NMA Academy

## Local setup

Project type: online course platform.

Frontend:
- React
- Runs locally on `http://localhost:3000`

Backend:
- Laravel + MySQL
- Backend folder: `/backend`
- Runs locally with:

```bash
php -S 127.0.0.1:8080 -t public

Backend URL:

http://127.0.0.1:8080

Frontend API base URL:

http://127.0.0.1:8080/api

Auth system:

Laravel Sanctum Bearer token authentication
MySQL local database via MySQL Workbench
Local email testing uses MAIL_MAILER=log
Emails can be checked in backend/storage/logs/laravel.log

Important:

Do not work on admin dashboard yet.
Do not implement admin auth yet.
Do not implement admin middleware yet.
Admin will be built much later in a separate phase.
Cloudflare Stream is not configured yet. The video player currently works in development placeholder mode.
Netopia payment integration exists in code but still needs real credentials and sandbox/production testing.
Completed phases
Phase 1 — Backend foundation

Implemented:

Laravel backend in /backend
MySQL config
Laravel Sanctum
CORS for frontend
API health route
.env / .env.example
Main auth-related models and migrations

Important tables:

users
personal_access_tokens
user_sessions
email_logs
password_reset_tokens
Phase 2 — Register + email verification

Implemented:

POST /api/auth/register
POST /api/auth/verify-email-code
POST /api/auth/resend-verification-code

Behavior:

User registers with name, email, password
Password is hashed
Account starts as unverified
A 6-character uppercase verification code is generated
Code contains letters and digits
Code expires in 1 hour
Email is sent through Laravel Mail
In local dev, code appears in storage/logs/laravel.log
After verification, user becomes active

Security:

Rate limiting
Temporary blocking after too many wrong code attempts
Password rule: minimum 8 characters, one uppercase letter, one digit
Phase 3 — Login, logout, Sanctum tokens, sessions

Implemented:

POST /api/auth/login
POST /api/auth/logout
GET /api/auth/me

Behavior:

Login works from frontend
Logout works from frontend
Sanctum Bearer token is created on login
Token is deleted on logout
user_sessions records active devices
Each user_session is linked to a Sanctum token with sanctum_token_id

Session limit:

Maximum 3 active sessions/devices per user
On 4th login, the oldest active session is revoked automatically
Revoked sessions get 401 on the next protected request
Phase 4 — User profile + active devices

Implemented:

GET /api/user/profile
PUT /api/user/profile
GET /api/user/sessions
DELETE /api/user/sessions/{id}

Behavior:

User can view profile
User can update name and phone
Email is visible but not editable in this phase
User can view active sessions/devices
User can revoke another active session
If user revokes current session, frontend logs out
Phase 5 — Forgot password / reset password

Implemented:

POST /api/auth/forgot-password
POST /api/auth/reset-password

Behavior:

Uses Laravel Password Broker
Reset token expires in 60 minutes
Reset link points to frontend:
http://localhost:3000/reset-password?email=...&token=...

After password reset:

all Sanctum tokens are deleted
all user sessions are revoked

Note:

When copying reset links from laravel.log, replace &amp; with & if needed.
Phase 6 — Change password from profile

Implemented:

POST /api/user/change-password

Behavior:

Authenticated user can change password
Requires current password
New password must follow same rules
Current session stays active
All other sessions/tokens are revoked
Phase 7 — Change email with re-verification

Implemented:

POST /api/user/request-email-change
POST /api/user/confirm-email-change
POST /api/user/cancel-email-change

Behavior:

User requests email change with new email + current password
Verification code is sent to the new email
Email is changed only after code confirmation
Current email remains active until new email is verified
Code expires in 1 hour
User can cancel pending email change
Phase 8 — Delete account

Implemented:

DELETE /api/user/account

Behavior:

Uses soft delete, not hard delete
Requires current password
Requires confirmation text: DELETE
On success:
user is soft deleted
all Sanctum tokens are deleted
all user sessions are revoked
frontend clears auth state and redirects user
Deleted user cannot log in again
Courses system
Updated course architecture

Current course structure:

course → categories → subcategories → one Cloudflare Stream video per subcategory

Business rules:

The platform may have one main large course or a small number of large courses.
Each course has categories.
Each category has subcategories.
Each subcategory has one video.
One category can be free preview.
Free preview can be viewed without buying the full course.
Paid categories require active course access.
Videos will use Cloudflare Stream later.
Cloudflare Stream is not configured yet.
Protected video player is mandatory.
Real DRM / anti-screen-recording is not implemented yet.
Current protection is basic anti-abuse, watermark, access control, session control and event logging.
Phase 9.1 — Courses database foundation

Implemented database tables and models:

courses
course_categories
course_subcategories
course_videos
user_courses
user_video_progress
video_watch_sessions
video_access_logs

Relationships added:

Course → categories, subcategories, videos, userCourses
Category → course, subcategories, videos
Subcategory → course, category, video
Video → course, category, subcategory, progress
UserCourse → user, course
UserVideoProgress → user, course, category, subcategory, video
VideoWatchSession → user, course, video, userSession
VideoAccessLog → user, course, video, userSession

Important rules:

One video per subcategory
Cloudflare video fields are prepared, but no Cloudflare API integration yet
Watch session table prepared for one-device-at-a-time video watching
Progress table prepared for resume/progress tracking
Phase 9.2 — Demo course seeder + public courses API

Implemented:

Demo course seeder
GET /api/courses
GET /api/courses/{slug}

Demo course:

NMA Academy - Curs Complet
Slug: nma-academy-curs-complet
3 categories/modules
8 subcategories/lessons
8 placeholder videos
First category is free preview
Other categories are paid/locked

Important fix:

Seeder originally created subcategories/videos as draft, so lessons did not appear on site.
Fixed by making demo categories, subcategories and videos published.

Public course API:

Returns published courses
Returns course detail with categories, subcategories and video metadata
Shows locked/free states
Does not expose protected playback URLs
Phase 9.3 — Authenticated course access

Implemented:

GET /api/user/courses
GET /api/user/courses/{slug}
POST /api/user/courses/{slug}/enroll-test

Behavior:

Authenticated user can see owned/enrolled courses
User with active access sees all categories unlocked
User without access gets 403 on protected user course detail
Public course detail endpoint became auth-aware:
without token: only free preview unlocked
with token + access: all lessons unlocked

Temporary testing:

enroll-test grants local test access until Netopia payments are implemented.

Important fix:

CourseAccessService::serializeCourse() had an array/Collection type mismatch causing 500 on GET /api/user/courses/{slug}.
Fixed and endpoint now works.
Phase 9.4 — Video progress tracking

Implemented:

POST /api/user/videos/{video}/progress
GET /api/user/videos/{video}/progress

Behavior:

Saves progress per user/video
Saves:
last_position_seconds
duration_seconds
watched_seconds
progress_percent
is_completed
completed_at
last_watched_at
Auto-complete when progress reaches 90% or higher
Progress is returned in:
GET /api/user/courses
GET /api/user/courses/{slug}
Category, subcategory and video progress are included in course tree

Important behavior:

Completed videos remain rewatchable.
Completion marks progress only. It must never block replay.
is_completed = true stays true even if user rewatches from start.
Phase 9.5 — One-device-at-a-time video watching

Implemented:

POST /api/user/videos/{video}/watch-session/start
POST /api/user/videos/{video}/watch-session/heartbeat
POST /api/user/videos/{video}/watch-session/end

Behavior:

User may be logged in on multiple devices, but can actively watch video on only one device/session at a time.
Starting a watch session checks for existing active watch sessions.
If another device is watching, backend returns 409.
Stale sessions older than ~60 seconds without heartbeat can be displaced.
Heartbeat updates last_heartbeat_at.
Ending session marks:
is_active = false
ended_at
ended_reason

Progress integration:

Heartbeat/end can update video progress when position is provided.
Phase 9.6 — Protected Cloudflare Stream playback access API

Implemented:

GET /api/videos/{video}/playback

Route decision:

Public route with optional Sanctum user detection
Free preview playback metadata can be requested without login
Paid videos require authentication and active course access

Behavior:

Free preview without auth returns playback metadata and progress = null
Free preview with auth returns playback metadata + user progress
Paid video without auth returns 401
Paid video with auth but no access returns 403
Paid video with access returns playback metadata

Cloudflare:

Cloudflare Stream is not configured yet.
Development mode is active.
playback.type = development
playback.url may be null
Cloudflare signing service structure exists for future use.
No Cloudflare upload or real API calls are implemented.

Env placeholders added:

CLOUDFLARE_ACCOUNT_ID
CLOUDFLARE_STREAM_SIGNING_KEY_ID
CLOUDFLARE_STREAM_SIGNING_PRIVATE_KEY
CLOUDFLARE_STREAM_SIGNED_URL_TTL_SECONDS
Phase 9.7 — Frontend Protected Video Player UI

Implemented:

ProtectedVideoPlayer
Player integrated into public course detail page
Player integrated into authenticated course player page
/course/:slug route
My Courses navigation to /course/{slug}
videoPlaybackService
watchService

Behavior:

Free preview lesson opens inline player
Paid locked lesson shows paywall
Paid unlocked lesson opens player
Development placeholder appears when Cloudflare playback URL is not available
Manual dev controls existed for:
start session
heartbeat
end session
save sample progress

Important:

Player does not crash when Cloudflare is not configured.
Video UID and development state are shown clearly.
Paid lessons are unlocked for users with access.
Phase 9.8 — Protected player behavior, watermark, auto progress

Implemented:

Automatic watch session lifecycle
Automatic heartbeat
Automatic progress saving
Dynamic watermark
Basic player protection events
Video event logging

New endpoint:

POST /api/user/videos/{video}/event

Logged events include:

play
pause
seek
complete
right_click_blocked
visibility_hidden
shortcut_blocked
error

Frontend behavior:

Click Redă starts watch session
Progress advances automatically in development mode
Heartbeat every ~30 seconds
Progress saves every ~12 seconds
Pause saves progress and ends session
Page exit / video change ends session
Complete marks video completed
Right click inside player is blocked and logged
Tab hidden pauses/ends playback and logs event
Shortcut blocking added for basic keys like F12 / Ctrl+S / Ctrl+U / Ctrl+Shift+I
Watermark shows authenticated user name/email, or NMA Academy Preview for unauthenticated preview

Important correction:

Completed videos must remain rewatchable.
Completed videos show a message like:
Video finalizat — îl poți revedea oricând.
Replay is allowed.
Phase 9.9 — Course frontend polish

Implemented frontend polish for:

public course page
authenticated course player page
My Courses dashboard page

Public course detail page:

Module headers show lesson count, duration, free/locked counts
Free preview badge added
Paid lessons show lock/paid badge
Free preview lessons open player
Locked paid lessons show paywall panel
CTA improved to Cumpără cursul
Mobile floating CTA added
Loading and error states improved

Authenticated course player page:

Sidebar shows modules and lessons clearly
All lessons are clickable when user has access
Completed lessons show green checkmark
Current selected lesson is highlighted
Progress header added
Resume position displayed
Completed lessons remain clickable and rewatchable
Bug fixed: paid lessons were incorrectly passed as locked even for users with access

My Courses page:

Real courses displayed from API
Purchased/enrolled courses separated from available courses
CTA changes based on progress:
Începe cursul
Continuă cursul
Revizionează cursul
Loading skeletons added
Error and empty states improved
Progress bars prepared for backend progress fields

Mobile:

Course detail and player pages improved for mobile responsiveness
CTA and lesson lists are usable on small screens
Small UX fix after Phase 9.9

Requested:

When an unauthenticated visitor opens a free preview lesson and tries to play, do not show only a generic auth error.
Show a clear message:
Ai nevoie de un cont pentru a viziona preview-urile gratuite.
Add buttons:
Autentifică-te
Creează cont gratuit
Free preview lessons remain visible publicly, but actual watch/play requires account.

Phase 10.1 â€” Admin course management connected to real backend

Problem found:

Admin course pages were still using frontend mock/localStorage data.
Public course pages were using the real Laravel/MySQL API.
This created two sources of truth:
admin could show two courses while the real database/public API showed only one.

Implemented:

Laravel admin course controller:
backend/app/Http/Controllers/Api/Admin/AdminCourseController.php

New protected admin endpoints:

GET /api/admin/courses
POST /api/admin/courses
GET /api/admin/courses/{course}
PUT /api/admin/courses/{course}
POST /api/admin/courses/{course}/duplicate
POST /api/admin/courses/{course}/archive

Behavior:

Admin course management now reads and writes the real MySQL courses tables.
Admin endpoints require Sanctum auth and user role admin/superadmin.
Course create/update syncs:
course core fields
features
target_audience
results_promised
categories/modules
subcategories/lessons
one video record per lesson/subcategory

Frontend changes:

AdminRoute now uses the real authenticated user role instead of nma_admin_token.
AdminCourses now loads from /api/admin/courses.
AdminCourseForm now saves to /api/admin/courses.
Login admin demo button now logs in with the real seeded admin account instead of creating a fake localStorage token.
Admin form now includes fields for:
currency
status
public card features
target audience
promised results

Seeded admin:

admin@example.com
password

DatabaseSeeder now creates/updates:
test@example.com as a normal user
admin@example.com as an admin user

Important behavior:

Admin and public course pages now share the same backend database source.
Courses created/edited in admin appear on the public courses section when status is published.
Archived/draft courses do not appear publicly.

Important limitation:

Separate admin auth is still not implemented; admin uses the same Sanctum login as normal users, gated by role.
Cloudflare upload integration is still not implemented.

Phase 10.2 — Real admin dashboard, real admin users/leads/stats, and course-card metadata fix

Problem found:

Admin dashboard, admin users, leads, and email campaigns were still frontend mock data.
Home course preview showed 0 minutes / 0 lesson information because the public course list endpoint did not return total duration and the frontend did not map count metadata.
Admin course form list fields were trimming/filtering on every keystroke, which made Enter/new lines and some spacing feel broken.
Admin layout had hardcoded "Admin User" and "Superadmin", so it looked like both admin and superadmin were shown regardless of the real account.

Implemented:

Laravel admin dashboard controller:
backend/app/Http/Controllers/Api/Admin/AdminDashboardController.php

New protected admin endpoints:

GET /api/admin/stats
GET /api/admin/users
GET /api/admin/users/{user}
PUT /api/admin/users/{user}/status
GET /api/admin/leads
POST /api/admin/email-campaigns

Behavior:

Admin stats now read real MySQL data from users, courses, user_courses, and email_logs.
Admin users list/detail now reads real users and real course access/session/email activity.
Admin leads currently come from real users with marketing_consent = true, because there is not yet a separate leads table.
Admin email campaigns now create real email_logs rows for the selected real user segment. They do not send provider emails yet.
Admin user status can be changed between active/suspended through the real backend.

Course metadata fix:

GET /api/courses now returns:
categories_count
subcategories_count
videos_count
total_duration_seconds

Frontend course mapping now stores:
total_duration_minutes
modules_count
lessons_count

Course preview opens immediately with list metadata and then refreshes from full detail by slug, so modules/lessons/duration are real.

Admin form fix:

Feature/target/result textareas preserve new lines and spaces while typing.
The final API payload trims and removes empty lines only when saving.
Course form now also exposes short_description for public cards.

Admin layout fix:

Admin header now displays the actual authenticated user name and a single normalized Admin label.
The hardcoded Superadmin label was removed.
Logout now uses the real AuthContext logout instead of only removing nma_admin_token.

SQL / database note:

No manual SQL changes were added in this phase.
No new migration was required.
Existing tables used: users, courses, course_videos, user_courses, user_sessions, email_logs.

Implemented endpoints
Public auth
POST /api/auth/register
POST /api/auth/verify-email-code
POST /api/auth/resend-verification-code
POST /api/auth/login
POST /api/auth/forgot-password
POST /api/auth/reset-password
Protected auth
POST /api/auth/logout
GET /api/auth/me
Protected user/account
GET /api/user/profile
PUT /api/user/profile
POST /api/user/change-password
POST /api/user/request-email-change
POST /api/user/confirm-email-change
POST /api/user/cancel-email-change
GET /api/user/sessions
DELETE /api/user/sessions/{id}
DELETE /api/user/account
Public courses/video
GET /api/courses
GET /api/courses/{slug}
GET /api/videos/{video}/playback
Admin courses
GET /api/admin/courses
POST /api/admin/courses
GET /api/admin/courses/{course}
PUT /api/admin/courses/{course}
POST /api/admin/courses/{course}/duplicate
POST /api/admin/courses/{course}/archive
Admin dashboard/users/leads/email
GET /api/admin/stats
GET /api/admin/users
GET /api/admin/users/{user}
PUT /api/admin/users/{user}/status
GET /api/admin/leads
POST /api/admin/email-campaigns
Protected courses/video
GET /api/user/courses
GET /api/user/courses/{slug}
POST /api/user/courses/{slug}/enroll-test
POST /api/user/videos/{video}/progress
GET /api/user/videos/{video}/progress
POST /api/user/videos/{video}/watch-session/start
POST /api/user/videos/{video}/watch-session/heartbeat
POST /api/user/videos/{video}/watch-session/end
POST /api/user/videos/{video}/event
POST /api/user/videos/{video}/playback-token/refresh
Important issues already solved
php artisan serve did not work on default ports, so local backend is started with:
php -S 127.0.0.1:8080 -t public
Frontend runs on port 3000, not 5173.
Frontend was initially calling localhost:8000, but correct API URL is:
http://127.0.0.1:8080/api
Logout button was fixed and now calls the real logout API.
Reset password link from logs may contain &amp;; browser needs &.
Course detail endpoint had a Collection vs array mismatch and was fixed.
Course lessons were not appearing because seeded subcategories/videos had status = draft. They now need status = published.
Completed videos were initially at risk of acting like blocked/finished-only content. Correct behavior is now:
completed videos remain rewatchable.
Phase 10.4 — Video security architecture: provider abstraction + token security + anomaly detection + browser protection

Implemented:

New contract:
App\Contracts\VideoProviderInterface

New video providers:
App\Services\VideoProviders\CloudflareStreamProvider
App\Services\VideoProviders\BunnyStreamProvider

New services and models:
App\Services\VideoAnomalyService
App\Models\VideoAnomalyLog

New database table:
video_anomaly_logs

New endpoint:
POST /api/user/videos/{video}/playback-token/refresh

New env vars added to config/services.php:
VIDEO_PROVIDER (cloudflare or bunny, default cloudflare)
BUNNY_STREAM_LIBRARY_ID
BUNNY_STREAM_API_KEY
BUNNY_STREAM_TOKEN_KEY
BUNNY_STREAM_CDN_HOSTNAME
BUNNY_STREAM_SIGNED_URL_TTL_SECONDS
CLOUDFLARE_STREAM_SIGNED_URL_TTL_SECONDS default changed from 3600 to 120

Modified files:
config/services.php
app/Providers/AppServiceProvider.php
app/Http/Controllers/Api/Course/VideoPlaybackController.php
app/Http/Controllers/Api/Course/VideoPlaybackTokenController.php (new)
app/Http/Controllers/Api/Course/VideoEventController.php
app/Http/Controllers/Api/Course/WatchSessionController.php
app/Http/Requests/Course/LogVideoEventRequest.php
routes/api.php
src/services/videoPlaybackService.ts
src/components/ProtectedVideoPlayer.tsx

Provider abstraction:

VideoProviderInterface defines buildPlaybackData(video, context) and isSigningEnabled() and tokenTtlSeconds().
Switching providers requires only VIDEO_PROVIDER=bunny in .env. No code changes.
AppServiceProvider binds the interface to the correct concrete class at boot time.
CloudflareStreamProvider: RS256 JWT signing, TTL 120 seconds, watch_session_id + UA hash embedded in token claims.
BunnyStreamProvider: HMAC-SHA256 CDN token signing. Verify exact formula against Bunny docs before going live.

Token security decisions:

No IP binding (tolerant to mobile network hops).
Token bound to: user_id, watch_session_id, UA hash.
TTL: 120 seconds (2 minutes). Refresh triggered at 75% of TTL (approximately 90 seconds).
Paid video tokens require an active watch_session_id. Without it the response returns type=requires_watch_session and the frontend starts a session first.
cloudflare_video_uid removed from the playback API response for security.
Rate limiting added: GET /api/videos/{video}/playback throttled at 30 req/min per user+IP. POST /api/user/videos/{video}/playback-token/refresh throttled at 20 req/min per user.

Token refresh endpoint:

POST /api/user/videos/{video}/playback-token/refresh
Body: watch_session_id
Validates that session is active and belongs to current user.
Detects UA mismatch between session start and refresh.
Detects IP change between session start and refresh.
Checks for rapid token refresh bursts (more than 10 in 60 seconds).
All detections log to video_anomaly_logs. No auto-suspend.

Anomaly detection:

video_anomaly_logs table: user_id, video_id, watch_session_id, user_session_id, anomaly_type, reason, details (JSON), ip_address, user_agent.
Anomaly types: ua_mismatch, ip_change, rapid_token_refresh, seek_burst, watch_conflict_attempt.
Cache-based counters (no DB queries) for rapid refresh and seek burst detection.
Logging only, no automatic account suspension.
Integrated into VideoPlaybackTokenController, VideoEventController (seek burst), WatchSessionController (watch conflicts).

New video event types accepted by POST /api/user/videos/{video}/event:

watermark_moved
watermark_removed
devtools_detected
screen_capture_blocked
pip_blocked

Frontend browser protection layers in ProtectedVideoPlayer:

Screen Capture API override: navigator.mediaDevices.getDisplayMedia is overridden on mount. Chromium-based browsers block the call. Firefox and Safari do not support this API block.
DevTools detection: window dimension probe runs every 2 seconds. Outer minus inner height or width greater than 160 pixels triggers video pause and logs devtools_detected server-side. Resets after DevTools is closed.
MutationObserver on watermark: watches the player container for watermark node removal or CSS hiding (display none, visibility hidden, opacity near zero). Triggers video pause and logs watermark_removed.
Watermark text: name, email, date (YYYY-MM-DD), session ID. Example: David · david@nma.ro · 2026-05-20 · #42
Watermark position logging: every move (every 25 to 40 seconds) logs x, y, watch_session_id, and timestamp_ms to server via watermark_moved event.
Picture-in-Picture disable: disablePictureInPicture set on all video elements. MutationObserver re-applies when HLS.js adds video elements later. picture-in-picture removed from iframe allow attribute.
Token refresh loop: scheduleTokenRefresh() called automatically at refresh_at_seconds after token issuance. Transparent to the user. Reschedules after each successful refresh.
Seek events include watch_session_id in metadata for anomaly correlation.

Important behavior unchanged:

Dev mode (Cloudflare not configured): no behavioral change. Placeholder URL returned as before. Token refresh loop is a no-op in dev mode.
Watch session endpoints: not broken. Extended minimally with VideoAnomalyService injection.
Completed videos remain rewatchable.

Important limitation:

HLS.js real player integration is still not implemented.
Real DRM (Widevine, FairPlay, PlayReady) is still not implemented.
Screen capture protection works only in Chromium-based browsers.
DevTools detection is deterrence, not hard security. Determined users can bypass it.

Not implemented yet

Do not assume these exist:

Separate admin authentication
Admin middleware class
Dedicated leads table and public lead capture API
Actual email provider campaign sending
Real Cloudflare Stream configured account
Real Cloudflare upload
Real Cloudflare playback with actual video files
HLS.js real playback
DRM / real anti-screen-recording
Oblio
Newsletter
Leads / data catcher
Discount codes
Certificates
Quizzes
Comments
Reviews
Notes system
Important note about screen recording protection

Current protection includes:

VideoProviderInterface abstraction (Cloudflare and Bunny providers ready)
Signed RS256 JWT tokens (Cloudflare) or HMAC-SHA256 tokens (Bunny), TTL 120 seconds
Token coupled to active watch session (required for paid videos in signed mode)
Auto token refresh loop at 90 seconds (transparent to user)
UA hash and watch session ID embedded in token claims
Device fingerprint binding (UA hash, not IP)
Rate limiting on playback and token refresh endpoints
Backend access checks (free preview vs paid, course access)
One-device-at-a-time video watching
Video event logs (play, pause, seek, complete, visibility_hidden, right_click_blocked, shortcut_blocked, watermark_moved, watermark_removed, devtools_detected, screen_capture_blocked, pip_blocked)
video_anomaly_logs with detailed JSON per anomaly (ua_mismatch, ip_change, rapid_token_refresh, seek_burst, watch_conflict_attempt)
Dynamic watermark with name, email, date, session ID
Watermark position logged server-side on every move
MutationObserver stops video if watermark is removed or hidden from DOM
DevTools detection (dimension probe, 2-second interval)
Screen Capture API override (Chromium only)
Picture-in-Picture disabled
Right-click blocking
Keyboard shortcut blocking (F12, Ctrl+S, Ctrl+U, Ctrl+Shift+I/J/C)
Pause and session end on tab hidden

Real screen-recording protection (black screen in OBS/Windows Game Bar/Loom) requires DRM such as Widevine/FairPlay/PlayReady.
This should be implemented as a separate phase after Cloudflare/Bunny provider decisions are finalized and the first paying customers are onboarded.

Recommended next phases
Phase 10.3 — Netopia payments API foundation

Problem found:

The checkout page still used the frontend mock payment service. Clicking pay only navigated to /payment/pending and never called the backend, so no user_courses access row was activated.

Implemented:

New database tables:
payments
payment_webhook_events

New backend config env:
NETOPIA_API_KEY
NETOPIA_SIGNATURE
NETOPIA_START_ENDPOINT

New backend service:
App\Services\NetopiaPaymentService

New endpoints:
POST /api/payments/checkout
GET /api/payments/{orderId}/status
GET|POST /api/payments/netopia/return
POST /api/webhooks/netopia

Behavior:

Authenticated checkout creates a local payment row, calls Netopia /payment/card/start, and returns the hosted Netopia paymentURL to the frontend.
Frontend checkout no longer collects card fields. The user is redirected to the secure Netopia hosted payment page.
Netopia return calls backend /api/payments/netopia/return, which checks status through /operation/status and redirects back to the frontend success/pending/failed pages.
Netopia IPN/webhook is received at /api/webhooks/netopia.
Webhook processing confirms the final state server-to-server through Netopia /operation/status before unlocking.
Course access is unlocked by creating/updating user_courses only after a paid/confirmed Netopia status.
Payment status polling is available for the pending page.

Important limitation:

Sandbox end-to-end test completed successfully with Netopia redirect flow:
Netopia sent the confirmation email, the webhook arrived with Approved, the local payment was marked confirmed, and user_courses was updated to active for the purchased course.

Follow-up fix after testing:

The frontend could still show /payment/failed even when Netopia and the backend had already confirmed the payment. The failed page now re-checks GET /api/payments/{orderId}/status and redirects to success if the payment is paid/confirmed. The Netopia cancelUrl also points to /payment/pending so the frontend verifies the final backend state before showing a failure.

Remaining limitation:

Production credentials and production endpoint still need to be configured before going live. Oblio invoices are still not implemented.

Next immediate phase — Course progress summary API cleanup

Goal:

Make sure GET /api/user/courses returns:
progress_percent
completed_videos_count
total_videos_count
last_watched_at
My Courses frontend is already prepared to consume these fields.
Later phase — Checkout foundation

Goal:

Checkout structure is now implemented in Phase 10.3.
Later phase — Netopia payments

Goal:

Payment initiation, Netopia webhook handling, and course unlock after confirmed payment are now implemented in Phase 10.3.
Phase 10.5 — Anti-piracy: strike system, session displacement, CORS/Referer validation

Implemented:

New database columns (migrations run):
users.strikes — unsignedInteger, default 0
users.active_playback_session_id — string 36, nullable
video_watch_sessions.playback_session_token — char 36, nullable, indexed

New mailable:
App\Mail\AccountSharingWarningMail

New email template:
resources/views/emails/account-sharing-warning.blade.php

New middleware:
App\Http\Middleware\ValidatePlaybackOrigin (alias: validate.playback.origin)

Modified backend:
app/Models/User.php — strikes, active_playback_session_id added to fillable and casts
app/Services/WatchSessionService.php — createSession() now accepts and stores playback_session_token
app/Http/Controllers/Api/Course/WatchSessionController.php — start() and heartbeat() rewritten
app/Http/Requests/Course/WatchSessionHeartbeatRequest.php — playback_session_token field added
bootstrap/app.php — validate.playback.origin middleware alias registered
routes/api.php — validate.playback.origin applied to playback and token-refresh routes

Modified frontend:
src/services/watchService.ts — StartSessionResponse includes playback_session_token, heartbeatWatchSession sends it
src/components/ProtectedVideoPlayer.tsx — playbackTokenRef added, session_displaced status and modal

Strike system behavior:

When a new device starts a watch session while another session is already active:
- The OLD session is intentionally left active (not immediately ended).
- users.active_playback_session_id is updated to the NEW session's UUID token.
- When the OLD device sends its next heartbeat, it detects that users.active_playback_session_id no longer matches its own session token.
- The backend increments users.strikes, sends a warning email (once per 24 hours per user via Cache gate), ends the old session with ended_reason=displaced_detected, and returns 403 DISPLACED_BY_NEW_SESSION.
- The frontend pauses playback and shows a "Sesiune preluată de alt dispozitiv" modal with a "Reia pe acest dispozitiv" button.

CORS/Referer validation:

ValidatePlaybackOrigin middleware compares the Origin or Referer header against FRONTEND_URL from the config/env.
If the header is absent (browser privacy settings, native clients), the request is allowed.
If the header is present but the origin does not match FRONTEND_URL, the middleware returns 403.
Applies to: GET /api/videos/{video}/playback and POST /api/user/videos/{video}/playback-token/refresh.
Note: for actual HLS segments and manifests (Cloudflare Stream / Bunny CDN), configure allowed origins in their respective dashboards — this middleware only covers Laravel API endpoints.

Account sharing warning email:

Dark theme email sent to the user when their session is displaced.
Shows: date/time of detection, strike count (X/3).
Shows extra warning block when strikes >= 2.
Rate limited to once per 24 hours per user via Cache key sharing_warning_email:{user_id}.

Watch session behavior change (from Phase 9.5):

Old behavior: starting on a different device while another is active → 409 ACTIVE_WATCH_SESSION_ON_ANOTHER_DEVICE.
New behavior: new session always wins; old session strikes on next heartbeat (no 409 returned).
The frontend "conflict" status is kept but no longer reachable from watch session start.

New env required:

FRONTEND_URL — must be set in .env (example: http://localhost:3000). Used by ValidatePlaybackOrigin and AccountSharingWarningMail.

Later phase — Real Cloudflare Stream playback

Goal:

Configure Cloudflare Stream
Use real video UIDs
Replace development placeholder with real playback
Much later phase — Admin dashboard

Goal:

Separate admin auth
Dedicated lead capture table/API
Upload/link Cloudflare videos
Sales/payment dashboard
