<?php

namespace App\Http\Controllers;

use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Schema;
use Illuminate\Support\Str;

/**
 * Generic table gateway — a Laravel/MySQL replacement for the Supabase
 * Data API (PostgREST). It lets the frontend `db` adapter run the common
 * subset of supabase queries (select/insert/update/delete with filters,
 * ordering, pagination and simple foreign-key embeds) against any
 * allow-listed table, with office (branch) scoping replacing Postgres RLS.
 *
 * Routes (all behind auth:sanctum + branch.scope):
 *   POST   /api/db/{table}/query   { select, filters, order, limit, offset, single, count }
 *   POST   /api/db/{table}         insert (object or array) [?select=...]
 *   PATCH  /api/db/{table}         { values, filters } [?select=...]
 *   DELETE /api/db/{table}         { filters }
 */
class GenericTableController extends Controller
{
    /**
     * Tables the gateway refuses to touch through the generic path
     * (auth/security sensitive — they have dedicated controllers).
     */
    private const DENY = [
        'users', 'personal_access_tokens', 'password_reset_tokens',
        'sessions', 'cache', 'cache_locks', 'jobs', 'job_batches',
        'failed_jobs', 'migrations', 'sms_provider_secrets',
    ];

    /**
     * Tables that require an explicit permission for any write (insert/update/
     * delete) through the generic gateway, plus the audit "module" recorded for
     * each change. Read access stays office-scoped; writes are guarded here so
     * an unauthorised user cannot mutate one module's data via another.
     */
    private const WRITE_GUARD = [
        'bank_accounts'     => ['permission' => 'accounting.manage', 'module' => 'bank_account'],
        'bank_transactions' => ['permission' => 'accounting.manage', 'module' => 'bank_transaction'],
        'accounts'          => ['permission' => 'accounting.manage', 'module' => 'account'],
        'journal_entries'   => ['permission' => 'accounting.manage', 'module' => 'journal_entry'],
        'journal_entry_lines' => ['permission' => 'accounting.manage', 'module' => 'journal_entry_line'],
    ];

    /**
     * Enforce per-table write permission. Developers and super admins always
     * pass (hasPermission returns true for them); everyone else needs the
     * mapped permission key.
     */
    private function authorizeWrite(Request $request, string $table): void
    {
        $guard = self::WRITE_GUARD[$table] ?? null;
        if (! $guard) {
            return;
        }
        $user = $request->user();
        if (! $user || ! $user->hasPermission($guard['permission'])) {
            abort(403, 'এই কাজের অনুমতি নেই।');
        }
    }

    /** Fire-and-forget audit entry for a guarded-table write. Never breaks the op. */
    private function recordAudit(Request $request, string $action, string $table, array $ids, array $meta = []): void
    {
        if (! isset(self::WRITE_GUARD[$table])) {
            return;
        }
        try {
            \App\Models\AuditLog::record([
                'user_id'     => optional($request->user())->id,
                'office_id'   => $request->attributes->get('scope_office_id'),
                'action'      => self::WRITE_GUARD[$table]['module'].'.'.$action,
                'entity_type' => $table,
                'entity_id'   => $ids[0] ?? null,
                'meta'        => array_merge(['ids' => array_values($ids)], $meta),
            ]);
        } catch (\Throwable $e) {
            // Auditing must never break the underlying operation.
        }
    }


    private function table(string $table): string
    {
        if (! preg_match('/^[a-z][a-z0-9_]*$/', $table)) {
            abort(400, 'অবৈধ টেবিল নাম।');
        }
        if (in_array($table, self::DENY, true)) {
            abort(403, "এই টেবিল ($table) সরাসরি ব্যবহার করা যাবে না।");
        }
        if (! Schema::hasTable($table) && ! $this->viewExists($table)) {
            abort(404, "টেবিল পাওয়া যায়নি: $table");
        }
        return $table;
    }

    /** MySQL views are not always reported by Schema::hasTable(), so check information_schema directly. */
    private function viewExists(string $table): bool
    {
        try {
            $rows = DB::select(
                'SELECT 1 FROM information_schema.views WHERE table_schema = DATABASE() AND table_name = ? LIMIT 1',
                [$table]
            );
            return ! empty($rows);
        } catch (\Throwable $e) {
            return false;
        }
    }

