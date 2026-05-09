import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { toast } from "sonner";
import { logAudit } from "@/lib/audit";
import { DEFAULT_DELAY_SETTINGS } from "@/lib/loanDelayFee";

export default function LoanDelaySettings() {
  const [row, setRow] = useState<any>({ ...DEFAULT_DELAY_SETTINGS, office_id: null });
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    (async () => {
      const { data: u } = await supabase.auth.getUser();
      const officeRes = await supabase.rpc("current_user_office" as any).single();
      const officeId = (officeRes.data as any) ?? null;
      const { data } = await supabase.from("loan_delay_fee_settings").select("*").eq("office_id", officeId as any).maybeSingle();
      setRow(data ?? { ...DEFAULT_DELAY_SETTINGS, office_id: officeId, created_by: u?.user?.id });
      setLoading(false);
    })();
  }, []);

  async function save() {
    setSaving(true);
    try {
      const { data: u } = await supabase.auth.getUser();
      const payload: any = {
        office_id: row.office_id ?? null,
        mode: row.mode,
        value: Number(row.value || 0),
        grace_days: Number(row.grace_days || 0),
        auto_apply: !!row.auto_apply,
        allow_partial_installment: !!row.allow_partial_installment,
        updated_by: u?.user?.id,
      };
      if (row.id) payload.id = row.id;
      const { data, error } = await supabase.from("loan_delay_fee_settings").upsert(payload).select("*").maybeSingle();
      if (error) throw error;
      setRow(data);
      await logAudit({ module: "other", action_type: "update", reference_id: data?.id, new_data: payload, office_id: payload.office_id });
      toast.success("সংরক্ষণ হয়েছে");
    } catch (e: any) {
      toast.error(e.message);
    } finally {
      setSaving(false);
    }
  }

  if (loading) return <div className="p-6 text-sm">লোড হচ্ছে…</div>;

  return (
    <div className="p-4 md:p-6 max-w-2xl mx-auto">
      <Card>
        <CardHeader><CardTitle>ঋণ কিস্তি জরিমানা সেটিংস</CardTitle></CardHeader>
        <CardContent className="space-y-4">
          <div className="grid grid-cols-2 gap-4">
            <div>
              <Label>মোড</Label>
              <select className="w-full h-10 border rounded-md px-3 bg-background"
                value={row.mode} onChange={(e) => setRow({ ...row, mode: e.target.value })}>
                <option value="flat">নির্দিষ্ট পরিমাণ (৳)</option>
                <option value="percent">শতাংশ (%)</option>
              </select>
            </div>
            <div>
              <Label>মান</Label>
              <Input type="number" step="0.01" value={row.value ?? 0} onChange={(e) => setRow({ ...row, value: e.target.value })} />
            </div>
            <div>
              <Label>রেয়াত দিন</Label>
              <Input type="number" value={row.grace_days ?? 0} onChange={(e) => setRow({ ...row, grace_days: e.target.value })} />
            </div>
          </div>
          <div className="flex items-center justify-between">
            <Label>স্বয়ংক্রিয় জরিমানা প্রয়োগ</Label>
            <Switch checked={!!row.auto_apply} onCheckedChange={(v) => setRow({ ...row, auto_apply: v })} />
          </div>
          <div className="flex items-center justify-between">
            <Label>আংশিক কিস্তি গ্রহণ অনুমতি</Label>
            <Switch checked={!!row.allow_partial_installment} onCheckedChange={(v) => setRow({ ...row, allow_partial_installment: v })} />
          </div>
          <p className="text-xs text-muted-foreground">
            ⚠️ "আংশিক কিস্তি গ্রহণ" বন্ধ থাকলে নির্ধারিত কিস্তির চেয়ে কম টাকা গ্রহণ করা যাবে না।
          </p>
          <Button onClick={save} disabled={saving}>সংরক্ষণ</Button>
        </CardContent>
      </Card>
    </div>
  );
}
