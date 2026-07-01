<?php

namespace App\Http\Controllers;

use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Str;
use Symfony\Component\Process\Process;

/**
 * Developer-only low-level tools:
 *   - File manager: browse / read / write any project file.
 *   - Self-update: pull from a (public) GitHub repo; repo URL is editable.
 *
 * Every route is guarded by the `developer` middleware. No other role can reach
 * these endpoints.
 */
class DeveloperToolsController extends Controller
{
    /** Directories that are never listed/read/written (too heavy or secret). */
    private const SKIP_DIRS = ['.git', 'node_modules', 'vendor', 'storage/framework', 'storage/logs'];

    /** Files that may never be read or written through the manager. */
    private const SECRET_FILES = ['.env', '.env.production', '.env.backup', 'auth.json'];

    private function root(): string
    {
        // Project root is one level above the Laravel backend dir.
        return rtrim(dirname(base_path()), '/');
    }

    /** Resolve a relative path safely inside the project root. */
    private function resolve(string $rel): string
    {
        $rel = str_replace('\\', '/', trim($rel));
        $rel = ltrim($rel, '/');
        if ($rel === '' ) {
            return $this->root();
        }
        if (str_contains($rel, '..')) {
            abort(400, 'অবৈধ পাথ।');
        }
        return $this->root().'/'.$rel;
    }

    private function relative(string $abs): string
    {
        return ltrim(Str::after($abs, $this->root()), '/');
    }

    private function isSecret(string $abs): bool
    {
        $base = basename($abs);
        return in_array($base, self::SECRET_FILES, true);
    }

    // ── File manager ──────────────────────────────────────────────────

    public function list(Request $request): JsonResponse
    {
        $dir = $this->resolve((string) $request->query('path', ''));
        if (! is_dir($dir)) {
            return response()->json(['message' => 'ডিরেক্টরি পাওয়া যায়নি।'], 404);
        }

        $entries = [];
        foreach (scandir($dir) ?: [] as $name) {
            if ($name === '.' || $name === '..') {
                continue;
            }
            $abs = $dir.'/'.$name;
            $rel = $this->relative($abs);
            // Skip heavy/secret directories from the tree.
            $skip = false;
            foreach (self::SKIP_DIRS as $s) {
                if ($rel === $s || str_starts_with($rel.'/', $s.'/')) {
                    $skip = true;
                    break;
                }
            }
            $isDir = is_dir($abs);
            $entries[] = [
                'name' => $name,
                'path' => $rel,
                'type' => $isDir ? 'dir' : 'file',
                'size' => $isDir ? null : @filesize($abs),
                'skipped' => $skip,
                'secret' => $this->isSecret($abs),
            ];
        }

        usort($entries, function ($a, $b) {
            if ($a['type'] !== $b['type']) {
                return $a['type'] === 'dir' ? -1 : 1;
            }
            return strcasecmp($a['name'], $b['name']);
        });

        return response()->json([
            'path' => $this->relative($dir),
            'entries' => $entries,
        ]);
    }

    public function read(Request $request): JsonResponse
    {
        $request->validate(['path' => 'required|string']);
        $abs = $this->resolve($request->input('path'));

        if (! is_file($abs)) {
            return response()->json(['message' => 'ফাইল পাওয়া যায়নি।'], 404);
        }
        if ($this->isSecret($abs)) {
            return response()->json(['message' => 'গোপন ফাইল পড়া যাবে না।'], 403);
        }
        $size = @filesize($abs);
        if ($size !== false && $size > 2 * 1024 * 1024) {
            return response()->json(['message' => 'ফাইলটি খুব বড় (২MB+)।'], 413);
        }
        $content = @file_get_contents($abs);
        if ($content === false) {
            return response()->json(['message' => 'ফাইল পড়া যায়নি।'], 500);
        }
        $isBinary = $content !== '' && str_contains(substr($content, 0, 8000), "\0");

        $this->logDev($request, 'file.read', $this->relative($abs));

        return response()->json([
            'path' => $this->relative($abs),
            'binary' => $isBinary,
            'content' => $isBinary ? null : $content,
            'size' => $size,
        ]);
    }

    public function write(Request $request): JsonResponse
    {
        $request->validate([
            'path' => 'required|string',
            'content' => 'present|string',
        ]);
        $abs = $this->resolve($request->input('path'));

        if ($this->isSecret($abs)) {
            return response()->json(['message' => 'গোপন ফাইল এডিট করা যাবে না।'], 403);
        }
        if (is_dir($abs)) {
            return response()->json(['message' => 'এটি একটি ডিরেক্টরি।'], 400);
        }
        $dir = dirname($abs);
        if (! is_dir($dir)) {
            @mkdir($dir, 0775, true);
        }
        $ok = @file_put_contents($abs, $request->input('content'));
        if ($ok === false) {
            return response()->json(['message' => 'ফাইল সেভ করা যায়নি (পারমিশন?)।'], 500);
        }

        $this->logDev($request, 'file.write', $this->relative($abs));

        return response()->json(['ok' => true, 'path' => $this->relative($abs), 'size' => $ok]);
    }

