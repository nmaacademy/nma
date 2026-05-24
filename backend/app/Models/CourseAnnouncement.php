<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Database\Eloquent\SoftDeletes;

class CourseAnnouncement extends Model
{
    use SoftDeletes;

    protected $fillable = [
        'course_id',
        'created_by',
        'title',
        'body',
        'status',
        'is_pinned',
        'published_at',
    ];

    protected function casts(): array
    {
        return [
            'is_pinned'    => 'boolean',
            'published_at' => 'datetime',
        ];
    }

    // ─── Relations ───────────────────────────────────────────────────────────

    public function course(): BelongsTo
    {
        return $this->belongsTo(Course::class);
    }

    // created_by is nullable — admin system is not fully implemented yet
    public function creator(): BelongsTo
    {
        return $this->belongsTo(User::class, 'created_by');
    }
}
