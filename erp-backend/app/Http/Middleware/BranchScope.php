<?php

namespace App\Http\Middleware;

use Closure;
use Illuminate\Http\Request;
use Symfony\Component\HttpFoundation\Response;

/**
 * Office (branch) scoping. Replaces Supabase RLS office isolation.
 * Injects the resolved office_id onto the request so controllers/queries
 * can scope. Super admin / developer may pass ?office_id to act globally.
 */
class BranchScope
{
    public function handle(Request $request, Closure $next): Response
    {
        $user = $request->user();

        if (!$user) {
            return response()->json(['message' => 'Unauthenticated.'], 401);
        }

        $isGlobal = $user->hasRole('super_admin') || $user->hasRole('developer');

        $scopeOfficeId = $isGlobal
            ? ($request->input('office_id') ?: $user->office_id)
            : $user->office_id;

        $request->attributes->set('scope_office_id', $scopeOfficeId);
        $request->attributes->set('scope_is_global', $isGlobal);

        return $next($request);
    }
}
