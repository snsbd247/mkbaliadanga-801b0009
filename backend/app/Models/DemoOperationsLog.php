<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;

class DemoOperationsLog extends Model
{
    protected $table = 'demo_operations_log';
    public $incrementing = false;
    protected $keyType = 'string';
    public $timestamps = false;
    protected $guarded = [];
    protected $fillable = ['user_id', 'user_email', 'action', 'modules', 'size', 'ip', 'user_agent', 'success', 'error_message', 'summary'];
}
