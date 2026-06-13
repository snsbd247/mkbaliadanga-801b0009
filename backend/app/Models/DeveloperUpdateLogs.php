<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;

class DeveloperUpdateLogs extends Model
{
    protected $table = 'developer_update_logs';
    public $incrementing = false;
    protected $keyType = 'string';
    public $timestamps = false;
    protected $guarded = [];
    protected $fillable = ['user_id', 'action', 'repo_url', 'commit_sha', 'commit_message', 'release_tag', 'note', 'status'];
}
