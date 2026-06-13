<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;

class VoterAuditLogs extends Model
{
    protected $table = 'voter_audit_logs';
    public $incrementing = false;
    protected $keyType = 'string';
    public $timestamps = false;
    protected $guarded = [];
    protected $fillable = ['farmer_id', 'account_number', 'voter_number_old', 'voter_number_new', 'is_voter_old', 'is_voter_new', 'changed_by', 'office_id', 'note', 'action'];
}
