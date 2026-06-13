<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;

class IrrigationInvoicePayments extends Model
{
    protected \$table = 'irrigation_invoice_payments';
    public \$incrementing = false;
    protected \$keyType = 'string';
    public \$timestamps = false;
    protected \$guarded = [];
    protected \$fillable = ['invoice_id', 'payment_id', 'collected_amount', 'delay_fee_collected', 'maintenance_collected', 'canal_collected', 'irrigation_collected', 'office_id', 'created_by', 'current_invoice_collected', 'previous_due_collected', 'delay_fee_original', 'delay_fee_override_reason'];
}
