<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;

class CashbookVoucherSeq extends Model
{
    protected \$table = 'cashbook_voucher_seq';
    public \$timestamps = false;
    protected \$guarded = [];
    protected \$fillable = ['office_id', 'stream', 'last_no'];
}
