import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/auth/AuthProvider";
import { useLang } from "@/i18n/LanguageProvider";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { toast } from "sonner";
import { Loader2, User as UserIcon, KeyRound } from "lucide-react";

export default function Profile() {
  const { user, refresh } = useAuth();
  const { lang } = useLang();
  const tr = (en: string, bn: string) => (lang === "bn" ? bn : en);

  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [fullName, setFullName] = useState("");
  const [username, setUsername] = useState("");
  const [email, setEmail] = useState("");

  const [pw, setPw] = useState("");
  const [pw2, setPw2] = useState("");
  const [pwSaving, setPwSaving] = useState(false);

  useEffect(() => {
    let cancel = false;
    (async () => {
      if (!user) return;
      const { data, error } = await supabase
        .from("profiles")
        .select("full_name, username, email")
        .eq("id", user.id)
        .maybeSingle();
      if (cancel) return;
      if (error) toast.error(error.message);
      setFullName(data?.full_name ?? "");
      setUsername(data?.username ?? "");
      setEmail(data?.email ?? user.email ?? "");
      setLoading(false);
    })();
    return () => { cancel = true; };
  }, [user]);

  const saveProfile = async () => {
    if (!user) return;
    setSaving(true);
    const { error } = await supabase
      .from("profiles")
      .upsert({
        id: user.id,
        full_name: fullName.trim() || null,
        username: username.trim() || null,
        email: email.trim() || null,
      }, { onConflict: "id" });
    setSaving(false);
    if (error) { toast.error(error.message); return; }
    toast.success(tr("Profile updated", "প্রোফাইল আপডেট হয়েছে"));
    refresh();
  };

  const changePassword = async () => {
    if (pw.length < 6) {
      toast.error(tr("Password must be at least 6 characters", "পাসওয়ার্ড কমপক্ষে ৬ অক্ষরের হতে হবে"));
      return;
    }
    if (pw !== pw2) {
      toast.error(tr("Passwords do not match", "পাসওয়ার্ড মিলছে না"));
      return;
    }
    setPwSaving(true);
    const { error } = await supabase.auth.updateUser({ password: pw });
    setPwSaving(false);
    if (error) { toast.error(error.message); return; }
    setPw(""); setPw2("");
    toast.success(tr("Password changed", "পাসওয়ার্ড পরিবর্তন হয়েছে"));
  };

  if (loading) {
    return <div className="flex h-64 items-center justify-center text-muted-foreground"><Loader2 className="h-5 w-5 animate-spin" /></div>;
  }

  return (
    <div className="mx-auto max-w-2xl space-y-6">
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2"><UserIcon className="h-5 w-5" /> {tr("Your Profile", "আপনার প্রোফাইল")}</CardTitle>
          <CardDescription>{tr("Update your personal information.", "আপনার ব্যক্তিগত তথ্য আপডেট করুন।")}</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid gap-2">
            <Label>{tr("Full Name", "পূর্ণ নাম")}</Label>
            <Input value={fullName} onChange={(e) => setFullName(e.target.value)} />
          </div>
          <div className="grid gap-2">
            <Label>{tr("Username", "ইউজারনেম")}</Label>
            <Input value={username} onChange={(e) => setUsername(e.target.value)} />
          </div>
          <div className="grid gap-2">
            <Label>{tr("Email", "ইমেইল")}</Label>
            <Input type="email" value={email} disabled />
            <p className="text-xs text-muted-foreground">{tr("Contact admin to change email.", "ইমেইল পরিবর্তনের জন্য অ্যাডমিনের সাথে যোগাযোগ করুন।")}</p>
          </div>
          <div className="flex justify-end">
            <Button onClick={saveProfile} disabled={saving}>
              {saving && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              {tr("Save Changes", "সংরক্ষণ করুন")}
            </Button>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2"><KeyRound className="h-5 w-5" /> {tr("Change Password", "পাসওয়ার্ড পরিবর্তন")}</CardTitle>
          <CardDescription>{tr("Set a new password for your account.", "আপনার অ্যাকাউন্টের নতুন পাসওয়ার্ড সেট করুন।")}</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid gap-2">
            <Label>{tr("New Password", "নতুন পাসওয়ার্ড")}</Label>
            <Input type="password" value={pw} onChange={(e) => setPw(e.target.value)} autoComplete="new-password" />
          </div>
          <div className="grid gap-2">
            <Label>{tr("Confirm New Password", "নতুন পাসওয়ার্ড নিশ্চিত করুন")}</Label>
            <Input type="password" value={pw2} onChange={(e) => setPw2(e.target.value)} autoComplete="new-password" />
          </div>
          <div className="flex justify-end">
            <Button onClick={changePassword} disabled={pwSaving || !pw || !pw2}>
              {pwSaving && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              {tr("Update Password", "পাসওয়ার্ড আপডেট")}
            </Button>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
