<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Concerns\HasUuids;
use Illuminate\Database\Eloquent\Model;

class Season extends Model
{
    use HasUuids;
    protected $keyType = 'string';
    public $incrementing = false;
    protected $fillable = [
        'name', 'year', 'type', 'season_type_id', 'fiscal_year',
        'start_date', 'end_date', 'due_date', 'status', 'is_active', 'extra',
    ];
    protected $casts = [
        'year' => 'integer',
        'start_date' => 'date',
        'end_date' => 'date',
        'due_date' => 'date',
        'is_active' => 'boolean',
        'extra' => 'array',
    ];
}
