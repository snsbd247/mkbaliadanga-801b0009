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

        // Security hardening headers on every API response.
        $middleware->append(SecurityHeaders::class);

        // Named aliases used by route definitions.
        $middleware->alias([
            'permission' => CheckPermission::class,
            'branch.scope' => BranchScope::class,
        ]);
    })
    ->withExceptions(function (Exceptions $exceptions) {
        // Always answer API requests with JSON. Without this, an unexpected
        // server error (e.g. a query against a missing column/table) renders as
        // an opaque HTML 500 that the frontend reports only as "Edge Function
        // Error". Returning structured JSON makes every failure actionable and
        // keeps the SPA error handling working.
        $exceptions->shouldRenderJsonWhen(function ($request, $throwable) {
            return $request->is('api/*') || $request->expectsJson();
        });

        $exceptions->render(function (\Throwable $e, $request) {
            if (! ($request->is('api/*') || $request->expectsJson())) {
                return null;
            }
            if ($e instanceof \Symfony\Component\HttpKernel\Exception\HttpExceptionInterface) {
                $status = $e->getStatusCode();
                return response()->json([
                    'message' => $e->getMessage() ?: 'Request failed',
                ], $status);
            }
            \Illuminate\Support\Facades\Log::error('API error: '.$e->getMessage(), [
                'exception' => get_class($e),
                'path' => $request->path(),
            ]);
            return response()->json([
                'message' => $e->getMessage(),
                'exception' => class_basename($e),
            ], 500);
        });
    })->create();
