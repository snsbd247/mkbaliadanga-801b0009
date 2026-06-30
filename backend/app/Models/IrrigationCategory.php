<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Concerns\HasUuids;
use Illuminate\Database\Eloquent\Model;

class IrrigationCategory extends Model
{
    use HasUuids;
    protected $keyType = 'string';
    public $incrementing = false;
    protected $fillable = ['office_id', 'name', 'name_bn', 'is_active', 'extra'];
    protected $casts = ['is_active' => 'boolean', 'extra' => 'array'];
}
