<?php

namespace App\Jobs;

use App\Models\SmsLog;
use Illuminate\Bus\Queueable;
use Illuminate\Contracts\Queue\ShouldQueue;
use Illuminate\Foundation\Bus\Dispatchable;
use Illuminate\Queue\InteractsWithQueue;
use Illuminate\Queue\SerializesModels;
use Illuminate\Support\Facades\Http;

class SendSmsJob implements ShouldQueue
{
    use Dispatchable, InteractsWithQueue, Queueable, SerializesModels;
    public int $tries = 3;
    public int $backoff = 30;

    public function __construct(
        public string $mobile,
        public string $message,
        public ?string $eventType = null,
        public ?string $farmerId = null,
        public ?string $officeId = null,
    ) {}

    public function handle(): void {
        $log = SmsLog::create([
            'office_id' => $this->officeId,
            'farmer_id' => $this->farmerId,
            'mobile'    => $this->mobile,
            'message'   => $this->message,
            'event_type'=> $this->eventType,
            'status'    => 'queued',
        ]);
        $token = config('services.greenweb.token', env('GREENWEB_SMS_TOKEN'));
        if (!$token) { $log->update(['status' => 'failed', 'provider_response' => 'Missing GREENWEB_SMS_TOKEN']); return; }
        try {
            $r = Http::timeout(15)->get('https://api.greenweb.com.bd/api.php', [
                'token'   => $token,
                'to'      => $this->normalize($this->mobile),
                'message' => $this->message,
                'sender'  => env('SMS_SENDER_ID'),
            ]);
            $body = $r->body();
            $ok = $r->ok() && preg_match('/ok/i', $body) && !preg_match('/err|invalid|fail/i', $body);
            $log->update([
                'status' => $ok ? 'sent' : 'failed',
                'provider_response' => substr($body, 0, 500),
                'sent_at' => $ok ? now() : null,
            ]);
        } catch (\Throwable $e) {
            $log->update(['status' => 'failed', 'provider_response' => substr($e->getMessage(), 0, 500)]);
            throw $e;
        }
    }

    private function normalize(string $m): string {
        $n = preg_replace('/\D/', '', $m);
        if (str_starts_with($n, '880')) return $n;
        if (str_starts_with($n, '0'))   return '88'.$n;
        if (strlen($n) === 10 && str_starts_with($n, '1')) return '880'.$n;
        return $n;
    }
}
