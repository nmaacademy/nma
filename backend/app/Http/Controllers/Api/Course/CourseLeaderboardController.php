<?php

namespace App\Http\Controllers\Api\Course;

use App\Http\Controllers\Controller;
use App\Models\Course;
use App\Models\User;
use App\Models\UserCourse;
use App\Models\UserVideoProgress;
use App\Models\CourseVideo;
use App\Services\CourseAccessService;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Carbon;
use Illuminate\Support\Facades\DB;

class CourseLeaderboardController extends Controller
{
    public function __construct(private readonly CourseAccessService $access) {}

    // ─── GET /api/user/courses/{slug}/leaderboard ─────────────────────────────
    public function index(Request $request, string $slug): JsonResponse
    {
        // ── 1. Resolve course ──────────────────────────────────────────────────
        $course = Course::where('slug', $slug)
            ->where('status', 'published')
            ->first();

        if (! $course) {
            return response()->json([
                'success' => false,
                'message' => 'Cursul nu a fost găsit.',
            ], 404);
        }

        // ── 2. Check current user has active access ────────────────────────────
        $authUser = $request->user();
        if (! $this->access->userHasActiveCourseAccess($authUser, $course)) {
            return response()->json([
                'success' => false,
                'message' => 'Ai nevoie de acces activ la curs pentru a vedea leaderboard-ul.',
            ], 403);
        }

        // ── 3. Total published videos for this course ──────────────────────────
        $totalVideos = CourseVideo::where('course_id', $course->id)
            ->where('status', 'published')
            ->whereNull('deleted_at')
            ->count();

        // ── 4. Active, non-expired course members ──────────────────────────────
        $userCourses = UserCourse::where('course_id', $course->id)
            ->where('access_status', 'active')
            ->where(function ($q) {
                $q->whereNull('expires_at')->orWhere('expires_at', '>', now());
            })
            ->get()
            ->keyBy('user_id');

        $userIds = $userCourses->keys();

        if ($userIds->isEmpty()) {
            return $this->emptyResponse($course, $authUser, $totalVideos);
        }

        // ── 5. Load non-deleted, non-suspended users ───────────────────────────
        $users = User::whereIn('id', $userIds)
            ->whereNull('deleted_at')
            ->where('status', '!=', 'suspended')
            ->select(['id', 'name'])
            ->get()
            ->keyBy('id');

        // ── 6. Aggregate progress per user (completed videos only) ─────────────
        $progressAgg = UserVideoProgress::where('course_id', $course->id)
            ->whereIn('user_id', $userIds)
            ->where('is_completed', true)
            ->select([
                'user_id',
                DB::raw('COUNT(*) as completed_videos_count'),
                DB::raw('MAX(completed_at) as latest_completed_at'),
            ])
            ->groupBy('user_id')
            ->get()
            ->keyBy('user_id');

        // ── 7. Build ranked entries ────────────────────────────────────────────
        $entries = [];

        foreach ($userIds as $uid) {
            if (! $users->has($uid)) continue; // suspended or deleted — skip

            $user    = $users[$uid];
            $uc      = $userCourses[$uid];
            $agg     = $progressAgg->get($uid);

            $completedCount    = $agg ? (int) $agg->completed_videos_count : 0;
            $latestCompletedAt = $agg?->latest_completed_at;

            $progressPercent = $totalVideos > 0
                ? min(100.0, round(($completedCount / $totalVideos) * 100, 2))
                : 0.0;

            $isCompleted = $totalVideos > 0 && $completedCount >= $totalVideos;

            // joined_at: prefer purchased_at (payment moment), fall back to record created_at
            $joinedAt = $uc->purchased_at ?? $uc->created_at;

            $entries[] = [
                'user_id'                => $uid,
                'name'                   => $user->name,
                'initials'               => $this->initials($user->name),
                'progress_percent'       => $progressPercent,
                'completed_videos_count' => $completedCount,
                'total_videos_count'     => $totalVideos,
                'is_completed'           => $isCompleted,
                'completed_at_course'    => ($isCompleted && $latestCompletedAt)
                    ? Carbon::parse($latestCompletedAt)->toIso8601String()
                    : null,
                'joined_at'              => $joinedAt?->toIso8601String(),
                // Internal sort keys — stripped before response
                '_completed_count'       => $completedCount,
                '_progress_pct'          => $progressPercent,
                '_completed_at_ts'       => ($isCompleted && $latestCompletedAt)
                    ? Carbon::parse($latestCompletedAt)->getTimestamp()
                    : PHP_INT_MAX,
                '_joined_at_ts'          => $joinedAt?->getTimestamp() ?? PHP_INT_MAX,
            ];
        }

        // ── 8. Sort ────────────────────────────────────────────────────────────
        usort($entries, function (array $a, array $b): int {
            // 1. completed_videos_count DESC
            if ($a['_completed_count'] !== $b['_completed_count']) {
                return $b['_completed_count'] - $a['_completed_count'];
            }
            // 2. progress_percent DESC
            if ($a['_progress_pct'] !== $b['_progress_pct']) {
                return $b['_progress_pct'] <=> $a['_progress_pct'];
            }
            // 3. completed_at_course ASC (earlier finisher ranks higher)
            if ($a['_completed_at_ts'] !== $b['_completed_at_ts']) {
                return $a['_completed_at_ts'] <=> $b['_completed_at_ts'];
            }
            // 4. joined_at ASC (older member ranks higher)
            return $a['_joined_at_ts'] <=> $b['_joined_at_ts'];
        });

        // ── 9. Assign ranks + strip sort keys ─────────────────────────────────
        $currentUserRaw = null;

        foreach ($entries as $i => &$entry) {
            $entry['rank'] = $i + 1;
            if ($entry['user_id'] === $authUser->id) {
                $currentUserRaw = $entry;
            }
            unset($entry['_completed_count'], $entry['_progress_pct'], $entry['_completed_at_ts'], $entry['_joined_at_ts']);
        }
        unset($entry);

        // ── 10. Paginate in memory ─────────────────────────────────────────────
        $perPage  = min((int) $request->input('per_page', 20), 50);
        $page     = max(1, (int) $request->input('page', 1));
        $total    = count($entries);
        $lastPage = max(1, (int) ceil($total / $perPage));
        $page     = min($page, $lastPage);

        $paginated = array_values(array_slice($entries, ($page - 1) * $perPage, $perPage));

        // ── 11. Build current_user summary ────────────────────────────────────
        $currentUser = $currentUserRaw ? [
            'rank'                   => $currentUserRaw['rank'],
            'progress_percent'       => $currentUserRaw['progress_percent'],
            'completed_videos_count' => $currentUserRaw['completed_videos_count'],
            'total_videos_count'     => $currentUserRaw['total_videos_count'],
            'is_completed'           => $currentUserRaw['is_completed'],
            'completed_at_course'    => $currentUserRaw['completed_at_course'],
            'joined_at'              => $currentUserRaw['joined_at'],
        ] : null;

        return response()->json([
            'success' => true,
            'message' => 'Leaderboard-ul cursului a fost încărcat.',
            'data'    => [
                'course' => [
                    'id'    => $course->id,
                    'title' => $course->title,
                    'slug'  => $course->slug,
                ],
                'leaderboard' => $paginated,
                'current_user' => $currentUser,
                'meta' => [
                    'total'        => $total,
                    'current_page' => $page,
                    'last_page'    => $lastPage,
                    'per_page'     => $perPage,
                ],
            ],
        ]);
    }

    // ─── Helpers ───────────────────────────────────────────────────────────────

    private function initials(string $name): string
    {
        $parts = preg_split('/\s+/', trim($name));
        if (count($parts) === 1) {
            return mb_strtoupper(mb_substr($parts[0], 0, 2));
        }
        return mb_strtoupper(mb_substr($parts[0], 0, 1) . mb_substr(end($parts), 0, 1));
    }

    private function emptyResponse(Course $course, User $authUser, int $totalVideos): JsonResponse
    {
        return response()->json([
            'success' => true,
            'message' => 'Leaderboard-ul cursului a fost încărcat.',
            'data'    => [
                'course' => [
                    'id'    => $course->id,
                    'title' => $course->title,
                    'slug'  => $course->slug,
                ],
                'leaderboard'  => [],
                'current_user' => null,
                'meta'         => [
                    'total'        => 0,
                    'current_page' => 1,
                    'last_page'    => 1,
                    'per_page'     => 20,
                ],
            ],
        ]);
    }
}
