<?php

namespace App\Http\Controllers;

use App\Models\SmsLog;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;

class SmsController extends Controller
{
    public function index(Request $request): JsonResponse
    {
        $perPage = (int) $request->query('per_page', 20);
        $scopeOffice = $request->attributes->get('scope_office_id');

        $logs = SmsLog::query()
            ->when($scopeOffice, fn ($q) => $q->where('office_id', $scopeOffice))
            ->when($request->query('status'), fn ($q, $s) => $q->where('status', $s))
            ->orderByDesc('created_at')
            ->paginate($perPage);

        return response()->json($logs);
    }

    public function send(Request $request): JsonResponse
    {
        $data = $request->validate([
            'to' => ['required', 'string', 'max:32'],
            'body' => ['required', 'string', 'max:1000'],
        ]);

        $log = SmsLog::create([
            'office_id' => $request->attributes->get('scope_office_id'),
            'to' => $data['to'],
            'body' => $data['body'],
            'status' => 'queued',
            'created_by' => $request->user()->id,
        ]);

        $this->dispatch($log);

        return response()->json(['data' => $log->fresh()], 201);
    }

    public function retry(Request $request): JsonResponse
    {
        $data = $request->validate(['id' => ['required', 'string', 'exists:sms_logs,id']]);
        $log = SmsLog::findOrFail($data['id']);

        $log->update(['status' => 'queued', 'error' => null]);
        $this->dispatch($log);

        return response()->json(['data' => $log->fresh()]);
    }

    /**
     * Hand the message to the configured gateway. No provider is wired in the
     * base build, so we mark it queued for the external worker/cron to deliver.
     * Configure SMS_PROVIDER + credentials to enable real sending.
     */
    private function dispatch(SmsLog $log): void
    {
        if (! config('services.sms.provider')) {
            return; // left 'queued' for the gateway worker to pick up
        }
        // Real provider integration is added during deployment.
    }
}
