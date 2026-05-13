<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Concerns\HasUuids;
use Illuminate\Database\Eloquent\Model;

class IrrigationRate extends Model {
    use HasUuids;
    protected $fillable = ['office_id','season_id','crop','rate_per_decimal','rate_per_bigha','meta'];
    protected $casts = ['meta' => 'array'];
}
