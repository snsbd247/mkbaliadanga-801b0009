<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Concerns\HasUuids;
use Illuminate\Database\Eloquent\Model;

class IrrigationRate extends Model
{
    use HasUuids;
    protected $keyType = 'string';
    public $incrementing = false;
    protected $fillable = [
        'season_id', 'category_id', 'crop', 'rate_per_decimal',
        'effective_from', 'effective_to', 'extra',
    ];
    protected $casts = [
        'rate_per_decimal' => 'float',
        'effective_from' => 'date',
        'effective_to' => 'date',
        'extra' => 'array',
    ];
}
