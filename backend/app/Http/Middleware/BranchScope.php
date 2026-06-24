<?php

namespace App\Http\Middleware;

use Closure;
use Illuminate\Http\Request;
use Symfony\Component\HttpFoundation\Response;

/**
 * Office (branch) scoping replacement for Postgres RLS.
 *
 * Injects the authenticated user's office_id onto the request so that
 * controllers/queries can scope data to the current office. A super admin
 * (role "super_admin") bypasses scoping and may pass ?office_id=... to view
 * a specific office.
 */
class BranchScope
{
    public function handle(Request $request, Closure $next): Response
    {
        $user = $request->user();

        if (! $user) {
            return response()->json(['message' => 'অনুমোদিত নয়।'], 401);
        }

        $isSuperAdmin = $user->roles()->where('role', 'super_admin')->exists();

        if ($isSuperAdmin) {
            // Super admin may optionally narrow to a single office.
            $request->attributes->set('scope_office_id', $request->query('office_id'));
            $request->attributes->set('is_super_admin', true);
        } else {
            $request->attributes->set('scope_office_id', $user->office_id);
            $request->attributes->set('is_super_admin', false);
        }

        return $next($request);
    }
}
