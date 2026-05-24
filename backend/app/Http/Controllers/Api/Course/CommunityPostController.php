<?php

namespace App\Http\Controllers\Api\Course;

use App\Http\Controllers\Controller;
use App\Models\Course;
use App\Models\CourseCommunityPost;
use App\Models\CourseCommunityReply;
use App\Services\CourseAccessService;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;

class CommunityPostController extends Controller
{
    public function __construct(private readonly CourseAccessService $access) {}

    // ─── GET /api/user/courses/{slug}/community/posts ─────────────────────────

    public function index(Request $request, string $slug): JsonResponse
    {
        $course = $this->findPublishedCourse($slug);
        if (! $course) {
            return $this->courseNotFound();
        }

        $user = $request->user();
        if (! $this->access->userHasActiveCourseAccess($user, $course)) {
            return $this->accessDenied();
        }

        $perPage = min((int) $request->input('per_page', 10), 30);
        $search  = trim((string) $request->input('search', ''));
        $sort    = $request->input('sort', 'latest_activity');

        $query = CourseCommunityPost::where('course_id', $course->id)
            ->where('status', 'published')
            ->whereNull('deleted_at')
            ->with(['user' => fn ($q) => $q->select('id', 'name')->whereNull('deleted_at')]);

        if ($search !== '') {
            $query->where(function ($q) use ($search) {
                $q->where('title', 'like', '%' . $search . '%')
                  ->orWhere('body',  'like', '%' . $search . '%');
            });
        }

        match ($sort) {
            'newest'          => $query->orderByDesc('created_at'),
            'most_replies'    => $query->orderByDesc('replies_count')->orderByDesc('created_at'),
            'pinned_first'    => $query->orderByDesc('is_pinned')->orderByDesc('last_reply_at'),
            default           => $query->orderByDesc('last_reply_at')->orderByDesc('created_at'), // latest_activity
        };

        $paginated = $query->paginate($perPage);

        $posts = $paginated->getCollection()->map(
            fn (CourseCommunityPost $post) => $this->serializePostListItem($post)
        )->filter()->values();

        return response()->json([
            'success' => true,
            'message' => 'Postările comunității au fost încărcate.',
            'data'    => [
                'course' => $this->serializeCourseMin($course),
                'posts'  => $posts,
                'meta'   => [
                    'total'        => $paginated->total(),
                    'current_page' => $paginated->currentPage(),
                    'last_page'    => $paginated->lastPage(),
                    'per_page'     => $paginated->perPage(),
                ],
            ],
        ]);
    }

    // ─── POST /api/user/courses/{slug}/community/posts ────────────────────────

    public function store(Request $request, string $slug): JsonResponse
    {
        $course = $this->findPublishedCourse($slug);
        if (! $course) {
            return $this->courseNotFound();
        }

        $user = $request->user();
        if (! $this->access->userHasActiveCourseAccess($user, $course)) {
            return $this->accessDenied();
        }

        if ($user->isSuspended()) {
            return response()->json([
                'success' => false,
                'message' => 'Contul tău este suspendat. Nu poți crea postări.',
            ], 403);
        }

        $validated = $request->validate([
            'title' => ['required', 'string', 'min:3', 'max:140'],
            'body'  => ['required', 'string', 'min:10', 'max:5000'],
        ]);

        // Store as plain text — strip any HTML tags to prevent XSS
        $title = strip_tags(trim($validated['title']));
        $body  = strip_tags(trim($validated['body']));

        // Reject if stripping emptied content beyond limits
        if (mb_strlen($title) < 3) {
            return response()->json([
                'success' => false,
                'message' => 'Titlul este prea scurt după eliminarea conținutului invalid.',
                'errors'  => ['title' => ['Titlul trebuie să aibă cel puțin 3 caractere.']],
            ], 422);
        }

        $post = CourseCommunityPost::create([
            'course_id'    => $course->id,
            'user_id'      => $user->id,
            'title'        => $title,
            'body'         => $body,
            'status'       => 'published',
            'is_pinned'    => false,
            'is_locked'    => false,
            'replies_count' => 0,
            'last_reply_at' => null,
        ]);

        $post->load(['user' => fn ($q) => $q->select('id', 'name')]);

        return response()->json([
            'success' => true,
            'message' => 'Postarea a fost creată cu succes.',
            'data'    => [
                'post' => $this->serializePostFull($post),
            ],
        ], 201);
    }

    // ─── GET /api/user/courses/{slug}/community/posts/{post} ─────────────────

