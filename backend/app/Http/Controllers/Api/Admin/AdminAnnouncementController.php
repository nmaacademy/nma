<?php

namespace App\Http\Controllers\Api\Admin;

use App\Http\Controllers\Controller;
use App\Models\Course;
use App\Models\CourseAnnouncement;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Validation\Rule;

class AdminAnnouncementController extends Controller
{
    // ─── GET /api/admin/courses/{course}/announcements ────────────────────────
    public function index(Request $request, Course $course): JsonResponse
    {
        $this->authorizeAdmin($request);

        $perPage = min((int) $request->input('per_page', 10), 50);
        $status  = $request->input('status');   // draft|published|hidden|null
        $search  = $request->input('search');
        $pinned  = $request->input('pinned');   // 1|0|null

        $query = CourseAnnouncement::where('course_id', $course->id)
            ->with('creator:id,name')
            ->orderByDesc('is_pinned')
            ->orderByDesc('created_at');

        if ($status && in_array($status, ['draft', 'published', 'hidden'], true)) {
            $query->where('status', $status);
        }

        if ($search) {
            $query->where(function ($q) use ($search) {
                $q->where('title', 'like', '%' . $search . '%')
                  ->orWhere('body',  'like', '%' . $search . '%');
            });
        }

        if ($pinned !== null) {
            $query->where('is_pinned', (bool) $pinned);
        }

        $paginated = $query->paginate($perPage);

        $announcements = $paginated->getCollection()->map(
            fn (CourseAnnouncement $a) => $this->serialize($a)
        )->values();

        return response()->json([
            'success' => true,
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

    // ─── POST /api/admin/courses/{course}/announcements ───────────────────────
    public function store(Request $request, Course $course): JsonResponse
    {
        $this->authorizeAdmin($request);

        $data = $this->validatePayload($request);

        $data['course_id']   = $course->id;
        $data['created_by']  = $request->user()->id;
        $data['published_at'] = $this->resolvePublishedAt($data);

        $announcement = CourseAnnouncement::create($data);
        $announcement->load('creator:id,name');

        return response()->json([
            'success' => true,
            'message' => 'Anunțul a fost creat.',
            'data'    => ['announcement' => $this->serialize($announcement)],
        ], 201);
    }

    // ─── GET /api/admin/announcements/{announcement} ──────────────────────────
    public function show(Request $request, CourseAnnouncement $announcement): JsonResponse
    {
        $this->authorizeAdmin($request);

        $announcement->load('creator:id,name');

        return response()->json([
            'success' => true,
            'data'    => ['announcement' => $this->serialize($announcement, full: true)],
        ]);
    }

    // ─── PUT /api/admin/announcements/{announcement} ──────────────────────────
    public function update(Request $request, CourseAnnouncement $announcement): JsonResponse
    {
        $this->authorizeAdmin($request);

        $data = $this->validatePayload($request);
        $data['published_at'] = $this->resolvePublishedAt($data, $announcement);

        $announcement->update($data);
        $announcement->load('creator:id,name');

        return response()->json([
            'success' => true,
            'message' => 'Anunțul a fost actualizat.',
            'data'    => ['announcement' => $this->serialize($announcement->fresh(), full: true)],
        ]);
    }

    // ─── DELETE /api/admin/announcements/{announcement} ───────────────────────
    public function destroy(Request $request, CourseAnnouncement $announcement): JsonResponse
    {
        $this->authorizeAdmin($request);

        $announcement->delete(); // soft delete

        return response()->json([
            'success' => true,
            'message' => 'Anunțul a fost șters.',
        ]);
    }

    // ─── Helpers ──────────────────────────────────────────────────────────────

    private function authorizeAdmin(Request $request): void
    {
        $role = $request->user()?->role;
        abort_unless(in_array($role, ['admin', 'superadmin'], true), 403, 'Admin access required.');
    }

    private function validatePayload(Request $request): array
    {
        return $request->validate([
            'title'        => ['required', 'string', 'min:3', 'max:160'],
            'body'         => ['required', 'string', 'min:10', 'max:10000'],
            'status'       => ['required', Rule::in(['draft', 'published', 'hidden'])],
            'is_pinned'    => ['nullable', 'boolean'],
            'published_at' => ['nullable', 'date'],
        ]);
    }

    /**
     * If transitioning to published without an explicit published_at, set it to now.
     * If moving back to draft/hidden, leave published_at as-is (keeps history).
     */
    private function resolvePublishedAt(array $data, ?CourseAnnouncement $existing = null): mixed
    {
        if (isset($data['published_at'])) {
            return $data['published_at'];
        }

        if ($data['status'] === 'published') {
            // Already published and has a date? keep it.
            if ($existing?->published_at && $existing->status === 'published') {
                return $existing->published_at;
            }
            return now();
        }

        return $existing?->published_at ?? null;
    }

    private function serialize(CourseAnnouncement $a, bool $full = false): array
    {
        $base = [
            'id'           => $a->id,
            'course_id'    => $a->course_id,
            'title'        => $a->title,
            'body_excerpt' => mb_strimwidth($a->body, 0, 200, '…'),
            'status'       => $a->status,
            'is_pinned'    => (bool) $a->is_pinned,
            'published_at' => $a->published_at?->toIso8601String(),
            'created_at'   => $a->created_at?->toIso8601String(),
            'updated_at'   => $a->updated_at?->toIso8601String(),
            'creator'      => $a->creator ? [
                'id'   => $a->creator->id,
                'name' => $a->creator->name,
            ] : null,
        ];

        if ($full) {
            $base['body'] = $a->body;
        }

        return $base;
    }
}
