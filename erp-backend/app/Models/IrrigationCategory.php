<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Concerns\HasUuids;
use Illuminate\Database\Eloquent\Model;

class IrrigationCategory extends Model
{
    use HasUuids;
    protected $keyType = 'string';
    public $incrementing = false;
    protected $guarded = ['id'];
    protected $casts = ['rate' => 'decimal:2', 'is_active' => 'boolean', 'meta' => 'array'];
}
