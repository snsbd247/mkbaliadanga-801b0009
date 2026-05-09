// i18n-ignore-file — admin-only page (English UI)
import { useEffect, useMemo, useState } from "react";
import { PageHeader } from "@/components/layout/PageHeader";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import {
  GitBranch, RefreshCw, Github, Download, ExternalLink, AlertTriangle,
  CheckCircle2, History, CheckCheck, FileSpreadsheet, FileText, Search, XCircle,
} from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/auth/AuthProvider";
import * as XLSX from "xlsx";
import jsPDF from "jspdf";
import autoTable from "jspdf-autotable";
import { applyPdfHeaderFooter } from "@/lib/exports";

const STORAGE_KEY = "developer:github_repo_url";

type Commit = {
  sha: string;
  commit: { message: string; author: { name: string; date: string } };
  html_url: string;
  author?: { login: string; avatar_url: string } | null;
};

type LogRow = {
  id: string;
  created_at: string;
  user_id: string;
  action: string;
  repo_url: string;
  commit_sha: string | null;
  commit_message: string | null;
  release_tag: string | null;
  note: string | null;
  status?: string | null;
  user_name?: string;
  user_email?: string;
};

function parseRepo(url: string): { owner: string; repo: string } | null {
  const m = url.trim().replace(/\.git$/, "").match(/github\.com[/:]([^/]+)\/([^/?#]+)/i);
  return m ? { owner: m[1], repo: m[2] } : null;
}

export default function DeveloperUpdates() {
  const { user } = useAuth();
  const [repoUrl, setRepoUrl] = useState<string>("");
  const [commits, setCommits] = useState<Commit[]>([]);
  const [latestRelease, setLatestRelease] = useState<any>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [lastChecked, setLastChecked] = useState<string | null>(null);
  const [history, setHistory] = useState<LogRow[]>([]);
  const [marking, setMarking] = useState<string | null>(null);

  // filters
  const [qUser, setQUser] = useState("");
  const [qRepo, setQRepo] = useState("");
  const [qText, setQText] = useState("");
  const [qAction, setQAction] = useState<string>("all");

  useEffect(() => {
    document.title = "Developer Updates";
    const saved = localStorage.getItem(STORAGE_KEY);
    if (saved) {
      setRepoUrl(saved);
      void check(saved);
    }
    void loadHistory();
  }, []);

  async function loadHistory() {
    const { data, error } = await supabase
      .from("developer_update_logs" as any)
      .select("*")
      .order("created_at", { ascending: false })
      .limit(500);
    if (error) { toast.error("Failed to load history"); return; }
    const rows = (data as any[]) ?? [];
    const ids = Array.from(new Set(rows.map(r => r.user_id).filter(Boolean)));
    let profileMap = new Map<string, { full_name: string | null; email: string | null }>();
    if (ids.length > 0) {
      const { data: profs } = await supabase
        .from("profiles")
        .select("id, full_name, email")
        .in("id", ids);
      (profs ?? []).forEach((p: any) => profileMap.set(p.id, { full_name: p.full_name, email: p.email }));
    }
    setHistory(rows.map(r => ({
      ...r,
      user_name: profileMap.get(r.user_id)?.full_name ?? "—",
      user_email: profileMap.get(r.user_id)?.email ?? "",
    })));
  }

  async function logEvent(payload: Partial<LogRow> & { action: string; repo_url: string }) {
    if (!user) return;
    await supabase.from("developer_update_logs" as any).insert({
      user_id: user.id,
      ...payload,
    });
    void loadHistory();
  }

  async function check(urlOverride?: string) {
    const url = urlOverride ?? repoUrl;
    const parsed = parseRepo(url);
    if (!parsed) {
      setError("Invalid GitHub URL. Use https://github.com/owner/repo");
      toast.error("Invalid GitHub URL");
      return;
    }
    setLoading(true); setError(null);
    try {
      const [commitsRes, releaseRes] = await Promise.all([
        fetch(`https://api.github.com/repos/${parsed.owner}/${parsed.repo}/commits?per_page=15`),
        fetch(`https://api.github.com/repos/${parsed.owner}/${parsed.repo}/releases/latest`),
      ]);
      if (!commitsRes.ok) throw new Error(`GitHub API: ${commitsRes.status}. Repo must be public.`);
      const commitsData = await commitsRes.json();
      setCommits(commitsData);
      const release = releaseRes.ok ? await releaseRes.json() : null;
      setLatestRelease(release);
      localStorage.setItem(STORAGE_KEY, url);
      setLastChecked(new Date().toLocaleString());
      const top = commitsData?.[0];
      toast.success("Update check successful", {
        description: top
          ? `Latest: ${top.sha.slice(0, 7)} — ${top.commit.message.split("\n")[0].slice(0, 80)}`
          : "No commits found",
      });
      await logEvent({
        action: "check",
        repo_url: url,
        status: "success",
        commit_sha: top?.sha ?? null,
        commit_message: top?.commit?.message?.split("\n")[0] ?? null,
        release_tag: release?.tag_name ?? null,
        note: `Fetched ${commitsData?.length ?? 0} commits`,
      });
    } catch (e: any) {
      setError(e.message);
      toast.error("Update check failed", { description: e.message });
      await logEvent({
        action: "check",
        repo_url: url,
        status: "error",
        note: e.message,
      });
    } finally {
      setLoading(false);
    }
  }

  async function markApplied(c: Commit) {
    if (!user) return;
    setMarking(c.sha);
    try {
      await logEvent({
        action: "mark_applied",
        repo_url: repoUrl,
        status: "success",
        commit_sha: c.sha,
        commit_message: c.commit.message.split("\n")[0],
        note: "Marked as applied by developer",
      });
      toast.success("Marked as applied", { description: `${c.sha.slice(0, 7)} — applied successfully` });
    } catch (e: any) {
      toast.error("Failed to mark applied", { description: e.message });
    } finally {
      setMarking(null);
    }
  }

  const parsed = parseRepo(repoUrl);

  // ---------------- filtering ----------------
  const filtered = useMemo(() => {
    const u = qUser.trim().toLowerCase();
    const r = qRepo.trim().toLowerCase();
    const t = qText.trim().toLowerCase();
    return history.filter(h => {
      if (qAction !== "all" && h.action !== qAction) return false;
      if (u && !(`${h.user_name} ${h.user_email}`.toLowerCase().includes(u))) return false;
      if (r && !(h.repo_url || "").toLowerCase().includes(r)) return false;
      if (t) {
        const blob = `${h.commit_sha ?? ""} ${h.commit_message ?? ""} ${h.release_tag ?? ""} ${h.note ?? ""}`.toLowerCase();
        if (!blob.includes(t)) return false;
      }
      return true;
    });
  }, [history, qUser, qRepo, qText, qAction]);

  function exportCsv() {
    const rows = filtered.map(h => ({
      When: new Date(h.created_at).toLocaleString(),
      User: h.user_name,
      Email: h.user_email,
      Action: h.action,
      Status: h.status ?? "",
      Commit: h.commit_sha ?? "",
      Message: h.commit_message ?? "",
      Release: h.release_tag ?? "",
      Repo: h.repo_url,
      Note: h.note ?? "",
    }));
    const ws = XLSX.utils.json_to_sheet(rows);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, "UpdateLogs");
    XLSX.writeFile(wb, `developer-updates-${new Date().toISOString().slice(0, 10)}.xlsx`);
    toast.success(`Exported ${rows.length} rows to Excel`);
  }

  async function exportPdf() {
    const doc = new jsPDF({ orientation: "landscape" });
    const startY = await applyPdfHeaderFooter(doc, { title: "Developer Update Logs" });
    autoTable(doc, {
      startY,
      head: [["When", "User", "Action", "Status", "Commit", "Message", "Release", "Repo"]],
      body: filtered.map(h => [
        new Date(h.created_at).toLocaleString(),
        `${h.user_name}\n${h.user_email}`,
        h.action,
        h.status ?? "",
        h.commit_sha?.slice(0, 7) ?? "",
        (h.commit_message ?? "").slice(0, 60),
        h.release_tag ?? "",
        h.repo_url,
      ]),
      styles: { fontSize: 8, cellPadding: 1.5, overflow: "linebreak" },
      headStyles: { fillColor: [16, 122, 87] },
      columnStyles: { 5: { cellWidth: 60 }, 7: { cellWidth: 50 } },
    });
    doc.save(`developer-updates-${new Date().toISOString().slice(0, 10)}.pdf`);
    toast.success(`Exported ${filtered.length} rows to PDF`);
  }

  function clearFilters() {
    setQUser(""); setQRepo(""); setQText(""); setQAction("all");
  }

  return (
    <>
      <PageHeader
        title="Developer Updates"
        description="Check for new commits and releases from a public GitHub repository"
      />

      <Alert className="mb-4">
        <AlertTriangle className="h-4 w-4" />
        <AlertTitle>How this works</AlertTitle>
        <AlertDescription className="text-sm space-y-1">
          <p>
            This tool reads commit/release info from a <strong>public</strong> GitHub repository — no
            credentials needed. It does <strong>not</strong> rebuild this Lovable-hosted app at runtime.
          </p>
          <p>
            For self-hosted deployments: paste your repo URL, see what's new, then pull &amp; redeploy on
            your server. On Lovable, push from GitHub auto-syncs (two-way sync).
          </p>
        </AlertDescription>
      </Alert>

      <Card className="p-4 mb-4">
        <div className="flex flex-col md:flex-row gap-3 md:items-end">
          <div className="flex-1">
            <Label htmlFor="repo">Public GitHub Repository URL</Label>
            <Input
              id="repo"
              value={repoUrl}
              onChange={(e) => setRepoUrl(e.target.value)}
              placeholder="https://github.com/owner/repository"
            />
          </div>
          <Button onClick={() => check()} disabled={loading || !repoUrl}>
            <RefreshCw className={`h-4 w-4 mr-1 ${loading ? "animate-spin" : ""}`} />
            Check for updates
          </Button>
          {parsed && (
            <Button asChild variant="outline">
              <a href={`https://github.com/${parsed.owner}/${parsed.repo}`} target="_blank" rel="noreferrer">
                <Github className="h-4 w-4 mr-1" /> Open repo
              </a>
            </Button>
          )}
        </div>
        {lastChecked && (
          <p className="text-xs text-muted-foreground mt-2">Last checked: {lastChecked}</p>
        )}
      </Card>

      {error && (
        <Alert variant="destructive" className="mb-4">
          <AlertTriangle className="h-4 w-4" />
          <AlertTitle>Error</AlertTitle>
          <AlertDescription>{error}</AlertDescription>
        </Alert>
      )}

      <Tabs defaultValue={commits.length > 0 || latestRelease ? "commits" : "history"}>
        <TabsList>
          <TabsTrigger value="commits" disabled={!parsed || commits.length === 0}><GitBranch className="h-4 w-4 mr-1" />Recent Commits</TabsTrigger>
          <TabsTrigger value="release" disabled={!parsed}><CheckCircle2 className="h-4 w-4 mr-1" />Latest Release</TabsTrigger>
          <TabsTrigger value="download" disabled={!parsed}><Download className="h-4 w-4 mr-1" />Download / Pull</TabsTrigger>
          <TabsTrigger value="history"><History className="h-4 w-4 mr-1" />Update History ({history.length})</TabsTrigger>
        </TabsList>

        <TabsContent value="commits">
          <Card className="p-0 divide-y">
            {commits.map((c) => (
              <div key={c.sha} className="p-3 flex items-start gap-3">
                <Badge variant="outline" className="font-mono text-[11px]">{c.sha.slice(0, 7)}</Badge>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium truncate">{c.commit.message.split("\n")[0]}</p>
                  <p className="text-xs text-muted-foreground">
                    {c.commit.author.name} • {new Date(c.commit.author.date).toLocaleString()}
                  </p>
                </div>
                <Button size="sm" variant="outline" onClick={() => markApplied(c)} disabled={marking === c.sha}>
                  <CheckCheck className="h-3 w-3 mr-1" /> Mark applied
                </Button>
                <Button asChild size="sm" variant="ghost">
                  <a href={c.html_url} target="_blank" rel="noreferrer"><ExternalLink className="h-3 w-3" /></a>
                </Button>
              </div>
            ))}
          </Card>
        </TabsContent>

        <TabsContent value="release">
          {latestRelease ? (
            <Card className="p-4 space-y-2">
              <div className="flex items-center gap-2">
                <Badge>{latestRelease.tag_name}</Badge>
                <h3 className="font-semibold">{latestRelease.name || latestRelease.tag_name}</h3>
              </div>
              <p className="text-xs text-muted-foreground">
                Published {new Date(latestRelease.published_at).toLocaleString()}
              </p>
              <pre className="whitespace-pre-wrap text-sm bg-muted p-3 rounded-md max-h-64 overflow-auto">
                {latestRelease.body || "(no release notes)"}
              </pre>
              <Button asChild variant="outline" size="sm">
                <a href={latestRelease.html_url} target="_blank" rel="noreferrer">
                  <ExternalLink className="h-3 w-3 mr-1" /> View release
                </a>
              </Button>
            </Card>
          ) : (
            <Card className="p-4 text-sm text-muted-foreground">No releases found.</Card>
          )}
        </TabsContent>

        <TabsContent value="download">
          {parsed && (
            <Card className="p-4 space-y-3 text-sm">
              <p className="font-medium">Apply updates on a self-hosted deployment:</p>
              <ol className="list-decimal pl-5 space-y-2 text-muted-foreground">
                <li>SSH into your server and navigate to your project directory.</li>
                <li>Run <code className="bg-muted px-1 rounded">git pull origin main</code></li>
                <li>Install deps: <code className="bg-muted px-1 rounded">npm install</code></li>
                <li>Run pending DB migrations on your Supabase/Postgres backend.</li>
                <li>Build &amp; restart: <code className="bg-muted px-1 rounded">npm run build &amp;&amp; pm2 restart app</code></li>
              </ol>
              <div className="pt-2 flex gap-2 flex-wrap">
                <Button asChild variant="outline" size="sm">
                  <a href={`https://github.com/${parsed.owner}/${parsed.repo}/archive/refs/heads/main.zip`} target="_blank" rel="noreferrer">
                    <Download className="h-3 w-3 mr-1" /> Download main.zip
                  </a>
                </Button>
                <Button asChild variant="outline" size="sm">
                  <a href={`https://github.com/${parsed.owner}/${parsed.repo}/tree/main/supabase/migrations`} target="_blank" rel="noreferrer">
                    <Github className="h-3 w-3 mr-1" /> View migrations
                  </a>
                </Button>
              </div>
            </Card>
          )}
        </TabsContent>

        <TabsContent value="history">
          <Card className="p-3 mb-3">
            <div className="grid grid-cols-1 md:grid-cols-5 gap-2 items-end">
              <div>
                <Label className="text-xs">User</Label>
                <Input value={qUser} onChange={e => setQUser(e.target.value)} placeholder="name or email" />
              </div>
              <div>
                <Label className="text-xs">Repo</Label>
                <Input value={qRepo} onChange={e => setQRepo(e.target.value)} placeholder="owner/repo" />
              </div>
              <div>
                <Label className="text-xs">Commit / message / note</Label>
                <Input value={qText} onChange={e => setQText(e.target.value)} placeholder="search…" />
              </div>
              <div>
                <Label className="text-xs">Action</Label>
                <Select value={qAction} onValueChange={setQAction}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">All</SelectItem>
                    <SelectItem value="check">check</SelectItem>
                    <SelectItem value="mark_applied">mark_applied</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="flex gap-2">
                <Button variant="outline" size="sm" onClick={clearFilters}><XCircle className="h-3 w-3 mr-1" />Clear</Button>
                <Button variant="outline" size="sm" onClick={exportCsv} disabled={filtered.length === 0}>
                  <FileSpreadsheet className="h-3 w-3 mr-1" />Excel
                </Button>
                <Button variant="outline" size="sm" onClick={exportPdf} disabled={filtered.length === 0}>
                  <FileText className="h-3 w-3 mr-1" />PDF
                </Button>
              </div>
            </div>
            <p className="text-xs text-muted-foreground mt-2 flex items-center gap-1">
              <Search className="h-3 w-3" /> Showing {filtered.length} of {history.length} entries
            </p>
          </Card>
          <Card>
            <Table>
              <TableHeader><TableRow>
                <TableHead>When</TableHead>
                <TableHead>User</TableHead>
                <TableHead>Action</TableHead>
                <TableHead>Status</TableHead>
                <TableHead>Commit</TableHead>
                <TableHead>Message</TableHead>
                <TableHead>Release</TableHead>
                <TableHead>Repo</TableHead>
              </TableRow></TableHeader>
              <TableBody>
                {filtered.map((h) => (
                  <TableRow key={h.id}>
                    <TableCell className="text-xs whitespace-nowrap">{new Date(h.created_at).toLocaleString()}</TableCell>
                    <TableCell className="text-xs">
                      <div className="font-medium">{h.user_name}</div>
                      <div className="text-muted-foreground">{h.user_email}</div>
                    </TableCell>
                    <TableCell>
                      <Badge variant={h.action === "mark_applied" ? "default" : "outline"}>{h.action}</Badge>
                    </TableCell>
                    <TableCell>
                      {h.status === "error"
                        ? <Badge variant="destructive">error</Badge>
                        : h.status
                          ? <Badge variant="secondary">{h.status}</Badge>
                          : <span className="text-muted-foreground text-xs">—</span>}
                    </TableCell>
                    <TableCell className="font-mono text-xs">{h.commit_sha?.slice(0, 7) ?? "—"}</TableCell>
                    <TableCell className="text-xs max-w-[280px] truncate" title={h.commit_message ?? ""}>{h.commit_message ?? h.note ?? "—"}</TableCell>
                    <TableCell className="text-xs">{h.release_tag ?? "—"}</TableCell>
                    <TableCell className="text-xs max-w-[200px] truncate" title={h.repo_url}>{h.repo_url}</TableCell>
                  </TableRow>
                ))}
                {filtered.length === 0 && (
                  <TableRow><TableCell colSpan={8} className="text-center text-muted-foreground py-6">No update history matches the filters.</TableCell></TableRow>
                )}
              </TableBody>
            </Table>
          </Card>
        </TabsContent>
      </Tabs>
    </>
  );
}
