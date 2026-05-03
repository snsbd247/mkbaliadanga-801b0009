import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { MessageSquare, CheckCircle2, XCircle, AlertTriangle, Clock } from "lucide-react";

type Status = {
  configured: boolean;
  enabled: boolean;
  sender_id: string | null;
  expires_at: string | null;
  days_to_expiry: number | null;
  expired: boolean;
  activated_at: string | null;
  last_updated: string | null;
  last_updater: string | null;
  staged_count: number;
  last_test: { ok: boolean; tested_at: string; response?: string } | null;
};

/**
 * Compact dashboard tile showing SMS provider readiness.
 * Pulls from the get_sms_provider_status RPC, which returns no token bytes
 * — safe for any authenticated admin to view.
 */
export function SmsProviderStatusCard() {
  const [s, setS] = useState<Status | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let alive = true;
    (async () => {
      const { data, error } = await supabase.rpc("get_sms_provider_status" as any, { _provider: "greenweb" } as any);
      if (!alive) return;
      if (!error && data) setS(data as unknown as Status);
      setLoading(false);
    })();
    return () => { alive = false; };
  }, []);

  if (loading) {
    return (
      <Card className="p-4 animate-pulse">
        <div className="h-4 w-24 bg-muted rounded mb-2" />
        <div className="h-6 w-32 bg-muted rounded" />
      </Card>
    );
  }
  if (!s) return null;

  // Determine status pill
  let pill: { label: string; cls: string; icon: any };
  if (!s.configured) {
    pill = { label: "No active token", cls: "bg-destructive text-destructive-foreground", icon: XCircle };
  } else if (s.expired) {
    pill = { label: "Token expired", cls: "bg-destructive text-destructive-foreground", icon: XCircle };
  } else if (!s.enabled) {
    pill = { label: "SMS disabled", cls: "bg-muted text-muted-foreground", icon: XCircle };
  } else if (s.days_to_expiry !== null && s.days_to_expiry < 14) {
    pill = { label: `Expires in ${s.days_to_expiry}d`, cls: "bg-amber-500 text-white", icon: AlertTriangle };
  } else {
    pill = { label: "Ready", cls: "bg-emerald-600 text-white", icon: CheckCircle2 };
  }
  const PillIcon = pill.icon;

  return (
    <Link to="/sms-settings" className="block">
      <Card className="p-4 hover:bg-accent/40 transition-colors">
        <div className="flex items-center justify-between gap-2 mb-2">
          <div className="flex items-center gap-1.5 text-sm font-medium">
            <MessageSquare className="h-4 w-4 text-muted-foreground" />
            SMS Provider
          </div>
          <Badge className={pill.cls}>
            <PillIcon className="h-3 w-3 mr-1" />
            {pill.label}
          </Badge>
        </div>
        <div className="space-y-0.5 text-xs text-muted-foreground">
          {s.sender_id && <div>Sender: <span className="text-foreground font-mono">{s.sender_id}</span></div>}
          {s.last_updated && (
            <div>Updated {new Date(s.last_updated).toLocaleDateString()} {s.last_updater ? `· ${s.last_updater}` : ""}</div>
          )}
          {s.staged_count > 0 && (
            <div className="text-amber-600">{s.staged_count} staged token{s.staged_count > 1 ? "s" : ""} waiting</div>
          )}
          {s.last_test?.tested_at && (
            <div className="flex items-center gap-1">
              <Clock className="h-3 w-3" />
              Last test: {s.last_test.ok ? "OK" : "Failed"} · {new Date(s.last_test.tested_at).toLocaleDateString()}
            </div>
          )}
        </div>
      </Card>
    </Link>
  );
}
