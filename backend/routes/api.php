<?php

use App\Http\Controllers\AuthController;
use Illuminate\Support\Facades\Route;

/*
|--------------------------------------------------------------------------
| API Routes (Step 2: Auth only)
|--------------------------------------------------------------------------
| Contract matches the frontend bridge src/lib/laravel-auth.ts:
|   POST /api/auth/login  { identifier, password, device }
|   GET  /api/auth/me
|   POST /api/auth/logout
| Module routes (farmers, lands, irrigation, savings, accounting, assets)
| are appended in later steps under auth:sanctum + branch.scope.
*/

Route::prefix('auth')->group(function () {
    Route::post('/login', [AuthController::class, 'login']);

    Route::middleware('auth:sanctum')->group(function () {
        Route::get('/me', [AuthController::class, 'me']);
        Route::post('/logout', [AuthController::class, 'logout']);
    });
});
