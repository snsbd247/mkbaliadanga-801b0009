<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;

class AccountingPeriods extends Model
{
    protected $table = 'accounting_periods';
    public $incrementing = false;
    protected $keyType = 'string';
    public $timestamps = true;
    protected $guarded = [];
    protected $fillable = ['period_start', 'period_end', 'status', 'closed_at', 'closed_by', 'office_id', 'total_debit', 'total_credit', 'total_income', 'total_expense', 'net_income', 'cash_in', 'cash_out', 'closing_balance_snapshot', 'note'];
}
