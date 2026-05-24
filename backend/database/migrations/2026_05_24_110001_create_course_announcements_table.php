<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::create('course_announcements', function (Blueprint $table) {
            $table->id();
            $table->foreignId('course_id')->constrained('courses')->restrictOnDelete();
            $table->foreignId('created_by')->nullable()->constrained('users')->nullOnDelete();
            $table->string('title', 160);
            $table->text('body');
            $table->enum('status', ['draft', 'published', 'hidden'])->default('draft');
            $table->boolean('is_pinned')->default(false);
            $table->timestamp('published_at')->nullable();
            $table->timestamps();
            $table->softDeletes();

            // Main member list query: published announcements for a course sorted by date
            $table->index(['course_id', 'status', 'published_at']);
            // Pinned-first sort
            $table->index(['course_id', 'is_pinned', 'published_at']);
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('course_announcements');
    }
};
