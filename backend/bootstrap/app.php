<?php

use App\Http\Middleware\BranchScope;
use App\Http\Middleware\CheckPermission;
use App\Http\Middleware\SecurityHeaders;
use Illuminate\Foundation\Application;
use Illuminate\Foundation\Configuration\Exceptions;
use Illuminate\Foundation\Configuration\Middleware;

return Application::configure(basePath: dirname(__DIR__))
    ->withRouting(
        api: __DIR__.'/../routes/api.php',
        commands: __DIR__.'/../routes/console.php',
        health: '/up',
    )
    ->withMiddleware(function (Middleware $middleware) {
        // Token-only API (Bearer tokens). Do NOT enable statefulApi(): the SPA
        // is served from the same domain as the API, and statefulApi() would
        // route same-origin requests through the web group's CSRF validation,
        // causing "CSRF token mismatch" on token-based login.

        // Named aliases used by route definitions.
        $middleware->alias([
            'permission' => CheckPermission::class,
            'branch.scope' => BranchScope::class,
        ]);
    })
    ->withExceptions(function (Exceptions $exceptions) {
        //
    })->create();
