<?php

namespace App\Http\Controllers\Api\Admin;

use App\Http\Controllers\Controller;
use App\Models\Course;
use App\Models\CourseCategory;
use App\Models\CourseSubcategory;
use App\Models\CourseVideo;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Str;
use Illuminate\Validation\ValidationException;

class AdminCourseController extends Controller
{
    public function index(Request $request): JsonResponse
    {
        $this->authorizeAdmin($request);

        $courses = Course::withCount(['categories', 'subcategories', 'videos'])
            ->orderByDesc('updated_at')
            ->get()
            ->map(fn (Course $course) => $this->serializeListCourse($course));

        return response()->json([
            'success' => true,
            'data'    => ['courses' => $courses],
        ]);
    }

    public function show(Request $request, Course $course): JsonResponse
    {
        $this->authorizeAdmin($request);

        $course->load([
            'categories' => fn ($q) => $q->orderBy('order_index')->with([
                'subcategories' => fn ($q) => $q->orderBy('order_index')->with('video'),
            ]),
        ]);

        return response()->json([
            'success' => true,
            'data'    => ['course' => $this->serializeDetailCourse($course)],
        ]);
    }

    public function store(Request $request): JsonResponse
    {
        $this->authorizeAdmin($request);
        $payload = $this->validatedPayload($request);

        $course = DB::transaction(function () use ($payload, $request) {
            $course = Course::create($this->courseAttributes($payload, $request->user()->id));
            $this->syncCurriculum($course, $payload['modules'] ?? []);

            return $course;
        });

        return response()->json([
            'success' => true,
            'message' => 'Cursul a fost creat.',
            'data'    => ['course' => $this->serializeDetailCourse($course->fresh())],
        ], 201);
    }

    public function update(Request $request, Course $course): JsonResponse
    {
        $this->authorizeAdmin($request);
        $payload = $this->validatedPayload($request, $course);

        DB::transaction(function () use ($course, $payload) {
            $course->update($this->courseAttributes($payload, $course->created_by));
            $this->syncCurriculum($course, $payload['modules'] ?? []);
        });

        return response()->json([
            'success' => true,
            'message' => 'Cursul a fost actualizat.',
            'data'    => ['course' => $this->serializeDetailCourse($course->fresh())],
        ]);
    }

    public function archive(Request $request, Course $course): JsonResponse
    {
        $this->authorizeAdmin($request);

        $course->update(['status' => 'archived']);

        return response()->json([
            'success' => true,
            'message' => 'Cursul a fost arhivat.',
        ]);
    }

    public function duplicate(Request $request, Course $course): JsonResponse
    {
        $this->authorizeAdmin($request);

        $copy = DB::transaction(function () use ($course, $request) {
            $course->load([
                'categories' => fn ($q) => $q->orderBy('order_index')->with([
                    'subcategories' => fn ($q) => $q->orderBy('order_index')->with('video'),
                ]),
            ]);

            $newCourse = $course->replicate([
                'slug',
                'status',
                'published_at',
                'created_by',
            ]);
            $newCourse->title        = $course->title . ' (Copy)';
            $newCourse->slug         = $this->uniqueSlug(Str::slug($course->slug . '-copy'));
            $newCourse->status       = 'draft';
            $newCourse->published_at = null;
            $newCourse->created_by   = $request->user()->id;
            $newCourse->save();

            foreach ($course->categories as $category) {
                $newCategory = $category->replicate(['course_id']);
                $newCategory->course_id = $newCourse->id;
                $newCategory->save();

                foreach ($category->subcategories as $subcategory) {
                    $newSubcategory = $subcategory->replicate(['course_id', 'category_id']);
                    $newSubcategory->course_id   = $newCourse->id;
                    $newSubcategory->category_id = $newCategory->id;
                    $newSubcategory->save();

                    if ($subcategory->video) {
                        $newVideo = $subcategory->video->replicate(['course_id', 'category_id', 'subcategory_id']);
                        $newVideo->course_id      = $newCourse->id;
                        $newVideo->category_id    = $newCategory->id;
                        $newVideo->subcategory_id = $newSubcategory->id;
                        $newVideo->save();
                    }
                }
            }

            return $newCourse;
        });

        return response()->json([
            'success' => true,
            'message' => 'Cursul a fost duplicat ca draft.',
            'data'    => ['course' => $this->serializeDetailCourse($copy->fresh())],
        ], 201);
    }

