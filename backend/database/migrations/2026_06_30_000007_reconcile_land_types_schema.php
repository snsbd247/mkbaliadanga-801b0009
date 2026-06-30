<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Schema;

/**
 * The Irrigation Settings UI reads/writes `code`, `name_en`, `sort_order` and
 * `deleted_at` on `land_types`, but the original Laravel migration only created
 * `name`, `bn_name (→name_bn)`, `is_active`, `extra`, timestamps. The mismatch
 * made "Land type" inserts fail (422/500) and the Code column render blank.
 *
 * This brings `land_types` in line with `irrigation_season_types` and the
 * Supabase schema. Fully guarded so it is safe to re-run.
 */
return new class extends Migration
{
    public function up(): void
    {
        if (! Schema::hasTable('land_types')) {
            return;
        }

        Schema::table('land_types', function ($table) {
            if (! Schema::hasColumn('land_types', 'code')) {
                $table->string('code')->nullable()->after('id');
            }
            if (! Schema::hasColumn('land_types', 'name_en')) {
                $table->string('name_en')->nullable()->after('name');
            }
            if (! Schema::hasColumn('land_types', 'sort_order')) {
                $table->integer('sort_order')->default(0);
            }
            if (! Schema::hasColumn('land_types', 'office_id')) {
                $table->uuid('office_id')->nullable();
            }
            if (! Schema::hasColumn('land_types', 'created_by')) {
                $table->uuid('created_by')->nullable();
            }
            if (! Schema::hasColumn('land_types', 'deleted_at')) {
                $table->timestampTz('deleted_at')->nullable();
            }
        });

        // Backfill code from name for any existing rows missing it, then make it usable.
        DB::statement("UPDATE `land_types`
            SET `code` = LOWER(REPLACE(TRIM(`name`), ' ', '_'))
            WHERE (`code` IS NULL OR `code` = '') AND `name` IS NOT NULL");

        // Mirror name into name_en where empty so the EN column isn't blank.
        DB::statement("UPDATE `land_types`
            SET `name_en` = `name`
            WHERE (`name_en` IS NULL OR `name_en` = '') AND `name` IS NOT NULL");
    }

    public function down(): void
    {
        // Non-destructive: keep the reconciled columns.
    }
};
