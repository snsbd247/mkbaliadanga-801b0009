<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;

class ImportAuditLogs extends Model
{
    protected \$table = 'import_audit_logs';
    public \$incrementing = false;
    protected \$keyType = 'string';
    public \$timestamps = false;
    protected \$guarded = [];
    protected \$fillable = ['user_id', 'office_id', 'module', 'mode', 'rows_processed', 'rows_inserted', 'rows_updated', 'rows_failed', 'error_report_url', 'summary'];
}
