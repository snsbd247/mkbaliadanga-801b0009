<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration {
    public function up(): void
    {
        Schema::create('savings_plans', function (Blueprint $t) {
            $t->char('id', 36)->primary();
            $t->char('office_id', 36)->nullable()->index();
            $t->string('name');
            $t->string('bn_name')->nullable();
            $t->decimal('amount', 14, 2)->default(0);
            $t->string('frequency', 32)->default('monthly');
            $t->boolean('is_active')->default(true);
            $t->json('meta')->nullable();
            $t->timestamps();
            $t->foreign('office_id')->references('id')->on('offices')->nullOnDelete();
        });

        Schema::create('savings_transactions', function (Blueprint $t) {
            $t->char('id', 36)->primary();
            $t->char('office_id', 36)->nullable()->index();
            $t->char('farmer_id', 36)->nullable()->index();
            $t->char('plan_id', 36)->nullable();
            $t->string('receipt_no', 64)->nullable()->index();
            $t->string('type', 16)->default('deposit');   // deposit / withdraw
            $t->decimal('amount', 14, 2)->default(0);
            $t->date('txn_date')->nullable();
            $t->boolean('is_void')->default(false);
            $t->json('extra')->nullable();
            $t->char('created_by', 36)->nullable();
            $t->timestamps();
            $t->foreign('farmer_id')->references('id')->on('farmers')->nullOnDelete();
        });

        Schema::create('shares', function (Blueprint $t) {
            $t->char('id', 36)->primary();
            $t->char('office_id', 36)->nullable()->index();
            $t->char('farmer_id', 36)->nullable()->index();
            $t->integer('qty')->default(0);
            $t->decimal('amount', 14, 2)->default(0);
            $t->date('issued_at')->nullable();
            $t->timestamps();
            $t->foreign('farmer_id')->references('id')->on('farmers')->nullOnDelete();
        });

        Schema::create('loans', function (Blueprint $t) {
            $t->char('id', 36)->primary();
            $t->char('office_id', 36)->nullable()->index();
            $t->char('farmer_id', 36)->nullable()->index();
            $t->string('loan_no', 64)->nullable()->index();
            $t->decimal('principal', 14, 2)->default(0);
            $t->decimal('interest_rate', 8, 2)->default(0);
            $t->integer('term_months')->default(0);
            $t->decimal('paid', 14, 2)->default(0);
            $t->decimal('outstanding', 14, 2)->default(0);
            $t->string('status', 32)->default('pending')->index();
            $t->date('disbursed_at')->nullable();
            $t->json('extra')->nullable();
            $t->char('created_by', 36)->nullable();
            $t->timestamps();
            $t->softDeletes();
            $t->foreign('farmer_id')->references('id')->on('farmers')->nullOnDelete();
        });

        Schema::create('loan_payments', function (Blueprint $t) {
            $t->char('id', 36)->primary();
            $t->char('office_id', 36)->nullable()->index();
            $t->char('loan_id', 36)->nullable()->index();
            $t->char('farmer_id', 36)->nullable();
            $t->string('receipt_no', 64)->nullable()->index();
            $t->decimal('principal_part', 14, 2)->default(0);
            $t->decimal('interest_part', 14, 2)->default(0);
            $t->decimal('amount', 14, 2)->default(0);
            $t->date('paid_at')->nullable();
            $t->boolean('is_void')->default(false);
            $t->json('extra')->nullable();
            $t->char('created_by', 36)->nullable();
            $t->timestamps();
            $t->foreign('loan_id')->references('id')->on('loans')->nullOnDelete();
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('loan_payments');
        Schema::dropIfExists('loans');
        Schema::dropIfExists('shares');
        Schema::dropIfExists('savings_transactions');
        Schema::dropIfExists('savings_plans');
    }
};
