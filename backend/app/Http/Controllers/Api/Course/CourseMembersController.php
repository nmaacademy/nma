<?php

namespace App\Http\Controllers\Api\Course;

use App\Http\Controllers\Controller;
use App\Models\Course;
use App\Models\CourseVideo;
use App\Models\UserCourse;
use App\Models\UserVideoProgress;
use App\Services\CourseAccessService;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;

class CourseMembersController extends Controller
{
    public function __construct(private readonly CourseAccessService $access) {}

    public function index(Request $request, string $slug): JsonResponse
    {
        // 1. Find published course
        $course = Course::where('slug', $slug)
            ->where('status', 'published')
            ->first();

        if (! $course) {
            return response()->json([
                'success' => false,
                'message' => 'Cursul nu a fost găsit.',
            ], 404);
        }

        // 2. Requesting user must have active access
        $user = $request->user();

        if (! $this->access->userHasActiveCourseAccess($user, $course)) {
            return response()->json([
                'success' => false,
                'message' => 'Ai nevoie de acces la curs pentru a vedea membrii.',
            ], 403);
        }

        // 3. Build member query with optional name search
        $search  = trim((string) $request->input('search', ''));
        $perPage = min((int) $request->input('per_page', 20), 100);

        $query = UserCourse::where('course_id', $course->id)
            ->where('access_status', 'active')
            ->where(function ($q) {
                $q->whereNull('expires_at')
                  ->orWhere('expires_at', '>', now());
            })
            ->whereHas('user', fn ($q) => $q->whereNull('deleted_at'))
            ->with(['user' => fn ($q) => $q->select('id', 'name')->whereNull('deleted_at')])
            ->orderBy('purchased_at', 'desc');

        if ($search !== '') {
            $query->whereHas('user', fn ($q) => $q->where('name', 'like', '%' . $search . '%'));
        }

        $paginated         = $query->paginate($perPage);
        $memberUserCourses = $paginated->getCollection();

        // 4. Bulk-load progress to avoid N+1 (3 queries total regardless of member count)
        $totalVideos = CourseVideo::where('course_id', $course->id)
            ->where('status', 'published')
            ->count();

        $memberIds = $memberUserCourses->pluck('user_id');

        $progressByUser = collect();
        if ($memberIds->isNotEmpty() && $totalVideos > 0) {
            $progressByUser = UserVideoProgress::where('course_id', $course->id)
                ->whereIn('user_id', $memberIds)
                ->get(['user_id', 'progress_percent', 'is_completed'])
                ->groupBy('user_id');
        }

        // 5. Build safe member payload
        $members = $memberUserCourses->map(function (UserCourse $uc) use ($totalVideos, $progressByUser) {
            $user = $uc->user;
            if (! $user) {
                return null;
            }

            $name    = $user->name ?? 'Utilizator';
            $words   = preg_split('/\s+/u', trim($name)) ?: [];
            $initials = collect($words)
                ->take(2)
                ->map(fn ($w) => mb_strtoupper(mb_substr($w, 0, 1)))
                ->implode('');

            $progressPercent = null;
            $completedCount  = null;

            if ($totalVideos > 0) {
                $userRows = $progressByUser->get($uc->user_id);

                if ($userRows && $userRows->isNotEmpty()) {
                    $sumPct          = $userRows->sum(fn ($r) => (float) $r->progress_percent);
                    $progressPercent = (float) round($sumPct / $totalVideos, 2);
                    $completedCount  = $userRows->where('is_completed', true)->count();
                } else {
                    $progressPercent = 0.0;
                    $completedCount  = 0;
                }
            }

            return [
                'user_id'                => $uc->user_id,
                'name'                   => $name,
                'initials'               => $initials ?: '?',
                'joined_at'              => ($uc->purchased_at ?? $uc->created_at)?->toIso8601String(),
                'progress_percent'       => $progressPercent,
                'completed_videos_count' => $completedCount,
                'total_videos_count'     => $totalVideos > 0 ? $totalVideos : null,
            ];
        })->filter()->values();

        return response()->json([
            'success' => true,
            'message' => 'Membrii cursului au fost încărcați.',
            'data'    => [
                'course'  => [
                    'id'    => $course->id,
                    'title' => $course->title,
                    'slug'  => $course->slug,
                ],
                'members' => $members,
                'meta'    => [
                    'total'        => $paginated->total(),
                    'current_page' => $paginated->currentPage(),
                    'last_page'    => $paginated->lastPage(),
                    'per_page'     => $paginated->perPage(),
                ],
            ],
        ]);
    }
}
