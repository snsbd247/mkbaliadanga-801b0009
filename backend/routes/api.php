<?php

use App\Http\Controllers\Auth\AuthController;
use App\Http\Controllers\Auth\FarmerAuthController;
use App\Http\Controllers\Auth\PasswordResetController;
use App\Http\Controllers\FarmerController;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Route;

// ─── Public ───────────────────────────────────────────────────────────────
Route::post('auth/login',                [AuthController::class, 'login'])->middleware('throttle:10,1');
Route::post('auth/password/forgot',      [PasswordResetController::class, 'request'])->middleware('throttle:5,5');
Route::post('auth/password/reset',       [PasswordResetController::class, 'reset'])->middleware('throttle:5,5');

// Farmer portal
Route::post('farmer/auth/request-otp',   [FarmerAuthController::class, 'requestOtp'])->middleware('throttle:5,5');
Route::post('farmer/auth/verify-otp',    [FarmerAuthController::class, 'verifyOtp'])->middleware('throttle:10,5');

// ─── Authenticated (admin/staff) ─────────────────────────────────────────
Route::middleware(['auth:sanctum'])->group(function () {
    Route::get('auth/me',         [AuthController::class, 'me']);
    Route::post('auth/logout',    [AuthController::class, 'logout']);
    Route::post('auth/logout-all',[AuthController::class, 'logoutAll']);

    Route::middleware(['office', 'audit'])->group(function () {
        Route::apiResource('farmers', FarmerController::class);
        // TODO: mount loans, savings, irrigation, payments, accounts, reports controllers in Phase 2.
    });
});

// ─── Authenticated (farmer portal) ───────────────────────────────────────
Route::middleware(['auth:sanctum'])->prefix('farmer')->group(function () {
    Route::get('me', fn (Request $r) => $r->user());
    // TODO: farmer self-service endpoints (statements, dues, payments)
});
