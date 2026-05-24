<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Database\Eloquent\Relations\HasMany;

class Payment extends Model
{
    public const STATUS_PENDING = 'pending';
    public const STATUS_REQUIRES_ACTION = 'requires_action';
    public const STATUS_PAID = 'paid';
    public const STATUS_CONFIRMED = 'confirmed';
    public const STATUS_FAILED = 'failed';
    public const STATUS_CANCELED = 'canceled';
    public const STATUS_EXPIRED = 'expired';
    public const STATUS_REFUNDED = 'refunded';

    protected $fillable = [
        'user_id',
        'course_id',
        'provider',
        'order_id',
        'ntp_id',
        'status',
        'provider_status',
        'error_code',
        'error_message',
        'amount',
        'currency',
        'customer_action_type',
        'customer_action_url',
        'authentication_token',
        'request_payload',
        'response_payload',
        'last_webhook_payload',
        'paid_at',
        'confirmed_at',
    ];

    protected function casts(): array
    {
        return [
            'amount'               => 'decimal:2',
            'provider_status'      => 'integer',
            'request_payload'      => 'array',
            'response_payload'     => 'array',
            'last_webhook_payload' => 'array',
            'paid_at'              => 'datetime',
            'confirmed_at'         => 'datetime',
        ];
    }

    public function user(): BelongsTo
    {
        return $this->belongsTo(User::class);
    }

    public function course(): BelongsTo
    {
        return $this->belongsTo(Course::class);
    }

    public function webhookEvents(): HasMany
    {
        return $this->hasMany(PaymentWebhookEvent::class);
    }

    public function isSuccessful(): bool
    {
        return in_array($this->status, [self::STATUS_PAID, self::STATUS_CONFIRMED], true);
    }
}
