<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::create('loan_plans', function (Blueprint $table) {
            $table->char('id', 36)->primary();
            $table->char('office_id', 36)->nullable();
            $table->string('name', 128);
            $table->decimal('principal', 16, 2)->default(0);
            $table->decimal('interest_rate', 8, 4)->default(0);
            $table->unsignedInteger('tenure_months')->default(0);
            $table->decimal('processing_fee', 16, 2)->nullable();
            $table->text('description')->nullable();
            $table->boolean('is_active')->default(true);
            $table->timestamps();

            $table->index('office_id');
            $table->foreign('office_id')->references('id')->on('offices')->nullOnDelete();
        });

        Schema::create('loans', function (Blueprint $table) {
            $table->char('id', 36)->primary();
            $table->char('farmer_id', 36);
            $table->char('loan_plan_id', 36)->nullable();
            $table->char('office_id', 36)->nullable();
            $table->string('loan_no', 32)->nullable()->unique();
            $table->decimal('principal', 16, 2)->default(0);
            $table->decimal('interest_rate', 8, 4)->default(0);
            $table->unsignedInteger('tenure_months')->default(0);
            $table->decimal('outstanding', 16, 2)->default(0);
            $table->enum('status', ['pending', 'active', 'closed', 'defaulted'])->default('active');
            $table->timestamp('disbursed_at')->nullable();
            $table->json('extra')->nullable();
            $table->timestamps();

            $table->index('farmer_id');
            $table->index('office_id');
            $table->foreign('farmer_id')->references('id')->on('farmers')->cascadeOnDelete();
            $table->foreign('loan_plan_id')->references('id')->on('loan_plans')->nullOnDelete();
            $table->foreign('office_id')->references('id')->on('offices')->nullOnDelete();
        });

        Schema::create('loan_repayments', function (Blueprint $table) {
            $table->char('id', 36)->primary();
            $table->char('loan_id', 36);
            $table->decimal('amount', 16, 2);
            $table->decimal('principal_part', 16, 2)->nullable();
            $table->decimal('interest_part', 16, 2)->nullable();
            $table->decimal('outstanding_after', 16, 2)->nullable();
            $table->timestamp('paid_at')->nullable();
            $table->text('note')->nullable();
            $table->char('created_by', 36)->nullable();
            $table->timestamps();

            $table->index('loan_id');
            $table->foreign('loan_id')->references('id')->on('loans')->cascadeOnDelete();
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('loan_repayments');
        Schema::dropIfExists('loans');
        Schema::dropIfExists('loan_plans');
    }
};
