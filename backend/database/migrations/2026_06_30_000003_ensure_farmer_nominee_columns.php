<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

/**
 * Data-safe, additive migration.
 *
 * The bulk farmer import (and the Farmer add/edit form) send nominee fields.
 * The generic DB gateway drops any column that doesn't physically exist on
 * the MySQL `farmers` table, so nominee data was silently discarded on VPS
 * installs whose `farmers` table predates these columns.
 *
 * This only ADDS columns when missing (guarded by hasColumn) — it never
 * drops, renames or truncates anything, so existing data is preserved and
 * it is safe to run repeatedly.
 */
return new class extends Migration {
    public function up(): void
    {
        if (! Schema::hasTable('farmers')) {
            return;
        }

        Schema::table('farmers', function (Blueprint $table) {
            if (! Schema::hasColumn('farmers', 'nominee_name')) {
                $table->string('nominee_name')->nullable();
            }
            if (! Schema::hasColumn('farmers', 'nominee_mobile')) {
                $table->string('nominee_mobile')->nullable();
            }
            if (! Schema::hasColumn('farmers', 'nominee_relation')) {
                $table->string('nominee_relation')->nullable();
            }
            if (! Schema::hasColumn('farmers', 'nominee_nid')) {
                $table->string('nominee_nid')->nullable();
            }
            if (! Schema::hasColumn('farmers', 'nominee_address')) {
                $table->string('nominee_address')->nullable();
            }
        });
    }

    public function down(): void
    {
        // Intentionally left empty — never drop columns that may hold data.
    }
};
