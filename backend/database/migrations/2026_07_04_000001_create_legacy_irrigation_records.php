<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

/**
 * Self-contained store for the previous software's irrigation collection
 * history. Intentionally has NO foreign keys or relations to any existing
 * module — rows are looked up only by `legacy_farmer_code`.
 */
return new class extends Migration
{
    public function up(): void
    {
        Schema::create('legacy_irrigation_records', function (Blueprint $table) {
            $table->char('id', 36)->primary();
            $table->char('office_id', 36)->nullable();
            $table->char('import_batch_id', 36)->nullable();

            $table->string('legacy_farmer_code')->nullable();
            $table->string('farmer_name')->nullable();
            $table->string('father_name')->nullable();
            $table->string('village')->nullable();
            $table->string('mobile_no')->nullable();
            $table->string('mouza_name')->nullable();
            $table->string('season_year')->nullable();
            $table->decimal('land_shatak', 14, 2)->nullable();
            $table->string('dag_no')->nullable();
            $table->decimal('rate', 14, 2)->nullable();
            $table->string('owner_id_name')->nullable();
            $table->decimal('due_amount', 14, 2)->nullable();
            $table->decimal('paid_amount', 14, 2)->nullable();
            $table->string('owner_type_name')->nullable();
            $table->string('owner_father_name')->nullable();
            $table->string('owner_village')->nullable();
            $table->string('owner_mobile_no')->nullable();
            $table->string('owner_fid')->nullable();
            $table->string('receipt_no')->nullable();
            $table->date('collection_date')->nullable();

            $table->timestamps();

            $table->index('legacy_farmer_code');
            $table->index('office_id');
            $table->index('import_batch_id');
            $table->index('season_year');
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('legacy_irrigation_records');
    }
};
