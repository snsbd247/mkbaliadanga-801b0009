<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;

class FarmerSavingsPlans extends Model
{
    protected $table = 'farmer_savings_plans';
    public $incrementing = false;
    protected $keyType = 'string';
    public $timestamps = true;
    protected $guarded = [];
    protected $fillable = ['farmer_id', 'plan_id', 'start_date', 'expected_total', 'expected_interest', 'maturity_amount', 'status', 'office_id', 'created_by', 'approved_by', 'approved_at', 'cancelled_by', 'cancelled_at', 'cancel_reason'];
}
