<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;

class CashbookExpenseHeads extends Model
{
    protected \$table = 'cashbook_expense_heads';
    public \$incrementing = false;
    protected \$keyType = 'string';
    public \$timestamps = true;
    protected \$guarded = [];
    protected \$fillable = ['office_id', 'stream', 'name_bn', 'name_en', 'sort_order', 'is_active'];
}