    public function show(Request $request, string $slug, int $post): JsonResponse
    {
        $course = $this->findPublishedCourse($slug);
        if (! $course) {
            return $this->courseNotFound();
        }

        $user = $request->user();
        if (! $this->access->userHasActiveCourseAccess($user, $course)) {
            return $this->accessDenied();
        }

        $post = CourseCommunityPost::where('id', $post)
            ->where('course_id', $course->id)
            ->where('status', 'published')
            ->whereNull('deleted_at')
            ->with(['user' => fn ($q) => $q->select('id', 'name')->whereNull('deleted_at')])
            ->first();

        if (! $post) {
            return response()->json([
                'success' => false,
                'message' => 'Postarea nu a fost găsită.',
            ], 404);
        }

        $repliesPerPage = 15;
        $repliesPage    = max(1, (int) $request->input('replies_page', 1));

        $repliesPaginated = CourseCommunityReply::where('post_id', $post->id)
            ->where('status', 'published')
            ->whereNull('deleted_at')
            ->with(['user' => fn ($q) => $q->select('id', 'name')->whereNull('deleted_at')])
            ->orderBy('created_at')
            ->paginate($repliesPerPage, ['*'], 'replies_page', $repliesPage);

        $replies = $repliesPaginated->getCollection()->map(
            fn (CourseCommunityReply $reply) => $this->serializeReply($reply)
        )->filter()->values();

        return response()->json([
            'success' => true,
            'message' => 'Postarea a fost încărcată.',
            'data'    => [
                'course'       => $this->serializeCourseMin($course),
                'post'         => $this->serializePostFull($post),
                'replies'      => $replies,
                'replies_meta' => [
                    'total'        => $repliesPaginated->total(),
                    'current_page' => $repliesPaginated->currentPage(),
                    'last_page'    => $repliesPaginated->lastPage(),
                    'per_page'     => $repliesPaginated->perPage(),
                ],
            ],
        ]);
    }

    // ─── DELETE /api/user/courses/{slug}/community/posts/{post} ──────────────

    public function destroy(Request $request, string $slug, int $post): JsonResponse
    {
        $course = $this->findPublishedCourse($slug);
        if (! $course) {
            return $this->courseNotFound();
        }

        $user = $request->user();
        if (! $this->access->userHasActiveCourseAccess($user, $course)) {
            return $this->accessDenied();
        }

        $post = CourseCommunityPost::where('id', $post)
            ->where('course_id', $course->id)
            ->where('user_id', $user->id)   // only own posts
            ->whereNull('deleted_at')
            ->first();

        if (! $post) {
            return response()->json([
                'success' => false,
                'message' => 'Postarea nu a fost găsită sau nu ai permisiunea de a o șterge.',
            ], 404);
        }

        $post->delete(); // soft delete

        return response()->json([
            'success' => true,
            'message' => 'Postarea a fost ștearsă.',
        ]);
    }

    // ─── Serializers ──────────────────────────────────────────────────────────

    private function serializePostListItem(CourseCommunityPost $post): ?array
    {
        $author = $post->user;
        if (! $author) {
            return null;
        }

        $bodyExcerpt = mb_strlen($post->body) > 200
            ? mb_substr($post->body, 0, 200) . '...'
            : $post->body;

        return [
            'id'            => $post->id,
            'title'         => $post->title,
            'body_excerpt'  => $bodyExcerpt,
            'author'        => $this->safeAuthor($author),
            'replies_count' => $post->replies_count,
            'is_pinned'     => $post->is_pinned,
            'is_locked'     => $post->is_locked,
            'last_reply_at' => $post->last_reply_at?->toIso8601String(),
            'created_at'    => $post->created_at?->toIso8601String(),
        ];
    }

    private function serializePostFull(CourseCommunityPost $post): ?array
    {
        $author = $post->user;
        if (! $author) {
            return null;
        }

        return [
            'id'            => $post->id,
            'title'         => $post->title,
            'body'          => $post->body,
            'author'        => $this->safeAuthor($author),
            'replies_count' => $post->replies_count,
            'is_pinned'     => $post->is_pinned,
            'is_locked'     => $post->is_locked,
            'last_reply_at' => $post->last_reply_at?->toIso8601String(),
            'created_at'    => $post->created_at?->toIso8601String(),
        ];
    }

    private function serializeReply(CourseCommunityReply $reply): ?array
    {
        $author = $reply->user;
        if (! $author) {
            return null;
        }

        return [
            'id'         => $reply->id,
            'body'       => $reply->body,
            'author'     => $this->safeAuthor($author),
            'created_at' => $reply->created_at?->toIso8601String(),
        ];
    }

    private function safeAuthor(\App\Models\User $user): array
    {
        $name    = $user->name ?? 'Utilizator';
        $words   = preg_split('/\s+/u', trim($name)) ?: [];
        $initials = collect($words)
            ->take(2)
            ->map(fn ($w) => mb_strtoupper(mb_substr($w, 0, 1)))
            ->implode('');

        return [
            'user_id'  => $user->id,
            'name'     => $name,
            'initials' => $initials ?: '?',
        ];
    }

    private function serializeCourseMin(Course $course): array
    {
        return [
            'id'    => $course->id,
            'title' => $course->title,
            'slug'  => $course->slug,
        ];
    }

    // ─── Shared lookup / response helpers ────────────────────────────────────

    private function findPublishedCourse(string $slug): ?Course
    {
        return Course::where('slug', $slug)
            ->where('status', 'published')
            ->first();
    }

    private function courseNotFound(): JsonResponse
    {
        return response()->json([
            'success' => false,
            'message' => 'Cursul nu a fost găsit.',
        ], 404);
    }

    private function accessDenied(): JsonResponse
    {
        return response()->json([
            'success' => false,
            'message' => 'Ai nevoie de acces activ la curs pentru a accesa comunitatea.',
        ], 403);
    }
}
