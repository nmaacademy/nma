<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::create('video_anomaly_logs', function (Blueprint $table) {
            $table->id();

            $table->foreignId('user_id')->constrained('users')->cascadeOnDelete();
            $table->foreignId('video_id')->nullable()->constrained('course_videos')->nullOnDelete();
            $table->unsignedBigInteger('watch_session_id')->nullable();
            $table->unsignedBigInteger('user_session_id')->nullable();

            // Anomaly classifier — used for admin dashboard filtering.
            // Values: ua_mismatch | ip_change | rapid_token_refresh | seek_burst | watch_conflict_attempt
            $table->string('anomaly_type', 50);

            // Human-readable summary — shown directly in admin UI.
            $table->string('reason', 255);

            // Structured details — specific values (hashes, counts, timestamps, etc.)
            // that allow exact reconstruction of what was suspicious.
            $table->json('details')->nullable();

            $table->string('ip_address', 45)->nullable();
            $table->text('user_agent')->nullable();

            $table->timestamps();

            $table->index('user_id');
            $table->index('anomaly_type');
            $table->index('created_at');
            $table->index(['user_id', 'anomaly_type']);
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('video_anomaly_logs');
    }
};
