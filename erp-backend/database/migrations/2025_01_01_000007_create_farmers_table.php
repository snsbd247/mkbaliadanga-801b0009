<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration {
    public function up(): void
    {
        Schema::create('farmers', function (Blueprint $t) {
            $t->char('id', 36)->primary();
            $t->char('office_id', 36)->nullable()->index();
            $t->string('code', 64)->nullable()->index();   // farmer code
            $t->string('name');
            $t->string('bn_name')->nullable();
            $t->string('father_name')->nullable();
            $t->string('mother_name')->nullable();
            $t->string('spouse_name')->nullable();
            $t->string('nid', 32)->nullable()->index();
            $t->string('phone', 32)->nullable()->index();
            $t->date('dob')->nullable();
            $t->string('gender', 16)->nullable();
            $t->string('village')->nullable();
            $t->char('mouza_id', 36)->nullable();
            $t->char('union_id', 36)->nullable();
            $t->char('upazila_id', 36)->nullable();
            $t->char('district_id', 36)->nullable();
            $t->string('address')->nullable();
            $t->string('photo_url')->nullable();
            $t->string('nominee_name')->nullable();
            $t->string('nominee_relation')->nullable();
            $t->string('nominee_nid', 32)->nullable();
            $t->string('nominee_phone', 32)->nullable();
            $t->string('status', 32)->default('active')->index();
            $t->boolean('is_member')->default(false);
            $t->boolean('is_blocked')->default(false);
            // Catch-all for remaining Supabase columns during data migration.
            $t->json('extra')->nullable();
            $t->char('created_by', 36)->nullable();
            $t->timestamps();
            $t->softDeletes();

            $t->foreign('office_id')->references('id')->on('offices')->nullOnDelete();
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('farmers');
    }
};
