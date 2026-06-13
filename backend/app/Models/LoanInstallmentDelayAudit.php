<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;

class LoanInstallmentDelayAudit extends Model
{
    protected $table = 'loan_installment_delay_audit';
    public $incrementing = false;
    protected $keyType = 'string';
    public $timestamps = false;
    protected $guarded = [];
    protected $fillable = ['installment_id', 'loan_id', 'payment_id', 'original_amount', 'modified_amount', 'reason', 'changed_by', 'office_id'];
}
