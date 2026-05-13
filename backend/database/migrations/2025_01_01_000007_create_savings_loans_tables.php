<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration {
    public function up(): void {
        Schema::create('savings_accounts', function (Blueprint $t) {
            $t->uuid('id')->primary();
            $t->foreignUuid('office_id')->constrained('offices')->cascadeOnDelete();
            $t->foreignUuid('farmer_id')->constrained('farmers')->cascadeOnDelete();
            $t->string('code', 32)->unique();
            $t->decimal('balance', 14, 2)->default(0);
            $t->date('opened_on');
            $t->boolean('is_active')->default(true);
            $t->timestamps();
        });

        Schema::create('savings_transactions', function (Blueprint $t) {
            $t->uuid('id')->primary();
            $t->foreignUuid('savings_account_id')->constrained('savings_accounts')->cascadeOnDelete();
            $t->foreignUuid('office_id')->constrained('offices')->cascadeOnDelete();
            $t->date('tx_date');
            $t->string('kind', 16);                 // deposit, withdraw, interest, fee
            $t->decimal('amount', 14, 2);
            $t->string('receipt_no', 64)->nullable()->index();
            $t->string('memo')->nullable();
            $t->foreignUuid('created_by')->nullable()->constrained('users');
            $t->timestamps();
        });

        Schema::create('loan_plans', function (Blueprint $t) {
            $t->uuid('id')->primary();
            $t->foreignUuid('office_id')->constrained('offices')->cascadeOnDelete();
            $t->string('name');
            $t->decimal('interest_pct', 6, 3)->default(0);
            $t->integer('default_term_months')->default(12);
            $t->decimal('processing_fee', 12, 2)->default(0);
            $t->decimal('delay_fee_pct', 6, 3)->default(0);
            $t->jsonb('rules')->default('{}');
            $t->boolean('is_active')->default(true);
            $t->timestamps();
        });

        Schema::create('loans', function (Blueprint $t) {
            $t->uuid('id')->primary();
            $t->foreignUuid('office_id')->constrained('offices')->cascadeOnDelete();
            $t->foreignUuid('farmer_id')->constrained('farmers')->cascadeOnDelete();
            $t->foreignUuid('plan_id')->nullable()->constrained('loan_plans')->nullOnDelete();
            $t->string('code', 32)->unique();
            $t->decimal('principal', 14, 2);
            $t->decimal('interest_pct', 6, 3)->default(0);
            $t->integer('term_months')->default(12);
            $t->date('disbursed_on')->nullable();
            $t->date('first_due_on')->nullable();
            $t->string('status', 16)->default('pending'); // pending, approved, active, closed, defaulted
            $t->decimal('outstanding', 14, 2)->default(0);
            $t->jsonb('schedule')->default('[]');
            $t->foreignUuid('approved_by')->nullable()->constrained('users');
            $t->timestamp('approved_at')->nullable();
            $t->timestamps();
            $t->softDeletes();
            $t->index(['farmer_id', 'status']);
        });

        Schema::create('loan_installments', function (Blueprint $t) {
            $t->uuid('id')->primary();
            $t->foreignUuid('loan_id')->constrained('loans')->cascadeOnDelete();
            $t->integer('seq');
            $t->date('due_date');
            $t->decimal('principal_due', 14, 2)->default(0);
            $t->decimal('interest_due', 14, 2)->default(0);
            $t->decimal('paid', 14, 2)->default(0);
            $t->decimal('delay_fee', 14, 2)->default(0);
            $t->string('status', 16)->default('due'); // due, paid, partial, overdue
            $t->date('paid_on')->nullable();
            $t->timestamps();
            $t->unique(['loan_id', 'seq']);
        });
    }
    public function down(): void {
        Schema::dropIfExists('loan_installments');
        Schema::dropIfExists('loans');
        Schema::dropIfExists('loan_plans');
        Schema::dropIfExists('savings_transactions');
        Schema::dropIfExists('savings_accounts');
    }
};
