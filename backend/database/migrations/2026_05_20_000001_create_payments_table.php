<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::create('payments', function (Blueprint $table) {
            $table->id();
            $table->foreignId('user_id')->constrained('users')->restrictOnDelete();
            $table->foreignId('course_id')->constrained('courses')->restrictOnDelete();
            $table->string('provider')->default('netopia');
            $table->string('order_id')->unique();
            $table->string('ntp_id')->nullable()->index();
            $table->string('status')->default('pending')->index();
            $table->unsignedSmallInteger('provider_status')->nullable();
            $table->string('error_code')->nullable();
            $table->text('error_message')->nullable();
            $table->decimal('amount', 10, 2);
            $table->string('currency', 3)->default('RON');
            $table->string('customer_action_type')->nullable();
            $table->text('customer_action_url')->nullable();
            $table->text('authentication_token')->nullable();
            $table->json('request_payload')->nullable();
            $table->json('response_payload')->nullable();
            $table->json('last_webhook_payload')->nullable();
            $table->timestamp('paid_at')->nullable();
            $table->timestamp('confirmed_at')->nullable();
            $table->timestamps();

            $table->index(['user_id', 'status']);
            $table->index(['course_id', 'status']);
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('payments');
    }
};
