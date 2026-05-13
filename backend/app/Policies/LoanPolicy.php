<?php

namespace App\Policies;

use App\Models\Loan;
use App\Models\User;

class LoanPolicy {
    public function viewAny(User $u): bool { return $u->hasPermission('loans.read'); }
    public function view(User $u, Loan $l): bool { return $u->hasPermission('loans.read') && $l->office_id === $u->office_id; }
    public function create(User $u): bool { return $u->hasPermission('loans.write'); }
    public function update(User $u, Loan $l): bool { return $u->hasPermission('loans.write') && $l->office_id === $u->office_id; }
    public function approve(User $u, Loan $l): bool { return $u->hasPermission('loans.approve') && $l->office_id === $u->office_id; }
}
