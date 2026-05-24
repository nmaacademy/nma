<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::create('course_community_posts', function (Blueprint $table) {
            $table->id();
            $table->foreignId('course_id')->constrained('courses')->restrictOnDelete();
            $table->foreignId('user_id')->constrained('users')->restrictOnDelete();
            $table->string('title', 140);
            $table->text('body');
            $table->enum('status', ['published', 'hidden', 'pending_review'])->default('published');
            $table->boolean('is_pinned')->default(false);
            $table->boolean('is_locked')->default(false);
            $table->unsignedInteger('replies_count')->default(0);
            $table->timestamp('last_reply_at')->nullable();
            $table->timestamps();
            $table->softDeletes();

            // Composite indexes for the three main query patterns:
            // 1. list published posts in a course sorted by activity / newest / replies
            $table->index(['course_id', 'status', 'last_reply_at']);
            $table->index(['course_id', 'status', 'created_at']);
            $table->index(['course_id', 'status', 'replies_count']);
            // 2. pinned-first sorts
            $table->index(['course_id', 'is_pinned', 'last_reply_at']);
            // 3. user's own posts (for delete permission check)
            $table->index(['user_id', 'course_id']);
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('course_community_posts');
    }
};
