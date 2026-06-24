<?php

namespace App\Http\Middleware;

use Closure;
use Illuminate\Http\Request;
use Symfony\Component\HttpFoundation\Response;

/**
 * Office (branch) scoping replacement for Postgres RLS.
 *
 * A super admin (role "super_admin") bypasses scoping and may pass
 * ?office_id=... to view a specific office; everyone else is locked to
 * their own office_id.
 */
class BranchScope
{
    public function handle(Request $request, Closure $next): Response
    {
        $user = $request->user();

        if (! $user) {
            return response()->json(['message' => 'অনুমোদিত নয়।'], 401);
        }

        if ($user->hasRole('super_admin')) {
            $request->attributes->set('scope_office_id', $request->query('office_id'));
            $request->attributes->set('is_super_admin', true);
        } else {
            $request->attributes->set('scope_office_id', $user->office_id);
            $request->attributes->set('is_super_admin', false);
        }

        return $next($request);
    }
}
