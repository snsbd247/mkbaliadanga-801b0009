<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Concerns\HasUuids;
use Illuminate\Database\Eloquent\Model;

class Permission extends Model {
    use HasUuids;
    protected $fillable = ['name','group','label'];
    public function roles() { return $this->belongsToMany(Role::class, 'role_permissions'); }
}
