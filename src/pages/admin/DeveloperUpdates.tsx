import { useEffect, useState } from "react";
import { PageHeader } from "@/components/layout/PageHeader";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { GitBranch, RefreshCw, Github, Download, ExternalLink, AlertTriangle, CheckCircle2 } from "lucide-react";
import { toast } from "sonner";

const STORAGE_KEY = "developer:github_repo_url";

type Commit = {
  sha: string;
  commit: { message: string; author: { name: string; date: string } };
  html_url: string;
  author?: { login: string; avatar_url: string } | null;
};

function parseRepo(url: string): { owner: string; repo: string } | null {
  try {
    const m = url.trim().replace(/\.git$/, "").match(/github\.com[/:]([^/]+)\/([^/?#]+)/i);
    if (!m) return null;
    return { owner: m[1], repo: m[2] };
  } catch { return null; }
}

export default function DeveloperUpdates() {
  const [repoUrl, setRepoUrl] = useState<string>("");
  const [commits, setCommits] = useState<Commit[]>([]);
  const [latestRelease, setLatestRelease] = useState<any>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [lastChecked, setLastChecked] = useState<string | null>(null);

  useEffect(() => {
    document.title = "Developer Updates";
    const saved = localStorage.getItem(STORAGE_KEY);
    if (saved) {
      setRepoUrl(saved);
      void check(saved);
    }
  }, []);

  async function check(urlOverride?: string) {
    const url = urlOverride ?? repoUrl;
    const parsed = parseRepo(url);
    if (!parsed) {
      setError("Invalid GitHub URL. Use https://github.com/owner/repo");
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
      if (releaseRes.ok) setLatestRelease(await releaseRes.json());
      else setLatestRelease(null);
      localStorage.setItem(STORAGE_KEY, url);
      setLastChecked(new Date().toLocaleString());
      toast.success("Update info fetched");
    } catch (e: any) {
      setError(e.message);
      toast.error(e.message);
    } finally {
      setLoading(false);
    }
  }

  const parsed = parseRepo(repoUrl);

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

      {(commits.length > 0 || latestRelease) && parsed && (
        <Tabs defaultValue="commits">
          <TabsList>
            <TabsTrigger value="commits"><GitBranch className="h-4 w-4 mr-1" />Recent Commits</TabsTrigger>
            <TabsTrigger value="release"><CheckCircle2 className="h-4 w-4 mr-1" />Latest Release</TabsTrigger>
            <TabsTrigger value="download"><Download className="h-4 w-4 mr-1" />Download / Pull</TabsTrigger>
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
            <Card className="p-4 space-y-3 text-sm">
              <p className="font-medium">Apply updates on a self-hosted deployment:</p>
              <ol className="list-decimal pl-5 space-y-2 text-muted-foreground">
                <li>SSH into your server and navigate to your project directory.</li>
                <li>
                  Run <code className="bg-muted px-1 rounded">git pull origin main</code>
                </li>
                <li>
                  Install deps: <code className="bg-muted px-1 rounded">npm install</code>
                </li>
                <li>
                  Run pending DB migrations on your Supabase/Postgres backend.
                </li>
                <li>
                  Build &amp; restart: <code className="bg-muted px-1 rounded">npm run build &amp;&amp; pm2 restart app</code>
                </li>
              </ol>
              <div className="pt-2 flex gap-2 flex-wrap">
                <Button asChild variant="outline" size="sm">
                  <a
                    href={`https://github.com/${parsed.owner}/${parsed.repo}/archive/refs/heads/main.zip`}
                    target="_blank"
                    rel="noreferrer"
                  >
                    <Download className="h-3 w-3 mr-1" /> Download main.zip
                  </a>
                </Button>
                <Button asChild variant="outline" size="sm">
                  <a
                    href={`https://github.com/${parsed.owner}/${parsed.repo}/tree/main/supabase/migrations`}
                    target="_blank"
                    rel="noreferrer"
                  >
                    <Github className="h-3 w-3 mr-1" /> View migrations
                  </a>
                </Button>
              </div>
            </Card>
          </TabsContent>
        </Tabs>
      )}
    </>
  );
}
