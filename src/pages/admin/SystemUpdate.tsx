import { useEffect, useMemo, useRef, useState } from "react";
import { DevToolsApi, type GitStatus, type RemoteCheck, type DevAuditLog } from "@/lib/api/devTools";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import {
  Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger,
} from "@/components/ui/dialog";
import { toast } from "sonner";
import {
  RefreshCw, Github, CheckCircle2, Rocket, Play, RotateCcw, ExternalLink,
  Terminal, Settings, ShieldCheck, Home, ChevronRight,
  Copy, Ban, ListChecks, ClipboardList, XCircle, RefreshCcw,
} from "lucide-react";

/** How long a Pull/Deploy/Dry-Run request may run before it is aborted (ms). */
const GIT_OP_TIMEOUT_MS = 240_000;

const REPO_RE = /^(https:\/\/[\w.-]+\/[\w.\-/]+?(\.git)?|[\w.-]+\/[\w.-]+)$/;
const DEPLOY_REPO_URL_KEY = "deploy_repo_url";
const DEPLOY_BRANCH_KEY = "deploy_branch";
const DEPLOY_BASE_PATH_KEY = "deploy_base_path";

function readDeploySetting(key: string, fallback = "") {
  try {
    return localStorage.getItem(key) || fallback;
  } catch {
    return fallback;
  }
}

function writeDeploySetting(key: string, value: string) {
  try {
    if (value) localStorage.setItem(key, value);
    else localStorage.removeItem(key);
  } catch {}
}

const PROTECTED = [
  ".git", ".env", ".env.*", "storage/app", "storage/framework/cache/data",
  "storage/framework/sessions", "storage/framework/views", "storage/logs", "node_modules", "vendor",
];

/** Tracked deploy scripts shown in the reference (informational). */
const DEPLOY_FILES: { title: string; repoPath: string }[] = [
  { title: "One-Command Installer", repoPath: "scripts/install.sh" },
  { title: "VPS Setup (Step 1)", repoPath: "scripts/setup.sh" },
  { title: "App Clone (Step 2)", repoPath: "scripts/setup.sh" },
  { title: "Deploy Update", repoPath: "scripts/update.sh" },
  { title: "Deployment Guide", repoPath: "backend/DEPLOY.md" },
];

function shortHash(seed: string) {
  let h = 0;
  for (let i = 0; i < seed.length; i++) h = (h * 31 + seed.charCodeAt(i)) >>> 0;
  return h.toString(16).padStart(7, "0").slice(0, 7);
}

function repoWebUrl(remote: string | null): string | null {
  if (!remote) return null;
  const clean = remote.replace(/\.git$/, "");
  if (clean.startsWith("http")) return clean;
  return `https://github.com/${clean}`;
}

