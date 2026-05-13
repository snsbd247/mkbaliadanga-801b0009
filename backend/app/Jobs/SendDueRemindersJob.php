<?php

namespace App\Jobs;

use App\Models\IrrigationInvoice;
use Illuminate\Bus\Queueable;
use Illuminate\Contracts\Queue\ShouldQueue;
use Illuminate\Foundation\Bus\Dispatchable;
use Illuminate\Queue\InteractsWithQueue;
use Illuminate\Queue\SerializesModels;

class SendDueRemindersJob implements ShouldQueue
{
    use Dispatchable, InteractsWithQueue, Queueable, SerializesModels;

    public function handle(): void {
        $today = now()->startOfDay();
        IrrigationInvoice::query()
            ->whereIn('status', ['open','partial'])
            ->whereDate('due_date', '<=', $today->copy()->addDays(3))
            ->with('farmer:id,office_id,name,mobile')
            ->chunkById(200, function ($rows) {
                foreach ($rows as $inv) {
                    $f = $inv->farmer;
                    if (!$f?->mobile) continue;
                    $owe = number_format(max(0, $inv->total - $inv->paid), 2);
                    SendSmsJob::dispatch(
                        $f->mobile,
                        "প্রিয় {$f->name}, আপনার সেচ বিল {$owe} টাকা বাকি (Inv: {$inv->invoice_no}). শীঘ্রই পরিশোধ করুন।",
                        'due_reminder', $f->id, $f->office_id,
                    );
                }
            });
    }
}
