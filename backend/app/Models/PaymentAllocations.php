<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;

class PaymentAllocations extends Model
{
    protected \$table = 'payment_allocations';
    public \$incrementing = false;
    protected \$keyType = 'string';
    public \$timestamps = false;
    protected \$guarded = [];
    protected \$fillable = ['payment_id', 'kind', 'reference_id', 'amount', 'office_id'];
}
