<?php

use App\Http\Controllers\AuthController;
use Illuminate\Support\Facades\Route;

/*
|--------------------------------------------------------------------------
| API Routes (Step 2: Auth only)
|--------------------------------------------------------------------------
| Additional module routes (farmers, lands, irrigation, savings, accounting,
| assets) will be appended in later steps under auth:sanctum + branch.scope.
*/

Route::post('/login', [AuthController::class, 'login']);

Route::middleware('auth:sanctum')->group(function () {
    Route::get('/me', [AuthController::class, 'me']);
    Route::post('/logout', [AuthController::class, 'logout']);
});
