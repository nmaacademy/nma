<?php

namespace App\Http\Controllers\Api\Course;

use App\Http\Controllers\Controller;
use App\Models\Course;
use App\Models\CourseCommunityPost;
use App\Models\CourseCommunityReply;
use App\Services\CourseAccessService;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;

class CommunityReplyController extends Controller
{
    public function __construct(private readonly CourseAccessService $access) {}

    // ─── POST /api/user/courses/{slug}/community/posts/{post}/replies ─────────

    public function store(Request $request, string $slug, int $post): JsonResponse
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
                'message' => 'Contul tău este suspendat. Nu poți adăuga răspunsuri.',
            ], 403);
        }

        $postModel = CourseCommunityPost::where('id', $post)
            ->where('course_id', $course->id)
            ->where('status', 'published')
            ->whereNull('deleted_at')
            ->first();

        if (! $postModel) {
            return response()->json([
                'success' => false,
                'message' => 'Postarea nu a fost găsită.',
            ], 404);
        }

        if ($postModel->is_locked) {
            return response()->json([
                'success' => false,
                'message' => 'Această postare este blocată. Nu se mai pot adăuga răspunsuri.',
            ], 422);
        }

        $validated = $request->validate([
            'body' => ['required', 'string', 'min:2', 'max:3000'],
        ]);

        // Store as plain text — strip any HTML tags to prevent XSS
        $body = strip_tags(trim($validated['body']));

        if (mb_strlen($body) < 2) {
            return response()->json([
                'success' => false,
                'message' => 'Răspunsul este prea scurt după eliminarea conținutului invalid.',
                'errors'  => ['body' => ['Răspunsul trebuie să aibă cel puțin 2 caractere.']],
            ], 422);
        }

        $reply = CourseCommunityReply::create([
            'course_id' => $course->id,
            'post_id'   => $postModel->id,
            'user_id'   => $user->id,
            'body'      => $body,
            'status'    => 'published',
        ]);

        // Update denormalized counters on the post atomically
        $postModel->increment('replies_count');
        $postModel->update(['last_reply_at' => now()]);

        $reply->load(['user' => fn ($q) => $q->select('id', 'name')]);
        $postModel->refresh();

        return response()->json([
            'success' => true,
            'message' => 'Răspunsul a fost adăugat cu succes.',
            'data'    => [
                'reply' => [
                    'id'         => $reply->id,
                    'body'       => $reply->body,
                    'author'     => $this->safeAuthor($reply->user),
                    'created_at' => $reply->created_at?->toIso8601String(),
                ],
                'post' => [
                    'id'            => $postModel->id,
                    'replies_count' => $postModel->replies_count,
                    'last_reply_at' => $postModel->last_reply_at?->toIso8601String(),
                ],
            ],
        ], 201);
    }

    // ─── DELETE /api/user/courses/{slug}/community/posts/{post}/replies/{reply}

    public function destroy(Request $request, string $slug, int $post, int $reply): JsonResponse
    {
        $course = $this->findPublishedCourse($slug);
        if (! $course) {
            return $this->courseNotFound();
        }

        $user = $request->user();
        if (! $this->access->userHasActiveCourseAccess($user, $course)) {
            return $this->accessDenied();
        }

        $replyModel = CourseCommunityReply::where('id', $reply)
            ->where('post_id', $post)
            ->where('course_id', $course->id)
            ->where('user_id', $user->id)   // only own replies
            ->whereNull('deleted_at')
            ->first();

        if (! $replyModel) {
            return response()->json([
                'success' => false,
                'message' => 'Răspunsul nu a fost găsit sau nu ai permisiunea de a-l șterge.',
            ], 404);
        }

        $replyModel->delete(); // soft delete

        // Recalculate replies_count from real published non-deleted replies
        $postModel = CourseCommunityPost::find($post);
        if ($postModel) {
            $actualCount = CourseCommunityReply::where('post_id', $postModel->id)
                ->where('status', 'published')
                ->whereNull('deleted_at')
                ->count();

            $lastReply = CourseCommunityReply::where('post_id', $postModel->id)
                ->where('status', 'published')
                ->whereNull('deleted_at')
                ->latest('created_at')
                ->first();

            $postModel->update([
                'replies_count' => $actualCount,
                'last_reply_at' => $lastReply?->created_at,
            ]);
        }

        return response()->json([
            'success' => true,
            'message' => 'Răspunsul a fost șters.',
        ]);
    }

    // ─── Helpers ──────────────────────────────────────────────────────────────

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
