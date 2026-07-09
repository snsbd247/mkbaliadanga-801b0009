<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        if (! Schema::hasTable('opening_balances')) {
            Schema::create('opening_balances', function (Blueprint $table) {
                $table->uuid('id')->primary();
                $table->uuid('office_id')->nullable();
                $table->string('fiscal_year'); // e.g. "2026-27"
                $table->decimal('irrigation_cash', 20, 4)->default(0);
                $table->decimal('savings_cash', 20, 4)->default(0);
                $table->text('note')->nullable();
                $table->timestamps();
                $table->unique(['office_id', 'fiscal_year']);
            });
        }
    }

    public function down(): void
    {
        Schema::dropIfExists('opening_balances');
    }
};
