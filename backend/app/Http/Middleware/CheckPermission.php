<?php

namespace App\Http\Middleware;

use Closure;
use Illuminate\Http\Request;
use Symfony\Component\HttpFoundation\Response;

/**
 * Route-level authorization replacement for Postgres RLS/GRANT.
 *
 * Usage: ->middleware('permission:farmers.view')
 */
class CheckPermission
{
    public function handle(Request $request, Closure $next, string $permission): Response
    {
        $user = $request->user();

        if (! $user) {
            return response()->json(['message' => 'অনুমোদিত নয়।'], 401);
        }

        if (! $user->hasPermission($permission)) {
            return response()->json([
                'message' => 'এই কাজের অনুমতি নেই।',
                'required' => $permission,
            ], 403);
        }

        return $next($request);
    }
}
