<?php

namespace App\Http\Controllers;

use App\Http\Controllers\SmsController;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Schema;

/**
 * Edge-function dispatcher — a Laravel replacement for Supabase Edge
 * Functions (supabase.functions.invoke(name, { body })).
 *
 * The frontend `db.functions.invoke(name, { body })` adapter posts to
 * /api/fn/{name} with the body as JSON. Each handler below mirrors the
 * behaviour of the original edge function using server-side controllers.
 *
 * Authorisation is enforced by the route middleware (auth:sanctum +
 * branch.scope).
 */
class FunctionController extends Controller
{
    public function handle(Request $request, string $name): JsonResponse
    {
        $method = 'fn_' . str_replace('-', '_', $name);

        if (! method_exists($this, $method)) {
            return response()->json([
                'error' => "Function '$name' is not available on this server.",
            ], 501);
        }

        return $this->{$method}($request);
    }

    /** Send a transactional SMS (delegates to SmsController). */
    protected function fn_send_sms(Request $request): JsonResponse
    {
        return app(SmsController::class)->send($request);
    }

    /** Trigger due-reminder SMS run. */
    protected function fn_sms_due_reminders(Request $request): JsonResponse
    {
        if (method_exists(SmsController::class, 'dueReminders')) {
            return app(SmsController::class)->dueReminders($request);
        }
        return response()->json(['error' => 'Due reminders not configured.'], 501);
    }
}
