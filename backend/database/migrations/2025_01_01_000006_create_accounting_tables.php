<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration {
    public function up(): void {
        // Chart of accounts
        Schema::create('accounts', function (Blueprint $t) {
            $t->uuid('id')->primary();
            $t->foreignUuid('office_id')->nullable()->constrained('offices')->cascadeOnDelete();
            $t->string('code', 32);
            $t->string('name');
            $t->string('name_bn')->nullable();
            $t->string('type', 16);   // asset, liability, equity, income, expense
            $t->foreignUuid('parent_id')->nullable()->constrained('accounts')->nullOnDelete();
            $t->boolean('is_active')->default(true);
            $t->timestamps();
            $t->unique(['office_id', 'code']);
        });

        Schema::create('journal_entries', function (Blueprint $t) {
            $t->uuid('id')->primary();
            $t->foreignUuid('office_id')->constrained('offices')->cascadeOnDelete();
            $t->string('reference', 64)->nullable()->index();
            $t->date('entry_date')->index();
            $t->string('memo')->nullable();
            $t->string('source_type', 64)->nullable();   // loan, irrigation_invoice, payment, manual...
            $t->uuid('source_id')->nullable();
            $t->foreignUuid('created_by')->nullable()->constrained('users')->nullOnDelete();
            $t->timestamps();
            $t->index(['source_type', 'source_id']);
        });

        Schema::create('ledger_entries', function (Blueprint $t) {
            $t->uuid('id')->primary();
            $t->foreignUuid('journal_entry_id')->constrained('journal_entries')->cascadeOnDelete();
            $t->foreignUuid('office_id')->constrained('offices')->cascadeOnDelete();
            $t->foreignUuid('account_id')->constrained('accounts');
            $t->date('entry_date')->index();
            $t->decimal('debit', 16, 2)->default(0);
            $t->decimal('credit', 16, 2)->default(0);
            $t->string('reference_type', 64)->nullable();
            $t->uuid('reference_id')->nullable();
            $t->string('memo')->nullable();
            $t->timestamps();
            $t->index(['account_id', 'entry_date']);
            $t->index(['reference_type', 'reference_id']);
        });

        Schema::create('period_closes', function (Blueprint $t) {
            $t->uuid('id')->primary();
            $t->foreignUuid('office_id')->constrained('offices')->cascadeOnDelete();
            $t->smallInteger('year');
            $t->smallInteger('month');
            $t->timestamp('closed_at');
            $t->foreignUuid('closed_by')->nullable()->constrained('users');
            $t->jsonb('snapshot')->default('{}');
            $t->unique(['office_id', 'year', 'month']);
        });
    }
    public function down(): void {
        Schema::dropIfExists('period_closes');
        Schema::dropIfExists('ledger_entries');
        Schema::dropIfExists('journal_entries');
        Schema::dropIfExists('accounts');
    }
};
