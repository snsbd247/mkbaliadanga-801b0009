<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Concerns\HasUuids;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Database\Eloquent\Relations\BelongsToMany;
use Illuminate\Foundation\Auth\User as Authenticatable;
use Illuminate\Notifications\Notifiable;
use Laravel\Sanctum\HasApiTokens;

class User extends Authenticatable
{
    use HasApiTokens, HasUuids, Notifiable;

    protected $keyType = 'string';
    public $incrementing = false;

    protected $fillable = [
        'username',
        'name',
        'email',
        'phone',
        'password',
        'office_id',
        'is_active',
    ];

    protected $hidden = [
        'password',
        'remember_token',
    ];

    protected function casts(): array
    {
        return [
            'email_verified_at' => 'datetime',
            'password' => 'hashed',
            'is_active' => 'boolean',
        ];
    }

    public function office(): BelongsTo
    {
        return $this->belongsTo(Office::class);
    }

    public function roles(): BelongsToMany
    {
        return $this->belongsToMany(Role::class, 'user_roles');
    }

    /** @return array<int, string> role names */
    public function roleNames(): array
    {
        return $this->roles()->pluck('name')->all();
    }

    /**
     * Flat list of permission keys granted via this user's roles.
     *
     * @return array<int, string>
     */
    public function permissionList(): array
    {
        return Permission::query()
            ->join('role_permissions', 'role_permissions.permission_id', '=', 'permissions.id')
            ->join('user_roles', 'user_roles.role_id', '=', 'role_permissions.role_id')
            ->where('user_roles.user_id', $this->id)
            ->pluck('permissions.key')
            ->unique()
            ->values()
            ->all();
    }

    public function hasRole(string $role): bool
    {
        return in_array($role, $this->roleNames(), true);
    }

    public function hasPermission(string $permission): bool
    {
        $permissions = $this->permissionList();

        // Wildcard (super admin) grants everything.
        return in_array('*', $permissions, true)
            || in_array($permission, $permissions, true);
    }
}
