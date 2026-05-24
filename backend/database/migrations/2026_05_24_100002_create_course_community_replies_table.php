<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::create('course_community_replies', function (Blueprint $table) {
            $table->id();
            $table->foreignId('course_id')->constrained('courses')->restrictOnDelete();
            $table->foreignId('post_id')->constrained('course_community_posts')->cascadeOnDelete();
            $table->foreignId('user_id')->constrained('users')->restrictOnDelete();
            $table->text('body');
            $table->enum('status', ['published', 'hidden', 'pending_review'])->default('published');
            $table->timestamps();
            $table->softDeletes();

            // Fetch replies for a post in chronological order (most common query)
            $table->index(['post_id', 'status', 'created_at']);
            // User's own replies (for delete permission check)
            $table->index(['user_id', 'course_id']);
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('course_community_replies');
    }
};
