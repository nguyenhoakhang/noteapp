<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::table('notes', function (Blueprint $table) {
            $table->index('user_id');
            $table->index('is_pinned');
            $table->index('pinned_at');
            $table->index(['user_id', 'is_pinned', 'pinned_at']);
        });
    }

    public function down(): void
    {
        Schema::table('notes', function (Blueprint $table) {
            $table->dropIndex(['user_id', 'is_pinned', 'pinned_at']);
            $table->dropIndex(['pinned_at']);
            $table->dropIndex(['is_pinned']);
            $table->dropIndex(['user_id']);
        });
    }
};
