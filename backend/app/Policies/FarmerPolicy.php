<?php

namespace App\Policies;

use App\Models\Farmer;
use App\Models\User;

class FarmerPolicy {
    public function viewAny(User $u): bool { return $u->hasPermission('farmers.read'); }
    public function view(User $u, Farmer $f): bool {
        return $u->hasPermission('farmers.read') && $f->office_id === $u->office_id;
    }
    public function create(User $u): bool { return $u->hasPermission('farmers.write'); }
    public function update(User $u, Farmer $f): bool {
        return $u->hasPermission('farmers.write') && $f->office_id === $u->office_id;
    }
    public function delete(User $u, Farmer $f): bool {
        return $u->hasPermission('farmers.delete') && $f->office_id === $u->office_id;
    }
}