    private function applyFilters($query, string $table, array $filters): void
    {
        foreach ($filters as $f) {
            $col = $f['column'] ?? null;
            $op = $f['op'] ?? 'eq';
            $val = $f['value'] ?? null;
            if ($op === 'or') {
                $this->applyOrFilter($query, $table, (string) $val);
                continue;
            }
            if (! $col || ! preg_match('/^[a-z0-9_]+$/i', $col)) {
                continue;
            }
            // Skip filters referencing a column not present in the MySQL schema
            // (Supabase callers sometimes filter on view-only / renamed columns).
            // Silently ignoring avoids a fatal SQL error → 500.
            if (! Schema::hasColumn($table, $col)) {
                continue;
            }
            switch ($op) {
                case 'eq':    $query->where($col, $val); break;
                case 'neq':   $query->where($col, '!=', $val); break;
                case 'not.eq': $query->where($col, '!=', $val); break;
                case 'not.neq': $query->where($col, '=', $val); break;
                case 'gt':    $query->where($col, '>', $val); break;
                case 'gte':   $query->where($col, '>=', $val); break;
                case 'lt':    $query->where($col, '<', $val); break;
                case 'lte':   $query->where($col, '<=', $val); break;
                case 'like':  $query->where($col, 'like', $val); break;
                case 'ilike': $query->where($col, 'like', $val); break;
                case 'not.like':
                case 'not.ilike': $query->where($col, 'not like', $val); break;
                case 'in':    $query->whereIn($col, (array) $val); break;
                case 'not.in': $query->whereNotIn($col, (array) $val); break;
                case 'is':
                    if ($val === null || $val === 'null') $query->whereNull($col);
                    else $query->where($col, $val);
                    break;
                case 'not.is':
                    if ($val === null || $val === 'null') $query->whereNotNull($col);
                    else $query->where($col, '!=', $val);
                    break;
                default:      $query->where($col, $val);
            }
        }
    }

    private function splitOrExpression(string $expr): array
    {
        $parts = [];
        $depth = 0;
        $buf = '';
        foreach (str_split($expr) as $ch) {
            if ($ch === '(') $depth++;
            if ($ch === ')') $depth = max(0, $depth - 1);
            if ($ch === ',' && $depth === 0) {
                if (trim($buf) !== '') $parts[] = trim($buf);
                $buf = '';
                continue;
            }
            $buf .= $ch;
        }
        if (trim($buf) !== '') $parts[] = trim($buf);
        return $parts;
    }

    private function applyOrFilter($query, string $table, string $expr): void
    {
        $clauses = $this->splitOrExpression($expr);
        if (empty($clauses)) return;

        $query->where(function ($or) use ($clauses, $table) {
            $applied = false;
            foreach ($clauses as $clause) {
                $bits = explode('.', $clause, 3);
                if (count($bits) < 3) continue;
                [$col, $op, $raw] = $bits;
                if ($op === 'not') {
                    $more = explode('.', $raw, 2);
                    if (count($more) < 2) continue;
                    $op = 'not.'.$more[0];
                    $raw = $more[1];
                }
                if (! preg_match('/^[a-z0-9_]+$/i', $col) || ! Schema::hasColumn($table, $col)) {
                    continue;
                }
                $val = $raw === 'null' ? null : $raw;
                $method = $applied ? 'orWhere' : 'where';
                switch ($op) {
                    case 'eq': $or->{$method}($col, $val); break;
                    case 'neq':
                    case 'not.eq': $or->{$method}($col, '!=', $val); break;
                    case 'gt': $or->{$method}($col, '>', $val); break;
                    case 'gte': $or->{$method}($col, '>=', $val); break;
                    case 'lt': $or->{$method}($col, '<', $val); break;
                    case 'lte': $or->{$method}($col, '<=', $val); break;
                    case 'like':
                    case 'ilike': $or->{$method}($col, 'like', $val); break;
                    case 'in':
                        $vals = preg_match('/^\((.*)\)$/', $raw, $m) ? explode(',', $m[1]) : explode(',', $raw);
                        $applied ? $or->orWhereIn($col, $vals) : $or->whereIn($col, $vals);
                        break;
                    case 'is':
                        if ($val === null) $applied ? $or->orWhereNull($col) : $or->whereNull($col);
                        else $or->{$method}($col, $val);
                        break;
                    case 'not.is':
                        if ($val === null) $applied ? $or->orWhereNotNull($col) : $or->whereNotNull($col);
                        else $or->{$method}($col, '!=', $val);
                        break;
                    default: continue 2;
                }
                $applied = true;
            }
        });
    }

    private function scope(Request $request, $query, string $table): void
    {
        if ($request->attributes->get('is_super_admin')) {
            $officeId = $request->attributes->get('scope_office_id');
            if ($officeId && Schema::hasColumn($table, 'office_id')) {
                $query->where('office_id', $officeId);
            }
            return;
        }
        $officeId = $request->attributes->get('scope_office_id');
        if ($officeId && Schema::hasColumn($table, 'office_id')) {
            $query->where('office_id', $officeId);
        }
    }

