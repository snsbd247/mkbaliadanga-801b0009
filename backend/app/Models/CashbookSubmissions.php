<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;

class CashbookSubmissions extends Model
{
    protected \$table = 'cashbook_submissions';
    public \$incrementing = false;
    protected \$keyType = 'string';
    public \$timestamps = false;
    protected \$guarded = [];
    protected \$fillable = ['year', 'month', 'opening_cash', 'closing_cash', 'total_income', 'total_expense', 'note', 'submitted_by', 'submitted_at', 'locked', 'stream'];
}