    // ── Self-update from GitHub ────────────────────────────────────────

    private function git(array $args, int $timeout = 120): array
    {
        // Run every git command with the project root marked as a trusted
        // directory. Without this, git refuses ("detected dubious ownership")
        // when the web user (www-data) operates on a root-owned checkout, which
        // makes remote/branch/commit all come back null.
        $cmd = array_merge(['git', '-c', 'safe.directory='.$this->root(), '-c', 'safe.directory=*'], $args);
        $process = new Process($cmd, $this->root());
        $process->setTimeout($timeout);
        $process->run();
        return [
            'ok' => $process->isSuccessful(),
            'output' => trim($process->getOutput()."\n".$process->getErrorOutput()),
        ];
    }

    public function gitStatus(Request $request): JsonResponse
    {
        $remote = $this->git(['remote', 'get-url', 'origin']);
        $branch = $this->git(['rev-parse', '--abbrev-ref', 'HEAD']);
        $commit = $this->git(['log', '-1', '--pretty=%h %s (%cr)']);

        return response()->json([
            'is_repo' => $branch['ok'],
            'remote_url' => $remote['ok'] ? trim($remote['output']) : null,
            'branch' => $branch['ok'] ? trim($branch['output']) : null,
            'last_commit' => $commit['ok'] ? trim($commit['output']) : null,
        ]);
    }

    public function setRemote(Request $request): JsonResponse
    {
        $request->validate(['url' => 'required|string|max:500']);
        $url = trim($request->input('url'));

        if (! preg_match('#^https://[\w.-]+/[\w.\-/]+?(\.git)?$#', $url)) {
            return response()->json(['message' => 'শুধুমাত্র সর্বজনীন https গিট URL গ্রহণযোগ্য।'], 422);
        }

        // Add origin if it doesn't exist, otherwise update it.
        $exists = $this->git(['remote', 'get-url', 'origin'])['ok'];
        $res = $exists
            ? $this->git(['remote', 'set-url', 'origin', $url])
            : $this->git(['remote', 'add', 'origin', $url]);

        $this->logDev($request, 'git.set_remote', $url, $res['ok'] ? 'ok' : 'failed', $res['output']);

        // Always return 200 so the client can render the real git output.
        // A non-zero git exit is reported via `ok:false`, not an HTTP error,
        // otherwise the axios wrapper masks the reason as a generic 500.
        return response()->json([
            'ok' => $res['ok'],
            'remote_url' => $url,
            'output' => $res['output'],
        ]);
    }

    public function pull(Request $request): JsonResponse
    {
        $request->validate(['branch' => 'nullable|string|max:120|regex:/^[\w.\-\/]+$/']);

        $fetch = $this->git(['fetch', 'origin'], 180);
        $current = $this->git(['rev-parse', '--abbrev-ref', 'HEAD']);
        $br = $request->filled('branch')
            ? trim($request->input('branch'))
            : ($current['ok'] ? trim($current['output']) : 'main');
        $pull = $this->git(['pull', 'origin', $br], 240);

        $this->logDev($request, 'git.pull', $br, $pull['ok'] ? 'ok' : 'failed', trim($fetch['output']."\n\n".$pull['output']));

        // Always return 200 so the client can render the real git output.
        // A non-zero git exit is reported via `ok:false`, not an HTTP error,
        // otherwise the axios wrapper masks the reason as a generic 500.
        return response()->json([
            'ok' => $pull['ok'],
            'output' => trim($fetch['output']."\n\n".$pull['output']),
        ]);
    }

    /**
     * Dry-run: fetch origin and report the incoming commits that a Pull & Deploy
     * would apply, without changing any local files.
     */
    public function dryRun(Request $request): JsonResponse
    {
        $request->validate(['branch' => 'nullable|string|max:120|regex:/^[\w.\-\/]+$/']);

        $fetch = $this->git(['fetch', 'origin'], 180);
        $current = $this->git(['rev-parse', '--abbrev-ref', 'HEAD']);
        $br = $request->filled('branch')
            ? trim($request->input('branch'))
            : ($current['ok'] ? trim($current['output']) : 'main');

        $incoming = $this->git(['log', '--oneline', "HEAD..origin/{$br}"]);
        $changed = $this->git(['diff', '--stat', "HEAD..origin/{$br}"]);
        $count = $incoming['ok'] && trim($incoming['output']) !== ''
            ? count(array_filter(explode("\n", trim($incoming['output']))))
            : 0;

        $this->logDev($request, 'git.dry_run', $br, $fetch['ok'] ? 'ok' : 'failed', "incoming={$count}");

        return response()->json([
            'ok' => $fetch['ok'],
            'branch' => $br,
            'incoming_count' => $count,
            'output' => trim(
                ($count === 0 ? "সবকিছু হালনাগাদ — কোনো নতুন কমিট নেই।\n\n" : "নতুন কমিট: {$count}\n\n")
                .$incoming['output']."\n\n".$changed['output']
            ),
        ]);
    }

