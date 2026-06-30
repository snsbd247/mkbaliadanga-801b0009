<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Schema;

/**
 * Data-safe patwaris schema reconciliation for the VPS/MySQL backend.
 *
 * The React admin Patwari form sends name_bn, mobile, nid, address, mouza_id,
 * is_active, note and created_by, but the original MySQL table only had
 * office_id/name/phone/extra. The generic gateway dropped the unknown columns,
 * so new patwaris could not be saved correctly. This migration only ADDs the
 * missing nullable/defaulted columns and backfills mobile from phone.
 * It never drops, truncates or reseeds data, so it is safe on a live DB
 * and safe to run repeatedly.
 */
return new class extends Migration {
    public function up(): void
    {
        if (! Schema::hasTable('patwaris')) {
            return;
        }

        Schema::table('patwaris', function (Blueprint $table) {
            if (! Schema::hasColumn('patwaris', 'name_bn')) {
                $table->string('name_bn')->nullable();
            }
            if (! Schema::hasColumn('patwaris', 'mobile')) {
                $table->string('mobile', 32)->nullable();
            }
            if (! Schema::hasColumn('patwaris', 'nid')) {
                $table->string('nid', 64)->nullable();
            }
            if (! Schema::hasColumn('patwaris', 'address')) {
                $table->string('address')->nullable();
            }
            if (! Schema::hasColumn('patwaris', 'mouza_id')) {
                $table->char('mouza_id', 36)->nullable();
            }
            if (! Schema::hasColumn('patwaris', 'is_active')) {
                $table->boolean('is_active')->default(true);
            }
            if (! Schema::hasColumn('patwaris', 'note')) {
                $table->text('note')->nullable();
            }
            if (! Schema::hasColumn('patwaris', 'created_by')) {
                $table->char('created_by', 36)->nullable();
            }
        });

        if (Schema::hasColumn('patwaris', 'phone') && Schema::hasColumn('patwaris', 'mobile')) {
            DB::statement("UPDATE patwaris SET mobile = phone WHERE (mobile IS NULL OR mobile = '') AND phone IS NOT NULL");
            DB::statement("UPDATE patwaris SET phone = mobile WHERE (phone IS NULL OR phone = '') AND mobile IS NOT NULL");
        }
    }

    public function down(): void
    {
        // Intentionally empty: never drop columns that may now contain live data.
    }
};
