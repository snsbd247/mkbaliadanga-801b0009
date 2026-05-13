<?php

namespace App\Policies;

use App\Models\Payment;
use App\Models\User;

class PaymentPolicy {
    public function viewAny(User $u): bool { return $u->hasPermission('payments.read'); }
    public function view(User $u, Payment $p): bool { return $u->hasPermission('payments.read') && $p->office_id === $u->office_id; }
    public function create(User $u): bool { return $u->hasPermission('payments.write'); }
    public function delete(User $u, Payment $p): bool { return $u->hasPermission('payments.delete') && $p->office_id === $u->office_id; }
}
