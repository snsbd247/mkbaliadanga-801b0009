<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration {
    public function up(): void
    {
        Schema::create('accounts', function (Blueprint $t) {
            $t->char('id', 36)->primary();
            $t->char('office_id', 36)->nullable()->index();
            $t->string('code', 32)->nullable()->index();
            $t->string('name');
            $t->string('type', 32)->default('asset');   // asset/liability/income/expense/equity
            $t->boolean('is_active')->default(true);
            $t->json('meta')->nullable();
            $t->timestamps();
            $t->foreign('office_id')->references('id')->on('offices')->nullOnDelete();
        });

        Schema::create('payments', function (Blueprint $t) {
            $t->char('id', 36)->primary();
            $t->char('office_id', 36)->nullable()->index();
            $t->char('farmer_id', 36)->nullable()->index();
            $t->string('receipt_no', 64)->nullable()->index();
            $t->string('source', 32)->default('irrigation'); // irrigation/savings/loan/share/other
            $t->decimal('amount', 14, 2)->default(0);
            $t->string('method', 32)->default('cash');
            $t->date('paid_at')->nullable();
            $t->boolean('is_void')->default(false);
            $t->json('breakdown')->nullable();
            $t->char('created_by', 36)->nullable();
            $t->timestamps();
            $t->foreign('farmer_id')->references('id')->on('farmers')->nullOnDelete();
        });

        Schema::create('receipts', function (Blueprint $t) {
            $t->char('id', 36)->primary();
            $t->char('office_id', 36)->nullable()->index();
            $t->char('farmer_id', 36)->nullable();
            $t->char('payment_id', 36)->nullable()->index();
            $t->string('receipt_no', 64)->index();
            $t->string('kind', 32)->default('monthly');  // monthly / unified
            $t->decimal('amount', 14, 2)->default(0);
            $t->json('payload')->nullable();
            $t->boolean('is_void')->default(false);
            $t->char('created_by', 36)->nullable();
            $t->timestamps();
        });

        // Atomic per-office, per-month receipt counter (replaces PG sequence/function).
        Schema::create('receipt_counters', function (Blueprint $t) {
            $t->char('office_id', 36);
            $t->string('kind', 32);
            $t->unsignedSmallInteger('year');
            $t->unsignedTinyInteger('month');
            $t->unsignedInteger('last_no')->default(0);
            $t->timestamps();
            $t->primary(['office_id', 'kind', 'year', 'month'], 'receipt_counters_pk');
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('receipt_counters');
        Schema::dropIfExists('receipts');
        Schema::dropIfExists('payments');
        Schema::dropIfExists('accounts');
    }
};
