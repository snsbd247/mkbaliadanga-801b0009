<?php

namespace App\Services;

use Illuminate\Support\Facades\DB;

/**
 * Atomic month-wise receipt numbering — replaces the Supabase
 * `next_monthly_receipt_no` / `next_unified_receipt_no` PG functions.
 *
 * Guarantees a unique, consistent sequence per (office, kind, year, month)
 * even under concurrent payments by locking the counter row inside a
 * transaction (`lockForUpdate`). Format: <PREFIX><YYYY><MM>-<NNNN>.
 */
class ReceiptNumberService
{
    public function next(string $officeId, string $kind = 'monthly', ?\DateTimeInterface $when = null): string
    {
        $when = $when ?? now();
        $year = (int) $when->format('Y');
        $month = (int) $when->format('n');

        return DB::transaction(function () use ($officeId, $kind, $year, $month) {
            $row = DB::table('receipt_counters')
                ->where('office_id', $officeId)
                ->where('kind', $kind)
                ->where('year', $year)
                ->where('month', $month)
                ->lockForUpdate()
                ->first();

            if (!$row) {
                DB::table('receipt_counters')->insert([
                    'office_id'  => $officeId,
                    'kind'       => $kind,
                    'year'       => $year,
                    'month'      => $month,
                    'last_no'    => 1,
                    'created_at' => now(),
                    'updated_at' => now(),
                ]);
                $next = 1;
            } else {
                $next = $row->last_no + 1;
                DB::table('receipt_counters')
                    ->where('office_id', $officeId)
                    ->where('kind', $kind)
                    ->where('year', $year)
                    ->where('month', $month)
                    ->update(['last_no' => $next, 'updated_at' => now()]);
            }

            $prefix = $kind === 'unified' ? 'U' : 'R';

            return sprintf('%s%04d%02d-%04d', $prefix, $year, $month, $next);
        });
    }
}
