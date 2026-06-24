<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Concerns\HasUuids;
use Illuminate\Database\Eloquent\Model;

class Office extends Model
{
    use HasUuids;

    protected $keyType = 'string';
    public $incrementing = false;

    protected $fillable = ['name', 'code', 'address', 'phone', 'is_active', 'meta'];

    protected $casts = [
        'is_active' => 'boolean',
        'meta'      => 'array',
    ];

    public function users()
    {
        return $this->hasMany(User::class);
    }
}
