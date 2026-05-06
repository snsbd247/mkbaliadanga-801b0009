import { useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { toast } from "sonner";
import { Loader2, AlertTriangle, Database, Trash2 } from "lucide-react";
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger,
} from "@/components/ui/alert-dialog";

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

export default function DemoManager() {
  const [action, setAction] = useState<"reset" | "import" | "both">("both");
  const [size, setSize] = useState(50);
  const [selected, setSelected] = useState<string[]>(MODULES.map((m) => m.id));
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<any>(null);

  const toggle = (id: string) =>
    setSelected((s) => (s.includes(id) ? s.filter((x) => x !== id) : [...s, id]));

  const run = async () => {
    setLoading(true);
    setResult(null);
    try {
      const { data, error } = await supabase.functions.invoke("demo-reset", {
        body: { action, modules: selected, size, confirm: "RESET" },
      });
      if (error) throw error;
      if ((data as any)?.error) throw new Error((data as any).error);
      setResult(data);
      toast.success("Operation complete");
    } catch (e: any) {
      toast.error(e?.message ?? "Failed");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="container max-w-4xl py-6 space-y-6">
      <div>
        <h1 className="text-2xl font-bold flex items-center gap-2">
          <Database className="h-6 w-6" /> ডেমো ডেটা ম্যানেজার
        </h1>
        <p className="text-muted-foreground text-sm mt-1">
          সফটওয়্যার এর ডেমো ডেটা ইমপোর্ট অথবা সম্পূর্ণ রিসেট করুন। শুধুমাত্র super admin।
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

          {action !== "reset" && (
            <div className="space-y-2">
              <Label>ডেমো ডেটার আকার (ফার্মার সংখ্যা)</Label>
              <Input type="number" min={5} max={500} value={size}
                onChange={(e) => setSize(Number(e.target.value) || 50)} />
            </div>
          )}
        </CardContent>
      </Card>

      {action !== "reset" && (
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

      <AlertDialog>
        <AlertDialogTrigger asChild>
          <Button variant="destructive" disabled={loading} className="w-full" size="lg">
            {loading ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : <Trash2 className="h-4 w-4 mr-2" />}
            চালু করুন
          </Button>
        </AlertDialogTrigger>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>আপনি কি নিশ্চিত?</AlertDialogTitle>
            <AlertDialogDescription>
              এই অপারেশন: <b>{action === "reset" ? "শুধু রিসেট" : action === "import" ? "শুধু ইমপোর্ট" : "রিসেট + ইমপোর্ট"}</b>।
              {action !== "import" && " সব transactional ডেটা মুছে যাবে।"}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>বাতিল</AlertDialogCancel>
            <AlertDialogAction onClick={run}>হ্যাঁ, চালু করুন</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {result && (
        <Card>
          <CardHeader><CardTitle>ফলাফল</CardTitle></CardHeader>
          <CardContent>
            <pre className="text-xs overflow-auto bg-muted p-3 rounded max-h-96">
              {JSON.stringify(result, null, 2)}
            </pre>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
