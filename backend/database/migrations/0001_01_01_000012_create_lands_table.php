<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::create('lands', function (Blueprint $table) {
            $table->char('id', 36)->primary();
            $table->char('farmer_id', 36);
            $table->char('office_id', 36)->nullable();
            $table->char('land_type_id', 36)->nullable();
            $table->string('khatian_no')->nullable();
            $table->string('dag_no')->nullable();
            $table->decimal('area_decimal', 12, 4)->nullable();
            $table->string('mouza')->nullable();
            $table->text('notes')->nullable();
            $table->json('extra')->nullable();
            $table->timestamps();

            $table->index('farmer_id');
            $table->index('office_id');
            $table->foreign('farmer_id')->references('id')->on('farmers')->cascadeOnDelete();
            $table->foreign('office_id')->references('id')->on('offices')->nullOnDelete();
            $table->foreign('land_type_id')->references('id')->on('land_types')->nullOnDelete();
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('lands');
    }
};
