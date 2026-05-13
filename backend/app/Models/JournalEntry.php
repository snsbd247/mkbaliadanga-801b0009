<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Concerns\HasUuids;
use Illuminate\Database\Eloquent\Model;

class JournalEntry extends Model {
    use HasUuids;
    protected $fillable = ['office_id','reference','entry_date','memo','source_type','source_id','created_by'];
    protected $casts = ['entry_date' => 'date'];
    public function lines() { return $this->hasMany(LedgerEntry::class); }
}
