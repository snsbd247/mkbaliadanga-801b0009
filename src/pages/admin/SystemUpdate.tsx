import { useEffect, useMemo, useState } from "react";
import { DevToolsApi, type GitStatus } from "@/lib/api/devTools";
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
} from "lucide-react";

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
  const [showProtected, setShowProtected] = useState(false);
  const [updatedAt, setUpdatedAt] = useState<number | null>(null);

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

  const runPull = async () => {
    setBusy("pull");
    setOutput("");
    try {
      const r = await DevToolsApi.pull(branch.trim() || undefined);
      setOutput(r.output);
      r.ok ? toast.success("Pull & Deploy সম্পন্ন হয়েছে") : toast.error("Pull & Deploy ব্যর্থ হয়েছে");
      load();
    } catch (e: any) {
      setOutput(e?.data?.output ?? e.message ?? "");
      toast.error(e.message ?? "Pull ব্যর্থ");
    } finally {
      setBusy(null);
    }
  };

  const runDry = async () => {
    setBusy("dry");
    setOutput("");
    try {
      const r = await DevToolsApi.dryRun(branch.trim() || undefined);
      setOutput(r.output);
      toast.success(r.incoming_count > 0 ? `${r.incoming_count} টি নতুন কমিট পাওয়া গেছে` : "সবকিছু হালনাগাদ");
    } catch (e: any) {
      setOutput(e?.data?.output ?? e.message ?? "");
      toast.error(e.message ?? "Dry-Run ব্যর্থ");
    } finally {
      setBusy(null);
    }
  };

  const runRollback = async () => {
    setBusy("rollback");
    setOutput("");
    try {
      const r = await DevToolsApi.rollback();
      setOutput(r.output);
      r.ok ? toast.success("রোলব্যাক সম্পন্ন হয়েছে") : toast.error("রোলব্যাক ব্যর্থ হয়েছে");
      load();
    } catch (e: any) {
      setOutput(e?.data?.output ?? e.message ?? "");
      toast.error(e.message ?? "রোলব্যাক ব্যর্থ");
    } finally {
      setBusy(null);
    }
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
                  <DialogFooter>
                    <Button variant="outline" onClick={() => setSettingsOpen(false)}>বাতিল</Button>
                    <Button onClick={saveRemote} disabled={savingRemote || !urlValid}>সেভ</Button>
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
            <pre id="deploy-output"
              className="max-h-80 overflow-auto rounded-md border bg-muted p-3 text-xs whitespace-pre-wrap">
              {output}
            </pre>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
