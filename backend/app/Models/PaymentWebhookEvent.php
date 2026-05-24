<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

class PaymentWebhookEvent extends Model
{
    protected $fillable = [
        'provider',
        'payment_id',
        'order_id',
        'ntp_id',
        'provider_status',
        'verified',
        'headers',
        'payload',
        'raw_payload',
        'verification_error',
        'processed_at',
    ];

    protected function casts(): array
    {
        return [
            'provider_status' => 'integer',
            'verified'        => 'boolean',
            'headers'         => 'array',
            'payload'         => 'array',
            'processed_at'    => 'datetime',
        ];
    }

    public function payment(): BelongsTo
    {
        return $this->belongsTo(Payment::class);
    }
}
