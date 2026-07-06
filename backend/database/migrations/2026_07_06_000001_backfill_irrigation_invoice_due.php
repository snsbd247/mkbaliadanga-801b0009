<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Support\Facades\DB;

return new class extends Migration
{
    /**
     * Backfill due_amount for irrigation invoices that were generated without it.
     * Older generation code omitted due_amount from the insert payload and relied
     * on a Postgres-only default, so on MySQL these rows kept due_amount = 0 even
     * though nothing was paid. Recompute due = payable - paid for live invoices.
     */
    public function up(): void
    {
        DB::table('irrigation_invoices')
            ->whereNull('deleted_at')
            ->whereNotIn('invoice_status', ['cancelled', 'carried_forward'])
            ->whereRaw('due_amount <> (payable_amount - paid_amount)')
            ->update([
                'due_amount' => DB::raw('GREATEST(payable_amount - paid_amount, 0)'),
                'updated_at' => now(),
            ]);
    }

    public function down(): void
    {
        // No-op: recomputed values are correct; nothing to revert.
    }
};
