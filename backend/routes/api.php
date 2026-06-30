<?php

use App\Http\Controllers\AccountController;
use App\Http\Controllers\AdminVerifyController;
use App\Http\Controllers\AssetController;
use App\Http\Controllers\AuditController;
use App\Http\Controllers\AuthController;
use App\Http\Controllers\FarmerAuthController;
use App\Http\Controllers\FarmerController;
use App\Http\Controllers\GeoController;
use App\Http\Controllers\IrrigationInvoiceController;
use App\Http\Controllers\IrrigationRateController;
use App\Http\Controllers\JournalController;
use App\Http\Controllers\LandController;
use App\Http\Controllers\LoanController;
use App\Http\Controllers\LoanPlanController;
use App\Http\Controllers\PaymentController;
use App\Http\Controllers\QrController;
use App\Http\Controllers\SmsController;
use App\Http\Controllers\OfficeController;
use App\Http\Controllers\ReportController;
use App\Http\Controllers\RoleController;
use App\Http\Controllers\SavingsController;
use App\Http\Controllers\SeasonController;
use App\Http\Controllers\GenericTableController;
use App\Http\Controllers\RpcController;
use App\Http\Controllers\FunctionController;
use App\Http\Controllers\StorageController;
use App\Http\Controllers\DeveloperToolsController;
use App\Http\Controllers\UserController;
use Illuminate\Support\Facades\Route;

/*
|--------------------------------------------------------------------------
| API Routes
|--------------------------------------------------------------------------
| Auth (Step 2/3) + Batch 1 (Users/Roles/Offices/Audit).
| Module routes (farmers, lands, irrigation, savings, accounting, assets)
| are appended in later steps.
*/

Route::prefix('auth')->group(function () {
    // Rate-limit credential endpoints to blunt brute-force attacks.
    Route::middleware('throttle:10,1')->group(function () {
        Route::post('/login', [AuthController::class, 'login']);
        Route::post('/password/forgot', [AuthController::class, 'forgotPassword']);
        Route::post('/password/reset', [AuthController::class, 'resetPassword']);
    });

    Route::middleware('auth:sanctum')->group(function () {
        Route::get('/me', [AuthController::class, 'me']);
        Route::post('/logout', [AuthController::class, 'logout']);
        Route::post('/logout-all', [AuthController::class, 'logoutAll']);
    });
});

// ── Batch 1: Admin / Users / Roles / Offices / Audit ──────────────────
Route::middleware(['auth:sanctum', 'branch.scope'])->group(function () {
    // Users
    Route::get('/users', [UserController::class, 'index'])->middleware('permission:users.view');
    Route::post('/users', [UserController::class, 'store'])->middleware('permission:users.manage');
    Route::put('/users/{user}', [UserController::class, 'update'])->middleware('permission:users.manage');
    Route::delete('/users/{user}', [UserController::class, 'destroy'])->middleware('permission:users.manage');
    Route::post('/users/{user}/roles', [UserController::class, 'assignRole'])->middleware('permission:users.manage');
    Route::delete('/users/{user}/roles/{role}', [UserController::class, 'removeRole'])->middleware('permission:users.manage');

    // Roles & permissions
    Route::get('/roles', [RoleController::class, 'index'])->middleware('permission:roles.view');
    Route::get('/permissions', [RoleController::class, 'permissions'])->middleware('permission:roles.view');
    Route::post('/roles/{role}/permissions', [RoleController::class, 'syncPermissions'])->middleware('permission:roles.manage');

    // Admin verification (required admin accounts + role mapping)
    Route::get('/admin/verify', [AdminVerifyController::class, 'index'])->middleware('permission:users.view');
    Route::post('/admin/verify/fix', [AdminVerifyController::class, 'fix'])->middleware('permission:users.manage');

    // Offices
    Route::get('/offices', [OfficeController::class, 'index'])->middleware('permission:offices.view');
    Route::post('/offices', [OfficeController::class, 'store'])->middleware('permission:offices.manage');
    Route::put('/offices/{office}', [OfficeController::class, 'update'])->middleware('permission:offices.manage');

    // Audit logs
    Route::get('/audit-logs', [AuditController::class, 'index'])->middleware('permission:audit.view');
});

