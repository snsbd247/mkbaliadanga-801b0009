<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::create('accounts', function (Blueprint $table) {
            $table->char('id', 36)->primary();
            $table->char('office_id', 36)->nullable();
            $table->string('code', 32);
            $table->string('name', 191);
            $table->string('name_bn', 191)->nullable();
            $table->enum('type', ['asset', 'liability', 'equity', 'income', 'expense']);
            $table->char('parent_id', 36)->nullable();
            $table->boolean('is_active')->default(true);
            $table->timestamps();

            $table->unique(['office_id', 'code']);
            $table->index('office_id');
            $table->index('parent_id');
            $table->foreign('office_id')->references('id')->on('offices')->nullOnDelete();
        });

        Schema::create('journal_entries', function (Blueprint $table) {
            $table->char('id', 36)->primary();
            $table->char('office_id', 36)->nullable();
            $table->date('entry_date');
            $table->string('reference', 64)->nullable();
            $table->text('memo')->nullable();
            $table->string('source_type', 64)->nullable();
            $table->char('source_id', 36)->nullable();
            $table->char('created_by', 36)->nullable();
            $table->timestamps();

            $table->index('office_id');
            $table->index('entry_date');
            $table->foreign('office_id')->references('id')->on('offices')->nullOnDelete();
        });

        Schema::create('journal_lines', function (Blueprint $table) {
            $table->char('id', 36)->primary();
            $table->char('entry_id', 36);
            $table->char('account_id', 36);
            $table->decimal('debit', 16, 2)->default(0);
            $table->decimal('credit', 16, 2)->default(0);
            $table->text('memo')->nullable();
            $table->timestamps();

            $table->index('entry_id');
            $table->index('account_id');
            $table->foreign('entry_id')->references('id')->on('journal_entries')->cascadeOnDelete();
            $table->foreign('account_id')->references('id')->on('accounts')->cascadeOnDelete();
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('journal_lines');
        Schema::dropIfExists('journal_entries');
        Schema::dropIfExists('accounts');
    }
};
