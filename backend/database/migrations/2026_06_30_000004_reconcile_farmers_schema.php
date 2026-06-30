<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Schema;

/**
 * Data-safe farmers schema reconciliation for the VPS/MySQL backend.
 *
 * The React app was originally built against the Supabase `farmers` table
 * (`name_en`, `mobile`, `member_no`, `farmer_code`, geo ids, voter fields),
 * while the first Laravel table used legacy aliases (`name`, `phone`, `code`).
 * On insert the generic gateway dropped the unknown Supabase columns, then MySQL
 * rejected the row because legacy `name` was NOT NULL.
 *
 * This migration only ADDs missing nullable/defaulted columns and backfills them
 * from existing legacy values. It never drops, truncates, renames or reseeds data,
 * so it is safe to run on a live VPS database and safe to run repeatedly.
 */
return new class extends Migration {
    public function up(): void
    {
        if (! Schema::hasTable('farmers')) {
            return;
        }

        Schema::table('farmers', function (Blueprint $table) {
            if (! Schema::hasColumn('farmers', 'name_en')) {
                $table->string('name_en')->nullable();
            }
            if (! Schema::hasColumn('farmers', 'name_bn')) {
                $table->string('name_bn')->nullable();
            }
            if (! Schema::hasColumn('farmers', 'mobile')) {
                $table->string('mobile', 32)->nullable();
            }
            if (! Schema::hasColumn('farmers', 'farmer_code')) {
                $table->string('farmer_code', 64)->nullable();
            }
            if (! Schema::hasColumn('farmers', 'member_no')) {
                $table->string('member_no', 64)->nullable();
            }
            if (! Schema::hasColumn('farmers', 'account_number')) {
                $table->string('account_number', 64)->nullable();
            }
            if (! Schema::hasColumn('farmers', 'voter_number')) {
                $table->string('voter_number', 64)->nullable();
            }
            if (! Schema::hasColumn('farmers', 'is_voter')) {
                $table->boolean('is_voter')->default(false);
            }
            if (! Schema::hasColumn('farmers', 'savings_inactive')) {
                $table->boolean('savings_inactive')->default(false);
            }
            if (! Schema::hasColumn('farmers', 'photo_url')) {
                $table->text('photo_url')->nullable();
            }
            if (! Schema::hasColumn('farmers', 'post_office')) {
                $table->string('post_office')->nullable();
            }

            foreach (['division_id', 'district_id', 'upazila_id', 'union_id', 'ward_id', 'village_id', 'mouza_id'] as $col) {
                if (! Schema::hasColumn('farmers', $col)) {
                    $table->char($col, 36)->nullable();
                }
            }
            if (! Schema::hasColumn('farmers', 'division')) {
                $table->string('division')->nullable();
            }

            if (! Schema::hasColumn('farmers', 'created_by')) {
                $table->char('created_by', 36)->nullable();
            }
            if (! Schema::hasColumn('farmers', 'deleted_at')) {
                $table->timestamp('deleted_at')->nullable();
            }
            if (! Schema::hasColumn('farmers', 'merged_at')) {
                $table->timestamp('merged_at')->nullable();
            }
            if (! Schema::hasColumn('farmers', 'merged_by')) {
                $table->char('merged_by', 36)->nullable();
            }
            if (! Schema::hasColumn('farmers', 'merged_into')) {
                $table->char('merged_into', 36)->nullable();
            }

            if (! Schema::hasColumn('farmers', 'voter_cancel_reason')) {
                $table->text('voter_cancel_reason')->nullable();
            }
            if (! Schema::hasColumn('farmers', 'voter_cancelled_at')) {
                $table->timestamp('voter_cancelled_at')->nullable();
            }
            if (! Schema::hasColumn('farmers', 'voter_cancelled_by')) {
                $table->char('voter_cancelled_by', 36)->nullable();
            }
            if (! Schema::hasColumn('farmers', 'voter_reactivate_reason')) {
                $table->text('voter_reactivate_reason')->nullable();
            }
            if (! Schema::hasColumn('farmers', 'voter_reactivated_at')) {
                $table->timestamp('voter_reactivated_at')->nullable();
            }
            if (! Schema::hasColumn('farmers', 'voter_reactivated_by')) {
                $table->char('voter_reactivated_by', 36)->nullable();
            }
        });

        // Backfill new Supabase-compatible columns from old Laravel aliases.
        if (Schema::hasColumn('farmers', 'name') && Schema::hasColumn('farmers', 'name_en')) {
            DB::statement("UPDATE farmers SET name_en = name WHERE (name_en IS NULL OR name_en = '') AND name IS NOT NULL");
            DB::statement("UPDATE farmers SET name = name_en WHERE (name IS NULL OR name = '') AND name_en IS NOT NULL");
        }
        if (Schema::hasColumn('farmers', 'phone') && Schema::hasColumn('farmers', 'mobile')) {
            DB::statement("UPDATE farmers SET mobile = phone WHERE (mobile IS NULL OR mobile = '') AND phone IS NOT NULL");
            DB::statement("UPDATE farmers SET phone = mobile WHERE (phone IS NULL OR phone = '') AND mobile IS NOT NULL");
        }
        if (Schema::hasColumn('farmers', 'code')) {
            if (Schema::hasColumn('farmers', 'member_no')) {
                DB::statement("UPDATE farmers SET member_no = code WHERE (member_no IS NULL OR member_no = '') AND code IS NOT NULL");
                DB::statement("UPDATE farmers SET code = member_no WHERE (code IS NULL OR code = '') AND member_no IS NOT NULL");
            }
            if (Schema::hasColumn('farmers', 'farmer_code')) {
                DB::statement("UPDATE farmers SET farmer_code = code WHERE (farmer_code IS NULL OR farmer_code = '') AND code IS NOT NULL");
                DB::statement("UPDATE farmers SET code = farmer_code WHERE (code IS NULL OR code = '') AND farmer_code IS NOT NULL");
            }
            if (Schema::hasColumn('farmers', 'member_no') && Schema::hasColumn('farmers', 'farmer_code')) {
                DB::statement("UPDATE farmers SET farmer_code = member_no WHERE (farmer_code IS NULL OR farmer_code = '') AND member_no IS NOT NULL");
                DB::statement("UPDATE farmers SET member_no = farmer_code WHERE (member_no IS NULL OR member_no = '') AND farmer_code IS NOT NULL");
            }
        }
    }

    public function down(): void
    {
        // Intentionally empty: never drop columns that may now contain live data.
    }
};