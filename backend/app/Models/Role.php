<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Concerns\HasUuids;
use Illuminate\Database\Eloquent\Model;

class Role extends Model {
    use HasUuids;
    protected $fillable = ['name','label','meta'];
    protected $casts = ['meta' => 'array'];

    public function permissions() { return $this->belongsToMany(Permission::class, 'role_permissions'); }
    public function users()       { return $this->belongsToMany(User::class, 'user_roles')->withPivot('office_id'); }
}