// ── Batch 2: Farmers / Lands / Geo ────────────────────────────────────
Route::middleware(['auth:sanctum', 'branch.scope'])->group(function () {
    // Geo lookups (read-only reference data)
    Route::get('/geo/divisions', [GeoController::class, 'divisions']);
    Route::get('/geo/districts', [GeoController::class, 'districts']);
    Route::get('/geo/upazilas', [GeoController::class, 'upazilas']);
    Route::get('/geo/unions', [GeoController::class, 'unions']);
    Route::get('/geo/mouzas', [GeoController::class, 'mouzas']);
    Route::get('/land-types', [GeoController::class, 'landTypes']);

    // Farmers
    Route::get('/farmers', [FarmerController::class, 'index'])->middleware('permission:farmers.view');
    Route::get('/farmers/{farmer}', [FarmerController::class, 'show'])->middleware('permission:farmers.view');
    Route::post('/farmers', [FarmerController::class, 'store'])->middleware('permission:farmers.manage');
    Route::put('/farmers/{farmer}', [FarmerController::class, 'update'])->middleware('permission:farmers.manage');
    Route::delete('/farmers/{farmer}', [FarmerController::class, 'destroy'])->middleware('permission:farmers.manage');

    // Lands
    Route::get('/lands', [LandController::class, 'index'])->middleware('permission:lands.view');
    Route::post('/lands', [LandController::class, 'store'])->middleware('permission:lands.manage');
    Route::put('/lands/{land}', [LandController::class, 'update'])->middleware('permission:lands.manage');
    Route::delete('/lands/{land}', [LandController::class, 'destroy'])->middleware('permission:lands.manage');
});

// ── Batch 3: Irrigation (সেচ) ─────────────────────────────────────────
Route::middleware(['auth:sanctum', 'branch.scope'])->group(function () {
    // Seasons
    Route::get('/seasons', [SeasonController::class, 'index'])->middleware('permission:irrigation.view');
    Route::post('/seasons', [SeasonController::class, 'store'])->middleware('permission:irrigation.manage');
    Route::put('/seasons/{season}', [SeasonController::class, 'update'])->middleware('permission:irrigation.manage');
    Route::post('/seasons/{season}/activate', [SeasonController::class, 'activate'])->middleware('permission:irrigation.manage');

    // Irrigation rates
    Route::get('/irrigation-rates', [IrrigationRateController::class, 'index'])->middleware('permission:irrigation.view');
    Route::post('/irrigation-rates', [IrrigationRateController::class, 'store'])->middleware('permission:irrigation.manage');
    Route::put('/irrigation-rates/{irrigationRate}', [IrrigationRateController::class, 'update'])->middleware('permission:irrigation.manage');
    Route::delete('/irrigation-rates/{irrigationRate}', [IrrigationRateController::class, 'destroy'])->middleware('permission:irrigation.manage');

    // Irrigation invoices
    Route::get('/irrigation-invoices', [IrrigationInvoiceController::class, 'index'])->middleware('permission:irrigation.view');
    Route::get('/irrigation-invoices/{invoice}', [IrrigationInvoiceController::class, 'show'])->middleware('permission:irrigation.view');
    Route::post('/irrigation-invoices', [IrrigationInvoiceController::class, 'store'])->middleware('permission:irrigation.manage');
    Route::delete('/irrigation-invoices/{invoice}', [IrrigationInvoiceController::class, 'destroy'])->middleware('permission:irrigation.manage');
});

// ── Batch 4: Savings / Loan / Share + Accounting + Assets ─────────────
Route::middleware(['auth:sanctum', 'branch.scope'])->group(function () {
    // Savings (also serves /share-collection in frontend)
    Route::get('/savings', [SavingsController::class, 'index'])->middleware('permission:savings.view');
    Route::get('/savings/{saving}', [SavingsController::class, 'show'])->middleware('permission:savings.view');
    Route::post('/savings', [SavingsController::class, 'store'])->middleware('permission:savings.manage');
    Route::post('/savings/{saving}/deposit', [SavingsController::class, 'deposit'])->middleware('permission:savings.manage');
    Route::post('/savings/{saving}/withdraw', [SavingsController::class, 'withdraw'])->middleware('permission:savings.manage');

    // Loan plans
    Route::get('/loan-plans', [LoanPlanController::class, 'index'])->middleware('permission:loans.view');
    Route::post('/loan-plans', [LoanPlanController::class, 'store'])->middleware('permission:loans.manage');
    Route::put('/loan-plans/{loanPlan}', [LoanPlanController::class, 'update'])->middleware('permission:loans.manage');
    Route::delete('/loan-plans/{loanPlan}', [LoanPlanController::class, 'destroy'])->middleware('permission:loans.manage');

    // Loans
    Route::get('/loans', [LoanController::class, 'index'])->middleware('permission:loans.view');
    Route::get('/loans/{loan}', [LoanController::class, 'show'])->middleware('permission:loans.view');
    Route::post('/loans', [LoanController::class, 'store'])->middleware('permission:loans.manage');
    Route::post('/loans/{loan}/repay', [LoanController::class, 'repay'])->middleware('permission:loans.manage');

    // Accounting — chart of accounts
    Route::get('/accounts', [AccountController::class, 'index'])->middleware('permission:accounting.view');
    Route::post('/accounts', [AccountController::class, 'store'])->middleware('permission:accounting.manage');
    Route::put('/accounts/{account}', [AccountController::class, 'update'])->middleware('permission:accounting.manage');

    // Accounting — journals
    Route::get('/journals', [JournalController::class, 'index'])->middleware('permission:accounting.view');
    Route::post('/journals', [JournalController::class, 'store'])->middleware('permission:accounting.manage');

    // Assets
    Route::get('/assets', [AssetController::class, 'index'])->middleware('permission:assets.view');
    Route::post('/assets', [AssetController::class, 'store'])->middleware('permission:assets.manage');
    Route::put('/assets/{asset}', [AssetController::class, 'update'])->middleware('permission:assets.manage');
});

