<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Schema;

/**
 * Reconciles the MySQL schema with what the React frontend expects:
 *  - `lands` gains the columns used by the UI (land_size, owner_type,
 *    field_type, mouza_id, geo ids, dag_numbers, etc.).
 *  - `ledger_entries` table is created (frontend reads/writes it directly
 *    instead of journal_entries/journal_lines).
 *  - `lands_with_location` and `ledger_entries_view` views are created so
 *    the corresponding pages stop returning 404.
 *
 * Every step is guarded so it is safe to run on an existing database.
 */
return new class extends Migration
{
    public function up(): void
    {
        // ── lands: add missing columns ────────────────────────────────
        if (Schema::hasTable('lands')) {
            Schema::table('lands', function (Blueprint $table) {
                if (! Schema::hasColumn('lands', 'land_size')) {
                    $table->decimal('land_size', 14, 4)->nullable();
                }
                if (! Schema::hasColumn('lands', 'owner_type')) {
                    $table->string('owner_type', 32)->nullable();
                }
                if (! Schema::hasColumn('lands', 'field_type')) {
                    $table->string('field_type', 32)->nullable();
                }
                if (! Schema::hasColumn('lands', 'mouza_id')) {
                    $table->char('mouza_id', 36)->nullable();
                }
                if (! Schema::hasColumn('lands', 'owner_farmer_id')) {
                    $table->char('owner_farmer_id', 36)->nullable();
                }
                if (! Schema::hasColumn('lands', 'division_id')) {
                    $table->char('division_id', 36)->nullable();
                }
                if (! Schema::hasColumn('lands', 'district_id')) {
                    $table->char('district_id', 36)->nullable();
                }
                if (! Schema::hasColumn('lands', 'upazila_id')) {
                    $table->char('upazila_id', 36)->nullable();
                }
                if (! Schema::hasColumn('lands', 'patwari_id')) {
                    $table->char('patwari_id', 36)->nullable();
                }
                if (! Schema::hasColumn('lands', 'dag_numbers')) {
                    $table->json('dag_numbers')->nullable();
                }
                if (! Schema::hasColumn('lands', 'remarks')) {
                    $table->text('remarks')->nullable();
                }
                if (! Schema::hasColumn('lands', 'deleted_at')) {
                    $table->softDeletes();
                }
            });

            // Backfill land_size from legacy area_decimal where empty.
            if (Schema::hasColumn('lands', 'area_decimal')) {
                DB::statement('UPDATE lands SET land_size = area_decimal WHERE land_size IS NULL AND area_decimal IS NOT NULL');
            }
        }

        // ── ledger_entries table ──────────────────────────────────────
        if (! Schema::hasTable('ledger_entries')) {
            Schema::create('ledger_entries', function (Blueprint $table) {
                $table->char('id', 36)->primary();
                $table->date('entry_date');
                $table->char('account_id', 36)->nullable();
                $table->decimal('debit', 16, 2)->default(0);
                $table->decimal('credit', 16, 2)->default(0);
                $table->string('reference_type', 64)->nullable();
                $table->char('reference_id', 36)->nullable();
                $table->text('description')->nullable();
                $table->char('office_id', 36)->nullable();
                $table->char('created_by', 36)->nullable();
                $table->timestamp('created_at')->nullable();

                $table->index('account_id');
                $table->index('office_id');
                $table->index('entry_date');
                $table->index(['reference_type', 'reference_id']);
            });
        }

        // ── lands_with_location view ──────────────────────────────────
        DB::statement('DROP VIEW IF EXISTS lands_with_location');
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
                dv.bn_name AS division_name,
                ds.bn_name AS district_name,
                up.bn_name AS upazila_name,
                COALESCE(mz.bn_name, mz.name) AS mouza_name,
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

        // ── ledger_entries_view ───────────────────────────────────────
        DB::statement('DROP VIEW IF EXISTS ledger_entries_view');
        DB::statement(<<<'SQL'
            CREATE VIEW ledger_entries_view AS
            SELECT
                le.id,
                le.entry_date,
                le.account_id,
                le.debit,
                le.credit,
                le.reference_type,
                le.reference_id,
                le.description,
                le.office_id,
                le.created_by,
                le.created_at,
                a.code AS account_code,
                a.name AS account_name,
                a.type AS account_type,
                o.name AS office_name
            FROM ledger_entries le
            LEFT JOIN accounts a ON a.id = le.account_id
            LEFT JOIN offices o ON o.id = le.office_id
        SQL);
    }

    public function down(): void
    {
        DB::statement('DROP VIEW IF EXISTS ledger_entries_view');
        DB::statement('DROP VIEW IF EXISTS lands_with_location');
        Schema::dropIfExists('ledger_entries');
    }
};
