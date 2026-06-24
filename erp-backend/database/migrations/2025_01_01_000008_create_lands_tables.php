<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration {
    public function up(): void
    {
        Schema::create('land_types', function (Blueprint $t) {
            $t->char('id', 36)->primary();
            $t->char('office_id', 36)->nullable()->index();
            $t->string('name');
            $t->string('bn_name')->nullable();
            $t->boolean('is_active')->default(true);
            $t->json('meta')->nullable();
            $t->timestamps();
            $t->foreign('office_id')->references('id')->on('offices')->nullOnDelete();
        });

        Schema::create('lands', function (Blueprint $t) {
            $t->char('id', 36)->primary();
            $t->char('office_id', 36)->nullable()->index();
            $t->char('farmer_id', 36)->nullable()->index();
            $t->char('land_type_id', 36)->nullable();
            $t->char('mouza_id', 36)->nullable();
            $t->string('dag_no', 64)->nullable()->index();
            $t->string('khatian_no', 64)->nullable();
            // Land size kept in decimals to avoid PG-style rounding issues.
            $t->decimal('katha', 12, 4)->default(0);
            $t->decimal('shatak', 12, 4)->default(0);
            $t->string('owner_name')->nullable();
            $t->string('land_status', 32)->default('own');   // own / barga
            $t->boolean('is_active')->default(true);
            $t->json('extra')->nullable();
            $t->char('created_by', 36)->nullable();
            $t->timestamps();
            $t->softDeletes();

            $t->foreign('office_id')->references('id')->on('offices')->nullOnDelete();
            $t->foreign('farmer_id')->references('id')->on('farmers')->nullOnDelete();
            $t->foreign('land_type_id')->references('id')->on('land_types')->nullOnDelete();
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('lands');
        Schema::dropIfExists('land_types');
    }
};
