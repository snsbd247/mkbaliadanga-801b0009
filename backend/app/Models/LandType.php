<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Concerns\HasUuids;
use Illuminate\Database\Eloquent\Model;

class LandType extends Model
{
    use HasUuids;
    protected $keyType = 'string';
    public $incrementing = false;
    protected $fillable = ['name', 'name_bn', 'is_active', 'extra'];
    protected $casts = ['is_active' => 'boolean', 'extra' => 'array'];
}
