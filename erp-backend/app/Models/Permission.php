<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Concerns\HasUuids;
use Illuminate\Database\Eloquent\Model;

class Permission extends Model
{
    use HasUuids;

    protected $keyType = 'string';
    public $incrementing = false;

    protected $fillable = ['name', 'group', 'label'];

    public function roles()
    {
        return $this->belongsToMany(CustomRole::class, 'role_permissions', 'permission_id', 'role_id');
    }
}
