<?php

namespace App\Http\Middleware;

use Closure;
use Illuminate\Http\Request;
use Symfony\Component\HttpFoundation\Response;

/**
 * RBAC gate. Usage: ->middleware('permission:farmers.view')
 * Super admin / developer bypass all checks.
 */
class CheckPermission
{
    public function handle(Request $request, Closure $next, string $permission): Response
    {
        $user = $request->user();

        if (!$user) {
            return response()->json(['message' => 'Unauthenticated.'], 401);
        }

        if ($user->hasRole('super_admin') || $user->hasRole('developer')) {
            return $next($request);
        }

        if (!$user->hasPermission($permission)) {
            return response()->json([
                'message' => "এই কাজের অনুমতি নেই / Missing permission: {$permission}",
            ], 403);
        }

        return $next($request);
    }
}
