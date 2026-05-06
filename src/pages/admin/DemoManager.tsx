import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { Badge } from "@/components/ui/badge";
import { toast } from "sonner";
import { Loader2, AlertTriangle, Database, Trash2, Eye, RefreshCw, CheckCircle2, XCircle } from "lucide-react";
import {
  Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle,
} from "@/components/ui/dialog";

const MODULES = [
  { id: "locations", label: "লোকেশন (বিভাগ/জেলা/উপজেলা/মৌজা)" },
  { id: "settings", label: "কোম্পানি সেটিংস + কার্ড" },
  { id: "accounting", label: "চার্ট অফ একাউন্টস" },
  { id: "farmers", label: "ফার্মার + জমি" },
  { id: "irrigation", label: "সেচ (রেট + চার্জ)" },
  { id: "loans", label: "ঋণ (পরিকল্পনা + ঋণ + পেমেন্ট)" },
  { id: "savings", label: "সঞ্চয় + শেয়ার" },
  { id: "expenses", label: "খরচ" },
];

type Action = "reset" | "import" | "both";

export default function DemoManager() {
  const [action, setAction] = useState<Action>("both");
  const [size, setSize] = useState(50);
  const [selected, setSelected] = useState<string[]>(MODULES.map((m) => m.id));
  const [loading, setLoading] = useState(false);
  const [previewOpen, setPreviewOpen] = useState(false);
  const [preview, setPreview] = useState<any>(null);
  const [logs, setLogs] = useState<any[]>([]);
  const [logsLoading, setLogsLoading] = useState(false);
  const [lastResult, setLastResult] = useState<any>(null);

  const toggle = (id: string) =>
    setSelected((s) => (s.includes(id) ? s.filter((x) => x !== id) : [...s, id]));

  const loadLogs = async () => {
    setLogsLoading(true);
    const { data } = await supabase
      .from("demo_operations_log" as any)
      .select("*")
      .order("created_at", { ascending: false })
      .limit(20);
    setLogs((data as any) ?? []);
    setLogsLoading(false);
  };

  useEffect(() => { loadLogs(); }, []);

  const fetchPreview = async () => {
    setLoading(true);
    try {
      const { data, error } = await supabase.functions.invoke("demo-reset", {
        body: { action: "preview", modules: selected, size },
      });
      if (error) throw error;
      if ((data as any)?.error) throw new Error((data as any).error);
      setPreview(data);
      setPreviewOpen(true);
    } catch (e: any) {
      toast.error(e?.message ?? "Preview failed");
    } finally {
      setLoading(false);
    }
  };

  const run = async () => {
    setPreviewOpen(false);
    setLoading(true);
    setLastResult(null);
    try {
      const { data, error } = await supabase.functions.invoke("demo-reset", {
        body: { action, modules: selected, size, confirm: "RESET" },
      });
      if (error) throw error;
      if ((data as any)?.error) throw new Error((data as any).error);
      setLastResult(data);
      toast.success("✓ অপারেশন সম্পন্ন হয়েছে");
      await loadLogs();
    } catch (e: any) {
      toast.error(e?.message ?? "Failed");
      setLastResult({ error: e?.message });
      await loadLogs();
    } finally {
      setLoading(false);
    }
  };

  const willWipe = action === "reset" || action === "both";
  const willImport = action === "import" || action === "both";

  return (
    <div className="container max-w-5xl py-6 space-y-6">
      <div>
        <h1 className="text-2xl font-bold flex items-center gap-2">
          <Database className="h-6 w-6" /> ডেমো ডেটা ম্যানেজার
        </h1>
        <p className="text-muted-foreground text-sm mt-1">
          ডেমো ডেটা ইমপোর্ট অথবা সম্পূর্ণ রিসেট করুন। শুধুমাত্র super admin।
        </p>
      </div>

      <Card className="border-destructive/40">
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-destructive">
            <AlertTriangle className="h-5 w-5" /> সতর্কতা
          </CardTitle>
          <CardDescription>
            রিসেট করলে auth ইউজার, রোল ও পার্মিশন ছাড়া বাকি সব transactional ডেটা মুছে যাবে। undo নাই।
          </CardDescription>
        </CardHeader>
      </Card>

      <Card>
        <CardHeader><CardTitle>অপারেশন</CardTitle></CardHeader>
        <CardContent className="space-y-4">
          <RadioGroup value={action} onValueChange={(v: any) => setAction(v)}>
            <div className="flex items-center space-x-2">
              <RadioGroupItem value="both" id="r-both" />
              <Label htmlFor="r-both">রিসেট + ডেমো ইমপোর্ট</Label>
            </div>
            <div className="flex items-center space-x-2">
              <RadioGroupItem value="reset" id="r-reset" />
              <Label htmlFor="r-reset">শুধু রিসেট (ডেটা মুছবে)</Label>
            </div>
            <div className="flex items-center space-x-2">
              <RadioGroupItem value="import" id="r-import" />
              <Label htmlFor="r-import">শুধু ইমপোর্ট</Label>
            </div>
          </RadioGroup>

          {willImport && (
            <div className="space-y-2">
              <Label>ডেমো ডেটার আকার (ফার্মার সংখ্যা)</Label>
              <Input type="number" min={5} max={500} value={size}
                onChange={(e) => setSize(Number(e.target.value) || 50)} />
            </div>
          )}
        </CardContent>
      </Card>

      {willImport && (
        <Card>
          <CardHeader>
            <CardTitle>মডিউল সিলেক্ট</CardTitle>
            <CardDescription>কোন কোন মডিউলের জন্য ডেমো ডেটা ইমপোর্ট হবে</CardDescription>
          </CardHeader>
          <CardContent className="grid grid-cols-1 md:grid-cols-2 gap-3">
            {MODULES.map((m) => (
              <label key={m.id} className="flex items-center gap-2 cursor-pointer">
                <Checkbox checked={selected.includes(m.id)} onCheckedChange={() => toggle(m.id)} />
                <span className="text-sm">{m.label}</span>
              </label>
            ))}
          </CardContent>
        </Card>
      )}

      <div className="flex gap-2">
        <Button onClick={fetchPreview} disabled={loading} variant="outline" className="flex-1" size="lg">
          {loading ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : <Eye className="h-4 w-4 mr-2" />}
          প্রিভিউ + কনফার্ম
        </Button>
      </div>

      {/* Preview / Confirmation Dialog */}
      <Dialog open={previewOpen} onOpenChange={setPreviewOpen}>
        <DialogContent className="max-w-2xl max-h-[85vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <AlertTriangle className="h-5 w-5 text-destructive" /> অপারেশন কনফার্ম করুন
            </DialogTitle>
            <DialogDescription>
              নিচের পরিবর্তনগুলো হবে। ভালো করে দেখে নিন — undo নাই।
            </DialogDescription>
          </DialogHeader>

          {preview && (
            <div className="space-y-4">
              {willWipe && (
                <div>
                  <h3 className="font-semibold text-destructive flex items-center gap-2 mb-2">
                    <Trash2 className="h-4 w-4" /> যা মুছে যাবে
                  </h3>
                  {Object.keys(preview.wipe_preview ?? {}).length === 0 ? (
                    <p className="text-sm text-muted-foreground">কোনো ডেটা নাই (সব টেবিল খালি)</p>
                  ) : (
                    <div className="border rounded-md divide-y">
                      {Object.entries(preview.wipe_preview as Record<string, number>)
                        .sort((a, b) => b[1] - a[1])
                        .map(([table, count]) => (
                          <div key={table} className="flex justify-between px-3 py-2 text-sm">
                            <span className="font-mono">{table}</span>
                            <Badge variant="destructive">{count} rows</Badge>
                          </div>
                        ))}
                    </div>
                  )}
                </div>
              )}

              {willImport && (
                <div>
                  <h3 className="font-semibold text-primary flex items-center gap-2 mb-2">
                    <Database className="h-4 w-4" /> যা ইমপোর্ট হবে (আনুমানিক)
                  </h3>
                  {Object.keys(preview.import_preview ?? {}).length === 0 ? (
                    <p className="text-sm text-muted-foreground">কোনো মডিউল সিলেক্ট নাই</p>
                  ) : (
                    <div className="border rounded-md divide-y">
                      {Object.entries(preview.import_preview as Record<string, number>).map(([k, v]) => (
                        <div key={k} className="flex justify-between px-3 py-2 text-sm">
                          <span>{k}</span>
                          <Badge>~{v}</Badge>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              )}
            </div>
          )}

          <DialogFooter>
            <Button variant="outline" onClick={() => setPreviewOpen(false)} disabled={loading}>বাতিল</Button>
            <Button variant="destructive" onClick={run} disabled={loading}>
              {loading ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : <Trash2 className="h-4 w-4 mr-2" />}
              হ্যাঁ, এক্সিকিউট করুন
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {lastResult && (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              {lastResult.error ? (
                <><XCircle className="h-5 w-5 text-destructive" /> ব্যর্থ</>
              ) : (
                <><CheckCircle2 className="h-5 w-5 text-primary" /> সফল</>
              )}
            </CardTitle>
          </CardHeader>
          <CardContent>
            <pre className="text-xs overflow-auto bg-muted p-3 rounded max-h-80">
              {JSON.stringify(lastResult, null, 2)}
            </pre>
          </CardContent>
        </Card>
      )}

      {/* Audit log */}
      <Card>
        <CardHeader className="flex-row items-center justify-between">
          <div>
            <CardTitle>অডিট লগ</CardTitle>
            <CardDescription>সর্বশেষ ২০টি ডেমো অপারেশন</CardDescription>
          </div>
          <Button variant="ghost" size="sm" onClick={loadLogs} disabled={logsLoading}>
            <RefreshCw className={`h-4 w-4 ${logsLoading ? "animate-spin" : ""}`} />
          </Button>
        </CardHeader>
        <CardContent>
          {logs.length === 0 ? (
            <p className="text-sm text-muted-foreground text-center py-6">কোনো লগ নাই</p>
          ) : (
            <div className="space-y-2">
              {logs.map((l) => (
                <div key={l.id} className="border rounded-md p-3 text-sm space-y-1">
                  <div className="flex items-center justify-between flex-wrap gap-2">
                    <div className="flex items-center gap-2">
                      {l.success ? (
                        <CheckCircle2 className="h-4 w-4 text-primary" />
                      ) : (
                        <XCircle className="h-4 w-4 text-destructive" />
                      )}
                      <Badge variant={l.success ? "default" : "destructive"}>{l.action}</Badge>
                      <span className="font-medium">{l.user_email ?? l.user_id?.slice(0, 8)}</span>
                    </div>
                    <span className="text-xs text-muted-foreground">
                      {new Date(l.created_at).toLocaleString()}
                    </span>
                  </div>
                  <div className="text-xs text-muted-foreground flex flex-wrap gap-x-4 gap-y-1">
                    {l.ip && <span>IP: {l.ip}</span>}
                    {l.size && <span>Size: {l.size}</span>}
                    {l.modules?.length > 0 && <span>Modules: {l.modules.join(", ")}</span>}
                  </div>
                  {l.error_message && (
                    <p className="text-xs text-destructive">{l.error_message}</p>
                  )}
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
