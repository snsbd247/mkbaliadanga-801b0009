<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;

class IrrigationRateOverrides extends Model
{
    protected $table = 'irrigation_rate_overrides';
    public $incrementing = false;
    protected $keyType = 'string';
    public $timestamps = false;
    protected $guarded = [];
    protected $fillable = ['office_id', 'irrigation_invoice_id', 'original_rate', 'overridden_rate', 'override_reason', 'approved_by', 'created_by'];
}
