<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Concerns\HasUuids;
use Illuminate\Database\Eloquent\Model;

class LedgerEntry extends Model {
    use HasUuids;
    protected $fillable = ['journal_entry_id','office_id','account_id','entry_date','debit','credit','reference_type','reference_id','memo'];
    protected $casts = ['entry_date'=>'date','debit'=>'decimal:2','credit'=>'decimal:2'];
    public function account() { return $this->belongsTo(Account::class); }
    public function journal() { return $this->belongsTo(JournalEntry::class, 'journal_entry_id'); }
}
