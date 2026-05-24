<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::table('users', function (Blueprint $table) {
            // Number of confirmed account-sharing violations detected.
            // Incremented each time a displaced watch session sends a heartbeat.
            $table->unsignedInteger('strikes')->default(0)->after('status');

            // UUID of the most recent active playback session.
            // Updated every time a new watch session starts.
            // Used in heartbeat validation: if the incoming token doesn't match, the
            // session has been displaced by a newer session on another device.
            $table->string('active_playback_session_id', 36)->nullable()->after('strikes');
        });
    }

    public function down(): void
    {
        Schema::table('users', function (Blueprint $table) {
            $table->dropColumn(['strikes', 'active_playback_session_id']);
        });
    }
};
