<?php

use App\Http\Controllers\AuditController;
use App\Http\Controllers\AuthController;
use App\Http\Controllers\OfficeController;
use App\Http\Controllers\RoleController;
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
    Route::post('/login', [AuthController::class, 'login']);

    Route::middleware('auth:sanctum')->group(function () {
        Route::get('/me', [AuthController::class, 'me']);
        Route::post('/logout', [AuthController::class, 'logout']);
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

    // Offices
    Route::get('/offices', [OfficeController::class, 'index'])->middleware('permission:offices.view');
    Route::post('/offices', [OfficeController::class, 'store'])->middleware('permission:offices.manage');
    Route::put('/offices/{office}', [OfficeController::class, 'update'])->middleware('permission:offices.manage');

    // Audit logs
    Route::get('/audit-logs', [AuditController::class, 'index'])->middleware('permission:audit.view');
});
