<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;

class VoucherSequences extends Model
{
    protected \$table = 'voucher_sequences';
    public \$timestamps = false;
    protected \$guarded = [];
    protected \$fillable = ['office_id', 'voucher_type', 'fiscal_year', 'last_no'];
}
