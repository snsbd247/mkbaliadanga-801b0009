<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;

class ReceiptSequences extends Model
{
    protected \$table = 'receipt_sequences';
    public \$timestamps = false;
    protected \$guarded = [];
    protected \$fillable = ['office_id', 'kind', 'year', 'month', 'last_no'];
}
