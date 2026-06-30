<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        if (!Schema::hasColumn('irrigation_invoices', 'discount_amount')) {
            Schema::table('irrigation_invoices', function (Blueprint $table) {
                $table->decimal('discount_amount', 14, 2)->default(0);
            });
        }
        if (!Schema::hasColumn('irrigation_invoices', 'discount_reason')) {
            Schema::table('irrigation_invoices', function (Blueprint $table) {
                $table->text('discount_reason')->nullable();
            });
        }
    }

    public function down(): void
    {
        // No-op: keep columns to preserve discount history.
    }
};
