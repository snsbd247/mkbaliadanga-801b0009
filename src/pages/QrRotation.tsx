import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/auth/AuthProvider";
import { PageHeader } from "@/components/layout/PageHeader";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Loader2, Save, Play, RefreshCw } from "lucide-react";
import { toast } from "sonner";
import { useLang } from "@/i18n/LanguageProvider";

interface Settings {
  enabled: boolean;
  interval_days: number;
  grace_hours: number;
  last_run_at: string | null;
  last_run_summary: any;
}

export default function QrRotation() {
  const { isSuper } = useAuth();
  const { t } = useLang();
  const [settings, setSettings] = useState<Settings | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [running, setRunning] = useState(false);

  useEffect(() => {
    document.title = "QR Token Rotation";
    load();
  }, []);

  async function load() {
    setLoading(true);
    const { data, error } = await supabase
      .from("qr_rotation_settings").select("*").eq("id", 1).maybeSingle();
    if (error) toast.error(error.message);
    setSettings((data as any) ?? { enabled: false, interval_days: 90, grace_hours: 24, last_run_at: null, last_run_summary: null });
    setLoading(false);
  }

  async function save() {
    if (!settings) return;
    setSaving(true);
    try {
      const { error } = await supabase
        .from("qr_rotation_settings")
        .update({
          enabled: settings.enabled,
          interval_days: settings.interval_days,
          grace_hours: settings.grace_hours,
          updated_at: new Date().toISOString(),
        })
        .eq("id", 1);
      if (error) { toast.error(error.message); return; }
      toast.success(t("p5c_settingsSaved"));
    } finally { setSaving(false); }
  }

  async function runNow() {
    setRunning(true);
    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) { toast.error(t("p5b_pleaseSignIn")); return; }
      const res = await fetch(`${import.meta.env.VITE_SUPABASE_URL}/functions/v1/qr-rotate-scheduled`, {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${session.access_token}` },
        body: JSON.stringify({ force: true }),
      });
      const j = await res.json();
      if (!res.ok) { toast.error(j?.error || t("p5b_failed")); return; }
      toast.success(`${t("p5c_rotated")} ${j.rotated} • ${t("p5c_revoked")} ${j.revoked}`);
      await load();
    } finally { setRunning(false); }
  }

  if (!isSuper) {
    return (
      <>
        <PageHeader title={t("p5c_qrRotationTitle")} />
        <Alert variant="destructive"><AlertDescription>{t("p5b_superAdminOnly")}</AlertDescription></Alert>
      </>
    );
  }

  if (loading || !settings) {
    return <div className="flex items-center justify-center py-20"><Loader2 className="h-6 w-6 animate-spin" /></div>;
  }

  return (
    <>
      <PageHeader
        title={t("p5c_qrRotationTitle")}
        description={t("p5c_qrRotationDesc")}
        actions={
          <Button variant="outline" size="sm" onClick={load}><RefreshCw className="h-4 w-4" />{t("p5c_refresh")}</Button>
        }
      />

      <Card className="p-4 mb-4">
        <div className="space-y-4 max-w-xl">
          <div className="flex items-center justify-between">
            <div>
              <Label htmlFor="enabled" className="font-semibold">Enable scheduled rotation</Label>
              <p className="text-xs text-muted-foreground">When enabled, the daily cron job rotates tokens older than the interval below.</p>
            </div>
            <Switch
              id="enabled"
              checked={settings.enabled}
              onCheckedChange={(v) => setSettings({ ...settings, enabled: v })}
            />
          </div>

          <div className="grid gap-3 md:grid-cols-2">
            <div>
              <Label>Rotation interval (days)</Label>
              <Input
                type="number" min={1} max={3650}
                value={settings.interval_days}
                onChange={(e) => setSettings({ ...settings, interval_days: Math.max(1, Number(e.target.value) || 90) })}
              />
              <p className="text-xs text-muted-foreground mt-1">Tokens older than this are reissued.</p>
            </div>
            <div>
              <Label>Grace window (hours)</Label>
              <Input
                type="number" min={0} max={720}
                value={settings.grace_hours}
                onChange={(e) => setSettings({ ...settings, grace_hours: Math.max(0, Number(e.target.value) || 24) })}
              />
              <p className="text-xs text-muted-foreground mt-1">Old token keeps working for this long before being revoked.</p>
            </div>
          </div>

          <div className="flex gap-2 pt-2">
            <Button onClick={save} disabled={saving}>
              {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}Save settings
            </Button>
            <Button variant="outline" onClick={runNow} disabled={running}>
              {running ? <Loader2 className="h-4 w-4 animate-spin" /> : <Play className="h-4 w-4" />}Run now
            </Button>
          </div>
        </div>
      </Card>

      <Card className="p-4">
        <h3 className="font-semibold mb-2">Last run</h3>
        {settings.last_run_at ? (
          <div className="text-sm space-y-1">
            <div><span className="text-muted-foreground">When:</span> {new Date(settings.last_run_at).toLocaleString()}</div>
            <div><span className="text-muted-foreground">Rotated:</span> {settings.last_run_summary?.rotated ?? 0}</div>
            <div><span className="text-muted-foreground">Revoked:</span> {settings.last_run_summary?.revoked ?? 0}</div>
          </div>
        ) : (
          <div className="text-sm text-muted-foreground">No rotation run yet.</div>
        )}
      </Card>
    </>
  );
}
