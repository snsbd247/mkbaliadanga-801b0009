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

    private function table(string $table): string
    {
        if (! preg_match('/^[a-z][a-z0-9_]*$/', $table)) {
            abort(400, 'অবৈধ টেবিল নাম।');
        }
        if (in_array($table, self::DENY, true)) {
            abort(403, "এই টেবিল ($table) সরাসরি ব্যবহার করা যাবে না।");
        }
        if (! Schema::hasTable($table)) {
            abort(404, "টেবিল পাওয়া যায়নি: $table");
        }
        return $table;
    }

    private function applyFilters($query, string $table, array $filters): void
    {
        foreach ($filters as $f) {
            $col = $f['column'] ?? null;
            $op = $f['op'] ?? 'eq';
            $val = $f['value'] ?? null;
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
                case 'gt':    $query->where($col, '>', $val); break;
                case 'gte':   $query->where($col, '>=', $val); break;
                case 'lt':    $query->where($col, '<', $val); break;
                case 'lte':   $query->where($col, '<=', $val); break;
                case 'like':  $query->where($col, 'like', $val); break;
                case 'ilike': $query->where($col, 'like', $val); break;
                case 'in':    $query->whereIn($col, (array) $val); break;
                case 'is':
                    if ($val === null || $val === 'null') $query->whereNull($col);
                    else $query->where($col, $val);
                    break;
                default:      $query->where($col, $val);
            }
        }
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
        $payload = $request->all();
        $rows = array_is_list($payload) ? $payload : [$payload];
        $now = now();
        $officeId = $request->attributes->get('scope_office_id');
        $isSuper = $request->attributes->get('is_super_admin');

        $prepared = [];
        foreach ($rows as $row) {
            $row = (array) $row;
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

        DB::table($table)->insert($prepared);

        $ids = array_filter(array_map(fn ($r) => $r['id'] ?? null, $prepared));
        $inserted = ! empty($ids)
            ? array_map(fn ($r) => (array) $r, DB::table($table)->whereIn('id', $ids)->get()->all())
            : $prepared;

        return response()->json($inserted, 201);
    }

    public function update(Request $request, string $table): JsonResponse
    {
        $table = $this->table($table);
        $values = (array) $request->input('values', []);
        $filters = $request->input('filters', []);

        // Safety: never allow an unfiltered mass-update (would rewrite the
        // whole office's table). Edits must always target specific rows.
        if (empty($filters)) {
            abort(400, 'ফিল্টার ছাড়া আপডেট করা যাবে না।');
        }

        // Reject unknown / malformed column names in the payload.
        foreach (array_keys($values) as $col) {
            if (! preg_match('/^[a-z0-9_]+$/i', (string) $col) || ! Schema::hasColumn($table, $col)) {
                abort(422, "অবৈধ কলাম: $col");
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
