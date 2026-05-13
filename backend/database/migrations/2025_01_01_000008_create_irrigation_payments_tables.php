<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration {
    public function up(): void {
        Schema::create('irrigation_rates', function (Blueprint $t) {
            $t->uuid('id')->primary();
            $t->foreignUuid('office_id')->constrained('offices')->cascadeOnDelete();
            $t->foreignUuid('season_id')->constrained('seasons')->cascadeOnDelete();
            $t->string('crop')->nullable();
            $t->decimal('rate_per_decimal', 12, 2);
            $t->decimal('rate_per_bigha', 12, 2)->nullable();
            $t->jsonb('meta')->default('{}');
            $t->timestamps();
            $t->index(['office_id', 'season_id']);
        });

        Schema::create('irrigation_invoices', function (Blueprint $t) {
            $t->uuid('id')->primary();
            $t->foreignUuid('office_id')->constrained('offices')->cascadeOnDelete();
            $t->foreignUuid('farmer_id')->constrained('farmers')->cascadeOnDelete();
            $t->foreignUuid('season_id')->constrained('seasons')->cascadeOnDelete();
            $t->foreignUuid('land_id')->nullable()->constrained('lands')->nullOnDelete();
            $t->string('invoice_no', 32)->unique();
            $t->date('invoice_date');
            $t->date('due_date')->nullable();
            $t->decimal('area_decimal', 10, 2)->default(0);
            $t->decimal('rate', 12, 2)->default(0);
            $t->decimal('total', 14, 2)->default(0);
            $t->decimal('paid', 14, 2)->default(0);
            $t->string('status', 16)->default('open'); // open, partial, paid, void
            $t->jsonb('breakdown')->default('{}');
            $t->timestamps();
            $t->softDeletes();
            $t->index(['farmer_id', 'season_id']);
        });

        Schema::create('payments', function (Blueprint $t) {
            $t->uuid('id')->primary();
            $t->foreignUuid('office_id')->constrained('offices')->cascadeOnDelete();
            $t->foreignUuid('farmer_id')->constrained('farmers')->cascadeOnDelete();
            $t->string('receipt_no', 64)->unique();
            $t->date('paid_on');
            $t->string('kind', 24);                  // irrigation, loan, savings_deposit, share, fee, other
            $t->decimal('amount', 14, 2);
            $t->string('method', 16)->default('cash'); // cash, bkash, nagad, bank
            $t->jsonb('allocations')->default('[]');   // [{target_type, target_id, amount}]
            $t->string('note')->nullable();
            $t->foreignUuid('collected_by')->nullable()->constrained('users');
            $t->timestamps();
            $t->softDeletes();
            $t->index(['farmer_id', 'paid_on']);
        });

        Schema::create('share_capital', function (Blueprint $t) {
            $t->uuid('id')->primary();
            $t->foreignUuid('office_id')->constrained('offices')->cascadeOnDelete();
            $t->foreignUuid('farmer_id')->constrained('farmers')->cascadeOnDelete();
            $t->date('tx_date');
            $t->decimal('amount', 14, 2);
            $t->string('memo')->nullable();
            $t->timestamps();
        });
    }
    public function down(): void {
        Schema::dropIfExists('share_capital');
        Schema::dropIfExists('payments');
        Schema::dropIfExists('irrigation_invoices');
        Schema::dropIfExists('irrigation_rates');
    }
};
