<?php

use App\Http\Controllers\Auth\AuthController;
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

    // Module routes will be registered here in ধাপ ৪
    // Route::middleware(['branch','permission:farmers.view'])->get('/farmers', ...);
});