    /**
     * Bridge frontend/Supabase column names to legacy Laravel/MySQL aliases.
     *
     * This is intentionally additive: when the new column exists we keep it,
     * and when the old required alias exists we mirror the value into it. That
     * prevents NOT NULL failures on older VPS schemas while preserving all new
     * data for migrated schemas.
     */
    private function normalizeWriteRow(string $table, array $row): array
    {
        // Convert ISO-8601 datetime strings (e.g. 2026-06-30T06:12:39.091Z)
        // into MySQL-compatible "Y-m-d H:i:s" so writes don't fail with
        // SQLSTATE[22007] Invalid datetime format on columns like deleted_at.
        foreach ($row as $key => $val) {
            if (is_string($val) && preg_match('/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}/', $val)) {
                try {
                    $row[$key] = (new \DateTime($val))->format('Y-m-d H:i:s');
                } catch (\Throwable $e) {
                    // leave value untouched if it cannot be parsed
                }
            }
        }

        // Array values (e.g. dag_numbers) must be JSON-encoded before hitting
        // MySQL, otherwise the PDO driver throws "Array to string conversion".
        foreach ($row as $key => $val) {
            if (is_array($val)) {
                $row[$key] = json_encode(array_values($val), JSON_UNESCAPED_UNICODE);
            }
        }



        // land_relations.valid_from is NOT NULL with no default on older
        // schemas. Backfill it so barga imports never fail on this column.
        if ($table === 'land_relations') {
            if (! array_key_exists('valid_from', $row) || $row['valid_from'] === null || $row['valid_from'] === '') {
                $row['valid_from'] = now()->format('Y-m-d');
            }
        }

        if ($table !== 'farmers') {
            return $row;
        }



        $copy = function (array &$row, string $from, string $to): void {
            if (! array_key_exists($from, $row) || array_key_exists($to, $row)) {
                return;
            }
            if (Schema::hasColumn('farmers', $to)) {
                $row[$to] = $row[$from];
            }
        };

        $copy($row, 'name_en', 'name');
        $copy($row, 'name', 'name_en');
        $copy($row, 'mobile', 'phone');
        $copy($row, 'phone', 'mobile');

        // Farmer ID is called member_no/farmer_code in the frontend and code in
        // the original Laravel table. Keep all aliases in sync on writes.
        foreach (['member_no', 'farmer_code', 'code'] as $source) {
            if (! array_key_exists($source, $row) || $row[$source] === null || $row[$source] === '') {
                continue;
            }
            foreach (['member_no', 'farmer_code', 'code'] as $target) {
                if ($target !== $source && ! array_key_exists($target, $row) && Schema::hasColumn('farmers', $target)) {
                    $row[$target] = $row[$source];
                }
            }
            break;
        }

        // Last-resort protection for older databases where `name` is NOT NULL.
        if (Schema::hasColumn('farmers', 'name') && (! array_key_exists('name', $row) || $row['name'] === null || $row['name'] === '')) {
            $row['name'] = $row['name_en'] ?? $row['name_bn'] ?? 'Unnamed Farmer';
        }

        return $row;
    }

    /**
     * Best-effort locator for the row/column that caused a MySQL insert to
     * fail. Reads the column name out of the driver error message when
     * present, then finds the first prepared row whose value is still a raw
     * array (should never happen after normalizeWriteRow) or otherwise blank.
     *
     * @return array{0:int,1:?string} [1-based row number, column name|null]
     */
    private function locateBadCell(array $prepared, \Throwable $e): array
    {
        $msg = $e->getMessage();
        $col = null;
        if (preg_match("/column '([^']+)'/i", $msg, $m)) {
            $col = $m[1];
        } elseif (preg_match('/Array to string conversion/i', $msg)) {
            foreach ($prepared as $i => $row) {
                foreach ($row as $k => $v) {
                    if (is_array($v)) {
                        return [$i + 1, $k];
                    }
                }
            }
        }
        if ($col) {
            foreach ($prepared as $i => $row) {
                if (array_key_exists($col, $row) && (is_array($row[$col]) || $row[$col] === '' || $row[$col] === null)) {
                    return [$i + 1, $col];
                }
            }
            return [1, $col];
        }
        return [1, null];
    }

