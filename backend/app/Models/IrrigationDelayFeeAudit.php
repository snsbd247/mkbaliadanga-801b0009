<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;

class IrrigationDelayFeeAudit extends Model
{
    protected $table = 'irrigation_delay_fee_audit';
    public $incrementing = false;
    protected $keyType = 'string';
    public $timestamps = false;
    protected $guarded = [];
    protected $fillable = ['invoice_id', 'payment_id', 'original_amount', 'modified_amount', 'reason', 'changed_by', 'office_id'];
}
