<?php

namespace App\Http\Controllers;

use App\Models\AuditLog;
use Illuminate\Http\Request;

class AuditController extends Controller
{
    public function index(Request $r) {
        abort_unless($r->user()->hasPermission('audit.read'), 403);
        return AuditLog::where(function ($q) use ($r) {
                if (!$r->user()->hasRole('super_admin')) $q->where('office_id', app('current_office_id'));
            })
            ->when($r->entity, fn($q,$v) => $q->where('entity',$v))
            ->when($r->user_id, fn($q,$v) => $q->where('user_id',$v))
            ->orderByDesc('created_at')->paginate((int)($r->per_page ?? 50));
    }
}
