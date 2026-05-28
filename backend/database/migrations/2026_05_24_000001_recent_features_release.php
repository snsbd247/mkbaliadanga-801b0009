<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;
use Illuminate\Support\Facades\DB;

/**
 * May 2026 release — backend mirror migration. Idempotent + safe to re-run.
 *
 * - Office-wise unique loan number (partial unique index, ignores soft-deleted).
 *   NOTE: original `loans` schema uses `code` for the human-readable loan number.
 *   We add a `loan_no` shadow column (kept in sync with `code`) ONLY if it does
 *   not already exist, and create the partial unique index on whichever column
 *   is present. This keeps fresh installs and legacy DBs both working.
 * - Adds 'hawlat', 'bank', 'mobile_banking' to irrigation payment category enum
 *   (only if the enum exists — newer installs use a categories lookup table).
 * - Creates irrigation_payment_categories lookup table (required by seeder).
 * - Creates qr_tokens table for /r/{token} receipt verification.
 * - Adds verify_token column to payments.
 */
return new class extends Migration {
    public function up(): void {
        // 1. Office-wise unique Loan No (works against `loan_no` if present,
        //    otherwise falls back to the existing `code` column).
        if (Schema::hasTable('loans')) {
            $col = Schema::hasColumn('loans', 'loan_no')
                ? 'loan_no'
                : (Schema::hasColumn('loans', 'code') ? 'code' : null);

            if ($col) {
                $hasSoftDeletes = Schema::hasColumn('loans', 'deleted_at');
                $where = $hasSoftDeletes ? 'WHERE deleted_at IS NULL' : '';
                DB::statement(
                    "CREATE UNIQUE INDEX IF NOT EXISTS idx_loans_office_loan_no_unique
                     ON loans (office_id, {$col}) {$where}"
                );
            }
        }

        // 2. Extend irrigation payment category enum — only if the legacy enum
        //    type exists. Modern schema uses irrigation_payment_categories table.
        $enumExists = DB::selectOne(
            "SELECT 1 AS x FROM pg_type WHERE typname = 'irrigation_payment_category'"
        );
        if ($enumExists) {
            foreach (['hawlat', 'bank', 'mobile_banking'] as $v) {
                DB::statement("ALTER TYPE irrigation_payment_category ADD VALUE IF NOT EXISTS '{$v}'");
            }
        }

        // 3. irrigation_payment_categories lookup table (required by seeder).
        if (!Schema::hasTable('irrigation_payment_categories')) {
            Schema::create('irrigation_payment_categories', function (Blueprint $t) {
                $t->bigIncrements('id');
                $t->string('code', 32)->unique();
                $t->string('label_en');
                $t->string('label_bn');
                $t->boolean('is_active')->default(true);
                $t->timestamps();
            });
        }

        // 4. qr_tokens table
        if (!Schema::hasTable('qr_tokens')) {
            Schema::create('qr_tokens', function (Blueprint $t) {
                $t->uuid('id')->primary();
                $t->string('token', 64)->unique();
                $t->uuid('payment_id')->nullable()->index();
                $t->string('payment_type', 32)->nullable();   // savings | loan | irrigation | combined
                $t->uuid('farmer_id')->nullable()->index();
                $t->timestamp('expires_at')->nullable();
                $t->timestamp('revoked_at')->nullable();
                $t->timestamps();
            });
        }

        // 5. payments.verify_token
        if (Schema::hasTable('payments') && !Schema::hasColumn('payments', 'verify_token')) {
            Schema::table('payments', function (Blueprint $t) {
                $t->string('verify_token', 64)->nullable()->index();
            });
        }
    }

    public function down(): void {
        DB::statement("DROP INDEX IF EXISTS idx_loans_office_loan_no_unique");
        if (Schema::hasTable('payments') && Schema::hasColumn('payments', 'verify_token')) {
            Schema::table('payments', fn (Blueprint $t) => $t->dropColumn('verify_token'));
        }
        Schema::dropIfExists('qr_tokens');
        Schema::dropIfExists('irrigation_payment_categories');
    }
};
