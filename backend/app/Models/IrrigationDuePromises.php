<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;

class IrrigationDuePromises extends Model
{
    protected \$table = 'irrigation_due_promises';
    public \$incrementing = false;
    protected \$keyType = 'string';
    public \$timestamps = true;
    protected \$guarded = [];
    protected \$fillable = ['office_id', 'farmer_id', 'payment_id', 'previous_due_amount', 'promise_date', 'remarks', 'approved_by', 'status', 'fulfilled_at'];
}
