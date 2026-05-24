<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::create('payment_webhook_events', function (Blueprint $table) {
            $table->id();
            $table->string('provider')->default('netopia');
            $table->foreignId('payment_id')->nullable()->constrained('payments')->nullOnDelete();
            $table->string('order_id')->nullable()->index();
            $table->string('ntp_id')->nullable()->index();
            $table->unsignedSmallInteger('provider_status')->nullable();
            $table->boolean('verified')->default(false);
            $table->json('headers')->nullable();
            $table->json('payload')->nullable();
            $table->text('raw_payload')->nullable();
            $table->text('verification_error')->nullable();
            $table->timestamp('processed_at')->nullable();
            $table->timestamps();

            $table->index(['provider', 'verified']);
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('payment_webhook_events');
    }
};
