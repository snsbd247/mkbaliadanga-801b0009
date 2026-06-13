<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;

class LoanPayments extends Model
{
    protected \$table = 'loan_payments';
    public \$incrementing = false;
    protected \$keyType = 'string';
    public \$timestamps = false;
    protected \$guarded = [];
    protected \$fillable = ['loan_id', 'amount', 'paid_on', 'collected_by', 'office_id', 'status', 'approved_by', 'approved_at', 'approval_note', 'note', 'penalty_collected', 'override_reason', 'override_by', 'receipt_no', 'principal_amount', 'interest_amount'];
}