    private function authorizeAdmin(Request $request): void
    {
        $role = $request->user()?->role;

        abort_unless(in_array($role, ['admin', 'superadmin'], true), 403, 'Admin access required.');
    }

    private function validatedPayload(Request $request, ?Course $course = null): array
    {
        $input = $request->all();
        $errors = [];

        $addError = function (string $field, string $message) use (&$errors): void {
            $errors[$field][] = $message;
        };

        $title = trim((string) ($input['title'] ?? ''));
        if ($title === '') {
            $addError('title', 'Titlul cursului este obligatoriu.');
        } elseif (mb_strlen($title) > 255) {
            $addError('title', 'Titlul cursului nu poate depasi 255 de caractere.');
        }

        $slugInput = trim((string) ($input['slug'] ?? ''));
        $slug = Str::slug($slugInput !== '' ? $slugInput : $title);
        if ($slug === '') {
            $addError('slug', 'Slug-ul nu poate fi generat. Completeaza titlul sau slug-ul manual.');
        } elseif (mb_strlen($slug) > 255) {
            $addError('slug', 'Slug-ul nu poate depasi 255 de caractere.');
        } else {
            $slugQuery = Course::where('slug', $slug);

            if ($course) {
                $slugQuery->whereKeyNot($course->id);
            }

            $slugExists = $slugQuery->exists();

            if ($slugExists) {
                $addError('slug', 'Exista deja un curs cu acest slug.');
            }
        }

        $price = $input['price'] ?? null;
        if (! is_numeric($price) || (float) $price < 0) {
            $addError('price', 'Pretul trebuie sa fie un numar pozitiv.');
        }

        $status = $input['status'] ?? 'published';
        if (! in_array($status, ['draft', 'published', 'archived'], true)) {
            $addError('status', 'Statusul cursului este invalid.');
        }

        $currency = (string) ($input['currency'] ?? 'RON');
        if (mb_strlen($currency) > 10) {
            $addError('currency', 'Moneda nu poate depasi 10 caractere.');
        }

        foreach (['short_description' => 255, 'thumbnail' => 2048] as $field => $max) {
            if (isset($input[$field]) && mb_strlen((string) $input[$field]) > $max) {
                $addError($field, "Campul nu poate depasi {$max} de caractere.");
            }
        }

        foreach (['features', 'target_audience', 'results_promised'] as $field) {
            if (isset($input[$field]) && ! is_array($input[$field])) {
                $addError($field, 'Campul trebuie sa fie o lista.');
                continue;
            }

            foreach (($input[$field] ?? []) as $index => $value) {
                if (mb_strlen((string) $value) > 255) {
                    $addError("{$field}.{$index}", 'Textul nu poate depasi 255 de caractere.');
                }
            }
        }

        if (isset($input['modules']) && ! is_array($input['modules'])) {
            $addError('modules', 'Modulele trebuie sa fie o lista.');
        }

        foreach (($input['modules'] ?? []) as $moduleIndex => $module) {
            if (! is_array($module)) {
                $addError("modules.{$moduleIndex}", 'Modul invalid.');
                continue;
            }

            $moduleTitle = trim((string) ($module['title'] ?? ''));
            if ($moduleTitle === '') {
                $addError("modules.{$moduleIndex}.title", 'Titlul modulului este obligatoriu.');
            } elseif (mb_strlen($moduleTitle) > 255) {
                $addError("modules.{$moduleIndex}.title", 'Titlul modulului nu poate depasi 255 de caractere.');
            }

            if (isset($module['lessons']) && ! is_array($module['lessons'])) {
                $addError("modules.{$moduleIndex}.lessons", 'Lectiile trebuie sa fie o lista.');
                continue;
            }

            foreach (($module['lessons'] ?? []) as $lessonIndex => $lesson) {
                if (! is_array($lesson)) {
                    $addError("modules.{$moduleIndex}.lessons.{$lessonIndex}", 'Lectie invalida.');
                    continue;
                }

                $lessonTitle = trim((string) ($lesson['title'] ?? ''));
                if ($lessonTitle === '') {
                    $addError("modules.{$moduleIndex}.lessons.{$lessonIndex}.title", 'Titlul lectiei este obligatoriu.');
                } elseif (mb_strlen($lessonTitle) > 255) {
                    $addError("modules.{$moduleIndex}.lessons.{$lessonIndex}.title", 'Titlul lectiei nu poate depasi 255 de caractere.');
                }

                if (isset($lesson['video_url']) && mb_strlen((string) $lesson['video_url']) > 2048) {
                    $addError("modules.{$moduleIndex}.lessons.{$lessonIndex}.video_url", 'URL-ul video este prea lung.');
                }
            }
        }

        if ($errors !== []) {
            throw ValidationException::withMessages($errors);
        }

        $input['title'] = $title;
        $input['slug'] = $slug;
        $input['price'] = (float) $price;
        $input['currency'] = $currency ?: 'RON';
        $input['status'] = $status;
        $input['modules'] = $input['modules'] ?? [];

        return $input;
    }

