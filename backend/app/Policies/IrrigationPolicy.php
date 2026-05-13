<?php

namespace App\Policies;

use App\Models\IrrigationInvoice;
use App\Models\User;

class IrrigationPolicy {
    public function viewAny(User $u): bool { return $u->hasPermission('irrigation.read'); }
    public function view(User $u, IrrigationInvoice $i): bool { return $u->hasPermission('irrigation.read') && $i->office_id === $u->office_id; }
    public function create(User $u): bool { return $u->hasPermission('irrigation.write'); }
    public function update(User $u, IrrigationInvoice $i): bool { return $u->hasPermission('irrigation.write') && $i->office_id === $u->office_id; }
}
