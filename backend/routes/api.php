<?php

use App\Http\Controllers\AccountController;
use App\Http\Controllers\AssetController;
use App\Http\Controllers\AuditController;
use App\Http\Controllers\Auth\AuthController;
use App\Http\Controllers\Auth\FarmerAuthController;
use App\Http\Controllers\Auth\PasswordResetController;
use App\Http\Controllers\FarmerController;
use App\Http\Controllers\IrrigationInvoiceController;
use App\Http\Controllers\IrrigationRateController;
use App\Http\Controllers\JournalController;
use App\Http\Controllers\LandController;
use App\Http\Controllers\LoanController;
use App\Http\Controllers\LoanPlanController;
use App\Http\Controllers\OfficeController;
use App\Http\Controllers\PaymentController;
use App\Http\Controllers\QrController;
use App\Http\Controllers\ReportsController;
use App\Http\Controllers\RoleController;
use App\Http\Controllers\SavingsController;
use App\Http\Controllers\SeasonController;
use App\Http\Controllers\SmsController;
use App\Http\Controllers\UserController;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Route;

// ─── Health (for load balancer / installer) ──────────────────────────────
Route::get('health', function () {
    encrypt('test');

    return response()->json([
        'ok'         => true,
        'app'        => config('app.name'),
        'env'        => config('app.env'),
        'encryption' => 'ok',
        'time'       => now()->toIso8601String(),
    ]);
});

// ─── Public ───────────────────────────────────────────────────────────────
Route::post('auth/login',                [AuthController::class, 'login'])->middleware('throttle:10,1');
Route::post('auth/password/forgot',      [PasswordResetController::class, 'request'])->middleware('throttle:5,5');
Route::post('auth/password/reset',       [PasswordResetController::class, 'reset'])->middleware('throttle:5,5');

Route::post('farmer/auth/login',         [FarmerAuthController::class, 'loginByCode'])->middleware('throttle:10,5');
Route::post('farmer/auth/request-otp',   [FarmerAuthController::class, 'requestOtp'])->middleware('throttle:5,5');
Route::post('farmer/auth/verify-otp',    [FarmerAuthController::class, 'verifyOtp'])->middleware('throttle:10,5');

Route::post('qr/resolve',                [QrController::class, 'resolve'])->middleware('throttle:60,1');

// ─── Authenticated (admin/staff) ─────────────────────────────────────────
Route::middleware(['auth:sanctum'])->group(function () {
    Route::get('auth/me',         [AuthController::class, 'me']);
    Route::post('auth/logout',    [AuthController::class, 'logout']);
    Route::post('auth/logout-all',[AuthController::class, 'logoutAll']);

    Route::middleware(['office', 'audit'])->group(function () {
        // Core entities
        Route::apiResource('farmers',  FarmerController::class);
        Route::apiResource('lands',    LandController::class)->except(['show']);
        Route::apiResource('seasons',  SeasonController::class)->only(['index','store','update']);
        Route::post('seasons/{id}/activate', [SeasonController::class, 'activate']);

        // Loans
        Route::apiResource('loan-plans', LoanPlanController::class)->except(['show']);
        Route::apiResource('loans',      LoanController::class)->except(['update']);
        Route::post('loans/{id}/approve', [LoanController::class, 'approve']);

        // Savings
        Route::get('savings',                  [SavingsController::class, 'index']);
        Route::get('savings/{id}',             [SavingsController::class, 'show']);
        Route::post('savings',                 [SavingsController::class, 'open']);
        Route::post('savings/{id}/deposit',    [SavingsController::class, 'deposit']);
        Route::post('savings/{id}/withdraw',   [SavingsController::class, 'withdraw']);

        // Irrigation
        Route::apiResource('irrigation-invoices', IrrigationInvoiceController::class)->except(['update']);
        Route::apiResource('irrigation-rates',    IrrigationRateController::class)->except(['show']);

        // Payments
        Route::apiResource('payments', PaymentController::class)->except(['update']);

        // Accounting
        Route::apiResource('accounts', AccountController::class)->only(['index','store','update']);
        Route::apiResource('journal-entries', JournalController::class)->only(['index','store']);

        // Reports
        Route::get('reports/trial-balance', [ReportsController::class, 'trialBalance']);
        Route::get('reports/profit-loss',   [ReportsController::class, 'profitAndLoss']);
        Route::get('reports/balance-sheet', [ReportsController::class, 'balanceSheet']);
        Route::get('reports/cashbook',      [ReportsController::class, 'cashbook']);

        // Assets
        Route::apiResource('assets', AssetController::class)->except(['show','destroy']);

        // SMS
        Route::get('sms/logs',  [SmsController::class, 'logs']);
        Route::post('sms/send', [SmsController::class, 'send']);
        Route::post('sms/retry',[SmsController::class, 'retry']);

        // QR
        Route::post('qr/issue',         [QrController::class, 'issue']);
        Route::delete('qr/{id}',        [QrController::class, 'revoke']);

        // Audit
        Route::get('audit-logs',        [AuditController::class, 'index']);
    });

    // Admin scope (RBAC + offices) — not pinned to office middleware so super_admin can act globally
    Route::apiResource('users',   UserController::class)->except(['show']);
    Route::post('users/{id}/roles',          [UserController::class, 'assignRole']);
    Route::delete('users/{id}/roles/{roleId}', [UserController::class, 'removeRole']);

    Route::get('roles',                       [RoleController::class, 'index']);
    Route::get('permissions',                 [RoleController::class, 'permissions']);
    Route::post('roles/{id}/permissions',     [RoleController::class, 'syncPermissions']);

    Route::apiResource('offices', OfficeController::class)->only(['index','store','update']);
});

// ─── Farmer portal (sanctum but farmer guard) ────────────────────────────
Route::middleware(['auth:sanctum'])->prefix('farmer')->group(function () {
    Route::get('me', fn (Request $r) => $r->user());
    // TODO: farmer self-service endpoints (statements, dues, payments)
});
