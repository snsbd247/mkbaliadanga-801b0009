<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;

class ReceiptCounters extends Model
{
    protected \$table = 'receipt_counters';
    public \$timestamps = false;
    protected \$guarded = [];
    protected \$fillable = ['kind', 'year', 'last_no'];
}
