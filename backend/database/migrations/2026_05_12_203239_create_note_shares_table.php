<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::create('note_shares', function (Blueprint $table) {
            $table->id();
            $table->foreignId('note_id')->constrained()->cascadeOnDelete();
            $table->foreignId('owner_id')->constrained('users')->cascadeOnDelete();
            $table->foreignId('shared_with_id')->constrained('users')->cascadeOnDelete();
            $table->enum('permission', ['read', 'edit'])->default('read');
            $table->timestamps();
            $table->unique(['note_id', 'shared_with_id']);
            $table->index(['shared_with_id', 'created_at']);
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('note_shares');
    }
};