import { useEffect, useMemo, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { toast } from "sonner";
import { logAudit } from "@/lib/audit";
import {
  DEFAULT_DELAY_SETTINGS,
  computePenaltyBreakdown,
  type LoanDelayFeeSettings,
} from "@/lib/loanDelayFee";
import { useLang } from "@/i18n/LanguageProvider";

export default function LoanDelaySettings() {
  const { t } = useLang();
  const [row, setRow] = useState<any>({ ...DEFAULT_DELAY_SETTINGS, office_id: null });
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  // preview state
  const [previewAmount, setPreviewAmount] = useState(5000);
  const [previewDays, setPreviewDays] = useState(15);

  useEffect(() => {
    (async () => {
      const officeRes = await supabase.rpc("current_user_office" as any).single();
      const officeId = (officeRes.data as any) ?? null;
      const { data: u } = await supabase.auth.getUser();
      const q = supabase.from("loan_delay_fee_settings").select("*");
      const { data } = await (officeId ? q.eq("office_id", officeId as any) : q.is("office_id", null)).maybeSingle();
      setRow(data ?? { ...DEFAULT_DELAY_SETTINGS, office_id: officeId, created_by: u?.user?.id });
      setLoading(false);
    })();
  }, []);

  const settings: LoanDelayFeeSettings = useMemo(
    () => ({
      mode: row.mode ?? "flat",
      value: Number(row.value || 0),
      daily_penalty: Number(row.daily_penalty || 0),
      max_penalty: row.max_penalty != null ? Number(row.max_penalty) : null,
      grace_days: Number(row.grace_days || 0),
      auto_apply: !!row.auto_apply,
      allow_partial_installment: !!row.allow_partial_installment,
      enforcement_mode: row.enforcement_mode ?? "block",
    }),
    [row],
  );

  const breakdown = useMemo(() => {
    const today = new Date();
    const due = new Date(today.getTime() - previewDays * 86400000).toISOString().slice(0, 10);
    return computePenaltyBreakdown(
      { id: "_", installment_no: 1, amount: previewAmount, due_date: due },
      settings,
      today,
    );
  }, [settings, previewAmount, previewDays]);

  async function save() {
    setSaving(true);
    try {
      const { data: u } = await supabase.auth.getUser();
      const payload: any = {
        office_id: row.office_id ?? null,
        mode: row.mode,
        value: Number(row.value || 0),
        daily_penalty: Number(row.daily_penalty || 0),
        max_penalty: row.max_penalty === "" || row.max_penalty == null ? null : Number(row.max_penalty),
        grace_days: Number(row.grace_days || 0),
        auto_apply: !!row.auto_apply,
        allow_partial_installment: !!row.allow_partial_installment,
        enforcement_mode: row.enforcement_mode ?? "block",
        updated_by: u?.user?.id,
      };
      if (row.id) payload.id = row.id;
      const { data, error } = await supabase
        .from("loan_delay_fee_settings")
        .upsert(payload)
        .select("*")
        .maybeSingle();
      if (error) throw error;
      setRow(data);
      await logAudit({
        module: "other",
        action_type: "update",
        reference_id: data?.id,
        new_data: payload,
        office_id: payload.office_id,
      });
      toast.success(t("saved"));
    } catch (e: any) {
      toast.error(e.message);
    } finally {
      setSaving(false);
    }
  }

  if (loading) return <div className="p-6 text-sm">{t("loading")}</div>;

  return (
    <div className="p-4 md:p-6 max-w-4xl mx-auto space-y-4">
      <Card>
        <CardHeader>
          <CardTitle>{t("loanInstallmentPenaltySettings" as any)}</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <Label>{t("penaltyType")}</Label>
              <select
                className="w-full h-10 border rounded-md px-3 bg-background"
                value={row.mode}
                onChange={(e) => setRow({ ...row, mode: e.target.value })}
              >
                <option value="flat">{t("penaltyTypeFlat" as any)}</option>
                <option value="percent">{t("penaltyTypePercent" as any)}</option>
                <option value="daily">{t("penaltyTypeDaily" as any)}</option>
                <option value="combined">{t("penaltyTypeCombined" as any)}</option>
              </select>
            </div>
            <div>
              <Label>{t("valuePercentOrTaka" as any)}</Label>
              <Input
                type="number"
                step="0.01"
                value={row.value ?? 0}
                onChange={(e) => setRow({ ...row, value: e.target.value })}
              />
            </div>
            <div>
              <Label>{t("dailyPenalty" as any)}</Label>
              <Input
                type="number"
                step="0.01"
                value={row.daily_penalty ?? 0}
                onChange={(e) => setRow({ ...row, daily_penalty: e.target.value })}
              />
            </div>
            <div>
              <Label>{t("maxPenaltyCap" as any)}</Label>
              <Input
                type="number"
                step="0.01"
                value={row.max_penalty ?? ""}
                placeholder={t("unlimited" as any)}
                onChange={(e) => setRow({ ...row, max_penalty: e.target.value })}
              />
            </div>
            <div>
              <Label>{t("graceDays")}</Label>
              <Input
                type="number"
                value={row.grace_days ?? 0}
                onChange={(e) => setRow({ ...row, grace_days: e.target.value })}
              />
            </div>
            <div>
              <Label>{t("enforcementMode" as any)}</Label>
              <select
                className="w-full h-10 border rounded-md px-3 bg-background"
                value={row.enforcement_mode ?? "block"}
                onChange={(e) => setRow({ ...row, enforcement_mode: e.target.value })}
              >
                <option value="block">{t("enforcementBlock" as any)}</option>
                <option value="warn">{t("enforcementWarn" as any)}</option>
                <option value="allow">{t("enforcementAllow" as any)}</option>
              </select>
            </div>
          </div>
          <div className="flex items-center justify-between">
            <Label>{t("autoApplyPenalty" as any)}</Label>
            <Switch
              checked={!!row.auto_apply}
              onCheckedChange={(v) => setRow({ ...row, auto_apply: v })}
            />
          </div>
          <p className="text-xs text-muted-foreground">{t("enforcementHint" as any)}</p>
          <Button onClick={save} disabled={saving}>{t("save")}</Button>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>{t("previewPenaltyCalc" as any)}</CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          <div className="grid grid-cols-2 gap-4">
            <div>
              <Label>{t("installmentAmount" as any)}</Label>
              <Input type="number" value={previewAmount} onChange={(e) => setPreviewAmount(Number(e.target.value || 0))} />
            </div>
            <div>
              <Label>{t("overdueDaysLabel" as any)}</Label>
              <Input type="number" value={previewDays} onChange={(e) => setPreviewDays(Number(e.target.value || 0))} />
            </div>
          </div>
          <div className="text-sm space-y-1 rounded-md border p-3 bg-muted/30">
            <div>{t("overdueDaysAfterGrace" as any).replace("{n}", String(breakdown.overdueDays))}</div>
            <div>{t("fixedPart" as any).replace("{n}", String(breakdown.fixedPart))}</div>
            <div>{t("percentPart" as any).replace("{n}", String(breakdown.percentPart))}</div>
            <div>{t("dailyPart" as any).replace("{n}", String(breakdown.dailyPart))}</div>
            {breakdown.capped && <div className="text-warning">{t("cappedAtMax" as any)}</div>}
            <div className="font-bold pt-1 border-t">{t("totalPenalty" as any).replace("{n}", String(breakdown.total))}</div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
