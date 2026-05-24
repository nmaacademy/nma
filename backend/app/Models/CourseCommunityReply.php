<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Database\Eloquent\SoftDeletes;

class CourseCommunityReply extends Model
{
    use SoftDeletes;

    protected $fillable = [
        'course_id',
        'post_id',
        'user_id',
        'body',
        'status',
    ];

    public function course(): BelongsTo
    {
        return $this->belongsTo(Course::class);
    }

    public function post(): BelongsTo
    {
        return $this->belongsTo(CourseCommunityPost::class, 'post_id');
    }

    public function user(): BelongsTo
    {
        return $this->belongsTo(User::class);
    }
}
