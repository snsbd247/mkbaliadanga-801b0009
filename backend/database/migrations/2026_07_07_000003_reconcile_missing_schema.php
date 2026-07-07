<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        // 1) profiles.receipt_layout (jsonb) — used by receipt layout settings/sync
        if (Schema::hasTable('profiles') && ! Schema::hasColumn('profiles', 'receipt_layout')) {
            Schema::table('profiles', function (Blueprint $table) {
                $table->json('receipt_layout')->nullable();
            });
        }

        // 2) receipt_no_legacy_map — maps legacy receipt numbers to source rows
        if (! Schema::hasTable('receipt_no_legacy_map')) {
            Schema::create('receipt_no_legacy_map', function (Blueprint $table) {
                $table->char('id', 36)->primary();
                $table->text('source_table');
                $table->char('source_id', 36);
                $table->text('legacy_receipt_no');
                $table->bigInteger('numeric_alias');
                $table->char('office_id', 36)->nullable();
                $table->timestampTz('created_at')->useCurrent();

                $table->unique(['source_table', 'source_id'], 'receipt_no_legacy_map_source_table_source_id_key');
            });
        }
    }

    public function down(): void
    {
        if (Schema::hasTable('profiles') && Schema::hasColumn('profiles', 'receipt_layout')) {
            Schema::table('profiles', function (Blueprint $table) {
                $table->dropColumn('receipt_layout');
            });
        }

        Schema::dropIfExists('receipt_no_legacy_map');
    }
};
