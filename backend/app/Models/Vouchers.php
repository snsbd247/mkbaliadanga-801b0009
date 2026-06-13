<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;

class Vouchers extends Model
{
    protected \$table = 'vouchers';
    public \$incrementing = false;
    protected \$keyType = 'string';
    public \$timestamps = true;
    protected \$guarded = [];
    protected \$fillable = ['office_id', 'voucher_no', 'voucher_type', 'voucher_date', 'amount', 'payee', 'narration', 'attachment_path', 'attachment_mime', 'reference_type', 'reference_id', 'created_by'];
}
