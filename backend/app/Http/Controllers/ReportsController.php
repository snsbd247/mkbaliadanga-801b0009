<?php

namespace App\Http\Controllers;

use App\Services\ReportingService;
use Illuminate\Http\Request;

class ReportsController extends Controller
{
    public function __construct(private ReportingService $svc) {}

    private function range(Request $r): array {
        return [$r->input('from', now()->startOfYear()->toDateString()), $r->input('to', now()->toDateString())];
    }

    public function trialBalance(Request $r) {
        abort_unless($r->user()->hasPermission('reports.read'), 403);
        [$from, $to] = $this->range($r);
        return ['from' => $from, 'to' => $to, 'rows' => $this->svc->trialBalance(app('current_office_id'), $from, $to)];
    }
    public function profitAndLoss(Request $r) {
        abort_unless($r->user()->hasPermission('reports.read'), 403);
        [$from, $to] = $this->range($r);
        return ['from' => $from, 'to' => $to] + $this->svc->profitAndLoss(app('current_office_id'), $from, $to);
    }
    public function balanceSheet(Request $r) {
        abort_unless($r->user()->hasPermission('reports.read'), 403);
        $asOf = $r->input('as_of', now()->toDateString());
        return ['as_of' => $asOf] + $this->svc->balanceSheet(app('current_office_id'), $asOf);
    }
    public function cashbook(Request $r) {
        abort_unless($r->user()->hasPermission('reports.read'), 403);
        [$from, $to] = $this->range($r);
        return ['from' => $from, 'to' => $to, 'rows' => $this->svc->cashbook(app('current_office_id'), $from, $to)];
    }
}
