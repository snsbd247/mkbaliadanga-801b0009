import { useState, useEffect, useMemo } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { toast } from "sonner";
import { Loader2, AlertTriangle, Database, Trash2, Eye, RefreshCw, CheckCircle2, XCircle, Filter } from "lucide-react";
import {
  Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle,
} from "@/components/ui/dialog";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";

import { useLang } from "@/i18n/LanguageProvider";

const MODULE_KEYS = [
  { id: "locations", tk: "dmModLocations" },
  { id: "settings", tk: "dmModSettings" },
  { id: "accounting", tk: "dmModAccounting" },
  { id: "farmers", tk: "dmModFarmers" },
  { id: "irrigation", tk: "dmModIrrigation" },
  { id: "loans", tk: "dmModLoans" },
  { id: "savings", tk: "dmModSavings" },
  { id: "expenses", tk: "dmModExpenses" },
] as const;

type Action = "reset" | "import" | "both";


export default function DemoManager() {
  const { t } = useLang();
  const [action, setAction] = useState<Action>("both");
  const [size, setSize] = useState(50);
  const [selected, setSelected] = useState<string[]>(MODULE_KEYS.map((m) => m.id));
  const [loading, setLoading] = useState(false);
  const [previewOpen, setPreviewOpen] = useState(false);
  const [preview, setPreview] = useState<any>(null);
  const [confirmText, setConfirmText] = useState("");

  // voter config
  const [voterRatio, setVoterRatio] = useState(3);
  const [voterNumberFormat, setVoterNumberFormat] = useState("V-{seq:5}");
  const [accountNumberFormat, setAccountNumberFormat] = useState("SAV-{seq:6}");

  // progress
  const [progress, setProgress] = useState(0);
  const [currentStep, setCurrentStep] = useState<string>("");
  const [stepLog, setStepLog] = useState<{ label: string; status: "running" | "done" | "error"; message?: string }[]>([]);
  const [lastResult, setLastResult] = useState<any>(null);
  const [seedLog, setSeedLog] = useState<any[]>([]);
  const [verification, setVerification] = useState<{ ok: boolean; issues: string[] } | null>(null);
  const [locationVerification, setLocationVerification] = useState<any>(null);
  const [farmerSamples, setFarmerSamples] = useState<any[]>([]);
  const [customNames, setCustomNames] = useState<any[] | null>(null);
  const [csvFileName, setCsvFileName] = useState<string>("");
  const [clearing, setClearing] = useState(false);

  // logs + filters
  const [logs, setLogs] = useState<any[]>([]);
  const [logsLoading, setLogsLoading] = useState(false);
  const [filterFrom, setFilterFrom] = useState("");
  const [filterTo, setFilterTo] = useState("");
  const [filterUser, setFilterUser] = useState("");
  const [filterAction, setFilterAction] = useState<string>("all");
  const [filterModule, setFilterModule] = useState<string>("all");

  const toggle = (id: string) =>
    setSelected((s) => (s.includes(id) ? s.filter((x) => x !== id) : [...s, id]));

  const loadLogs = async () => {
    setLogsLoading(true);
    const { data } = await supabase
      .from("demo_operations_log" as any)
      .select("*")
      .order("created_at", { ascending: false })
      .limit(100);
    setLogs((data as any) ?? []);
    setLogsLoading(false);
  };

  useEffect(() => { loadLogs(); }, []);

  const filteredLogs = useMemo(() => {
    return logs.filter((l) => {
      if (filterFrom && new Date(l.created_at) < new Date(filterFrom)) return false;
      if (filterTo && new Date(l.created_at) > new Date(filterTo + "T23:59:59")) return false;
      if (filterUser && !(l.user_email ?? "").toLowerCase().includes(filterUser.toLowerCase())) return false;
      if (filterAction !== "all" && l.action !== filterAction) return false;
      if (filterModule !== "all" && !(l.modules ?? []).includes(filterModule)) return false;
      return true;
    });
  }, [logs, filterFrom, filterTo, filterUser, filterAction, filterModule]);

  const fetchPreview = async () => {
    setLoading(true);
    setConfirmText("");
    try {
      const { data, error } = await supabase.functions.invoke("demo-reset", {
        body: { action: "preview", modules: selected, size },
      });
      if (error) throw error;
      if ((data as any)?.error) throw new Error((data as any).error);
      setPreview(data);
      setPreviewOpen(true);
    } catch (e: any) {
      toast.error(e?.message ?? t("dmPreviewFailed" as any));
    } finally {
      setLoading(false);
    }
  };

  const run = async () => {
    if (confirmText !== "RESET") {
      toast.error(t("dmConfirmRequired" as any));
      return;
    }
    setPreviewOpen(false);
    setLoading(true);
    setLastResult(null);
    setProgress(0);
    setStepLog([]);
    setCurrentStep(t("dmStarting" as any));

    try {
      const { data: { session } } = await supabase.auth.getSession();
      const url = `https://${import.meta.env.VITE_SUPABASE_PROJECT_ID}.supabase.co/functions/v1/demo-reset`;
      const resp = await fetch(url, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "Authorization": `Bearer ${session?.access_token}`,
          "apikey": import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY,
        },
        body: JSON.stringify({ action, modules: selected, size, confirm: "RESET", stream: true,
          voterCfg: { voterRatio, voterNumberFormat, accountNumberFormat },
          customNames: customNames ?? undefined }),
      });

      if (!resp.ok || !resp.body) {
        const txt = await resp.text();
        throw new Error(txt || `HTTP ${resp.status}`);
      }

      const reader = resp.body.getReader();
      const decoder = new TextDecoder();
      let buffer = "";
      let succeeded = false;

      while (true) {
        const { value, done } = await reader.read();
        if (done) break;
        buffer += decoder.decode(value, { stream: true });
        const lines = buffer.split("\n");
        buffer = lines.pop() ?? "";
        for (const line of lines) {
          if (!line.trim()) continue;
          try {
            const ev = JSON.parse(line);
            if (ev.type === "step") {
              setCurrentStep(ev.label);
              setProgress(ev.percent ?? 0);
              setStepLog((s) => [...s, { label: ev.label, status: "running" }]);
            } else if (ev.type === "done") {
              setProgress(ev.percent ?? 0);
              setStepLog((s) => s.map((x, i) => i === s.length - 1 ? { ...x, status: "done" } : x));
            } else if (ev.type === "warn") {
              setStepLog((s) => [...s, { label: ev.step, status: "error", message: ev.message }]);
            } else if (ev.type === "error" || ev.type === "fatal") {
              setStepLog((s) => [...s, { label: ev.step ?? "fatal", status: "error", message: ev.message }]);
              throw new Error(ev.message);
            } else if (ev.type === "seed_log") {
              setSeedLog(ev.rows ?? []);
            } else if (ev.type === "complete") {
              setProgress(100);
              setCurrentStep(t("dmComplete" as any));
              setLastResult(ev.summary);
              if (ev.summary?.verification) setVerification(ev.summary.verification);
              if (ev.summary?.location_verification) setLocationVerification(ev.summary.location_verification);
              if (ev.summary?.farmer_samples) setFarmerSamples(ev.summary.farmer_samples);
              if (ev.summary?.seed_log) setSeedLog(ev.summary.seed_log);
              succeeded = true;
            }
          } catch (parseErr) {
            console.error("parse line:", line, parseErr);
          }
        }
      }

      if (succeeded) toast.success(`✓ ${t("dmOpDone" as any)}`);
      await loadLogs();
    } catch (e: any) {
      toast.error(e?.message ?? t("dmFailedGeneric" as any));
      setLastResult({ error: e?.message });
      await loadLogs();
    } finally {
      setLoading(false);
      setConfirmText("");
    }
  };

  const willWipe = action === "reset" || action === "both";
  const willImport = action === "import" || action === "both";

  return (
    <div className="container max-w-5xl py-6 space-y-6">
      <div>
        <h1 className="text-2xl font-bold flex items-center gap-2">
          <Database className="h-6 w-6" /> {t("dmTitle" as any)}
        </h1>
        <p className="text-muted-foreground text-sm mt-1">{t("dmSubtitle" as any)}</p>
      </div>

      <Card className="border-destructive/40">
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-destructive">
            <AlertTriangle className="h-5 w-5" /> {t("dmWarningTitle" as any)}
          </CardTitle>
          <CardDescription>{t("dmWarningDesc" as any)}</CardDescription>
        </CardHeader>
      </Card>

      <Card>
        <CardHeader><CardTitle>{t("dmOperation" as any)}</CardTitle></CardHeader>
        <CardContent className="space-y-4">
          <RadioGroup value={action} onValueChange={(v: any) => setAction(v)}>
            <div className="flex items-center space-x-2">
              <RadioGroupItem value="both" id="r-both" />
              <Label htmlFor="r-both">{t("dmActionBoth" as any)}</Label>
            </div>
            <div className="flex items-center space-x-2">
              <RadioGroupItem value="reset" id="r-reset" />
              <Label htmlFor="r-reset">{t("dmActionReset" as any)}</Label>
            </div>
            <div className="flex items-center space-x-2">
              <RadioGroupItem value="import" id="r-import" />
              <Label htmlFor="r-import">{t("dmActionImport" as any)}</Label>
            </div>
          </RadioGroup>

          {willImport && (
            <div className="space-y-2">
              <Label>{t("dmSize" as any)}</Label>
              <Input type="number" min={5} max={500} value={size}
                onChange={(e) => setSize(Number(e.target.value) || 50)} />
            </div>
          )}
        </CardContent>
      </Card>

      {willImport && (
        <Card>
          <CardHeader>
            <CardTitle>{t("dmModulesTitle" as any)}</CardTitle>
            <CardDescription>{t("dmModulesDesc" as any)}</CardDescription>
          </CardHeader>
          <CardContent className="grid grid-cols-1 md:grid-cols-2 gap-3">
            {MODULE_KEYS.map((m) => (
              <label key={m.id} className="flex items-center gap-2 cursor-pointer">
                <Checkbox checked={selected.includes(m.id)} onCheckedChange={() => toggle(m.id)} />
                <span className="text-sm">{t(m.tk as any)}</span>
              </label>
            ))}
          </CardContent>
        </Card>
      )}

      {willImport && (
        <Card>
          <CardHeader>
            <CardTitle>Voter Configuration</CardTitle>
            <CardDescription>প্রতি কতজনে ১জন voter হবে এবং voter/account number ফরম্যাট সেট করুন। টোকেন: {"{seq:N}"}, {"{office}"}, {"{year}"}</CardDescription>
          </CardHeader>
          <CardContent className="grid grid-cols-1 md:grid-cols-3 gap-3">
            <div>
              <Label>Voter Ratio (1 in N)</Label>
              <Input type="number" min={1} max={20} value={voterRatio}
                onChange={(e) => setVoterRatio(Math.max(1, Number(e.target.value) || 3))} />
            </div>
            <div>
              <Label>Voter Number Format</Label>
              <Input value={voterNumberFormat} onChange={(e) => setVoterNumberFormat(e.target.value)} placeholder="V-{seq:5}" />
            </div>
            <div>
              <Label>Account Number Format</Label>
              <Input value={accountNumberFormat} onChange={(e) => setAccountNumberFormat(e.target.value)} placeholder="SAV-{seq:6}" />
            </div>
          </CardContent>
        </Card>
      )}

      {willImport && selected.includes("farmers") && (
        <Card>
          <CardHeader>
            <CardTitle>Real Farmer Names (CSV — Optional)</CardTitle>
            <CardDescription>
              CSV আপলোড করলে demo নামের বদলে এই নামগুলো ব্যবহার হবে। কলাম: <code>name_en, name_bn, father_name, mother_name, mobile, nid</code> (শুধু <code>name_en</code> বাধ্যতামূলক)। ডুপ্লিকেট NID/farmer_code স্বয়ংক্রিয়ভাবে স্কিপ হবে।
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-2">
            <Input type="file" accept=".csv,text/csv" onChange={async (e) => {
              const f = e.target.files?.[0];
              if (!f) { setCustomNames(null); setCsvFileName(""); return; }
              const txt = await f.text();
              const lines = txt.split(/\r?\n/).filter((l) => l.trim());
              if (!lines.length) { toast.error("CSV খালি"); return; }
              const header = lines[0].split(",").map((s) => s.trim().toLowerCase().replace(/^"|"$/g, ""));
              const idx = (k: string) => header.indexOf(k);
              const rows = lines.slice(1).map((line) => {
                const cols = line.split(",").map((s) => s.trim().replace(/^"|"$/g, ""));
                return {
                  en: cols[idx("name_en")] ?? "",
                  bn: cols[idx("name_bn")] ?? "",
                  father: cols[idx("father_name")] ?? "",
                  mother: cols[idx("mother_name")] ?? "",
                  mobile: cols[idx("mobile")] ?? "",
                  nid: cols[idx("nid")] ?? "",
                };
              }).filter((r) => r.en);
              if (!rows.length) { toast.error("name_en কলাম পাওয়া যায়নি"); return; }
              setCustomNames(rows);
              setCsvFileName(f.name);
              toast.success(`${rows.length} জন farmer নাম লোড হয়েছে`);
            }} />
            {customNames && (
              <div className="text-xs text-muted-foreground flex items-center gap-2">
                <Badge>{customNames.length} নাম লোড: {csvFileName}</Badge>
                <Button size="sm" variant="ghost" onClick={() => { setCustomNames(null); setCsvFileName(""); }}>সরান</Button>
              </div>
            )}
          </CardContent>
        </Card>
      )}

      <Button onClick={fetchPreview} disabled={loading} variant="outline" className="w-full" size="lg">
        {loading ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : <Eye className="h-4 w-4 mr-2" />}
        {t("dmPreviewBtn" as any)}
      </Button>


      {/* Live progress */}
      {loading && (
        <Card>
          <CardHeader>
            <CardTitle className="text-sm">{t("dmProgress" as any)}: {progress}%</CardTitle>
            <CardDescription>{currentStep}</CardDescription>
          </CardHeader>
          <CardContent className="space-y-3">
            <Progress value={progress} />
            <div className="max-h-64 overflow-y-auto space-y-1 text-xs">
              {stepLog.slice(-30).map((s, i) => (
                <div key={i} className="flex items-center gap-2">
                  {s.status === "running" && <Loader2 className="h-3 w-3 animate-spin text-muted-foreground" />}
                  {s.status === "done" && <CheckCircle2 className="h-3 w-3 text-primary" />}
                  {s.status === "error" && <XCircle className="h-3 w-3 text-destructive" />}
                  <span className={s.status === "error" ? "text-destructive" : ""}>{s.label}</span>
                  {s.message && <span className="text-destructive">— {s.message}</span>}
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}

      {/* Preview / Confirmation Dialog */}
      <Dialog open={previewOpen} onOpenChange={(o) => { if (!loading) setPreviewOpen(o); if (!o) setConfirmText(""); }}>
        <DialogContent className="max-w-2xl max-h-[85vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <AlertTriangle className="h-5 w-5 text-destructive" /> {t("dmConfirmTitle" as any)}
            </DialogTitle>
            <DialogDescription>
              {t("dmConfirmDesc" as any)}
            </DialogDescription>
          </DialogHeader>

          {preview && (
            <div className="space-y-4">
              {willWipe && (
                <div>
                  <h3 className="font-semibold text-destructive flex items-center gap-2 mb-2">
                    <Trash2 className="h-4 w-4" /> {t("dmWillDelete" as any)}
                  </h3>
                  {Object.keys(preview.wipe_preview ?? {}).length === 0 ? (
                    <p className="text-sm text-muted-foreground">{t("dmNoDataToWipe" as any)}</p>
                  ) : (
                    <div className="border rounded-md divide-y max-h-60 overflow-y-auto">
                      {Object.entries(preview.wipe_preview as Record<string, number>)
                        .sort((a, b) => b[1] - a[1])
                        .map(([table, count]) => (
                          <div key={table} className="flex justify-between px-3 py-2 text-sm">
                            <span className="font-mono">{table}</span>
                            <Badge variant="destructive">{count} {t("dmRows" as any)}</Badge>
                          </div>
                        ))}
                    </div>
                  )}
                </div>
              )}

              {willImport && (
                <div>
                  <h3 className="font-semibold text-primary flex items-center gap-2 mb-2">
                    <Database className="h-4 w-4" /> {t("dmWillImport" as any)}
                  </h3>
                  {Object.keys(preview.import_preview ?? {}).length === 0 ? (
                    <p className="text-sm text-muted-foreground">{t("dmNoModuleSelected" as any)}</p>
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

              {/* Mandatory typed confirmation */}
              <div className="space-y-2 pt-2 border-t">
                <Label className="text-destructive">
                  {t("dmConfirmTypeLabel" as any)}
                </Label>
                <Input
                  value={confirmText}
                  onChange={(e) => setConfirmText(e.target.value)}
                  placeholder="RESET"
                  autoComplete="off"
                />
              </div>
            </div>
          )}

          <DialogFooter>
            <Button variant="outline" onClick={() => setPreviewOpen(false)} disabled={loading}>{t("dmCancel" as any)}</Button>
            <Button variant="destructive" onClick={run} disabled={loading || confirmText !== "RESET"}>
              {loading ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : <Trash2 className="h-4 w-4 mr-2" />}
              {t("dmExecute" as any)}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {lastResult && !loading && (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              {lastResult.error ? (
                <><XCircle className="h-5 w-5 text-destructive" /> {t("dmFailed" as any)}</>
              ) : (
                <><CheckCircle2 className="h-5 w-5 text-primary" /> {t("dmSuccess" as any)}</>
              )}
            </CardTitle>
          </CardHeader>
          <CardContent>
            <pre className="text-xs overflow-auto bg-muted p-3 rounded max-h-60">
              {JSON.stringify(lastResult, null, 2)}
            </pre>
          </CardContent>
        </Card>
      )}

      {verification && !loading && (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              {verification.ok ? <CheckCircle2 className="h-5 w-5 text-primary" /> : <XCircle className="h-5 w-5 text-destructive" />}
              Voter Integrity Verification
            </CardTitle>
            <CardDescription>{verification.ok ? "সব ফার্মার ঠিকঠাক — non-voter দের কোনো সেভিং/লোন/শেয়ার নেই।" : `${verification.issues.length} টি সমস্যা পাওয়া গেছে`}</CardDescription>
          </CardHeader>
          {!verification.ok && (
            <CardContent>
              <ul className="text-xs text-destructive space-y-1 max-h-40 overflow-y-auto list-disc pl-5">
                {verification.issues.map((iss, i) => <li key={i}>{iss}</li>)}
              </ul>
            </CardContent>
          )}
        </Card>
      )}

      {locationVerification && !loading && (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              {locationVerification.ok ? <CheckCircle2 className="h-5 w-5 text-primary" /> : <XCircle className="h-5 w-5 text-destructive" />}
              Location Count Verification
            </CardTitle>
            <CardDescription>{locationVerification.ok ? "সব Division/District/Upazila/Mouza ঠিকঠাক sit হয়েছে।" : `${locationVerification.missing.length} টি গরমিল`}</CardDescription>
          </CardHeader>
          <CardContent>
            <table className="w-full text-xs border rounded">
              <thead className="bg-muted">
                <tr><th className="p-2 text-left">Table</th><th className="p-2 text-right">Expected</th><th className="p-2 text-right">Actual</th></tr>
              </thead>
              <tbody>
                {Object.keys(locationVerification.expected).map((k) => (
                  <tr key={k} className="border-t">
                    <td className="p-2 font-mono">{k}</td>
                    <td className="p-2 text-right">≥{locationVerification.expected[k]}</td>
                    <td className={`p-2 text-right ${locationVerification.actual[k] < locationVerification.expected[k] ? "text-destructive font-semibold" : ""}`}>{locationVerification.actual[k]}</td>
                  </tr>
                ))}
              </tbody>
            </table>
            {!locationVerification.ok && (
              <ul className="mt-2 text-xs text-destructive list-disc pl-5">
                {locationVerification.missing.map((m: string, i: number) => <li key={i}>{m}</li>)}
              </ul>
            )}
          </CardContent>
        </Card>
      )}

      {farmerSamples.length > 0 && !loading && (
        <Card>
          <CardHeader>
            <CardTitle>Import Summary — Farmer Samples ({farmerSamples.length})</CardTitle>
            <CardDescription>প্রথম কয়েকজন farmer-এর নাম (EN/BN) এবং mouza_id দেখুন।</CardDescription>
          </CardHeader>
          <CardContent>
            <table className="w-full text-xs border rounded">
              <thead className="bg-muted">
                <tr>
                  <th className="p-2 text-left">Code</th>
                  <th className="p-2 text-left">Name (EN)</th>
                  <th className="p-2 text-left" lang="bn">Name (BN)</th>
                  <th className="p-2 text-left">Mouza ID</th>
                </tr>
              </thead>
              <tbody>
                {farmerSamples.map((f, i) => (
                  <tr key={i} className="border-t">
                    <td className="p-2 font-mono">{f.farmer_code}</td>
                    <td className="p-2">{f.name_en}</td>
                    <td className="p-2" lang="bn">{f.name_bn}</td>
                    <td className="p-2 font-mono text-[10px]">{f.mouza_id?.slice(0, 8) ?? "—"}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </CardContent>
        </Card>
      )}

        <Card>
          <CardHeader>
            <CardTitle>Per-Farmer Seed Log ({seedLog.length})</CardTitle>
            <CardDescription>প্রতিটি ফার্মারের voter status এবং কোন মডিউলে seed হয়েছে</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="max-h-80 overflow-auto border rounded">
              <table className="w-full text-xs">
                <thead className="bg-muted sticky top-0">
                  <tr>
                    <th className="text-left p-2">Farmer Code</th>
                    <th className="text-left p-2">Voter</th>
                    <th className="text-left p-2">Voter No</th>
                    <th className="text-left p-2">Account No</th>
                    <th className="text-center p-2">Savings</th>
                    <th className="text-center p-2">Loans</th>
                    <th className="text-center p-2">Shares</th>
                  </tr>
                </thead>
                <tbody>
                  {seedLog.map((r, i) => (
                    <tr key={i} className="border-t">
                      <td className="p-2 font-mono">{r.farmer_code}</td>
                      <td className="p-2">{r.is_voter ? "✓" : "—"}</td>
                      <td className="p-2 font-mono">{r.voter_number ?? "—"}</td>
                      <td className="p-2 font-mono">{r.account_number ?? "—"}</td>
                      <td className="p-2 text-center">{r.savings_seeded ? "✓" : "—"}</td>
                      <td className="p-2 text-center">{r.loans_seeded ? "✓" : "—"}</td>
                      <td className="p-2 text-center">{r.shares_seeded ? "✓" : "—"}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Audit log */}
      <Card>
        <CardHeader className="flex-row items-center justify-between">
          <div>
            <CardTitle className="flex items-center gap-2"><Filter className="h-4 w-4" /> {t("dmAuditTitle" as any)}</CardTitle>
            <CardDescription>{(t("dmAuditCount" as any) as string).replace("{filtered}", String(filteredLogs.length)).replace("{total}", String(logs.length))}</CardDescription>
          </div>
          <div className="flex items-center gap-2">
            <Button variant="destructive" size="sm" disabled={clearing} onClick={async () => {
              if (!confirm("সব audit log মুছে ফেলবেন? এটা ফেরানো যাবে না।")) return;
              setClearing(true);
              try {
                const { data, error } = await supabase.functions.invoke("demo-reset", { body: { action: "clear_audit", confirm: "CLEAR" } });
                if (error) throw error;
                if ((data as any)?.error) throw new Error((data as any).error);
                toast.success("Audit logs cleared");
                await loadLogs();
              } catch (e: any) {
                toast.error(e?.message ?? "Clear failed");
              } finally { setClearing(false); }
            }}>
              {clearing ? <Loader2 className="h-4 w-4 animate-spin mr-1" /> : <Trash2 className="h-4 w-4 mr-1" />}
              Clear All Audit Logs
            </Button>
            <Button variant="ghost" size="sm" onClick={loadLogs} disabled={logsLoading}>
              <RefreshCw className={`h-4 w-4 ${logsLoading ? "animate-spin" : ""}`} />
            </Button>
          </div>
        </CardHeader>
        <CardContent className="space-y-4">
          {/* Filters */}
          <div className="grid grid-cols-1 md:grid-cols-5 gap-2">
            <div>
              <Label className="text-xs">{t("dmFilterFrom" as any)}</Label>
              <Input type="date" value={filterFrom} onChange={(e) => setFilterFrom(e.target.value)} />
            </div>
            <div>
              <Label className="text-xs">{t("dmFilterTo" as any)}</Label>
              <Input type="date" value={filterTo} onChange={(e) => setFilterTo(e.target.value)} />
            </div>
            <div>
              <Label className="text-xs">{t("dmFilterUser" as any)}</Label>
              <Input placeholder={t("dmFilterSearch" as any)} value={filterUser} onChange={(e) => setFilterUser(e.target.value)} />
            </div>
            <div>
              <Label className="text-xs">{t("dmFilterAction" as any)}</Label>
              <Select value={filterAction} onValueChange={setFilterAction}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">{t("dmFilterAll" as any)}</SelectItem>
                  <SelectItem value="reset">reset</SelectItem>
                  <SelectItem value="import">import</SelectItem>
                  <SelectItem value="both">both</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label className="text-xs">{t("dmFilterModule" as any)}</Label>
              <Select value={filterModule} onValueChange={setFilterModule}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">{t("dmFilterAll" as any)}</SelectItem>
                  {MODULE_KEYS.map((m) => <SelectItem key={m.id} value={m.id}>{t(m.tk as any)}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
          </div>

          {filteredLogs.length === 0 ? (
            <p className="text-sm text-muted-foreground text-center py-6">{t("dmNoLogs" as any)}</p>
          ) : (
            <div className="space-y-2 max-h-[500px] overflow-y-auto">
              {filteredLogs.map((l) => (
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
                    {l.ip && <span>{t("dmIp" as any)}: {l.ip}</span>}
                    {l.size != null && <span>{t("dmSizeLbl" as any)}: {l.size}</span>}
                    {l.modules?.length > 0 && <span>{t("dmModulesLbl" as any)}: {l.modules.map((mid: string) => { const mod = MODULE_KEYS.find(m => m.id === mid); return mod ? t(mod.tk as any) : mid; }).join(", ")}</span>}
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
