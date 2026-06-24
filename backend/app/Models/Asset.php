<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Concerns\HasUuids;
use Illuminate\Database\Eloquent\Model;

class Asset extends Model
{
    use HasUuids;

    protected $keyType = 'string';
    public $incrementing = false;

    protected $fillable = [
        'office_id', 'name', 'category', 'serial_no', 'purchase_date', 'cost', 'status', 'extra',
    ];

    protected $casts = [
        'purchase_date' => 'date',
        'cost' => 'float',
        'extra' => 'array',
    ];
}
