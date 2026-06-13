<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

/**
 * June 2026 release — mirrors recent Supabase additions:
 *  - bank_accounts (with `stream` for the 4-account mapping: sech / sech_small / saving / other)
 *  - bank_transactions (deposit / withdraw / transfer between accounts)
 *  - office_incomes (farmer-less receipts on the irrigation serial: scrap, hawlat, grants, etc.)
 *
 * Idempotent + safe to re-run.
 */
return new class extends Migration {
    public function up(): void {
        if (!Schema::hasTable('bank_accounts')) {
            Schema::create('bank_accounts', function (Blueprint $t) {
                $t->uuid('id')->primary();
                $t->foreignUuid('office_id')->nullable()->constrained('offices')->cascadeOnDelete();
                $t->string('bank_name');
                $t->string('branch')->nullable();
                $t->string('account_no', 64);
                $t->string('account_title')->nullable();
                $t->string('account_type', 32)->default('savings');
                $t->decimal('opening_balance', 14, 2)->default(0);
                $t->string('stream', 32)->default('other'); // sech | sech_small | saving | other
                $t->boolean('is_active')->default(true);
                $t->timestamps();
            });
        }

        if (!Schema::hasTable('bank_transactions')) {
            Schema::create('bank_transactions', function (Blueprint $t) {
                $t->uuid('id')->primary();
                $t->foreignUuid('office_id')->nullable()->constrained('offices')->cascadeOnDelete();
                $t->foreignUuid('bank_account_id')->constrained('bank_accounts')->cascadeOnDelete();
                $t->date('txn_date')->useCurrent();
                $t->string('txn_type', 16);            // deposit | withdraw | transfer_in | transfer_out
                $t->decimal('amount', 14, 2);
                $t->string('reference_no', 64)->nullable();
                $t->uuid('counterparty_account_id')->nullable();
                $t->uuid('transfer_group')->nullable()->index();
                $t->string('note')->nullable();
                $t->foreignUuid('created_by')->nullable()->constrained('users');
                $t->timestamp('created_at')->useCurrent();
            });
        }

        if (!Schema::hasTable('office_incomes')) {
            Schema::create('office_incomes', function (Blueprint $t) {
                $t->uuid('id')->primary();
                $t->foreignUuid('office_id')->nullable()->constrained('offices')->cascadeOnDelete();
                $t->string('receipt_no', 64)->index();
                $t->string('income_type', 32)->default('other'); // scrap | hawlat | grant | other
                $t->string('payer_name');
                $t->decimal('amount', 14, 2)->default(0);
                $t->date('received_on')->useCurrent();
                $t->string('stream', 32)->default('sech'); // sech | saving
                $t->string('note')->nullable();
                $t->foreignUuid('created_by')->nullable()->constrained('users');
                $t->timestamps();
            });
        }
    }

    public function down(): void {
        Schema::dropIfExists('office_incomes');
        Schema::dropIfExists('bank_transactions');
        Schema::dropIfExists('bank_accounts');
    }
};
