<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration {
    public function up(): void {
        // Geographic locations (BD divisions / districts / upazilas / unions / villages)
        Schema::create('locations', function (Blueprint $t) {
            $t->uuid('id')->primary();
            $t->uuid('parent_id')->nullable();
            $t->string('kind', 32);      // division, district, upazila, union, village
            $t->string('name');
            $t->string('name_bn')->nullable();
            $t->string('code', 32)->nullable();
            $t->timestamps();
            $t->index(['kind', 'parent_id']);
        });

        // Self-referencing FK added after table creation to avoid PG unique-constraint resolution issue
        Schema::table('locations', function (Blueprint $t) {
            $t->foreign('parent_id')->references('id')->on('locations')->nullOnDelete();
        });

        Schema::create('seasons', function (Blueprint $t) {
            $t->uuid('id')->primary();
            $t->foreignUuid('office_id')->constrained('offices')->cascadeOnDelete();
            $t->string('name');                 // Boro 2025, Aman 2024, ...
            $t->string('name_bn')->nullable();
            $t->date('start_date');
            $t->date('end_date');
            $t->boolean('is_active')->default(false);
            $t->jsonb('rates')->default('{}');
            $t->timestamps();
            $t->unique(['office_id', 'name']);
        });

        Schema::create('farmers', function (Blueprint $t) {
            $t->uuid('id')->primary();
            $t->foreignUuid('office_id')->constrained('offices')->cascadeOnDelete();
            $t->string('code', 32)->index();    // FRM-0001
            $t->string('name');
            $t->string('name_bn')->nullable();
            $t->string('father_name')->nullable();
            $t->string('mother_name')->nullable();
            $t->string('mobile', 32)->nullable()->index();
            $t->string('nid', 32)->nullable()->index();
            $t->date('dob')->nullable();
            $t->string('gender', 16)->nullable();
            $t->foreignUuid('village_id')->nullable()->constrained('locations')->nullOnDelete();
            $t->string('address')->nullable();
            $t->string('photo_path')->nullable();
            $t->boolean('is_voter')->default(false);
            $t->date('joined_on')->nullable();
            $t->jsonb('extra')->default('{}');
            $t->boolean('is_active')->default(true);
            $t->timestamps();
            $t->softDeletes();
            $t->unique(['office_id', 'code']);
        });

        Schema::create('farmer_credentials', function (Blueprint $t) {
            $t->uuid('id')->primary();
            $t->foreignUuid('farmer_id')->constrained('farmers')->cascadeOnDelete();
            $t->string('password_hash')->nullable();
            $t->string('otp_code', 12)->nullable();
            $t->timestamp('otp_expires_at')->nullable();
            $t->integer('otp_attempts')->default(0);
            $t->timestamp('last_login_at')->nullable();
            $t->timestamps();
            $t->unique('farmer_id');
        });

        Schema::create('lands', function (Blueprint $t) {
            $t->uuid('id')->primary();
            $t->foreignUuid('office_id')->constrained('offices')->cascadeOnDelete();
            $t->foreignUuid('farmer_id')->constrained('farmers')->cascadeOnDelete();
            $t->string('dag_no', 64)->nullable();
            $t->string('khatian_no', 64)->nullable();
            $t->decimal('area_decimal', 10, 2)->default(0);    // shotok / decimal
            $t->foreignUuid('village_id')->nullable()->constrained('locations')->nullOnDelete();
            $t->string('crop')->nullable();
            $t->jsonb('meta')->default('{}');
            $t->timestamps();
            $t->softDeletes();
            $t->index(['farmer_id']);
        });
    }
    public function down(): void {
        Schema::dropIfExists('lands');
        Schema::dropIfExists('farmer_credentials');
        Schema::dropIfExists('farmers');
        Schema::dropIfExists('seasons');
        Schema::dropIfExists('locations');
    }
};
