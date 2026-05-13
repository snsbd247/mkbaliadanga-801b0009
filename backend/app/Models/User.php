<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Concerns\HasUuids;
use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\SoftDeletes;
use Illuminate\Foundation\Auth\User as Authenticatable;
use Illuminate\Notifications\Notifiable;
use Laravel\Sanctum\HasApiTokens;

class User extends Authenticatable
{
    use HasUuids, HasApiTokens, HasFactory, Notifiable, SoftDeletes;

    protected $fillable = ['name','email','password','office_id','phone','preferences','is_active'];
    protected $hidden   = ['password','remember_token'];
    protected $casts = [
        'email_verified_at' => 'datetime',
        'last_login_at'     => 'datetime',
        'password'          => 'hashed',
        'preferences'       => 'array',
        'is_active'         => 'boolean',
    ];

    public function office()       { return $this->belongsTo(Office::class); }
    public function roles()        { return $this->belongsToMany(Role::class, 'user_roles')->withPivot('office_id')->withTimestamps(); }

    public function hasRole(string $name, ?string $officeId = null): bool {
        return $this->roles()
            ->where('name', $name)
            ->when($officeId, fn($q) => $q->wherePivot('office_id', $officeId))
            ->exists();
    }

    public function hasPermission(string $name): bool {
        return $this->roles()
            ->whereHas('permissions', fn($q) => $q->where('name', $name))
            ->exists();
    }
}
