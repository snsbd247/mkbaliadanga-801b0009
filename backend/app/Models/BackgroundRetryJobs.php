<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;

class BackgroundRetryJobs extends Model
{
    protected $table = 'background_retry_jobs';
    public $incrementing = false;
    protected $keyType = 'string';
    public $timestamps = true;
    protected $guarded = [];
    protected $fillable = ['office_id', 'job_type', 'reference_id', 'payload', 'status', 'retry_count', 'max_retry', 'next_retry_at', 'last_error', 'created_by'];
}
