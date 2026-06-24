<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::create('payments', function (Blueprint $table) {
            $table->char('id', 36)->primary();
            $table->char('office_id', 36)->nullable();
            $table->char('farmer_id', 36);
            $table->string('receipt_no', 32)->nullable()->unique();
            $table->decimal('amount', 16, 2)->default(0);
            $table->enum('method', ['cash', 'bank', 'mobile', 'cheque'])->default('cash');
            $table->string('reference', 128)->nullable();
            $table->timestamp('occurred_at')->nullable();
            $table->char('created_by', 36)->nullable();
            $table->json('extra')->nullable();
            $table->timestamps();

            $table->index('farmer_id');
            $table->index('office_id');
            $table->foreign('farmer_id')->references('id')->on('farmers')->cascadeOnDelete();
            $table->foreign('office_id')->references('id')->on('offices')->nullOnDelete();
        });

        Schema::create('payment_allocations', function (Blueprint $table) {
            $table->char('id', 36)->primary();
            $table->char('payment_id', 36);
            $table->string('target_type', 32); // loan | savings | irrigation_invoice
            $table->char('target_id', 36);
            $table->decimal('amount', 16, 2)->default(0);
            $table->timestamps();

            $table->index('payment_id');
            $table->index(['target_type', 'target_id']);
            $table->foreign('payment_id')->references('id')->on('payments')->cascadeOnDelete();
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('payment_allocations');
        Schema::dropIfExists('payments');
    }
};