    /** Parse a supabase-style select string, returning [columns, embeds]. */
    private function parseSelect(?string $select): array
    {
        if (! $select || trim($select) === '*' || trim($select) === '') {
            return [['*'], []];
        }
        $columns = [];
        $embeds = [];
        $depth = 0;
        $buf = '';
        $tokens = [];
        foreach (str_split($select) as $ch) {
            if ($ch === '(') $depth++;
            if ($ch === ')') $depth--;
            if ($ch === ',' && $depth === 0) { $tokens[] = trim($buf); $buf = ''; continue; }
            $buf .= $ch;
        }
        if (trim($buf) !== '') $tokens[] = trim($buf);

        foreach ($tokens as $tok) {
            if (str_contains($tok, '(')) {
                // relation embed: name(col1,col2) or alias:name(...)
                $name = trim(substr($tok, 0, strpos($tok, '(')));
                $inner = substr($tok, strpos($tok, '(') + 1, -1);
                $alias = $name;
                if (str_contains($name, ':')) {
                    [$alias, $name] = array_map('trim', explode(':', $name, 2));
                }
                $embeds[] = ['alias' => $alias, 'table' => $name, 'columns' => array_map('trim', explode(',', $inner))];
            } else {
                $columns[] = $tok;
            }
        }
        if (empty($columns)) $columns = ['*'];
        return [$columns, $embeds];
    }

    private function attachEmbeds(array $rows, string $baseTable, array $embeds): array
    {
        foreach ($embeds as $embed) {
            $relTable = $embed['table'];
            if (! preg_match('/^[a-z][a-z0-9_]*$/', $relTable) || ! Schema::hasTable($relTable)) {
                continue;
            }
            // Convention: base table has <singular_rel>_id referencing rel.id
            $fk = Str::singular($relTable) . '_id';
            if (! Schema::hasColumn($baseTable, $fk)) {
                // try alias as fk source (alias_id)
                $fk = Str::singular($embed['alias']) . '_id';
                if (! Schema::hasColumn($baseTable, $fk)) continue;
            }
            $ids = array_values(array_unique(array_filter(array_map(fn ($r) => $r[$fk] ?? null, $rows))));
            $map = [];
            if (! empty($ids)) {
                $cols = $embed['columns'];
                if (! in_array('*', $cols, true) && ! in_array('id', $cols, true)) $cols[] = 'id';
                $related = DB::table($relTable)->whereIn('id', $ids)->get($cols);
                foreach ($related as $rel) $map[$rel->id] = (array) $rel;
            }
            foreach ($rows as &$row) {
                $row[$embed['alias']] = $map[$row[$fk] ?? null] ?? null;
            }
            unset($row);
        }
        return $rows;
    }

    public function select(Request $request, string $table): JsonResponse
    {
        $table = $this->table($table);
        [$columns, $embeds] = $this->parseSelect($request->input('select'));

        $query = DB::table($table);
        $this->scope($request, $query, $table);
        $this->applyFilters($query, $table, $request->input('filters', []));

        if ($request->boolean('count')) {
            return response()->json(['count' => $query->count()]);
        }

        foreach ($request->input('order', []) as $o) {
            $col = $o['column'] ?? null;
            if ($col && preg_match('/^[a-z0-9_]+$/i', $col) && Schema::hasColumn($table, $col)) {
                $query->orderBy($col, ($o['ascending'] ?? true) ? 'asc' : 'desc');
            }
        }
        if ($request->filled('limit')) $query->limit((int) $request->input('limit'));
        if ($request->filled('offset')) $query->offset((int) $request->input('offset'));

        // Column projection (skip when embeds need fk columns; just fetch all then filter).
        // Drop any requested column that doesn't exist in the MySQL table so a
        // stale/view-only column name can't turn the whole query into a 500.
        if (in_array('*', $columns, true) || ! empty($embeds)) {
            $selectCols = ['*'];
        } else {
            $selectCols = array_values(array_filter(
                $columns,
                fn ($c) => preg_match('/^[a-z0-9_]+$/i', (string) $c) && Schema::hasColumn($table, $c)
            ));
            if (empty($selectCols)) $selectCols = ['*'];
        }
        $rows = array_map(fn ($r) => (array) $r, $query->get($selectCols)->all());

        if (! empty($embeds)) {
            $rows = $this->attachEmbeds($rows, $table, $embeds);
            if (! in_array('*', $columns, true)) {
                $keep = array_merge($columns, array_map(fn ($e) => $e['alias'], $embeds));
                $rows = array_map(fn ($r) => array_intersect_key($r, array_flip($keep)), $rows);
            }
        }

        if ($request->boolean('single')) {
            return response()->json($rows[0] ?? null);
        }
        return response()->json($rows);
    }

