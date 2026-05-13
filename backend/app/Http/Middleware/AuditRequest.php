<?php

namespace App\Http\Middleware;

use App\Models\AuditLog;
use Closure;
use Illuminate\Http\Request;
use Illuminate\Support\Str;

class AuditRequest {
    public function handle(Request $request, Closure $next) {
        $response = $next($request);
        try {
            if (in_array($request->method(), ['POST','PUT','PATCH','DELETE']) && $request->user()) {
                AuditLog::create([
                    'office_id' => $request->user()->office_id,
                    'user_id'   => $request->user()->id,
                    'action'    => strtolower($request->method()),
                    'entity'    => Str::before(trim($request->path(), '/'), '/'),
                    'meta'      => [
                        'path'   => $request->path(),
                        'status' => $response->getStatusCode(),
                    ],
                    'ip'        => $request->ip(),
                    'created_at'=> now(),
                ]);
            }
        } catch (\Throwable $e) { /* swallow audit errors */ }
        return $response;
    }
}