    private function courseAttributes(array $payload, ?int $createdBy): array
    {
        $status = $payload['status'] ?? 'published';
        return [
            'title'             => $payload['title'],
            'slug'              => $payload['slug'],
            'short_description' => $payload['short_description'] ?? Str::limit((string) ($payload['description'] ?? $payload['title']), 220),
            'description'       => $payload['description'] ?? null,
            'price'             => $payload['price'],
            'currency'          => $payload['currency'] ?? 'RON',
            'thumbnail_url'     => $payload['thumbnail'] ?? null,
            'status'            => $status,
            'created_by'        => $createdBy,
            'published_at'      => $status === 'published' ? now() : null,
            'features'          => array_values(array_filter($payload['features'] ?? [])),
            'target_audience'   => array_values(array_filter($payload['target_audience'] ?? [])),
            'results_promised'  => array_values(array_filter($payload['results_promised'] ?? [])),
        ];
    }

    private function syncCurriculum(Course $course, array $modules): void
    {
        $keptCategoryIds = [];

        foreach ($modules as $moduleIndex => $moduleData) {
            $category = $this->resolveCategory($course, $moduleData['module_id'] ?? null);
            $lessons  = $moduleData['lessons'] ?? [];

            $category->fill([
                'course_id'        => $course->id,
                'title'            => $moduleData['title'],
                'slug'             => $category->exists ? $category->slug : $this->uniqueCategorySlug($course, $moduleData['title']),
                'description'      => $moduleData['description'] ?? null,
                'order_index'      => $moduleData['order'] ?? $moduleIndex,
                'is_free_preview'  => (bool) ($moduleData['is_free_preview'] ?? collect($lessons)->contains(fn ($lesson) => (bool) ($lesson['is_free_preview'] ?? false))),
                'status'           => 'published',
            ]);
            $category->save();
            $keptCategoryIds[] = $category->id;

            $this->syncLessons($course, $category, $lessons);
        }

        $course->categories()
            ->whereNotIn('id', $keptCategoryIds ?: [0])
            ->delete();
    }

    private function syncLessons(Course $course, CourseCategory $category, array $lessons): void
    {
        $keptSubcategoryIds = [];

        foreach ($lessons as $lessonIndex => $lessonData) {
            $subcategory = $this->resolveSubcategory($category, $lessonData['lesson_id'] ?? null);

            $subcategory->fill([
                'course_id'    => $course->id,
                'category_id'  => $category->id,
                'title'        => $lessonData['title'],
                'slug'         => $subcategory->exists ? $subcategory->slug : $this->uniqueSubcategorySlug($category, $lessonData['title']),
                'description'  => $lessonData['description'] ?? null,
                'order_index'  => $lessonData['order'] ?? $lessonIndex,
                'status'       => 'published',
            ]);
            $subcategory->save();
            $keptSubcategoryIds[] = $subcategory->id;

            CourseVideo::updateOrCreate(
                ['subcategory_id' => $subcategory->id],
                [
                    'course_id'                 => $course->id,
                    'category_id'               => $category->id,
                    'title'                     => $lessonData['title'],
                    'cloudflare_playback_url'   => $lessonData['video_url'] ?? null,
                    'duration_seconds'          => ((int) ($lessonData['duration_minutes'] ?? 0)) * 60,
                    'order_index'               => $lessonData['order'] ?? $lessonIndex,
                    'status'                    => 'published',
                ],
            );
        }

        $category->subcategories()
            ->whereNotIn('id', $keptSubcategoryIds ?: [0])
            ->delete();
    }