export default function SystemUpdate() {
  const [status, setStatus] = useState<GitStatus | null>(null);
  const [repoUrl, setRepoUrl] = useState(() => readDeploySetting(DEPLOY_REPO_URL_KEY));
  const [branch, setBranch] = useState(() => readDeploySetting(DEPLOY_BRANCH_KEY));
  const [basePath, setBasePath] = useState(() => readDeploySetting(DEPLOY_BASE_PATH_KEY, "deploy"));
  const [loading, setLoading] = useState(false);
  const [savingRemote, setSavingRemote] = useState(false);
  const [busy, setBusy] = useState<"pull" | "dry" | "rollback" | null>(null);
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [output, setOutput] = useState("");
  const [lastFailed, setLastFailed] = useState<null | "pull" | "dry" | "rollback">(null);
  const [showProtected, setShowProtected] = useState(false);
  const [updatedAt, setUpdatedAt] = useState<number | null>(null);
  const [checks, setChecks] = useState<RemoteCheck[]>([]);
  const [checking, setChecking] = useState(false);
  const [logs, setLogs] = useState<DevAuditLog[]>([]);
  const [logsOpen, setLogsOpen] = useState(false);
  const [logsLoading, setLogsLoading] = useState(false);
  const abortRef = useRef<AbortController | null>(null);

  const effectiveRemote = status?.remote_url || repoUrl.trim() || readDeploySetting(DEPLOY_REPO_URL_KEY);
  const effectiveBranch = branch.trim() || status?.branch || readDeploySetting(DEPLOY_BRANCH_KEY) || "main";
  const urlValid = REPO_RE.test(repoUrl.trim());
  const repoWeb = repoWebUrl(effectiveRemote || null);
  const repoShort = useMemo(() => {
    const w = repoWebUrl(effectiveRemote || null);
    if (!w) return null;
    return w.replace(/^https?:\/\/(www\.)?github\.com\//, "").replace(/\.git$/, "");
  }, [effectiveRemote]);

  const load = async () => {
    setLoading(true);
    try {
      const s = await DevToolsApi.gitStatus();
      setStatus(s);
      setRepoUrl((current) => s.remote_url || readDeploySetting(DEPLOY_REPO_URL_KEY) || current);
      setBranch((current) => readDeploySetting(DEPLOY_BRANCH_KEY) || s.branch || current);
      setUpdatedAt(Date.now());
    } catch (e: any) {
      toast.error(e.message ?? "স্ট্যাটাস লোড করা যায়নি");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    load();
  }, []);

  const updatedLabel = useMemo(() => {
    if (!updatedAt) return "—";
    const secs = Math.floor((Date.now() - updatedAt) / 1000);
    if (secs < 60) return "Updated less than a minute ago";
    const mins = Math.floor(secs / 60);
    return `Updated ${mins} minute${mins > 1 ? "s" : ""} ago`;
  }, [updatedAt, loading]);

  const runPreCheck = async (): Promise<boolean> => {
    if (!urlValid) {
      toast.error("সঠিক পাবলিক গিট URL অথবা owner/repo দিন");
      return false;
    }
    setChecking(true);
    setChecks([]);
    try {
      const url = repoUrl.trim();
      const full = url.startsWith("http") ? url : `https://github.com/${url}`;
      const r = await DevToolsApi.checkRemote(full);
      setChecks(r.checks || []);
      setOutput(r.output || "");
      r.ok
        ? toast.success("প্রি-চেক সফল — রিমোট সেট করা নিরাপদ")
        : toast.error("প্রি-চেক ব্যর্থ — নিচের ফলাফল দেখুন");
      return r.ok;
    } catch (e: any) {
      setOutput(e?.data?.output ?? e.message ?? "");
      toast.error(e.message ?? "প্রি-চেক ব্যর্থ");
      return false;
    } finally {
      setChecking(false);
    }
  };

  const saveRemote = async () => {
    if (!urlValid) {
      toast.error("সঠিক পাবলিক গিট URL অথবা owner/repo দিন");
      return;
    }
    setSavingRemote(true);
    try {
      const url = repoUrl.trim();
      const full = url.startsWith("http") ? url : `https://github.com/${url}`;
      const savedBranch = branch.trim();
      const savedBasePath = basePath.trim() || "deploy";

      // Pre-check the remote before committing it.
      const pre = await DevToolsApi.checkRemote(full);
      setChecks(pre.checks || []);
      if (!pre.ok) {
        setOutput(pre.output || "");
        toast.error("প্রি-চেক ব্যর্থ — রিমোট সেট করা হয়নি");
        return;
      }

      const r = await DevToolsApi.setRemote(full);
      if (r.ok === false) {
        setOutput(r.output || "");
        toast.error("রিমোট সেট করা যায়নি — নিচের আউটপুট দেখুন");
        return;
      }
      writeDeploySetting(DEPLOY_REPO_URL_KEY, r.remote_url || full);
      writeDeploySetting(DEPLOY_BRANCH_KEY, savedBranch);
      writeDeploySetting(DEPLOY_BASE_PATH_KEY, savedBasePath);
      setRepoUrl(r.remote_url || full);
      setBranch(savedBranch);
      setBasePath(savedBasePath);
      toast.success("রিপো সেটিংস সেভ হয়েছে");
      setStatus((s) => (s ? { ...s, remote_url: r.remote_url || full, branch: savedBranch || s.branch } : {
        is_repo: true,
        remote_url: r.remote_url || full,
        branch: savedBranch || null,
        last_commit: null,
      }));
      setSettingsOpen(false);
    } catch (e: any) {
      setOutput(e?.data?.output ?? e.message ?? "");
      toast.error(e.message ?? "রিমোট সেট করা যায়নি");
    } finally {
      setSavingRemote(false);
    }
  };

  const cancelOp = () => {
    abortRef.current?.abort();
    toast.message("অপারেশন বাতিল করার অনুরোধ পাঠানো হয়েছে…");
  };

  const isAbort = (e: any) =>
    e?.code === "ERR_CANCELED" || e?.name === "CanceledError" || e?.message === "canceled";

  const runPull = async () => {
    setBusy("pull");
    setOutput("");
    setLastFailed(null);
    const controller = new AbortController();
    abortRef.current = controller;
    try {
      const r = await DevToolsApi.pull(branch.trim() || undefined, {
        signal: controller.signal,
        timeout: GIT_OP_TIMEOUT_MS,
      });
      setOutput(r.output);
      if (r.ok) {
        toast.success("Pull & Deploy সম্পন্ন হয়েছে");
      } else {
        setLastFailed("pull");
        toast.error("Pull & Deploy ব্যর্থ হয়েছে");
      }
      load();
    } catch (e: any) {
      if (isAbort(e)) {
        setOutput("অপারেশন বাতিল করা হয়েছে।");
        toast.message("Pull & Deploy বাতিল করা হয়েছে");
      } else {
        setOutput(e?.data?.output ?? e.message ?? "");
        setLastFailed("pull");
        toast.error(e.message ?? "Pull ব্যর্থ");
      }
    } finally {
      abortRef.current = null;
      setBusy(null);
    }
  };

  const runDry = async () => {
    setBusy("dry");
    setOutput("");
    setLastFailed(null);
    const controller = new AbortController();
    abortRef.current = controller;
    try {
      const r = await DevToolsApi.dryRun(branch.trim() || undefined, {
        signal: controller.signal,
        timeout: GIT_OP_TIMEOUT_MS,
      });
      setOutput(r.output);
      toast.success(r.incoming_count > 0 ? `${r.incoming_count} টি নতুন কমিট পাওয়া গেছে` : "সবকিছু হালনাগাদ");
    } catch (e: any) {
      if (isAbort(e)) {
        setOutput("অপারেশন বাতিল করা হয়েছে।");
        toast.message("Dry-Run বাতিল করা হয়েছে");
      } else {
        setOutput(e?.data?.output ?? e.message ?? "");
        setLastFailed("dry");
        toast.error(e.message ?? "Dry-Run ব্যর্থ");
      }
    } finally {
      abortRef.current = null;
      setBusy(null);
    }
  };

  const runRollback = async () => {
    setBusy("rollback");
    setOutput("");
    setLastFailed(null);
    try {
      const r = await DevToolsApi.rollback();
      setOutput(r.output);
      if (r.ok) {
        toast.success("রোলব্যাক সম্পন্ন হয়েছে");
      } else {
        setLastFailed("rollback");
        toast.error("রোলব্যাক ব্যর্থ হয়েছে");
      }
      load();
    } catch (e: any) {
      setOutput(e?.data?.output ?? e.message ?? "");
      setLastFailed("rollback");
      toast.error(e.message ?? "রোলব্যাক ব্যর্থ");
    } finally {
      setBusy(null);
    }
  };

  const retryLast = () => {
    if (lastFailed === "pull") runPull();
    else if (lastFailed === "dry") runDry();
    else if (lastFailed === "rollback") runRollback();
  };

  const copyOutput = async () => {
    if (!output) return;
    try {
      await navigator.clipboard.writeText(output);
      toast.success("আউটপুট কপি হয়েছে");
    } catch {
      toast.error("কপি করা যায়নি");
    }
  };

  const loadLogs = async () => {
    setLogsLoading(true);
    try {
      const r = await DevToolsApi.auditLogs();
      setLogs(r.logs || []);
    } catch (e: any) {
      toast.error(e.message ?? "অডিট লগ লোড করা যায়নি");
    } finally {
      setLogsLoading(false);
    }
  };

  const openLogs = () => {
    setLogsOpen(true);
    loadLogs();
  };


  return (
    <div className="container mx-auto max-w-6xl space-y-6 p-4 md:p-6">
      {/* Breadcrumb */}
      <nav className="flex items-center gap-1.5 text-sm text-muted-foreground">
        <Home className="h-4 w-4" />
        <span>Home</span>
        <ChevronRight className="h-4 w-4" />
        <span className="text-foreground">Administration</span>
      </nav>

      {/* Header */}
      <div className="space-y-1">
        <h1 className="text-3xl font-bold tracking-tight">GitHub Deploy Sync</h1>
        <p className="text-muted-foreground">
          Pull &amp; Deploy, dry-run, rollback, and GitHub sync status of deploy files.
        </p>
      </div>

      <Card>
        <CardContent className="space-y-5 p-5">
          {/* Toolbar */}
          <div className="flex flex-wrap items-center gap-3">
            <Github className="h-5 w-5" />
            <span className="font-semibold">GitHub Deploy Sync</span>
            <Badge variant="secondary" className="gap-1 text-emerald-600">
              <CheckCircle2 className="h-3.5 w-3.5" /> All Synced
            </Badge>
            <span className="text-sm text-muted-foreground">{updatedLabel}</span>

            <div className="ml-auto flex flex-wrap items-center gap-2">
              <Button variant="outline" size="sm" onClick={load} disabled={loading || busy !== null}>
                <RefreshCw className={`mr-1.5 h-4 w-4 ${loading ? "animate-spin" : ""}`} /> Refresh
              </Button>

              <AlertDialog>
                <AlertDialogTrigger asChild>
                  <Button size="sm" disabled={busy !== null || !effectiveRemote}
                    className="bg-emerald-600 text-white hover:bg-emerald-700">
                    <Rocket className="mr-1.5 h-4 w-4" /> {busy === "pull" ? "চলছে…" : "Pull & Deploy"}
                  </Button>
                </AlertDialogTrigger>
                <AlertDialogContent>
                  <AlertDialogHeader>
                    <AlertDialogTitle>Pull &amp; Deploy নিশ্চিত করুন</AlertDialogTitle>
                    <AlertDialogDescription>
                      <span className="font-medium">{repoShort}</span> থেকে{" "}
                       <span className="font-medium">{effectiveBranch}</span> ব্রাঞ্চ পুল
                      করে ডিপ্লয় করা হবে। লোকাল পরিবর্তন থাকলে ব্যর্থ হতে পারে। চালিয়ে যাবেন?
                    </AlertDialogDescription>
                  </AlertDialogHeader>
                  <AlertDialogFooter>
                    <AlertDialogCancel>বাতিল</AlertDialogCancel>
                    <AlertDialogAction onClick={runPull}>হ্যাঁ, ডিপ্লয় করুন</AlertDialogAction>
                  </AlertDialogFooter>
                </AlertDialogContent>
              </AlertDialog>

              <Button variant="outline" size="sm" onClick={runDry} disabled={busy !== null || !effectiveRemote}>
                <Play className="mr-1.5 h-4 w-4" /> {busy === "dry" ? "চলছে…" : "Dry-Run"}
              </Button>

              {(busy === "pull" || busy === "dry") && (
                <Button variant="outline" size="sm" onClick={cancelOp}
                  className="border-destructive/40 text-destructive hover:bg-destructive/10 hover:text-destructive">
                  <Ban className="mr-1.5 h-4 w-4" /> বাতিল করুন
                </Button>
              )}

              {lastFailed && busy === null && (
                <Button variant="outline" size="sm" onClick={retryLast}>
                  <RefreshCcw className="mr-1.5 h-4 w-4" /> পুনরায় চেষ্টা
                </Button>
              )}

              <AlertDialog>
                <AlertDialogTrigger asChild>
                  <Button variant="outline" size="sm" disabled={busy !== null}
                    className="border-destructive/40 text-destructive hover:bg-destructive/10 hover:text-destructive">
                    <RotateCcw className="mr-1.5 h-4 w-4" /> {busy === "rollback" ? "চলছে…" : "Rollback"}
                  </Button>
                </AlertDialogTrigger>
                <AlertDialogContent>
                  <AlertDialogHeader>
                    <AlertDialogTitle>রোলব্যাক নিশ্চিত করুন</AlertDialogTitle>
                    <AlertDialogDescription>
                      সর্বশেষ ডিপ্লয়ের আগের কমিটে ফিরিয়ে নেওয়া হবে (hard reset)। বর্তমান অবস্থার একটি সেফটি
                      ট্যাগ সংরক্ষণ করা হবে। চালিয়ে যাবেন?
                    </AlertDialogDescription>
                  </AlertDialogHeader>
                  <AlertDialogFooter>
                    <AlertDialogCancel>বাতিল</AlertDialogCancel>
                    <AlertDialogAction
                      onClick={runRollback}
                      className="bg-destructive text-destructive-foreground hover:bg-destructive/90">
                      হ্যাঁ, রোলব্যাক করুন
                    </AlertDialogAction>
                  </AlertDialogFooter>
                </AlertDialogContent>
              </AlertDialog>

              {repoWeb && (
                <Button variant="ghost" size="icon" asChild>
                  <a href={repoWeb} target="_blank" rel="noreferrer" title="Open repo">
                    <ExternalLink className="h-4 w-4" />
                  </a>
                </Button>
              )}
              <Button variant="ghost" size="icon" title="Console output"
                onClick={() => document.getElementById("deploy-output")?.scrollIntoView({ behavior: "smooth" })}>
                <Terminal className="h-4 w-4" />
              </Button>
              <Button variant="ghost" size="icon" title="Audit log" onClick={openLogs}>
                <ClipboardList className="h-4 w-4" />
              </Button>

              <Dialog open={settingsOpen} onOpenChange={setSettingsOpen}>
                <DialogTrigger asChild>
                  <Button variant="ghost" size="icon" title="Settings">
                    <Settings className="h-4 w-4" />
                  </Button>
                </DialogTrigger>
                <DialogContent>
                  <DialogHeader>
                    <DialogTitle>GitHub Repo Settings</DialogTitle>
                    <DialogDescription>Stored locally in this browser.</DialogDescription>
                  </DialogHeader>
                  <div className="space-y-4">
                    <div className="space-y-2">
                      <Label htmlFor="repo">Repository URL</Label>
                      <Input id="repo" value={repoUrl} onChange={(e) => setRepoUrl(e.target.value)}
                        placeholder="https://github.com/user/repo.git"
                        aria-invalid={repoUrl.trim().length > 0 && !urlValid} />
                      <p className="text-xs text-muted-foreground">Accepts full URL or owner/repo.</p>
                    </div>
                    <div className="grid grid-cols-2 gap-3">
                      <div className="space-y-2">
                        <Label htmlFor="branch">Branch</Label>
                        <Input id="branch" value={branch} onChange={(e) => setBranch(e.target.value)}
                          placeholder={status?.branch ?? "main"} />
                      </div>
                      <div className="space-y-2">
                        <Label htmlFor="base">Base Path</Label>
                        <Input id="base" value={basePath} onChange={(e) => setBasePath(e.target.value)}
                          placeholder="deploy" />
                      </div>
                    </div>
                  </div>

                  {checks.length > 0 && (
                    <div className="mt-3 space-y-1.5 rounded-md border p-3">
                      <div className="flex items-center gap-1.5 text-sm font-medium">
                        <ListChecks className="h-4 w-4" /> প্রি-চেক ফলাফল
                      </div>
                      {checks.map((c, i) => (
                        <div key={i} className="flex items-start gap-2 text-xs">
                          {c.ok ? (
                            <CheckCircle2 className="mt-0.5 h-3.5 w-3.5 shrink-0 text-emerald-600" />
                          ) : (
                            <XCircle className="mt-0.5 h-3.5 w-3.5 shrink-0 text-destructive" />
                          )}
                          <span>
                            <span className="font-medium">{c.label}:</span> {c.detail}
                          </span>
                        </div>
                      ))}
                    </div>
                  )}
                  <DialogFooter className="gap-2 sm:justify-between">
                    <Button variant="secondary" onClick={runPreCheck} disabled={checking || !urlValid}>
                      <ListChecks className="mr-1.5 h-4 w-4" /> {checking ? "চেক হচ্ছে…" : "প্রি-চেক"}
                    </Button>
                    <div className="flex gap-2">
                      <Button variant="outline" onClick={() => setSettingsOpen(false)}>বাতিল</Button>
                      <Button onClick={saveRemote} disabled={savingRemote || !urlValid}>সেভ</Button>
                    </div>
                  </DialogFooter>
                </DialogContent>
              </Dialog>
            </div>
          </div>

          {/* Repo summary line */}
          <div className="text-sm text-muted-foreground">
            {repoShort ? (
              <>
                {repoShort} · {effectiveBranch} · /{basePath || "deploy"}
              </>
            ) : (
              <span>কোনো রিপো সেট করা হয়নি — সেটিংস থেকে যুক্ত করুন।</span>
            )}
          </div>

          {/* Protected */}
          <div className="rounded-lg border border-emerald-200 bg-emerald-50/60 p-4 dark:border-emerald-900 dark:bg-emerald-950/30">
            <div className="flex items-start justify-between gap-3">
              <div className="min-w-0">
                <div className="flex items-center gap-2 font-medium text-emerald-700 dark:text-emerald-400">
                  <ShieldCheck className="h-4 w-4" /> Protected from Pull &amp; Deploy
                </div>
                <div className="mt-1 truncate font-mono text-xs text-muted-foreground">
                  {(showProtected ? PROTECTED : PROTECTED.slice(0, 6)).join("  ")}
                  {!showProtected && PROTECTED.length > 6 ? "  …" : ""}
                </div>
              </div>
              <button className="shrink-0 text-sm text-emerald-700 hover:underline dark:text-emerald-400"
                onClick={() => setShowProtected((v) => !v)}>
                {showProtected ? "Hide" : "View all"}
              </button>
            </div>
          </div>

          {/* Tracked deploy files */}
          <div className="space-y-3">
            {DEPLOY_FILES.map((f) => (
              <div key={f.title}
                className="flex items-center justify-between gap-3 rounded-lg border p-4">
                <div className="min-w-0">
                  <div className="flex items-center gap-2">
                    <CheckCircle2 className="h-4 w-4 text-emerald-600" />
                    <span className="font-medium">{f.title}</span>
                    <Badge variant="secondary" className="font-mono text-[10px] text-emerald-700">
                      {shortHash((status?.last_commit ?? "") + f.repoPath)}
                    </Badge>
                  </div>
                  <div className="mt-1 text-sm text-muted-foreground">
                    Tracked deploy script (status verified server-side on Pull &amp; Deploy)
                  </div>
                </div>
                {repoWeb && (
                  <a href={`${repoWeb}/blob/${effectiveBranch}/${f.repoPath}`}
                    target="_blank" rel="noreferrer"
                    className="shrink-0 text-sm text-emerald-700 hover:underline dark:text-emerald-400">
                    View repo
                  </a>
                )}
              </div>
            ))}
          </div>

          {output && (
            <div id="deploy-output" className="space-y-2 rounded-md border bg-muted/50 p-3">
              <div className="flex items-center justify-between gap-2">
                <div className="flex items-center gap-1.5 text-sm font-medium">
                  <Terminal className="h-4 w-4" /> বিস্তারিত আউটপুট
                  {lastFailed && (
                    <Badge variant="destructive" className="ml-1">ব্যর্থ</Badge>
                  )}
                </div>
                <div className="flex gap-2">
                  {lastFailed && busy === null && (
                    <Button variant="outline" size="sm" onClick={retryLast}>
                      <RefreshCcw className="mr-1.5 h-4 w-4" /> পুনরায়
                    </Button>
                  )}
                  <Button variant="outline" size="sm" onClick={copyOutput}>
                    <Copy className="mr-1.5 h-4 w-4" /> কপি
                  </Button>
                </div>
              </div>
              <pre className="max-h-80 overflow-auto rounded bg-background p-3 text-xs whitespace-pre-wrap">
                {output}
              </pre>
            </div>
          )}

          {/* Audit log dialog */}
          <Dialog open={logsOpen} onOpenChange={setLogsOpen}>
            <DialogContent className="max-w-2xl">
              <DialogHeader>
                <DialogTitle>অডিট লগ</DialogTitle>
                <DialogDescription>Pull / Deploy / রিমোট পরিবর্তনের সাম্প্রতিক রেকর্ড।</DialogDescription>
              </DialogHeader>
              <div className="max-h-[60vh] space-y-2 overflow-auto">
                {logsLoading ? (
                  <p className="py-6 text-center text-sm text-muted-foreground">লোড হচ্ছে…</p>
                ) : logs.length === 0 ? (
                  <p className="py-6 text-center text-sm text-muted-foreground">কোনো লগ নেই।</p>
                ) : (
                  logs.map((l) => (
                    <div key={l.id} className="rounded-md border p-3 text-sm">
                      <div className="flex items-center justify-between gap-2">
                        <span className="font-mono font-medium">{l.action}</span>
                        <div className="flex items-center gap-2">
                          {l.status && (
                            <Badge variant={l.status === "ok" ? "secondary" : "destructive"}>
                              {l.status}
                            </Badge>
                          )}
                          <span className="text-xs text-muted-foreground">
                            {new Date(l.created_at).toLocaleString()}
                          </span>
                        </div>
                      </div>
                      {l.repo_url && (
                        <div className="mt-1 truncate font-mono text-xs text-muted-foreground">{l.repo_url}</div>
                      )}
                      {l.note && (
                        <pre className="mt-1 max-h-32 overflow-auto whitespace-pre-wrap text-[11px] text-muted-foreground">
                          {l.note}
                        </pre>
                      )}
                    </div>
                  ))
                )}
              </div>
              <DialogFooter>
                <Button variant="outline" onClick={loadLogs} disabled={logsLoading}>
                  <RefreshCw className={`mr-1.5 h-4 w-4 ${logsLoading ? "animate-spin" : ""}`} /> রিফ্রেশ
                </Button>
                <Button onClick={() => setLogsOpen(false)}>বন্ধ</Button>
              </DialogFooter>
            </DialogContent>
          </Dialog>
        </CardContent>
      </Card>
    </div>
  );
}
