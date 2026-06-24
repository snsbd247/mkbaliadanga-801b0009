<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::create('savings_accounts', function (Blueprint $table) {
            $table->char('id', 36)->primary();
            $table->char('farmer_id', 36);
            $table->char('office_id', 36)->nullable();
            $table->string('account_no', 32)->unique();
            $table->decimal('balance', 16, 2)->default(0);
            $table->enum('status', ['active', 'closed'])->default('active');
            $table->timestamp('opened_at')->nullable();
            $table->json('extra')->nullable();
            $table->timestamps();

            $table->index('farmer_id');
            $table->index('office_id');
            $table->foreign('farmer_id')->references('id')->on('farmers')->cascadeOnDelete();
            $table->foreign('office_id')->references('id')->on('offices')->nullOnDelete();
        });

        Schema::create('savings_transactions', function (Blueprint $table) {
            $table->char('id', 36)->primary();
            $table->char('account_id', 36);
            $table->enum('type', ['deposit', 'withdraw']);
            $table->decimal('amount', 16, 2);
            $table->decimal('balance_after', 16, 2)->nullable();
            $table->timestamp('occurred_at')->nullable();
            $table->text('note')->nullable();
            $table->char('created_by', 36)->nullable();
            $table->timestamps();

            $table->index('account_id');
            $table->foreign('account_id')->references('id')->on('savings_accounts')->cascadeOnDelete();
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('savings_transactions');
        Schema::dropIfExists('savings_accounts');
    }
};