    private function resolveCategory(Course $course, mixed $id): CourseCategory
    {
        if (is_numeric($id)) {
            $category = $course->categories()->whereKey((int) $id)->first();
            if ($category) return $category;
        }

        return new CourseCategory();
    }

    private function resolveSubcategory(CourseCategory $category, mixed $id): CourseSubcategory
    {
        if (is_numeric($id)) {
            $subcategory = $category->subcategories()->whereKey((int) $id)->first();
            if ($subcategory) return $subcategory;
        }

        return new CourseSubcategory();
    }

    private function serializeListCourse(Course $course): array
    {
        return [
            'id'                  => $course->id,
            'title'               => $course->title,
            'slug'                => $course->slug,
            'short_description'   => $course->short_description,
            'description'         => $course->description,
            'price'               => (float) $course->price,
            'currency'            => $course->currency,
            'thumbnail_url'       => $course->thumbnail_url,
            'status'              => $course->status,
            'published_at'        => $course->published_at?->toIso8601String(),
            'features'            => $course->features ?? [],
            'target_audience'     => $course->target_audience ?? [],
            'results_promised'    => $course->results_promised ?? [],
            'categories_count'    => $course->categories_count ?? 0,
            'subcategories_count' => $course->subcategories_count ?? 0,
            'videos_count'        => $course->videos_count ?? 0,
        ];
    }

    private function serializeDetailCourse(Course $course): array
    {
        $course->loadMissing([
            'categories' => fn ($q) => $q->orderBy('order_index')->with([
                'subcategories' => fn ($q) => $q->orderBy('order_index')->with('video'),
            ]),
        ]);

        return array_merge($this->serializeListCourse($course), [
            'categories' => $course->categories->map(fn (CourseCategory $category) => [
                'id'              => $category->id,
                'title'           => $category->title,
                'slug'            => $category->slug,
                'description'     => $category->description,
                'order_index'     => $category->order_index,
                'is_free_preview' => (bool) $category->is_free_preview,
                'subcategories'   => $category->subcategories->map(fn (CourseSubcategory $subcategory) => [
                    'id'            => $subcategory->id,
                    'title'         => $subcategory->title,
                    'slug'          => $subcategory->slug,
                    'description'   => $subcategory->description,
                    'order_index'   => $subcategory->order_index,
                    'video'         => $subcategory->video ? [
                        'id'               => $subcategory->video->id,
                        'title'            => $subcategory->video->title,
                        'duration_seconds' => $subcategory->video->duration_seconds,
                        'playback_url'      => $subcategory->video->cloudflare_playback_url,
                        'thumbnail_url'     => $subcategory->video->cloudflare_thumbnail_url,
                    ] : null,
                ])->values()->all(),
            ])->values()->all(),
        ]);
    }

    private function uniqueSlug(string $base): string
    {
        $slug = $base ?: 'course';
        $candidate = $slug;
        $i = 2;

        while (Course::where('slug', $candidate)->exists()) {
            $candidate = "{$slug}-{$i}";
            $i++;
        }

        return $candidate;
    }

    private function uniqueCategorySlug(Course $course, string $title): string
    {
        $base = Str::slug($title) ?: 'module';
        $candidate = $base;
        $i = 2;

        while ($course->categories()->where('slug', $candidate)->exists()) {
            $candidate = "{$base}-{$i}";
            $i++;
        }

        return $candidate;
    }

    private function uniqueSubcategorySlug(CourseCategory $category, string $title): string
    {
        $base = Str::slug($title) ?: 'lesson';
        $candidate = $base;
        $i = 2;

        while ($category->subcategories()->where('slug', $candidate)->exists()) {
            $candidate = "{$base}-{$i}";
            $i++;
        }

        return $candidate;
    }
}
