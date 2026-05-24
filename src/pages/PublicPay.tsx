// Public-facing payment intent submission page (P-E3).
// i18n-ignore-file — public landing page
import { useEffect, useMemo, useState } from "react";
import { Navigate, useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { toast } from "sonner";
import { CheckCircle2, Loader2, ArrowLeft } from "lucide-react";

const sb = supabase as any;

export default function PublicPay() {
  // Farmer portal session gate — prevents anonymous false submissions from outside.
  const token = useMemo(() => localStorage.getItem("farmer_portal_token") ?? "", []);
  const expiresAt = useMemo(() => localStorage.getItem("farmer_portal_expires") ?? "", []);
  const expired = expiresAt ? Date.parse(expiresAt) < Date.now() : false;
  const nav = useNavigate();
  if (!token || expired) {
    return <Navigate to="/" replace />;
  }

  const [form, setForm] = useState({
    farmer_code: "", phone: "", amount: 0, allocation_hint: "irrigation", note: "",
  });
  const [lookup, setLookup] = useState<{ name?: string; code?: string } | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [done, setDone] = useState<string | null>(null);

  async function lookupFarmer() {
    if (!form.farmer_code.trim()) return;
    const { data } = await sb.from("farmers")
      .select("name_en, name_bn, farmer_code")
      .eq("farmer_code", form.farmer_code.trim())
      .maybeSingle();
    if (!data) { setLookup(null); toast.error("কোডটি পাওয়া যায়নি"); return; }
    setLookup({ name: data.name_bn || data.name_en, code: data.farmer_code });
  }

  async function submit() {
    if (!form.farmer_code.trim()) return toast.error("কৃষক কোড দিন");
    if (!form.amount || form.amount <= 0) return toast.error("টাকার পরিমাণ দিন");
    setSubmitting(true);
    try {
      const { data, error } = await sb.from("public_payment_intents").insert({
        farmer_code: form.farmer_code.trim(),
        phone: form.phone || null,
        amount: form.amount,
        allocation_hint: form.allocation_hint,
        note: form.note || null,
      }).select("id").single();
      if (error) throw error;
      setDone(data.id);
    } catch (e: any) {
      toast.error(e.message || "Failed");
    } finally {
      setSubmitting(false);
    }
  }

  if (done) {
    return (
      <div className="min-h-screen flex items-center justify-center p-4 bg-muted/30">
        <Card className="p-8 max-w-md w-full text-center space-y-4">
          <CheckCircle2 className="h-16 w-16 text-success mx-auto" />
          <h2 className="text-xl font-semibold">পেমেন্ট অনুরোধ জমা হয়েছে</h2>
          <p className="text-sm text-muted-foreground">
            আপনার রেফারেন্স: <span className="font-mono">{done.slice(0, 8).toUpperCase()}</span>
          </p>
          <p className="text-sm">অফিস কর্তৃপক্ষ যাচাই করে আপনাকে রসিদ প্রদান করবে।</p>
          <Button onClick={() => { setDone(null); setForm({ farmer_code: "", phone: "", amount: 0, allocation_hint: "irrigation", note: "" }); setLookup(null); }} variant="outline">নতুন অনুরোধ</Button>
        </Card>
      </div>
    );
  }

  return (
    <div className="min-h-screen flex items-center justify-center p-4 bg-muted/30">
      <Card className="p-6 max-w-md w-full space-y-4">
        <div className="text-center">
          <h1 className="text-2xl font-bold">পেমেন্ট অনুরোধ জমা দিন</h1>
          <p className="text-xs text-muted-foreground mt-1">MK Baliadanga • অনলাইন পেমেন্ট পোর্টাল</p>
        </div>

        <div className="space-y-3">
          <div>
            <Label>কৃষক কোড</Label>
            <div className="flex gap-2">
              <Input value={form.farmer_code} onChange={(e) => setForm({ ...form, farmer_code: e.target.value })} placeholder="2026-00000123" onBlur={lookupFarmer} />
              <Button type="button" variant="outline" onClick={lookupFarmer}>খুঁজুন</Button>
            </div>
            {lookup && <p className="text-xs text-success mt-1">✓ {lookup.name}</p>}
          </div>
          <div>
            <Label>মোবাইল</Label>
            <Input value={form.phone} onChange={(e) => setForm({ ...form, phone: e.target.value })} placeholder="01XXXXXXXXX" />
          </div>
          <div>
            <Label>টাকার পরিমাণ (৳)</Label>
            <Input type="number" value={form.amount || ""} onChange={(e) => setForm({ ...form, amount: Number(e.target.value) })} />
          </div>
          <div>
            <Label>কী জন্য পরিশোধ?</Label>
            <Select value={form.allocation_hint} onValueChange={(v) => setForm({ ...form, allocation_hint: v })}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="irrigation">সেচ বিল</SelectItem>
                <SelectItem value="loan">ঋণ কিস্তি</SelectItem>
                <SelectItem value="savings">সঞ্চয়</SelectItem>
                <SelectItem value="other">অন্যান্য</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div>
            <Label>মন্তব্য</Label>
            <Input value={form.note} onChange={(e) => setForm({ ...form, note: e.target.value })} placeholder="ঐচ্ছিক" />
          </div>
          <Button onClick={submit} disabled={submitting} className="w-full">
            {submitting ? <Loader2 className="h-4 w-4 animate-spin" /> : "অনুরোধ জমা দিন"}
          </Button>
          <p className="text-xs text-muted-foreground text-center">এটি একটি অনুরোধ। প্রকৃত রসিদ অফিস হতে প্রদান করা হবে।</p>
        </div>
      </Card>
    </div>
  );
}
