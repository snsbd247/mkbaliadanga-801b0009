<?php

namespace App\Services;

use App\Models\Account;
use App\Models\IrrigationInvoice;
use App\Models\IrrigationRate;
use App\Models\Land;
use App\Models\Season;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Str;

class IrrigationService
{
    public function __construct(private AccountingService $accounting) {}

    public function resolveRate(string $officeId, string $seasonId, ?string $crop = null): float {
        $q = DB::table('irrigation_rates')->where('office_id', $officeId)->where('season_id', $seasonId);
        if ($crop) $q->where(function ($w) use ($crop) { $w->where('crop', $crop)->orWhereNull('crop'); });
        $row = $q->orderByRaw('crop IS NULL')->first();
        return $row ? (float) $row->rate_per_decimal : 0.0;
    }

    public function generateInvoice(string $officeId, string $farmerId, string $seasonId, ?string $landId, float $areaDecimal, string $invoiceDate, ?float $rateOverride = null, ?string $dueDate = null): IrrigationInvoice {
        return DB::transaction(function () use ($officeId, $farmerId, $seasonId, $landId, $areaDecimal, $invoiceDate, $rateOverride, $dueDate) {
            $crop = $landId ? optional(Land::find($landId))->crop : null;
            $rate = $rateOverride ?? $this->resolveRate($officeId, $seasonId, $crop);
            $total = round($rate * $areaDecimal, 2);
            $inv = IrrigationInvoice::create([
                'office_id'    => $officeId, 'farmer_id' => $farmerId, 'season_id' => $seasonId, 'land_id' => $landId,
                'invoice_no'   => 'IRR-'.now()->format('ymd').'-'.strtoupper(Str::random(5)),
                'invoice_date' => $invoiceDate, 'due_date' => $dueDate,
                'area_decimal' => $areaDecimal, 'rate' => $rate, 'total' => $total,
                'status'       => 'open',
                'breakdown'    => ['crop' => $crop, 'rate_per_decimal' => $rate],
            ]);
            $ar  = Account::where('office_id', $officeId)->where('code', '1100')->first();
            $inc = Account::where('office_id', $officeId)->where('code', '4000')->first();
            if ($ar && $inc && $total > 0) {
                $this->accounting->postJournal($officeId, $invoiceDate, [
                    ['account_id' => $ar->id,  'debit' => $total, 'credit' => 0, 'memo' => "Irrigation invoice {$inv->invoice_no}"],
                    ['account_id' => $inc->id, 'debit' => 0, 'credit' => $total, 'memo' => "Irrigation income {$inv->invoice_no}"],
                ], ['source_type' => 'irrigation_invoice', 'source_id' => $inv->id, 'reference' => $inv->invoice_no]);
            }
            return $inv;
        });
    }
}
