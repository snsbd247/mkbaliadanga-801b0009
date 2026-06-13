<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;

class SavingsYearlyOpening extends Model
{
    protected \$table = 'savings_yearly_opening';
    public \$incrementing = false;
    protected \$keyType = 'string';
    public \$timestamps = false;
    protected \$guarded = [];
    protected \$fillable = ['farmer_id', 'year', 'opening_balance', 'office_id'];
}
