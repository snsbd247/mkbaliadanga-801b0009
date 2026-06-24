<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::create('seasons', function (Blueprint $table) {
            $table->char('id', 36)->primary();
            $table->string('name');
            $table->integer('year')->nullable();
            $table->date('start_date')->nullable();
            $table->date('end_date')->nullable();
            $table->boolean('is_active')->default(false);
            $table->json('extra')->nullable();
            $table->timestamps();
            $table->index('is_active');
        });

        Schema::create('irrigation_categories', function (Blueprint $table) {
            $table->char('id', 36)->primary();
            $table->char('office_id', 36)->nullable();
            $table->string('name');
            $table->string('bn_name')->nullable();
            $table->boolean('is_active')->default(true);
            $table->json('extra')->nullable();
            $table->timestamps();
            $table->index('office_id');
        });

        Schema::create('irrigation_rates', function (Blueprint $table) {
            $table->char('id', 36)->primary();
            $table->char('season_id', 36)->nullable();
            $table->char('category_id', 36)->nullable();
            $table->string('crop')->nullable();
            $table->decimal('rate_per_decimal', 12, 4)->default(0);
            $table->date('effective_from')->nullable();
            $table->date('effective_to')->nullable();
            $table->json('extra')->nullable();
            $table->timestamps();

            $table->index('season_id');
            $table->foreign('season_id')->references('id')->on('seasons')->nullOnDelete();
            $table->foreign('category_id')->references('id')->on('irrigation_categories')->nullOnDelete();
        });

        Schema::create('irrigation_invoices', function (Blueprint $table) {
            $table->char('id', 36)->primary();
            $table->char('office_id', 36)->nullable();
            $table->char('farmer_id', 36);
            $table->char('season_id', 36)->nullable();
            $table->char('land_id', 36)->nullable();
            $table->string('invoice_no')->nullable();
            $table->decimal('area_decimal', 12, 4)->nullable();
            $table->decimal('rate_per_decimal', 12, 4)->nullable();
            $table->decimal('amount', 14, 2)->default(0);
            $table->decimal('paid_amount', 14, 2)->default(0);
            $table->decimal('due_amount', 14, 2)->default(0);
            $table->string('status')->default('unpaid');
            $table->date('issue_date')->nullable();
            $table->date('due_date')->nullable();
            $table->json('extra')->nullable();
            $table->timestamps();

            $table->unique(['office_id', 'invoice_no']);
            $table->index(['farmer_id', 'status']);
            $table->foreign('farmer_id')->references('id')->on('farmers')->cascadeOnDelete();
            $table->foreign('season_id')->references('id')->on('seasons')->nullOnDelete();
            $table->foreign('office_id')->references('id')->on('offices')->nullOnDelete();
        });

        Schema::create('irrigation_invoice_payments', function (Blueprint $table) {
            $table->char('id', 36)->primary();
            $table->char('invoice_id', 36);
            $table->char('payment_id', 36)->nullable();
            $table->decimal('amount', 14, 2)->default(0);
            $table->string('method')->nullable();
            $table->string('receipt_no')->nullable();
            $table->dateTime('paid_at')->nullable();
            $table->json('extra')->nullable();
            $table->timestamps();

            $table->index('invoice_id');
            $table->foreign('invoice_id')->references('id')->on('irrigation_invoices')->cascadeOnDelete();
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('irrigation_invoice_payments');
        Schema::dropIfExists('irrigation_invoices');
        Schema::dropIfExists('irrigation_rates');
        Schema::dropIfExists('irrigation_categories');
        Schema::dropIfExists('seasons');
    }
};
