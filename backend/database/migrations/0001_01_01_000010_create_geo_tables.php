<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::create('divisions', function (Blueprint $table) {
            $table->char('id', 36)->primary();
            $table->string('name');
            $table->string('bn_name')->nullable();
            $table->json('extra')->nullable();
            $table->timestamps();
        });

        Schema::create('districts', function (Blueprint $table) {
            $table->char('id', 36)->primary();
            $table->char('division_id', 36)->nullable();
            $table->string('name');
            $table->string('bn_name')->nullable();
            $table->json('extra')->nullable();
            $table->timestamps();
            $table->foreign('division_id')->references('id')->on('divisions')->nullOnDelete();
        });

        Schema::create('upazilas', function (Blueprint $table) {
            $table->char('id', 36)->primary();
            $table->char('district_id', 36)->nullable();
            $table->string('name');
            $table->string('bn_name')->nullable();
            $table->json('extra')->nullable();
            $table->timestamps();
            $table->foreign('district_id')->references('id')->on('districts')->nullOnDelete();
        });

        Schema::create('unions', function (Blueprint $table) {
            $table->char('id', 36)->primary();
            $table->char('upazila_id', 36)->nullable();
            $table->string('name');
            $table->string('bn_name')->nullable();
            $table->json('extra')->nullable();
            $table->timestamps();
            $table->foreign('upazila_id')->references('id')->on('upazilas')->nullOnDelete();
        });

        Schema::create('mouzas', function (Blueprint $table) {
            $table->char('id', 36)->primary();
            $table->char('union_id', 36)->nullable();
            $table->string('name');
            $table->string('bn_name')->nullable();
            $table->string('jl_no')->nullable();
            $table->json('extra')->nullable();
            $table->timestamps();
            $table->foreign('union_id')->references('id')->on('unions')->nullOnDelete();
        });

        Schema::create('patwaris', function (Blueprint $table) {
            $table->char('id', 36)->primary();
            $table->char('office_id', 36)->nullable();
            $table->string('name');
            $table->string('phone')->nullable();
            $table->json('extra')->nullable();
            $table->timestamps();
            $table->index('office_id');
        });

        Schema::create('land_types', function (Blueprint $table) {
            $table->char('id', 36)->primary();
            $table->string('name');
            $table->string('bn_name')->nullable();
            $table->boolean('is_active')->default(true);
            $table->json('extra')->nullable();
            $table->timestamps();
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('land_types');
        Schema::dropIfExists('patwaris');
        Schema::dropIfExists('mouzas');
        Schema::dropIfExists('unions');
        Schema::dropIfExists('upazilas');
        Schema::dropIfExists('districts');
        Schema::dropIfExists('divisions');
    }
};
