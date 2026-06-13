<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;

class SavingsPlans extends Model
{
    protected $table = 'savings_plans';
    public $incrementing = false;
    protected $keyType = 'string';
    public $timestamps = true;
    protected $guarded = [];
    protected $fillable = ['name', 'name_bn', 'duration_months', 'installment_type', 'installment_amount', 'interest_rate', 'maturity_type', 'is_active', 'office_id', 'created_by'];
}
