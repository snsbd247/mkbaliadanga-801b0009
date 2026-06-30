import { useEffect, useState } from "react";
import { DevToolsApi, type FileEntry } from "@/lib/api/devTools";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { toast } from "sonner";
import { Folder, FileText, ChevronRight, Home, Save, RefreshCw, Lock } from "lucide-react";

function fmtSize(n: number | null): string {
  if (n == null) return "";
  if (n < 1024) return `${n} B`;
  if (n < 1024 * 1024) return `${(n / 1024).toFixed(1)} KB`;
  return `${(n / 1024 / 1024).toFixed(1)} MB`;
}

export default function FileManager() {
  const [path, setPath] = useState("");
  const [entries, setEntries] = useState<FileEntry[]>([]);
  const [loading, setLoading] = useState(false);
  const [openFile, setOpenFile] = useState<string | null>(null);
  const [content, setContent] = useState("");
  const [binary, setBinary] = useState(false);
  const [saving, setSaving] = useState(false);

  const loadDir = async (p: string) => {
    setLoading(true);
    try {
      const res = await DevToolsApi.list(p);
      setPath(res.path);
      setEntries(res.entries);
      setOpenFile(null);
    } catch (e: any) {
      toast.error(e.message ?? "লোড করা যায়নি");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadDir("");
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const openEntry = async (en: FileEntry) => {
    if (en.skipped) {
      toast.info("এই ফোল্ডার ফাইল ম্যানাজারে দেখানো হয় না।");
      return;
    }
    if (en.type === "dir") {
      loadDir(en.path);
      return;
    }
    if (en.secret) {
      toast.error("গোপন ফাইল খোলা যাবে না।");
      return;
    }
    try {
      const res = await DevToolsApi.read(en.path);
      setOpenFile(res.path);
      setBinary(res.binary);
      setContent(res.content ?? "");
    } catch (e: any) {
      toast.error(e.message ?? "ফাইল পড়া যায়নি");
    }
  };

  const save = async () => {
    if (!openFile) return;
    setSaving(true);
    try {
      await DevToolsApi.write(openFile, content);
      toast.success("সেভ হয়েছে");
    } catch (e: any) {
      toast.error(e.message ?? "সেভ করা যায়নি");
    } finally {
      setSaving(false);
    }
  };

  const crumbs = path ? path.split("/") : [];
  const goTo = (idx: number) => loadDir(crumbs.slice(0, idx + 1).join("/"));

  return (
    <div className="container mx-auto p-4 space-y-4">
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center justify-between">
            <span>ফাইল ম্যানাজার (ডেভেলপার)</span>
            <Button variant="outline" size="sm" onClick={() => loadDir(path)} disabled={loading}>
              <RefreshCw className="h-4 w-4" />
            </Button>
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          <div className="flex flex-wrap items-center gap-1 text-sm">
            <button className="inline-flex items-center gap-1 hover:underline" onClick={() => loadDir("")}>
              <Home className="h-3.5 w-3.5" /> root
            </button>
            {crumbs.map((c, i) => (
              <span key={i} className="inline-flex items-center gap-1">
                <ChevronRight className="h-3.5 w-3.5 text-muted-foreground" />
                <button className="hover:underline" onClick={() => goTo(i)}>{c}</button>
              </span>
            ))}
          </div>

          <div className="grid gap-4 md:grid-cols-[320px_1fr]">
            <div className="rounded-md border divide-y max-h-[60vh] overflow-auto">
              {entries.map((en) => (
                <button
                  key={en.path}
                  onClick={() => openEntry(en)}
                  className={`flex w-full items-center gap-2 px-3 py-2 text-left text-sm hover:bg-muted ${
                    en.skipped ? "opacity-50" : ""
                  } ${openFile === en.path ? "bg-muted" : ""}`}
                >
                  {en.type === "dir" ? (
                    <Folder className="h-4 w-4 text-primary shrink-0" />
                  ) : en.secret ? (
                    <Lock className="h-4 w-4 text-muted-foreground shrink-0" />
                  ) : (
                    <FileText className="h-4 w-4 text-muted-foreground shrink-0" />
                  )}
                  <span className="flex-1 truncate">{en.name}</span>
                  <span className="text-xs text-muted-foreground">{fmtSize(en.size)}</span>
                </button>
              ))}
              {entries.length === 0 && !loading && (
                <div className="p-3 text-sm text-muted-foreground">খালি ডিরেক্টরি</div>
              )}
            </div>

            <div className="space-y-2">
              {openFile ? (
                <>
                  <div className="flex items-center justify-between gap-2">
                    <code className="truncate text-xs">{openFile}</code>
                    <Button size="sm" onClick={save} disabled={saving || binary}>
                      <Save className="mr-1 h-4 w-4" /> সেভ
                    </Button>
                  </div>
                  {binary ? (
                    <div className="rounded-md border p-4 text-sm text-muted-foreground">
                      বাইনারি ফাইল — এডিট করা যাবে না।
                    </div>
                  ) : (
                    <Textarea
                      value={content}
                      onChange={(e) => setContent(e.target.value)}
                      spellCheck={false}
                      className="min-h-[55vh] font-mono text-xs"
                    />
                  )}
                </>
              ) : (
                <div className="flex h-full min-h-[40vh] items-center justify-center rounded-md border text-sm text-muted-foreground">
                  একটি ফাইল নির্বাচন করুন
                </div>
              )}
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
