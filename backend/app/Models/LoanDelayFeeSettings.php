<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;

class LoanDelayFeeSettings extends Model
{
    protected $table = 'loan_delay_fee_settings';
    public $incrementing = false;
    protected $keyType = 'string';
    public $timestamps = true;
    protected $guarded = [];
    protected $fillable = ['office_id', 'mode', 'value', 'grace_days', 'auto_apply', 'allow_partial_installment', 'created_by', 'updated_by', 'daily_penalty', 'max_penalty', 'enforcement_mode'];
}
