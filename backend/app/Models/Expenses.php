<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;

class Expenses extends Model
{
    protected \$table = 'expenses';
    public \$incrementing = false;
    protected \$keyType = 'string';
    public \$timestamps = true;
    protected \$guarded = [];
    protected \$fillable = ['expense_date', 'head', 'payee', 'amount', 'method', 'note', 'office_id', 'created_by', 'deleted_at', 'stream', 'voucher_no', 'attachment_path', 'attachment_mime', 'bank_account_id', 'is_bank_deposit', 'head_id'];
}
