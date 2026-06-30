<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Schema;

/**
 * The Locations UI persists `upazila_id` on mouzas (its direct parent in the
 * app's hierarchy), but the original table only had `union_id`. Inserts then
 * failed with 422 "অবৈধ কলাম: upazila_id".
 *
 * Adds `upazila_id` (and an `is_active` flag used by the cascading dropdowns)
 * to the geo tables where missing. Fully guarded + data-preserving.
 */
return new class extends Migration
{
    public function up(): void
    {
        if (Schema::hasTable('mouzas') && ! Schema::hasColumn('mouzas', 'upazila_id')) {
            Schema::table('mouzas', function ($table) {
                $table->char('upazila_id', 36)->nullable()->after('union_id');
            });
        }

        foreach (['divisions', 'districts', 'upazilas', 'unions', 'mouzas'] as $t) {
            if (Schema::hasTable($t) && ! Schema::hasColumn($t, 'is_active')) {
                Schema::table($t, function ($table) {
                    $table->boolean('is_active')->default(true);
                });
                DB::table($t)->update(['is_active' => true]);
            }
        }
    }

    public function down(): void
    {
        // No-op: additive columns are safe to keep.
    }
};
