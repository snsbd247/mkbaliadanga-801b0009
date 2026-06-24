<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration {
    public function up(): void
    {
        Schema::create('divisions', function (Blueprint $t) {
            $t->char('id', 36)->primary();
            $t->string('name');
            $t->string('bn_name')->nullable();
            $t->timestamps();
        });

        Schema::create('districts', function (Blueprint $t) {
            $t->char('id', 36)->primary();
            $t->char('division_id', 36)->nullable()->index();
            $t->string('name');
            $t->string('bn_name')->nullable();
            $t->timestamps();
            $t->foreign('division_id')->references('id')->on('divisions')->nullOnDelete();
        });

        Schema::create('upazilas', function (Blueprint $t) {
            $t->char('id', 36)->primary();
            $t->char('district_id', 36)->nullable()->index();
            $t->string('name');
            $t->string('bn_name')->nullable();
            $t->timestamps();
            $t->foreign('district_id')->references('id')->on('districts')->nullOnDelete();
        });

        Schema::create('unions', function (Blueprint $t) {
            $t->char('id', 36)->primary();
            $t->char('upazila_id', 36)->nullable()->index();
            $t->string('name');
            $t->string('bn_name')->nullable();
            $t->timestamps();
            $t->foreign('upazila_id')->references('id')->on('upazilas')->nullOnDelete();
        });

        Schema::create('mouzas', function (Blueprint $t) {
            $t->char('id', 36)->primary();
            $t->char('union_id', 36)->nullable()->index();
            $t->string('name');
            $t->string('bn_name')->nullable();
            $t->string('jl_no', 32)->nullable();
            $t->timestamps();
            $t->foreign('union_id')->references('id')->on('unions')->nullOnDelete();
        });

        Schema::create('patwaris', function (Blueprint $t) {
            $t->char('id', 36)->primary();
            $t->char('office_id', 36)->nullable()->index();
            $t->string('name');
            $t->string('phone', 32)->nullable();
            $t->string('designation')->nullable();
            $t->boolean('is_active')->default(true);
            $t->json('meta')->nullable();
            $t->timestamps();
            $t->foreign('office_id')->references('id')->on('offices')->nullOnDelete();
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('patwaris');
        Schema::dropIfExists('mouzas');
        Schema::dropIfExists('unions');
        Schema::dropIfExists('upazilas');
        Schema::dropIfExists('districts');
        Schema::dropIfExists('divisions');
    }
};
