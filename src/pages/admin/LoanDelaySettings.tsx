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

export default function LoanDelaySettings() {
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
      const { data } = await supabase
        .from("loan_delay_fee_settings")
        .select("*")
        .eq("office_id", officeId as any)
        .maybeSingle();
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
      toast.success("সংরক্ষণ হয়েছে");
    } catch (e: any) {
      toast.error(e.message);
    } finally {
      setSaving(false);
    }
  }

  if (loading) return <div className="p-6 text-sm">লোড হচ্ছে…</div>;

  return (
    <div className="p-4 md:p-6 max-w-4xl mx-auto space-y-4">
      <Card>
        <CardHeader>
          <CardTitle>ঋণ কিস্তি জরিমানা সেটিংস</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <Label>জরিমানার ধরন</Label>
              <select
                className="w-full h-10 border rounded-md px-3 bg-background"
                value={row.mode}
                onChange={(e) => setRow({ ...row, mode: e.target.value })}
              >
                <option value="flat">নির্দিষ্ট পরিমাণ (৳)</option>
                <option value="percent">শতাংশ (%)</option>
                <option value="daily">দৈনিক (৳/দিন)</option>
                <option value="combined">মিলিত (% + দৈনিক)</option>
              </select>
            </div>
            <div>
              <Label>মান (% অথবা ৳)</Label>
              <Input
                type="number"
                step="0.01"
                value={row.value ?? 0}
                onChange={(e) => setRow({ ...row, value: e.target.value })}
              />
            </div>
            <div>
              <Label>দৈনিক জরিমানা (৳/দিন)</Label>
              <Input
                type="number"
                step="0.01"
                value={row.daily_penalty ?? 0}
                onChange={(e) => setRow({ ...row, daily_penalty: e.target.value })}
              />
            </div>
            <div>
              <Label>সর্বোচ্চ জরিমানা সীমা (৳)</Label>
              <Input
                type="number"
                step="0.01"
                value={row.max_penalty ?? ""}
                placeholder="সীমাহীন"
                onChange={(e) => setRow({ ...row, max_penalty: e.target.value })}
              />
            </div>
            <div>
              <Label>রেয়াত দিন</Label>
              <Input
                type="number"
                value={row.grace_days ?? 0}
                onChange={(e) => setRow({ ...row, grace_days: e.target.value })}
              />
            </div>
            <div>
              <Label>প্রয়োগ পদ্ধতি</Label>
              <select
                className="w-full h-10 border rounded-md px-3 bg-background"
                value={row.enforcement_mode ?? "block"}
                onChange={(e) => setRow({ ...row, enforcement_mode: e.target.value })}
              >
                <option value="block">আংশিক পেমেন্ট ব্লক</option>
                <option value="warn">শুধু সতর্ক করুন</option>
                <option value="allow">আংশিক অনুমতি (override প্রয়োজন)</option>
              </select>
            </div>
          </div>
          <div className="flex items-center justify-between">
            <Label>স্বয়ংক্রিয় জরিমানা প্রয়োগ</Label>
            <Switch
              checked={!!row.auto_apply}
              onCheckedChange={(v) => setRow({ ...row, auto_apply: v })}
            />
          </div>
          <p className="text-xs text-muted-foreground">
            ⚠️ প্রয়োগ পদ্ধতি "block" থাকলে নির্ধারিত কিস্তির চেয়ে কম টাকা গ্রহণ করা যাবে না।
            "warn" → সতর্কবার্তা দেখাবে। "allow" → override কারণ ও অডিট লগ প্রয়োজন।
          </p>
          <Button onClick={save} disabled={saving}>সংরক্ষণ</Button>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>প্রিভিউ — জরিমানা হিসাব</CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          <div className="grid grid-cols-2 gap-4">
            <div>
              <Label>কিস্তির পরিমাণ (৳)</Label>
              <Input type="number" value={previewAmount} onChange={(e) => setPreviewAmount(Number(e.target.value || 0))} />
            </div>
            <div>
              <Label>বিলম্বিত দিন</Label>
              <Input type="number" value={previewDays} onChange={(e) => setPreviewDays(Number(e.target.value || 0))} />
            </div>
          </div>
          <div className="text-sm space-y-1 rounded-md border p-3 bg-muted/30">
            <div>বিলম্বিত দিন: <b>{breakdown.overdueDays}</b> (রেয়াত বাদে)</div>
            <div>নির্দিষ্ট অংশ: ৳ {breakdown.fixedPart}</div>
            <div>শতাংশ অংশ: ৳ {breakdown.percentPart}</div>
            <div>দৈনিক অংশ: ৳ {breakdown.dailyPart}</div>
            {breakdown.capped && <div className="text-warning">⚠ সর্বোচ্চ সীমায় কাটা হয়েছে</div>}
            <div className="font-bold pt-1 border-t">মোট জরিমানা: ৳ {breakdown.total}</div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
