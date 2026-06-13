<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;

class JournalEntryLines extends Model
{
    protected $table = 'journal_entry_lines';
    public $incrementing = false;
    protected $keyType = 'string';
    public $timestamps = false;
    protected $guarded = [];
    protected $fillable = ['journal_id', 'account_id', 'debit', 'credit', 'description', 'position'];
}
