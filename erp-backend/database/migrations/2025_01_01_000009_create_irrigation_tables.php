<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration {
    public function up(): void
    {
        Schema::create('seasons', function (Blueprint $t) {
            $t->char('id', 36)->primary();
            $t->char('office_id', 36)->nullable()->index();
            $t->string('name');
            $t->string('bn_name')->nullable();
            $t->year('year')->nullable();
            $t->boolean('is_active')->default(true);
            $t->json('meta')->nullable();
            $t->timestamps();
            $t->foreign('office_id')->references('id')->on('offices')->nullOnDelete();
        });

        Schema::create('irrigation_categories', function (Blueprint $t) {
            $t->char('id', 36)->primary();
            $t->char('office_id', 36)->nullable()->index();
            $t->string('name');
            $t->string('bn_name')->nullable();
            $t->decimal('rate', 12, 2)->default(0);
            $t->boolean('is_active')->default(true);
            $t->json('meta')->nullable();
            $t->timestamps();
            $t->foreign('office_id')->references('id')->on('offices')->nullOnDelete();
        });

        Schema::create('irrigation_invoices', function (Blueprint $t) {
            $t->char('id', 36)->primary();
            $t->char('office_id', 36)->nullable()->index();
            $t->char('farmer_id', 36)->nullable()->index();
            $t->char('land_id', 36)->nullable();
            $t->char('season_id', 36)->nullable()->index();
            $t->char('category_id', 36)->nullable();
            $t->string('invoice_no', 64)->nullable()->index();
            $t->decimal('amount', 14, 2)->default(0);
            $t->decimal('maintenance', 14, 2)->default(0);
            $t->decimal('canal', 14, 2)->default(0);
            $t->decimal('delay_fee', 14, 2)->default(0);
            $t->decimal('paid', 14, 2)->default(0);
            $t->decimal('due', 14, 2)->default(0);
            $t->string('status', 32)->default('unpaid')->index();
            $t->json('extra')->nullable();
            $t->char('created_by', 36)->nullable();
            $t->timestamps();
            $t->softDeletes();
            $t->foreign('office_id')->references('id')->on('offices')->nullOnDelete();
            $t->foreign('farmer_id')->references('id')->on('farmers')->nullOnDelete();
        });

        Schema::create('irrigation_invoice_payments', function (Blueprint $t) {
            $t->char('id', 36)->primary();
            $t->char('office_id', 36)->nullable()->index();
            $t->char('invoice_id', 36)->nullable()->index();
            $t->char('farmer_id', 36)->nullable();
            $t->string('receipt_no', 64)->nullable()->index();
            $t->decimal('amount', 14, 2)->default(0);
            $t->decimal('delay_fee', 14, 2)->default(0);
            $t->string('method', 32)->default('cash');
            $t->date('paid_at')->nullable();
            $t->boolean('is_void')->default(false);
            $t->json('extra')->nullable();
            $t->char('created_by', 36)->nullable();
            $t->timestamps();
            $t->foreign('invoice_id')->references('id')->on('irrigation_invoices')->nullOnDelete();
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('irrigation_invoice_payments');
        Schema::dropIfExists('irrigation_invoices');
        Schema::dropIfExists('irrigation_categories');
        Schema::dropIfExists('seasons');
    }
};
