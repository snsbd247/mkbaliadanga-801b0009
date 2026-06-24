<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Concerns\HasUuids;
use Illuminate\Database\Eloquent\SoftDeletes;
use Illuminate\Database\Eloquent\Model;

class Farmer extends Model
{
    use HasUuids, SoftDeletes;

    protected $keyType = 'string';
    public $incrementing = false;

    protected $guarded = ['id'];

    protected $casts = [
        'dob'        => 'date',
        'is_member'  => 'boolean',
        'is_blocked' => 'boolean',
        'extra'      => 'array',
    ];

    public function office()
    {
        return $this->belongsTo(Office::class);
    }

    public function lands()
    {
        return $this->hasMany(Land::class);
    }
}
