<?php

namespace App\Mail;

use Illuminate\Bus\Queueable;
use Illuminate\Mail\Mailable;
use Illuminate\Mail\Mailables\Content;
use Illuminate\Mail\Mailables\Envelope;
use Illuminate\Queue\SerializesModels;

class AccountSharingWarningMail extends Mailable
{
    use Queueable, SerializesModels;

    public function __construct(
        public readonly string $userName,
        public readonly int    $strikeCount,
        public readonly string $detectedAt,
    ) {}

    public function envelope(): Envelope
    {
        return new Envelope(
            subject: 'Avertizare securitate — Activitate suspectă detectată pe contul tău NMA Academy',
        );
    }

    public function content(): Content
    {
        return new Content(
            view: 'emails.account-sharing-warning',
        );
    }
}
