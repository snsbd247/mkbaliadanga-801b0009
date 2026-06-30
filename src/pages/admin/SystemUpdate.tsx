import { useEffect, useState } from "react";
import { DevToolsApi, type GitStatus } from "@/lib/api/devTools";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { toast } from "sonner";
import { RefreshCw, GitBranch, Download, Save } from "lucide-react";

export default function SystemUpdate() {
  const [status, setStatus] = useState<GitStatus | null>(null);
  const [repoUrl, setRepoUrl] = useState("");
  const [loading, setLoading] = useState(false);
  const [savingRemote, setSavingRemote] = useState(false);
  const [pulling, setPulling] = useState(false);
  const [output, setOutput] = useState("");

  const load = async () => {
    setLoading(true);
    try {
      const s = await DevToolsApi.gitStatus();
      setStatus(s);
      setRepoUrl(s.remote_url ?? "");
    } catch (e: any) {
      toast.error(e.message ?? "স্ট্যাটাস লোড করা যায়নি");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    load();
  }, []);

  const saveRemote = async () => {
    setSavingRemote(true);
    try {
      const r = await DevToolsApi.setRemote(repoUrl.trim());
      toast.success("রিপো লিঙ্ক সেভ হয়েছে");
      setStatus((s) => (s ? { ...s, remote_url: r.remote_url } : s));
    } catch (e: any) {
      toast.error(e.message ?? "রিমোট সেট করা যায়নি");
    } finally {
      setSavingRemote(false);
    }
  };

  const pull = async () => {
    setPulling(true);
    setOutput("");
    try {
      const r = await DevToolsApi.pull();
      setOutput(r.output);
      r.ok ? toast.success("আপডেট সম্পন্ন হয়েছে") : toast.error("আপডেট ব্যর্থ হয়েছে");
      load();
    } catch (e: any) {
      setOutput(e?.data?.output ?? e.message ?? "");
      toast.error(e.message ?? "পুল ব্যর্থ");
    } finally {
      setPulling(false);
    }
  };

  return (
    <div className="container mx-auto max-w-3xl space-y-4 p-4">
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center justify-between">
            <span className="flex items-center gap-2">
              <GitBranch className="h-5 w-5" /> সফটওয়্যার আপডেট (GitHub)
            </span>
            <Button variant="outline" size="sm" onClick={load} disabled={loading}>
              <RefreshCw className="h-4 w-4" />
            </Button>
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid grid-cols-2 gap-3 text-sm">
            <div>
              <div className="text-muted-foreground">ব্রাঞ্চ</div>
              <div className="font-medium">{status?.branch ?? "—"}</div>
            </div>
            <div>
              <div className="text-muted-foreground">সর্বশেষ কমিট</div>
              <div className="font-medium">{status?.last_commit ?? "—"}</div>
            </div>
          </div>

          <div className="space-y-2">
            <Label htmlFor="repo">পাবলিক গিটহাব রিপো লিঙ্ক</Label>
            <div className="flex gap-2">
              <Input
                id="repo"
                value={repoUrl}
                onChange={(e) => setRepoUrl(e.target.value)}
                placeholder="https://github.com/user/repo.git"
              />
              <Button onClick={saveRemote} disabled={savingRemote || !repoUrl.trim()}>
                <Save className="mr-1 h-4 w-4" /> সেভ
              </Button>
            </div>
            <p className="text-xs text-muted-foreground">শুধুমাত্র সর্বজনীন https গিট URL গ্রহণযোগ্য।</p>
          </div>

          <Button onClick={pull} disabled={pulling || !status?.remote_url} className="w-full">
            <Download className="mr-1 h-4 w-4" /> {pulling ? "আপডেট হচ্ছে…" : "পুল করে আপডেট করুন"}
          </Button>

          {output && (
            <pre className="max-h-72 overflow-auto rounded-md border bg-muted p-3 text-xs whitespace-pre-wrap">
              {output}
            </pre>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
