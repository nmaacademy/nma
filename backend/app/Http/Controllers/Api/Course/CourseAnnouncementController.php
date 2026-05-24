<?php

namespace App\Http\Controllers\Api\Course;

use App\Http\Controllers\Controller;
use App\Models\Course;
use App\Models\CourseAnnouncement;
use App\Services\CourseAccessService;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;

class CourseAnnouncementController extends Controller
{
    public function __construct(private readonly CourseAccessService $access) {}

    // ─── GET /api/user/courses/{slug}/announcements ───────────────────────────
    //
    // Returns published announcements for a course the authenticated user has
    // active access to. Pinned announcements are sorted first, then by
    // published_at descending.

    public function index(Request $request, string $slug): JsonResponse
    {
        $course = Course::where('slug', $slug)
            ->where('status', 'published')
            ->first();

        if (! $course) {
            return response()->json([
                'success' => false,
                'message' => 'Cursul nu a fost găsit.',
            ], 404);
        }

        $user = $request->user();
        if (! $this->access->userHasActiveCourseAccess($user, $course)) {
            return response()->json([
                'success' => false,
                'message' => 'Ai nevoie de acces activ la curs pentru a vedea anunțurile.',
            ], 403);
        }

        $perPage = min((int) $request->input('per_page', 10), 30);

        $paginated = CourseAnnouncement::where('course_id', $course->id)
            ->where('status', 'published')
            ->whereNotNull('published_at')
            ->where('published_at', '<=', now())
            ->whereNull('deleted_at')
            ->orderByDesc('is_pinned')
            ->orderByDesc('published_at')
            ->paginate($perPage);

        $announcements = $paginated->getCollection()->map(
            fn (CourseAnnouncement $a) => [
                'id'           => $a->id,
                'title'        => $a->title,
                'body'         => $a->body,
                'is_pinned'    => (bool) $a->is_pinned,
                'published_at' => $a->published_at?->toIso8601String(),
                'created_at'   => $a->created_at?->toIso8601String(),
            ]
        )->values();

        return response()->json([
            'success' => true,
            'message' => 'Anunțurile cursului au fost încărcate.',
            'data'    => [
                'course' => [
                    'id'    => $course->id,
                    'title' => $course->title,
                    'slug'  => $course->slug,
                ],
                'announcements' => $announcements,
                'meta'          => [
                    'total'        => $paginated->total(),
                    'current_page' => $paginated->currentPage(),
                    'last_page'    => $paginated->lastPage(),
                    'per_page'     => $paginated->perPage(),
                ],
            ],
        ]);
    }
}
