<?php

namespace App\Http\Controllers;

use App\Jobs\SendSmsJob;
use App\Models\SmsLog;
use Illuminate\Http\Request;

class SmsController extends Controller
{
    public function logs(Request $r) {
        abort_unless($r->user()->hasPermission('sms.read'), 403);
        return SmsLog::where(function ($q) use ($r) {
                if (!$r->user()->hasRole('super_admin')) $q->where('office_id', app('current_office_id'));
            })
            ->when($r->status, fn($q,$v) => $q->where('status',$v))
            ->orderByDesc('created_at')->paginate((int)($r->per_page ?? 50));
    }

    public function send(Request $r) {
        abort_unless($r->user()->hasPermission('sms.send'), 403);
        $d = $r->validate([
            'mobiles'    => 'required|array|min:1',
            'mobiles.*'  => 'string|min:10',
            'message'    => 'required|string|max:600',
            'event_type' => 'nullable|string|max:32',
        ]);
        $count = 0;
        foreach ($d['mobiles'] as $m) {
            SendSmsJob::dispatch($m, $d['message'], $d['event_type'] ?? 'manual', null, app('current_office_id'));
            $count++;
        }
        return response()->json(['queued' => $count]);
    }

    public function retry(Request $r) {
        abort_unless($r->user()->hasPermission('sms.send'), 403);
        $ids = $r->input('ids', []);
        $rows = SmsLog::whereIn('id', $ids)->orWhere(function ($q) use ($ids) {
            if (!$ids) $q->whereIn('status', ['failed','queued'])->limit(50);
        })->get();
        foreach ($rows as $log) {
            SendSmsJob::dispatch($log->mobile, $log->message, $log->event_type, $log->farmer_id, $log->office_id);
            $log->increment('retry_count');
        }
        return response()->json(['retried' => $rows->count()]);
    }
}
