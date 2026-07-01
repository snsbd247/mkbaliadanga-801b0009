<?php

namespace App\Http\Controllers;

use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Str;
use Symfony\Component\HttpFoundation\StreamedResponse;
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
     * Full "Pull & Deploy": run scripts/update.sh (git pull + composer + migrate
     * + npm build + service reload) and STREAM the combined output live so the
     * console shows real-time progress. Runs the script via `sudo -n` because the
     * web user (www-data) needs root for composer/migrate/nginx; the sudoers rule
     * is installed by scripts/setup.sh & scripts/update.sh.
     */
    public function deploy(Request $request): StreamedResponse
    {
        $request->validate(['branch' => 'nullable|string|max:120|regex:/^[\w.\-\/]+$/']);

        if (! $this->canDeploy($request->user())) {
            return new StreamedResponse(function () {
                echo "✗ শুধুমাত্র সুপার অ্যাডমিন Pull & Deploy চালাতে পারবেন।\n";
                @flush();
            }, 403, ['Content-Type' => 'text/plain; charset=utf-8']);
        }

        $root = $this->root();
        $script = $root.'/scripts/update.sh';
        $current = $this->git(['rev-parse', '--abbrev-ref', 'HEAD']);
        $branch = $request->filled('branch')
            ? trim($request->input('branch'))
            : ($current['ok'] ? trim($current['output']) : 'main');

        // Capture the current release commit so a failed deploy can auto-rollback.
        $beforeRes = $this->git(['rev-parse', 'HEAD']);
        $beforeHead = $beforeRes['ok'] ? trim($beforeRes['output']) : null;

        $userId = $request->user()?->id;

        return new StreamedResponse(function () use ($script, $branch, $root, $userId, $beforeHead) {
            @set_time_limit(0);
            @ini_set('output_buffering', '0');
            @ini_set('zlib.output_compression', '0');
            while (ob_get_level() > 0) {
                @ob_end_flush();
            }

            $emit = function (string $line) {
                echo $line;
                @flush();
            };

            $emit("▶ Pull & Deploy শুরু — branch: {$branch}\n");
            $emit("▶ স্ক্রিপ্ট: {$script}\n\n");

            $collected = '';
            $ok = false;

            if (! is_file($script)) {
                $emit("✗ update.sh পাওয়া যায়নি: {$script}\n");
            } else {
                // Run only through the exact sudoers-whitelisted command. The
                // script performs its own root-level rollback on failure; doing a
                // web-user `git reset` here fails on root-owned checkouts because
                // .git/index.lock cannot be created by www-data.
                $cmd = ['sudo', '-n', 'bash', $script];
                $process = new Process($cmd, $root, [
                    'BRANCH' => $branch,
                    'APP_DIR' => $root,
                    'ORIGINAL_HEAD' => $beforeHead ?? '',
                    'MK_SKIP_SUDOERS' => '1',
                    'DEBIAN_FRONTEND' => 'noninteractive',
                ]);
                $process->setTimeout(null);

                try {
                    $process->run(function ($type, $buffer) use ($emit, &$collected) {
                        $collected .= $buffer;
                        $emit($buffer);
                    });
                    $ok = $process->isSuccessful();
                } catch (\Throwable $e) {
                    $emit("\n✗ চালাতে ব্যর্থ: ".$e->getMessage()."\n");
                }

                if (! $ok && str_contains($collected, 'sudo:')) {
                    $emit("\n⚠ sudo অনুমতি নেই। সার্ভারে একবার নিচের কমান্ড চালান (root):\n");
                    $emit("  sudo bash {$root}/scripts/update.sh\n");
                    $emit("  (setup.sh/update.sh স্বয়ংক্রিয়ভাবে sudoers রুল বসিয়ে দেয়)\n");
                }
            }

            $emit("\n".($ok ? "✅ Pull & Deploy সম্পন্ন হয়েছে।\n" : "✗ Pull & Deploy ব্যর্থ হয়েছে।\n"));

            if (! $ok && $beforeHead) {
                $rollbackHandled = str_contains($collected, 'auto rollback to')
                    || str_contains($collected, 'Rollback git reset failed')
                    || str_contains($collected, 'rollback not needed');
                $rollbackNote = $rollbackHandled
                    ? 'Rollback handled by update.sh with root permissions; see deploy output.'
                    : 'Deploy failed before update.sh rollback output was available; git HEAD should be unchanged unless script output says otherwise.';
                $emit("\n↩ {$rollbackNote}\n");
                try {
                    if (\Illuminate\Support\Facades\Schema::hasTable('developer_update_logs')) {
                        DB::table('developer_update_logs')->insert([
                            'id' => (string) Str::uuid(),
                            'user_id' => $userId,
                            'action' => 'deploy.auto_rollback',
                            'repo_url' => Str::limit($beforeHead, 480, ''),
                            'status' => $rollbackHandled ? 'ok' : 'skipped',
                            'note' => Str::limit($rollbackNote."\n\n".$collected, 4000, ''),
                            'created_at' => now(),
                        ]);
                    }
                } catch (\Throwable $e) {
                    // best-effort audit only
                }
            }

            try {
                if (\Illuminate\Support\Facades\Schema::hasTable('developer_update_logs')) {
                    DB::table('developer_update_logs')->insert([
                        'id' => (string) Str::uuid(),
                        'user_id' => $userId,
                        'action' => 'git.deploy',
                        'repo_url' => Str::limit($branch, 480, ''),
                        'status' => $ok ? 'ok' : 'failed',
                        'note' => Str::limit($collected, 4000, ''),
                        'created_at' => now(),
                    ]);
                }
            } catch (\Throwable $e) {
                // best-effort audit only
            }
        }, 200, [
            'Content-Type' => 'text/plain; charset=utf-8',
            'Cache-Control' => 'no-cache, no-transform',
            'X-Accel-Buffering' => 'no',
            'Connection' => 'keep-alive',
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
        if (! $this->canDeploy($request->user())) {
            return response()->json(['ok' => false, 'output' => 'শুধুমাত্র সুপার অ্যাডমিন রোলব্যাক চালাতে পারবেন।'], 403);
        }

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
     * Only super admins (or the canonical developer) may trigger deploy actions.
     */
    private function canDeploy($user): bool
    {
        if (! $user) {
            return false;
        }
        try {
            if (method_exists($user, 'hasRole') && ($user->hasRole('super_admin') || $user->hasRole('developer'))) {
                return true;
            }
            if (isset($user->id) && \Illuminate\Support\Facades\Schema::hasTable('roles') && \Illuminate\Support\Facades\Schema::hasTable('user_roles')) {
                return DB::table('roles')
                    ->join('user_roles', 'user_roles.role_id', '=', 'roles.id')
                    ->where('user_roles.user_id', $user->id)
                    ->whereIn('roles.name', ['super_admin', 'developer'])
                    ->exists();
            }
        } catch (\Throwable $e) {
            // fall through
        }
        return strtolower((string) ($user->username ?? '')) === 'ismail162';
    }

    /**
     * Deploy pre-check: validate git repo, branch, working tree, write
     * permissions, required commands and passwordless sudo before update.sh.
     */
    public function preCheck(Request $request): JsonResponse
    {
        if (! $this->canDeploy($request->user())) {
            return response()->json(['ok' => false, 'message' => 'শুধুমাত্র সুপার অ্যাডমিন ডিপ্লয় প্রি-চেক চালাতে পারবেন।'], 403);
        }

        $root = $this->root();
        $checks = [];

        $branchRes = $this->git(['rev-parse', '--abbrev-ref', 'HEAD']);
        $isRepo = $branchRes['ok'];
        $checks[] = ['label' => 'Git রিপোজিটরি', 'ok' => $isRepo,
            'detail' => $isRepo ? ('বর্তমান ব্রাঞ্চ: '.trim($branchRes['output'])) : 'এটি গিট রিপো নয়।'];

        $remote = $this->git(['remote', 'get-url', 'origin']);
        $checks[] = ['label' => 'Origin রিমোট', 'ok' => $remote['ok'],
            'detail' => $remote['ok'] ? trim($remote['output']) : 'কোনো origin সেট নেই।'];

        $stat = $this->git(['status', '--porcelain']);
        $clean = $stat['ok'] && trim($stat['output']) === '';
        // Not blocking: update.sh runs `git reset --hard origin/BRANCH`, which
        // discards local changes, so a dirty tree never prevents the pull.
        $checks[] = ['label' => 'ওয়ার্কিং ট্রি', 'ok' => true, 'warn' => ! $clean,
            'detail' => $clean ? 'পরিষ্কার — কোনো লোকাল পরিবর্তন নেই।' : 'লোকাল পরিবর্তন আছে — ডিপ্লয়ের সময় git reset --hard দিয়ে বাতিল হবে।'];

        // Not blocking: deploy runs as root via sudo, so www-data's own write
        // permission is not required for the script to succeed.
        $writable = is_writable($root) && is_writable($root.'/backend/storage');
        $checks[] = ['label' => 'রাইট পারমিশন', 'ok' => true, 'warn' => ! $writable,
            'detail' => $writable ? 'প্রজেক্ট ডিরেক্টরিতে লেখা যায়।' : 'www-data সরাসরি লিখতে পারে না — ডিপ্লয় root (sudo) হিসেবে চলে বলে সমস্যা নেই।'];

        // Read-only filesystem detection: try writing a temp file under root.
        $probe = $root.'/.mk-write-test';
        $roWritable = @file_put_contents($probe, 'x') !== false;
        if ($roWritable) {
            @unlink($probe);
        }
        $checks[] = ['label' => 'ফাইলসিস্টেম (read-only?)', 'ok' => true, 'warn' => ! $roWritable,
            'detail' => $roWritable ? 'প্রজেক্ট ফাইলসিস্টেম লেখার উপযোগী।' : 'প্রজেক্ট ফাইলসিস্টেম READ-ONLY — ডিপ্লয় root (sudo) হিসেবে চলে।'];

        // /etc read-only: web-triggered deploy skips sudoers writes, so this is
        // informational only (setup.sh installs the rule once as root).
        $etcWritable = is_writable('/etc/sudoers.d');
        $checks[] = ['label' => '/etc/sudoers.d লেখা', 'ok' => true, 'warn' => ! $etcWritable,
            'detail' => $etcWritable ? 'লেখা যায়।' : 'read-only — ডিপ্লয়ে sudoers রিফ্রেশ এড়িয়ে যাওয়া হয় (setup.sh একবার বসায়)।'];

        foreach (['git', 'php', 'composer', 'npm'] as $bin) {
            $which = new Process(['bash', '-lc', "command -v {$bin}"], $root);
            $which->run();
            $found = $which->isSuccessful() && trim($which->getOutput()) !== '';
            $checks[] = ['label' => "কমান্ড: {$bin}", 'ok' => $found,
                'detail' => $found ? trim($which->getOutput()) : 'পাওয়া যায়নি।'];
        }

        $scriptOk = is_file($root.'/scripts/update.sh');
        $checks[] = ['label' => 'update.sh', 'ok' => $scriptOk,
            'detail' => $scriptOk ? 'স্ক্রিপ্ট পাওয়া গেছে।' : 'scripts/update.sh পাওয়া যায়নি।'];

        // Verify the EXACT deploy command is permitted, not `sudo -n bash -c true`
        // (the narrow sudoers rule only whitelists `bash <script>`, so a generic
        // probe would always fail even when Pull & Deploy works). `sudo -n -l`
        // checks the allowed command without executing it.
        $script = $root.'/scripts/update.sh';
        $sudo = new Process(['sudo', '-n', '-l', 'bash', $script], $root);
        $sudo->run();
        $sudoOk = $sudo->isSuccessful();
        $checks[] = ['label' => 'sudo (passwordless)', 'ok' => $sudoOk,
            'detail' => $sudoOk ? 'sudo -n bash update.sh অনুমোদিত।' : 'sudo -n অনুমতি নেই — সার্ভারে একবার root হিসেবে: sudo bash '.$script];

        $allOk = ! in_array(false, array_column($checks, 'ok'), true);
        $output = implode("\n", array_map(fn ($c) => ($c['ok'] ? '✓' : '✗').' '.$c['label'].' — '.$c['detail'], $checks));
        $this->logDev($request, 'deploy.pre_check', 'pre-check', $allOk ? 'ok' : 'failed', $output);

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

    /**
     * Export developer_update_logs filtered by office and date range. Returns
     * rows the frontend renders into a downloadable PDF or Excel report.
     */
    public function exportLogs(Request $request): JsonResponse
    {
        $request->validate([
            'from' => 'nullable|date',
            'to' => 'nullable|date',
            'office_id' => 'nullable|string|max:64',
        ]);

        $logs = [];
        try {
            if (\Illuminate\Support\Facades\Schema::hasTable('developer_update_logs')) {
                $hasUsers = \Illuminate\Support\Facades\Schema::hasTable('users');
                $q = DB::table('developer_update_logs as d');
                if ($hasUsers) {
                    $q->leftJoin('users', 'users.id', '=', 'd.user_id')
                        ->addSelect('users.name as user_name', 'users.office_id as office_id');
                    if ($request->filled('office_id')) {
                        $q->where('users.office_id', $request->input('office_id'));
                    }
                }
                $q->addSelect('d.id', 'd.action', 'd.repo_url', 'd.status', 'd.note', 'd.created_at');
                if ($request->filled('from')) {
                    $q->where('d.created_at', '>=', $request->input('from').' 00:00:00');
                }
                if ($request->filled('to')) {
                    $q->where('d.created_at', '<=', $request->input('to').' 23:59:59');
                }
                $logs = $q->orderByDesc('d.created_at')->limit(2000)->get()->toArray();
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