    /**
     * Rollback: hard-reset the working tree to the previous commit (HEAD@{1}).
     * A safety tag is created before rolling back.
     */
    public function rollback(Request $request): JsonResponse
    {
        $before = $this->git(['rev-parse', 'HEAD']);
        if ($before['ok']) {
            $tag = 'pre-rollback-'.now()->format('Ymd-His');
            $this->git(['tag', $tag, trim($before['output'])]);
        }

        $reset = $this->git(['reset', '--hard', 'HEAD@{1}']);
        $commit = $this->git(['log', '-1', '--pretty=%h %s (%cr)']);

        $this->logDev($request, 'git.rollback', $before['ok'] ? trim($before['output']) : 'unknown', $reset['ok'] ? 'ok' : 'failed', trim($reset['output']));

        return response()->json([
            'ok' => $reset['ok'],
            'last_commit' => $commit['ok'] ? trim($commit['output']) : null,
            'output' => trim($reset['output']),
        ]);
    }

    /**
     * Pre-check a remote URL before setting it: validate the format, confirm the
     * repo is reachable with the current credentials (git ls-remote), and report
     * whether an origin already exists. Always returns 200 with a structured body.
     */
    public function checkRemote(Request $request): JsonResponse
    {
        $request->validate(['url' => 'required|string|max:500']);
        $url = trim($request->input('url'));

        $checks = [];

        // 1) Format
        $formatOk = (bool) preg_match('#^https://[\w.-]+/[\w.\-/]+?(\.git)?$#', $url);
        $checks[] = [
            'label' => 'URL ফরম্যাট',
            'ok' => $formatOk,
            'detail' => $formatOk ? $url : 'শুধুমাত্র সর্বজনীন https গিট URL গ্রহণযোগ্য।',
        ];

        // 2) Existing origin
        $existing = $this->git(['remote', 'get-url', 'origin']);
        $existingUrl = $existing['ok'] ? trim($existing['output']) : null;
        $checks[] = [
            'label' => 'বর্তমান origin',
            'ok' => true,
            'detail' => $existingUrl ? "আগের origin: {$existingUrl} (আপডেট হবে)" : 'কোনো origin সেট নেই (নতুন যোগ হবে)।',
        ];

        // 3) Reachability / permission (only if format is valid)
        $reachOk = false;
        $reachDetail = 'ফরম্যাট ঠিক না থাকায় সংযোগ যাচাই করা হয়নি।';
        if ($formatOk) {
            $ls = $this->git(['ls-remote', '--heads', $url], 60);
            $reachOk = $ls['ok'];
            $reachDetail = $ls['ok']
                ? 'রিপো পাওয়া গেছে এবং অ্যাক্সেসযোগ্য।'
                : ('সংযোগ/অনুমতি ব্যর্থ: '.Str::limit($ls['output'], 400));
        }
        $checks[] = ['label' => 'সংযোগ ও অনুমতি', 'ok' => $reachOk, 'detail' => $reachDetail];

        $allOk = $formatOk && $reachOk;
        $output = implode("\n", array_map(
            fn ($c) => ($c['ok'] ? '✓' : '✗').' '.$c['label'].' — '.$c['detail'],
            $checks
        ));

        $this->logDev($request, 'git.check_remote', $url, $allOk ? 'ok' : 'failed', $output);

        return response()->json(['ok' => $allOk, 'checks' => $checks, 'output' => $output]);
    }

    /**
     * Recent developer-tool audit log entries (pull / deploy / remote changes).
     */
    public function auditLogs(Request $request): JsonResponse
    {
        $logs = [];
        try {
            if (\Illuminate\Support\Facades\Schema::hasTable('developer_update_logs')) {
                $logs = DB::table('developer_update_logs')
                    ->orderByDesc('created_at')
                    ->limit(50)
                    ->get(['id', 'action', 'repo_url', 'status', 'note', 'created_at'])
                    ->toArray();
            }
        } catch (\Throwable $e) {
            // best-effort
        }

        return response()->json(['logs' => $logs]);
    }

    private function logDev(Request $request, string $action, string $detail, ?string $status = null, ?string $note = null): void
    {
        try {
            if (\Illuminate\Support\Facades\Schema::hasTable('developer_update_logs')) {
                DB::table('developer_update_logs')->insert([
                    'id' => (string) Str::uuid(),
                    'user_id' => $request->user()?->id,
                    'action' => $action,
                    'repo_url' => Str::limit($detail, 480, ''),
                    'status' => $status,
                    'note' => $note !== null ? Str::limit($note, 4000, '') : null,
                    'created_at' => now(),
                ]);
            }
        } catch (\Throwable $e) {
            // best-effort audit only
        }
    }
}
