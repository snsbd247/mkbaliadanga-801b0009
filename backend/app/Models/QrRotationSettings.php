<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;

class QrRotationSettings extends Model
{
    protected \$table = 'qr_rotation_settings';
    public \$timestamps = false;
    protected \$guarded = [];
    protected \$fillable = ['enabled', 'interval_days', 'grace_hours', 'last_run_at', 'last_run_summary', 'updated_by'];
}
