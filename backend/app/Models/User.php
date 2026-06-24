<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Concerns\HasUuids;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Database\Eloquent\Relations\HasMany;
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

    public function roles(): HasMany
    {
        return $this->hasMany(UserRole::class);
    }

    /**
     * Flat list of permission identifiers granted to this user via their roles.
     *
     * @return array<int, string>
     */
    public function permissionList(): array
    {
        return UserRole::query()
            ->where('user_id', $this->id)
            ->join('role_permissions', 'role_permissions.role', '=', 'user_roles.role')
            ->pluck('role_permissions.permission')
            ->unique()
            ->values()
            ->all();
    }

    public function hasPermission(string $permission): bool
    {
        return in_array($permission, $this->permissionList(), true);
    }
}
