<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Database\Eloquent\Relations\HasMany;
use Illuminate\Database\Eloquent\SoftDeletes;

class CourseCommunityPost extends Model
{
    use SoftDeletes;

    protected $fillable = [
        'course_id',
        'user_id',
        'title',
        'body',
        'status',
        'is_pinned',
        'is_locked',
        'replies_count',
        'last_reply_at',
    ];

    protected function casts(): array
    {
        return [
            'is_pinned'     => 'boolean',
            'is_locked'     => 'boolean',
            'replies_count' => 'integer',
            'last_reply_at' => 'datetime',
        ];
    }

    public function course(): BelongsTo
    {
        return $this->belongsTo(Course::class);
    }

    public function user(): BelongsTo
    {
        return $this->belongsTo(User::class);
    }

    public function replies(): HasMany
    {
        return $this->hasMany(CourseCommunityReply::class, 'post_id');
    }

    public function publishedReplies(): HasMany
    {
        return $this->hasMany(CourseCommunityReply::class, 'post_id')
            ->where('status', 'published');
    }
}