    public function insert(Request $request, string $table): JsonResponse
    {
        $table = $this->table($table);
        $this->authorizeWrite($request, $table);
        $payload = $request->all();
        $rows = array_is_list($payload) ? $payload : [$payload];
        $now = now();
        $officeId = $request->attributes->get('scope_office_id');
        $isSuper = $request->attributes->get('is_super_admin');

        $prepared = [];
        foreach ($rows as $row) {
            $row = $this->normalizeWriteRow($table, (array) $row);
            // Drop columns that don't exist on this table (schema drift between
            // the React app and MySQL) instead of failing the whole insert.
            foreach (array_keys($row) as $col) {
                if (! preg_match('/^[a-z0-9_]+$/i', (string) $col)) {
                    abort(422, "অবৈধ কলাম: $col");
                }
                if (! Schema::hasColumn($table, $col)) {
                    unset($row[$col]);
                }
            }
            if (Schema::hasColumn($table, 'id') && empty($row['id'])) {
                $row['id'] = (string) Str::uuid();
            }
            if (Schema::hasColumn($table, 'office_id') && empty($row['office_id'])) {
                if ($officeId) $row['office_id'] = $officeId;
            }
            if (! $isSuper && $officeId && Schema::hasColumn($table, 'office_id')) {
                $row['office_id'] = $officeId; // force own office
            }
            foreach (['created_at', 'updated_at'] as $ts) {
                if (Schema::hasColumn($table, $ts) && empty($row[$ts])) $row[$ts] = $now;
            }
            $prepared[] = $row;
        }

        try {
            DB::table($table)->insert($prepared);
        } catch (\Illuminate\Database\QueryException $e) {
            // Pinpoint the offending row/column so the importer can fix the
            // exact cell instead of guessing from a raw MySQL error.
            [$rowNo, $col] = $this->locateBadCell($prepared, $e);
            $suggestion = $col
                ? " — কলাম '$col' (সারি $rowNo) এর মান সঠিক নয়; array হলে JSON বা কমা/সেমিকোলন দিয়ে দিন।"
                : '';
            return response()->json([
                'ok' => false,
                'error' => $e->getMessage(),
                'row' => $rowNo,
                'column' => $col,
                'message' => "ইনসার্ট ব্যর্থ (টেবিল: $table)$suggestion",
            ], 422);
        }

        $ids = array_filter(array_map(fn ($r) => $r['id'] ?? null, $prepared));
        $inserted = ! empty($ids)
            ? array_map(fn ($r) => (array) $r, DB::table($table)->whereIn('id', $ids)->get()->all())
            : $prepared;

        return response()->json($inserted, 201);
    }

    public function update(Request $request, string $table): JsonResponse
    {
        $table = $this->table($table);
        $values = $this->normalizeWriteRow($table, (array) $request->input('values', []));
        $filters = $request->input('filters', []);

        // Safety: never allow an unfiltered mass-update (would rewrite the
        // whole office's table). Edits must always target specific rows.
        if (empty($filters)) {
            abort(400, 'ফিল্টার ছাড়া আপডেট করা যাবে না।');
        }

        // Drop columns that don't exist on this table instead of failing.
        foreach (array_keys($values) as $col) {
            if (! preg_match('/^[a-z0-9_]+$/i', (string) $col)) {
                abort(422, "অবৈধ কলাম: $col");
            }
            if (! Schema::hasColumn($table, $col)) {
                unset($values[$col]);
            }
        }

        if (Schema::hasColumn($table, 'updated_at')) $values['updated_at'] = now();
        // Protected columns can never be changed through the generic gateway.
        unset($values['id'], $values['created_at']);
        // Non-super-admins may not move a record to another office.
        if (! $request->attributes->get('is_super_admin')) {
            unset($values['office_id']);
        }

        $query = DB::table($table);
        $this->scope($request, $query, $table);
        $this->applyFilters($query, $table, $filters);
        $query->update($values);

        $read = DB::table($table);
        $this->scope($request, $read, $table);
        $this->applyFilters($read, $table, $filters);
        $rows = array_map(fn ($r) => (array) $r, $read->get()->all());

        return response()->json($rows);
    }

    public function delete(Request $request, string $table): JsonResponse
    {
        $table = $this->table($table);
        $filters = $request->input('filters', []);
        if (empty($filters)) {
            abort(400, 'ফিল্টার ছাড়া ডিলিট করা যাবে না।');
        }
        $query = DB::table($table);
        $this->scope($request, $query, $table);
        $this->applyFilters($query, $table, $filters);
        $count = $query->delete();
        return response()->json(['deleted' => $count]);
    }
}
