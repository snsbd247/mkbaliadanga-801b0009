<?php

namespace App\Services;

use App\Models\JournalEntry;
use App\Models\LedgerEntry;
use Illuminate\Support\Facades\DB;

/**
 * Double-entry accounting service.
 * Lines = [['account_id'=>uuid, 'debit'=>0, 'credit'=>0, 'memo'=>?], ...]
 */
class AccountingService
{
    public function postJournal(string $officeId, string $entryDate, array $lines, array $opts = []): JournalEntry {
        $debit  = array_sum(array_column($lines, 'debit'));
        $credit = array_sum(array_column($lines, 'credit'));
        if (round($debit - $credit, 2) !== 0.00) {
            throw new \DomainException("Unbalanced journal: D=$debit C=$credit");
        }
        return DB::transaction(function () use ($officeId, $entryDate, $lines, $opts) {
            $j = JournalEntry::create([
                'office_id'   => $officeId,
                'entry_date'  => $entryDate,
                'reference'   => $opts['reference'] ?? null,
                'memo'        => $opts['memo'] ?? null,
                'source_type' => $opts['source_type'] ?? null,
                'source_id'   => $opts['source_id']   ?? null,
                'created_by'  => $opts['created_by']  ?? null,
            ]);
            foreach ($lines as $ln) {
                LedgerEntry::create([
                    'journal_entry_id' => $j->id,
                    'office_id'        => $officeId,
                    'account_id'       => $ln['account_id'],
                    'entry_date'       => $entryDate,
                    'debit'            => $ln['debit']  ?? 0,
                    'credit'           => $ln['credit'] ?? 0,
                    'memo'             => $ln['memo']   ?? null,
                    'reference_type'   => $opts['source_type'] ?? null,
                    'reference_id'     => $opts['source_id']   ?? null,
                ]);
            }
            return $j;
        });
    }
}
