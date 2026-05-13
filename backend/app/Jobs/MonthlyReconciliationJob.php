<?php

namespace App\Jobs;

use App\Models\LedgerEntry;
use App\Models\Notification;
use App\Models\User;
use Carbon\Carbon;
use Illuminate\Bus\Queueable;
use Illuminate\Contracts\Queue\ShouldQueue;
use Illuminate\Foundation\Bus\Dispatchable;
use Illuminate\Queue\InteractsWithQueue;
use Illuminate\Queue\SerializesModels;
use Illuminate\Support\Facades\DB;

class MonthlyReconciliationJob implements ShouldQueue
{
    use Dispatchable, InteractsWithQueue, Queueable, SerializesModels;

    public function __construct(public ?int $year = null, public ?int $month = null) {}

    public function handle(): void {
        $d = Carbon::now()->subMonthNoOverflow();
        $year = $this->year ?? $d->year;
        $month = $this->month ?? $d->month;
        $start = Carbon::create($year, $month, 1)->startOfDay();
        $end   = $start->copy()->addMonth();

        $totals = LedgerEntry::whereBetween('entry_date', [$start, $end])
            ->select(DB::raw('SUM(debit) as d'), DB::raw('SUM(credit) as c'))->first();
        $diff = round(($totals->d ?? 0) - ($totals->c ?? 0), 2);

        $superAdmins = DB::table('user_roles')
            ->join('roles', 'roles.id', '=', 'user_roles.role_id')
            ->where('roles.name', 'super_admin')
            ->pluck('user_roles.user_id')->unique();

        foreach ($superAdmins as $uid) {
            DB::table('notifications')->insert([
                'id' => (string) \Illuminate\Support\Str::uuid(),
                'user_id' => $uid,
                'kind'    => 'reconciliation_monthly',
                'title'   => "Monthly reconciliation $year-".str_pad((string)$month, 2, '0', STR_PAD_LEFT),
                'body'    => $diff == 0 ? 'Ledger balanced.' : "Ledger imbalance: $diff",
                'link'    => '/ledger-reconciliation',
                'created_at' => now(),
                'updated_at' => now(),
            ]);
        }
    }
}
