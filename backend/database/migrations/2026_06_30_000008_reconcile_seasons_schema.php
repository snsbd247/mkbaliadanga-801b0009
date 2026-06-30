<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Schema;

/**
 * The Seasons UI reads/writes `type`, `season_type_id`, `fiscal_year`,
 * `due_date`, and `status` on `seasons`, but the original Laravel migration
 * only created `name`, `year`, `start_date`, `end_date`, `is_active`, `extra`.
 * The mismatch made those columns disappear after insert (stripped by the
 * model) so Fiscal year / Due / Status rendered blank.
 *
 * Fully guarded so it is safe to re-run.
 */
return new class extends Migration
{
    public function up(): void
    {
        if (! Schema::hasTable('seasons')) {
            return;
        }

        Schema::table('seasons', function ($table) {
            if (! Schema::hasColumn('seasons', 'type')) {
                $table->string('type')->nullable();
            }
            if (! Schema::hasColumn('seasons', 'season_type_id')) {
                $table->char('season_type_id', 36)->nullable();
            }
            if (! Schema::hasColumn('seasons', 'fiscal_year')) {
                $table->string('fiscal_year')->nullable();
            }
            if (! Schema::hasColumn('seasons', 'due_date')) {
                $table->date('due_date')->nullable();
            }
            if (! Schema::hasColumn('seasons', 'status')) {
                $table->string('status')->default('active');
            }
        });

        // Backfill status from is_active for existing rows.
        if (Schema::hasColumn('seasons', 'status') && Schema::hasColumn('seasons', 'is_active')) {
            DB::table('seasons')->whereNull('status')->update(['status' => DB::raw("CASE WHEN is_active = 1 THEN 'active' ELSE 'closed' END")]);
        }
    }

    public function down(): void
    {
        // Non-destructive; leave columns in place.
    }
};
