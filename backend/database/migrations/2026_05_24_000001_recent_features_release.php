<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;
use Illuminate\Support\Facades\DB;

/**
 * May 2026 release — backend mirror migration.
 *
 * - Office-wise unique loan_no (partial unique index, ignores soft-deleted).
 * - Adds 'hawlat', 'bank', 'mobile_banking' to irrigation_payments.category enum.
 * - Creates qr_tokens table for /r/{token} receipt verification.
 * - Adds verify_token column to payments.
 */
return new class extends Migration {
    public function up(): void {
        // 1. Office-wise unique Loan No
        DB::statement(
            "CREATE UNIQUE INDEX IF NOT EXISTS idx_loans_office_loan_no_unique
             ON loans (office_id, loan_no)
             WHERE deleted_at IS NULL"
        );

        // 2. Extend irrigation payment category enum (Postgres)
        foreach (['hawlat', 'bank', 'mobile_banking'] as $v) {
            DB::statement("ALTER TYPE irrigation_payment_category ADD VALUE IF NOT EXISTS '$v'");
        }

        // 3. qr_tokens table
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

        // 4. payments.verify_token
        if (Schema::hasTable('payments') && !Schema::hasColumn('payments', 'verify_token')) {
            Schema::table('payments', function (Blueprint $t) {
                $t->string('verify_token', 64)->nullable()->index();
            });
        }
    }

    public function down(): void {
        DB::statement("DROP INDEX IF EXISTS idx_loans_office_loan_no_unique");
        if (Schema::hasColumn('payments', 'verify_token')) {
            Schema::table('payments', fn (Blueprint $t) => $t->dropColum