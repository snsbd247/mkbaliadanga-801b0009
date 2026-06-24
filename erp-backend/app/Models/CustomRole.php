<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Concerns\HasUuids;
use Illuminate\Database\Eloquent\Model;

/**
 * Custom roles live in their OWN table (user_custom_roles pivot).
 * Never stored on users/profiles — prevents privilege escalation.
 */
class CustomRole extends Model
{
    use HasUuids;

    protected $table = 'custom_roles';
    protected $keyType = 'string';
    public $incrementing = false;

    protected $fillable = ['name', 'label', 'meta'];

    protected $casts = ['meta' => 'array'];

    public function permissions()
    {
        return $this->belongsToMany(Permission::class, 'role_permissions', 'role_id', 'permission_id');
    }

    public function users()
    {
        return $this->belongsToMany(User::class, 'user_custom_roles', 'role_id', 'user_id')
            ->withPivot('office_id');
    }
}
