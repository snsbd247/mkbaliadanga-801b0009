<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Schema;

/**
 * The React frontend (originally Supabase) uses `name_bn` on all geo /
 * catalog tables, but the Laravel migrations created the column as
 * `bn_name`. That mismatch made every insert/update fail with
 * 422 "অবৈধ কলাম: name_bn" and reads returned null Bangla names.
 *
 * This renames `bn_name` -> `name_bn` everywhere it exists, and rebuilds
 * the `lands_with_location` view (which referenced `bn_name`).
 * Fully guarded so it is safe to re-run.
 */
return new class extends Migration
{
    private array $tables = [
        'divisions', 'districts', 'upazilas', 'unions', 'mouzas',
        'land_types', 'irrigation_categories',
    ];

    public function up(): void
    {
        // Drop the view first so renaming underlying columns can't break it.
        DB::statement('DROP VIEW IF EXISTS lands_with_location');

        foreach ($this->tables as $table) {
            if (Schema::hasTable($table)
                && Schema::hasColumn($table, 'bn_name')
                && ! Schema::hasColumn($table, 'name_bn')) {
                DB::statement("ALTER TABLE `{$table}` CHANGE `bn_name` `name_bn` VARCHAR(255) NULL");
            }
        }

        // Rebuild lands_with_location using name_bn.
        if (Schema::hasTable('lands')) {
            DB::statement(<<<'SQL'
                CREATE VIEW lands_with_location AS
                SELECT
                    l.id,
                    l.farmer_id,
                    l.office_id,
                    l.land_type_id,
                    l.owner_farmer_id,
                    l.owner_type,
                    l.field_type,
                    l.land_size,
                    l.dag_no,
                    l.dag_numbers,
                    l.mouza,
                    l.mouza_id,
                    l.division_id,
                    l.district_id,
                    l.upazila_id,
                    l.patwari_id,
                    l.created_at,
                    dv.name_bn AS division_name,
                    ds.name_bn AS district_name,
                    up.name_bn AS upazila_name,
                    COALESCE(mz.name_bn, mz.name) AS mouza_name,
                    pw.name AS patwari_name,
                    NULL AS patwari_name_bn,
                    pw.phone AS patwari_mobile
                FROM lands l
                LEFT JOIN divisions dv ON dv.id = l.division_id
                LEFT JOIN districts ds ON ds.id = l.district_id
                LEFT JOIN upazilas up ON up.id = l.upazila_id
                LEFT JOIN mouzas mz ON mz.id = l.mouza_id
                LEFT JOIN patwaris pw ON pw.id = l.patwari_id
                WHERE l.deleted_at IS NULL
            SQL);
        }
    }

    public function down(): void
    {
        // No-op: name_bn is the canonical column going forward.
    }
};
