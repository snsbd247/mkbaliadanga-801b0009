<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Concerns\HasUuids;
use Illuminate\Database\Eloquent\Model;

class LoanInstallment extends Model {
    use HasUuids;
    protected $fillable = ['loan_id','seq','due_date','principal_due','interest_due','paid','delay_fee','status','paid_on'];
    protected $casts = ['due_date'=>'date','paid_on'=>'date'];
    public function loan() { return $this->belongsTo(Loan::class); }
}
