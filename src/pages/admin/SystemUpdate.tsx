import { useEffect, useState } from "react";
import { DevToolsApi, type GitStatus } from "@/lib/api/devTools";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import { toast } from "sonner";
import { RefreshCw, GitBranch, Download, Save } from "lucide-react";

const REPO_RE = /^https:\/\/[\w.-]+\/[\w.\-/]+?(\.git)?$/;

export default function SystemUpdate() {
  const [status, setStatus] = useState<GitStatus | null>(null);
  const [repoUrl, setRepoUrl] = useState("");
  const [branch, setBranch] = useState("");
  const [loading, setLoading] = useState(false);
  const [savingRemote, setSavingRemote] = useState(false);
  const [pulling, setPulling] = useState(false);
  const [output, setOutput] = useState("");

  const urlValid = REPO_RE.test(repoUrl.trim());

  const load = async () => {
    setLoading(true);
    try {
      const s = await DevToolsApi.gitStatus();
      setStatus(s);
      setRepoUrl(s.remote_url ?? "");
      setBranch(s.branch ?? "");
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
    if (!urlValid) {
      toast.error("সঠিক পাবলিক https গিট URL দিন");
      return;
    }
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
      const r = await DevToolsApi.pull(branch.trim() || undefined);
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
              <div className="text-muted-foreground">বর্তমান ব্রাঞ্চ</div>
              <div className="font-medium">{status?.branch ?? "—"}</div>
            </div>
            <div>
              <div className="text-muted-foreground">সর্বশেষ কমিট</div>
              <div className="font-medium">{status?.last_commit ?? "—"}</div>
            </div>
          </div>

          <div className="space-y-2">
            <Label htmlFor="repo">পাবলিক গিটহাব রিপো লিঙ্ক (origin)</Label>
            <div className="flex gap-2">
              <Input
                id="repo"
                value={repoUrl}
                onChange={(e) => setRepoUrl(e.target.value)}
                placeholder="https://github.com/user/repo.git"
                aria-invalid={repoUrl.trim().length > 0 && !urlValid}
              />
              <Button onClick={saveRemote} disabled={savingRemote || !urlValid}>
                <Save className="mr-1 h-4 w-4" /> সেভ
              </Button>
            </div>
            {repoUrl.trim().length > 0 && !urlValid ? (
              <p className="text-xs text-destructive">URL সঠিক নয়। উদাহরণ: https://github.com/user/repo.git</p>
            ) : (
              <p className="text-xs text-muted-foreground">শুধুমাত্র সর্বজনীন https গিট URL গ্রহণযোগ্য।</p>
            )}
          </div>

          <div className="space-y-2">
            <Label htmlFor="branch">ব্রাঞ্চ (খালি রাখলে বর্তমান ব্রাঞ্চ)</Label>
            <Input
              id="branch"
              value={branch}
              onChange={(e) => setBranch(e.target.value)}
              placeholder={status?.branch ?? "main"}
            />
          </div>

          <AlertDialog>
            <AlertDialogTrigger asChild>
              <Button disabled={pulling || !status?.remote_url} className="w-full">
                <Download className="mr-1 h-4 w-4" /> {pulling ? "আপডেট হচ্ছে…" : "পুল করে আপডেট করুন"}
              </Button>
            </AlertDialogTrigger>
            <AlertDialogContent>
              <AlertDialogHeader>
                <AlertDialogTitle>আপডেট নিশ্চিত করুন</AlertDialogTitle>
                <AlertDialogDescription>
                  <span className="font-medium">{status?.remote_url}</span> থেকে{" "}
                  <span className="font-medium">{branch.trim() || status?.branch || "main"}</span> ব্রাঞ্চ পুল করা হবে।
                  লোকাল পরিবর্তন থাকলে আপডেট ব্যর্থ হতে পারে। চালিয়ে যাবেন?
                </AlertDialogDescription>
              </AlertDialogHeader>
              <AlertDialogFooter>
                <AlertDialogCancel>বাতিল</AlertDialogCancel>
                <AlertDialogAction onClick={pull}>হ্যাঁ, আপডেট করুন</AlertDialogAction>
              </AlertDialogFooter>
            </AlertDialogContent>
          </AlertDialog>

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
