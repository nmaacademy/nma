<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::table('video_watch_sessions', function (Blueprint $table) {
            // UUID generated at session start, stored here and on users.active_playback_session_id.
            // Sent to the frontend and included in every heartbeat request.
            // If users.active_playback_session_id no longer matches this token, the session
            // has been displaced by a newer playback on another device → strike.
            $table->char('playback_session_token', 36)->nullable()->after('user_session_id')->index();
        });
    }

    public function down(): void
    {
        Schema::table('video_watch_sessions', function (Blueprint $table) {
            $table->dropColumn('playback_session_token');
        });
    }
};
