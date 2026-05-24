<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

class VideoAnomalyLog extends Model
{
    protected $fillable = [
        'user_id',
        'video_id',
        'watch_session_id',
        'user_session_id',
        'anomaly_type',
        'reason',
        'details',
        'ip_address',
        'user_agent',
    ];

    protected $casts = [
        'details' => 'array',
    ];

    public function user(): BelongsTo
    {
        return $this->belongsTo(User::class);
    }

    public function video(): BelongsTo
    {
        return $this->belongsTo(CourseVideo::class, 'video_id');
    }
}
