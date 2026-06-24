<?php

use App\Http\Controllers\Auth\AuthController;
use App\Http\Controllers\FarmerController;
use App\Http\Controllers\GeoController;
use App\Http\Controllers\LandController;
use Illuminate\Support\Facades\Route;

/*
|--------------------------------------------------------------------------
| API Routes
|--------------------------------------------------------------------------
| Base prefix: /api  (Laravel auto-prefixes this file).
| Auth via Sanctum personal access tokens (Bearer).
*/

Route::post('/auth/login', [AuthController::class, 'login']);

Route::middleware('auth:sanctum')->group(function () {
    Route::get('/auth/me',          [AuthController::class, 'me']);
    Route::post('/auth/logout',     [AuthController::class, 'logout']);
    Route::post('/auth/logout-all', [AuthController::class, 'logoutAll']);

    // All module routes are office-scoped via the `branch` middleware.
    Route::middleware('branch')->group(function () {

        // ── Geo / catalog lookups (read-only) ───────────────────────
        Route::get('/geo/divisions',  [GeoController::class, 'divisions']);
        Route::get('/geo/districts',   [GeoController::class, 'districts']);
        Route::get('/geo/upazilas',    [GeoController::class, 'upazilas']);
        Route::get('/geo/unions',      [GeoController::class, 'unions']);
        Route::get('/geo/mouzas',      [GeoController::class, 'mouzas']);
        Route::get('/geo/patwaris',    [GeoController::class, 'patwaris']);
        Route::get('/geo/land-types',  [GeoController::class, 'landTypes']);

        // ── Farmers ─────────────────────────────────────────────────
        Route::get('/farmers',        [FarmerController::class, 'index'])->middleware('permission:farmers.view');
        Route::get('/farmers/{farmer}', [FarmerController::class, 'show'])->middleware('permission:farmers.view');
        Route::post('/farmers',       [FarmerController::class, 'store'])->middleware('permission:farmers.add');
        Route::put('/farmers/{farmer}', [FarmerController::class, 'update'])->middleware('permission:farmers.edit');
        Route::delete('/farmers/{farmer}', [FarmerController::class, 'destroy'])->middleware('permission:farmers.delete');

        // ── Lands ───────────────────────────────────────────────────
        Route::get('/lands',          [LandController::class, 'index'])->middleware('permission:lands.view');
        Route::get('/lands/{land}',   [LandController::class, 'show'])->middleware('permission:lands.view');
        Route::post('/lands',         [LandController::class, 'store'])->middleware('permission:lands.add');
        Route::put('/lands/{land}',   [LandController::class, 'update'])->middleware('permission:lands.edit');
        Route::delete('/lands/{land}', [LandController::class, 'destroy'])->middleware('permission:lands.delete');
    });
});
