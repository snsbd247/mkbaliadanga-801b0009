<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Concerns\HasUuids;
use Illuminate\Database\Eloquent\Model;

class LoanPlan extends Model
{
    use HasUuids;

    protected $keyType = 'string';
    public $incrementing = false;

    protected $fillable = [
        'office_id', 'name', 'principal', 'interest_rate', 'tenure_months',
        'processing_fee', 'description', 'is_active',
    ];

    protected $casts = [
        'principal' => 'float',
        'interest_rate' => 'float',
        'tenure_months' => 'integer',
        'processing_fee' => 'float',
        'is_active' => 'boolean',
    ];
}
