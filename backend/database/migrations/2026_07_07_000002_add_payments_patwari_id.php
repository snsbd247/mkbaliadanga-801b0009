<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        if (! Schema::hasTable('payments') || Schema::hasColumn('payments', 'patwari_id')) {
            return;
        }

        Schema::table('payments', function (Blueprint $table) {
            $table->char('patwari_id', 36)->nullable()->after('receipt_no');
            $table->index('patwari_id', 'idx_payments_patwari_id');
        });
    }

    public function down(): void
    {
        if (! Schema::hasTable('payments') || ! Schema::hasColumn('payments', 'patwari_id')) {
            return;
        }

        Schema::table('payments', function (Blueprint $table) {
            $table->dropIndex('idx_payments_patwari_id');
            $table->dropColumn('patwari_id');
        });
    }
};