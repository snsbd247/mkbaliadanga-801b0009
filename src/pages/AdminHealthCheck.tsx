import { useEffect, useState } from "react";
import { db } from "@/lib/db";
import { PageHeader } from "@/components/layout/PageHeader";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { useLang } from "@/i18n/LanguageProvider";
import { CheckCircle2, XCircle, Loader2, RefreshCw } from "lucide-react";

type Status = "checking" | "ok" | "down";

// Edge functions the Users & Roles / admin features depend on, with a safe probe payload.
const CHECKS: Array<{ name: string; probe: Record<string, unknown> }> = [
  { name: "admin-users", probe: { action: "__healthcheck__" } },
  { name: "irrigation-missing-rates", probe: { season_id: "__healthcheck__" } },
];

export default function AdminHealthCheck() {
  const { t } = useLang();
  const [results, setResults] = useState<Record<string, Status>>({});
  const [running, setRunning] = useState(false);

  async function runChecks() {
    setRunning(true);
    setResults(Object.fromEntries(CHECKS.map((c) => [c.name, "checking" as Status])));
    await Promise.all(
      CHECKS.map(async (c) => {
        try {
          const { error } = await db.functions.invoke(c.name, { body: c.probe });
          // A function that responds (even with a validation error) is deployed & healthy.
          // Only a transport-level failure ("not available", network) means it's down.
          const raw = String(error?.message ?? "");
          const down = /not available on this server|Failed to (send|fetch)|Function not found|failed to reach|network/i.test(raw);
          setResults((prev) => ({ ...prev, [c.name]: down ? "down" : "ok" }));
        } catch {
          setResults((prev) => ({ ...prev, [c.name]: "down" }));
        }
      }),
    );
    setRunning(false);
  }

  useEffect(() => { document.title = `${t("edgeHealthTitle")} — ${t("appName")}`; runChecks(); }, []);

  return (
    <div className="space-y-4">
      <PageHeader title={t("edgeHealthTitle")} subtitle={t("edgeHealthSubtitle")} />
      <div className="flex justify-end">
        <Button variant="outline" size="sm" onClick={runChecks} disabled={running}>
          <RefreshCw className={`h-4 w-4 mr-1 ${running ? "animate-spin" : ""}`} /> {t("edgeHealthRecheck")}
        </Button>
      </div>
      <Card>
        <CardContent className="pt-6 space-y-3">
          {CHECKS.map((c) => {
            const s = results[c.name] ?? "checking";
            return (
              <div key={c.name} className="flex items-center justify-between rounded-md border p-3">
                <span className="font-mono text-sm">{c.name}</span>
                {s === "checking" && (
                  <Badge variant="secondary" className="gap-1"><Loader2 className="h-3.5 w-3.5 animate-spin" /> {t("edgeHealthChecking")}</Badge>
                )}
                {s === "ok" && (
                  <Badge className="gap-1 bg-emerald-600 hover:bg-emerald-600"><CheckCircle2 className="h-3.5 w-3.5" /> {t("edgeHealthOk")}</Badge>
                )}
                {s === "down" && (
                  <Badge variant="destructive" className="gap-1"><XCircle className="h-3.5 w-3.5" /> {t("edgeHealthDown")}</Badge>
                )}
              </div>
            );
          })}
          <p className="text-xs text-muted-foreground">{t("edgeHealthHint")}</p>
        </CardContent>
      </Card>
    </div>
  );
}