// ── Financial reports ────────────────────────────────────────────────
Route::middleware(['auth:sanctum', 'branch.scope'])->group(function () {
    Route::get('/reports/trial-balance', [ReportController::class, 'trialBalance'])->middleware('permission:accounting.view');
    Route::get('/reports/profit-loss', [ReportController::class, 'profitAndLoss'])->middleware('permission:accounting.view');
    Route::get('/reports/balance-sheet', [ReportController::class, 'balanceSheet'])->middleware('permission:accounting.view');
    Route::get('/reports/cashbook', [ReportController::class, 'cashbook'])->middleware('permission:accounting.view');
});

// ── Payments + Receipts (multi-allocation) ────────────────────────────
Route::middleware(['auth:sanctum', 'branch.scope'])->group(function () {
    Route::get('/payments', [PaymentController::class, 'index'])->middleware('permission:payments.view');
    Route::get('/payments/{payment}', [PaymentController::class, 'show'])->middleware('permission:payments.view');
    Route::post('/payments', [PaymentController::class, 'store'])->middleware('permission:payments.manage');
    Route::delete('/payments/{payment}', [PaymentController::class, 'destroy'])->middleware('permission:payments.manage');
});

// ── SMS + QR tokens ───────────────────────────────────────────────────
Route::middleware(['auth:sanctum', 'branch.scope'])->group(function () {
    Route::get('/sms/logs', [SmsController::class, 'index'])->middleware('permission:sms.view');
    Route::post('/sms/send', [SmsController::class, 'send'])->middleware('permission:sms.manage');
    Route::post('/sms/retry', [SmsController::class, 'retry'])->middleware('permission:sms.manage');

    Route::post('/qr/issue', [QrController::class, 'issue'])->middleware('permission:qr.manage');
    Route::delete('/qr/{qr}', [QrController::class, 'revoke'])->middleware('permission:qr.manage');
    Route::post('/qr/resolve', [QrController::class, 'resolve'])->middleware('permission:qr.view');
});

// ── Generic table gateway (Supabase Data API replacement) ─────────────
// Lets the frontend `db` adapter run the common subset of supabase
// queries against any allow-listed table, office-scoped by branch.scope.
Route::middleware(['auth:sanctum', 'branch.scope'])->group(function () {
    Route::post('/db/{table}/query', [GenericTableController::class, 'select']);
    Route::post('/db/{table}', [GenericTableController::class, 'insert']);
    Route::patch('/db/{table}', [GenericTableController::class, 'update']);
    Route::delete('/db/{table}', [GenericTableController::class, 'delete']);

    // RPC dispatcher (Supabase Postgres RPC replacement)
    Route::post('/rpc/{name}', [RpcController::class, 'handle']);
    // Edge-function dispatcher (Supabase Edge Functions replacement)
    Route::post('/fn/{name}', [FunctionController::class, 'handle']);
    // Storage gateway (Supabase Storage replacement)
    Route::post('/storage/upload', [StorageController::class, 'upload']);
    Route::post('/storage/remove', [StorageController::class, 'remove']);
});

// ── Developer-only tools: file manager + GitHub self-update ───────────
Route::middleware(['auth:sanctum', 'developer'])->prefix('dev')->group(function () {
    Route::get('/files', [DeveloperToolsController::class, 'list']);
    Route::post('/files/read', [DeveloperToolsController::class, 'read']);
    Route::post('/files/write', [DeveloperToolsController::class, 'write']);

    Route::get('/git/status', [DeveloperToolsController::class, 'gitStatus']);
    Route::post('/git/remote', [DeveloperToolsController::class, 'setRemote']);
    Route::post('/git/pull', [DeveloperToolsController::class, 'pull']);
});

// ── Farmer portal (self-service: code login or phone + OTP) ───────────
Route::prefix('farmer')->group(function () {
    Route::middleware('throttle:10,1')->group(function () {
        Route::post('/auth/login', [FarmerAuthController::class, 'login']);
        Route::post('/auth/request-otp', [FarmerAuthController::class, 'requestOtp']);
        Route::post('/auth/verify-otp', [FarmerAuthController::class, 'verifyOtp']);
    });

    Route::middleware('auth:sanctum')->get('/me', [FarmerAuthController::class, 'me']);
});
