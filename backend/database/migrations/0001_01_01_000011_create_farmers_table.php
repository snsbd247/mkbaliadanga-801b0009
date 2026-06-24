<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::create('farmers', function (Blueprint $table) {
            $table->char('id', 36)->primary();
            $table->char('office_id', 36)->nullable();
            $table->string('code')->nullable();
            $table->string('name');
            $table->string('father_name')->nullable();
            $table->string('mother_name')->nullable();
            $table->string('phone')->nullable();
            $table->string('nid')->nullable();
            $table->string('address')->nullable();
            $table->string('village')->nullable();
            $table->string('union')->nullable();
            $table->string('upazila')->nullable();
            $table->string('district')->nullable();
            $table->string('status')->default('active');
            // Holds the remaining ~30 Supabase columns during data migration.
            $table->json('extra')->nullable();
            $table->timestamps();

            $table->unique(['office_id', 'code']);
            $table->index('office_id');
            $table->index('status');
            $table->foreign('office_id')->references('id')->on('offices')->nullOnDelete();
        });

        Schema::create('farmer_notes', function (Blueprint $table) {
            $table->char('id', 36)->primary();
            $table->char('farmer_id', 36);
            $table->char('user_id', 36)->nullable();
            $table->text('note')->nullable();
            $table->json('extra')->nullable();
            $table->timestamps();
            $table->foreign('farmer_id')->references('id')->on('farmers')->cascadeOnDelete();
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('farmer_notes');
        Schema::dropIfExists('farmers');
    }
};
