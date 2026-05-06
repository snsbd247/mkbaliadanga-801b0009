import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/auth/AuthProvider";
import { useLang } from "@/i18n/LanguageProvider";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { toast } from "sonner";
import { Loader2, User as UserIcon, KeyRound, Mail, ShieldCheck, AlertCircle } from "lucide-react";
import { useNavigate } from "react-router-dom";
import { z } from "zod";
import { PasswordStrength } from "@/components/auth/PasswordStrength";
import { passwordIssues } from "@/lib/passwordPolicy";

const profileSchema = z.object({
  full_name: z
    .string()
    .trim()
    .min(2, "Full name must be at least 2 characters")
    .max(120, "Full name must be at most 120 characters")
    .regex(/^[\p{L}\p{M}.\-' ]+$/u, "Only letters, spaces, dots, hyphens and apostrophes"),
  username: z
    .string()
    .trim()
    .regex(/^[a-zA-Z0-9_.-]{3,30}$/, "3–30 chars; letters, digits, dot, underscore, hyphen"),
});

async function logAudit(user_id: string, action: string, meta: Record<string, any> = {}) {
  try {
    await supabase.from("audit_logs").insert({
      user_id,
      action,
      entity: "profile",
      entity_id: user_id,
      meta,
    });
  } catch {
    /* non-fatal */
  }
}

export default function Profile() {
  const { user, signOut, refresh } = useAuth();
  const { lang } = useLang();
  const navigate = useNavigate();
  const tr = (en: string, bn: string) => (lang === "bn" ? bn : en);

  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [fullName, setFullName] = useState("");
  const [username, setUsername] = useState("");
  const [originalEmail, setOriginalEmail] = useState("");
  const [email, setEmail] = useState("");

  const [pw, setPw] = useState("");
  const [pw2, setPw2] = useState("");
  const [pwSaving, setPwSaving] = useState(false);
  const [emailSaving, setEmailSaving] = useState(false);

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
      const e = data?.email ?? user.email ?? "";
      setEmail(e);
      setOriginalEmail(e);
      setLoading(false);
    })();
    return () => { cancel = true; };
  }, [user]);

  const saveProfile = async () => {
    if (!user) return;
    const parsed = profileSchema.safeParse({ full_name: fullName, username });
    if (!parsed.success) {
      const first = parsed.error.errors[0]?.message;
      return toast.error(first ?? tr("Validation failed", "যাচাইকরণ ব্যর্থ"));
    }
    // Username uniqueness check
    setSaving(true);
    const { data: dup } = await supabase
      .from("profiles")
      .select("id")
      .eq("username", parsed.data.username)
      .neq("id", user.id)
      .maybeSingle();
    if (dup) {
      setSaving(false);
      return toast.error(tr("Username already taken", "এই ইউজারনেম ইতিমধ্যে ব্যবহৃত"));
    }
    const { error } = await supabase
      .from("profiles")
      .update({
        full_name: parsed.data.full_name,
        username: parsed.data.username,
      })
      .eq("id", user.id);
    setSaving(false);
    if (error) { toast.error(error.message); return; }
    await logAudit(user.id, "profile.update", { full_name: parsed.data.full_name, username: parsed.data.username });
    toast.success(tr("Profile updated", "প্রোফাইল আপডেট হয়েছে"));
    refresh();
  };

  const changeEmail = async () => {
    if (!user) return;
    const emailParsed = z.string().trim().email().max(255).safeParse(email);
    if (!emailParsed.success) return toast.error(tr("Invalid email address", "অবৈধ ইমেইল ঠিকানা"));
    if (emailParsed.data === originalEmail) return toast.info(tr("Email unchanged", "ইমেইল পরিবর্তন হয়নি"));

    setEmailSaving(true);
    const { error } = await supabase.auth.updateUser(
      { email: emailParsed.data },
      { emailRedirectTo: `${window.location.origin}/` }
    );
    setEmailSaving(false);
    if (error) return toast.error(error.message);
    await logAudit(user.id, "profile.email_change_requested", { from: originalEmail, to: emailParsed.data });
    toast.success(
      tr(
        "Verification link sent. Please check both old and new inboxes to confirm the change.",
        "ভেরিফিকেশন লিংক পাঠানো হয়েছে। পুরোনো ও নতুন দুই ইমেইল ইনবক্স যাচাই করে নিশ্চিত করুন।"
      ),
      { duration: 8000 }
    );
  };

  const changePassword = async () => {
    if (!user) return;
    const issues = passwordIssues(pw, 10);
    if (issues.length) return toast.error(issues.join(" • "));
    if (pw !== pw2) return toast.error(tr("Passwords do not match", "পাসওয়ার্ড মিলছে না"));

    setPwSaving(true);
    const { error } = await supabase.auth.updateUser({ password: pw });
    if (error) {
      setPwSaving(false);
      return toast.error(error.message);
    }
    await logAudit(user.id, "profile.password_changed", { at: new Date().toISOString() });
    toast.success(
      tr(
        "Password changed. You will be signed out for security — please log in again.",
        "পাসওয়ার্ড পরিবর্তন হয়েছে। নিরাপত্তার জন্য সাইন-আউট করা হবে — আবার লগইন করুন।"
      ),
      { duration: 5000 }
    );
    setPw(""); setPw2("");
    setTimeout(async () => {
      await signOut();
      navigate("/auth", { replace: true });
    }, 1500);
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
            <Input value={fullName} onChange={(e) => setFullName(e.target.value)} maxLength={120} />
            <p className="text-xs text-muted-foreground">{tr("2–120 characters; letters, spaces, dots, hyphens.", "২–১২০ অক্ষর; অক্ষর, স্পেস, ডট, হাইফেন।")}</p>
          </div>
          <div className="grid gap-2">
            <Label>{tr("Username", "ইউজারনেম")}</Label>
            <Input value={username} onChange={(e) => setUsername(e.target.value)} maxLength={30} />
            <p className="text-xs text-muted-foreground">{tr("3–30 characters; letters, digits, . _ -", "৩–৩০ অক্ষর; অক্ষর, সংখ্যা, . _ -")}</p>
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
          <CardTitle className="flex items-center gap-2"><Mail className="h-5 w-5" /> {tr("Email Address", "ইমেইল ঠিকানা")}</CardTitle>
          <CardDescription>{tr("Update your email. A verification link will be sent.", "আপনার ইমেইল আপডেট করুন। ভেরিফিকেশন লিংক পাঠানো হবে।")}</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid gap-2">
            <Label>{tr("Email", "ইমেইল")}</Label>
            <Input type="email" value={email} onChange={(e) => setEmail(e.target.value)} maxLength={255} />
          </div>
          <Alert>
            <ShieldCheck className="h-4 w-4" />
            <AlertTitle>{tr("Verification required", "ভেরিফিকেশন প্রয়োজন")}</AlertTitle>
            <AlertDescription className="text-xs">
              {tr(
                "After saving, confirmation emails will be sent to both your old and new addresses. The change only takes effect after both are confirmed.",
                "সংরক্ষণের পরে পুরোনো ও নতুন উভয় ইমেইলে নিশ্চিতকরণ লিংক যাবে। উভয় নিশ্চিত হলেই পরিবর্তন কার্যকর হবে।"
              )}
            </AlertDescription>
          </Alert>
          <div className="flex justify-end">
            <Button onClick={changeEmail} disabled={emailSaving || email === originalEmail}>
              {emailSaving && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              {tr("Send Verification", "ভেরিফিকেশন পাঠান")}
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
            <PasswordStrength value={pw} minLen={10} />
          </div>
          <div className="grid gap-2">
            <Label>{tr("Confirm New Password", "নতুন পাসওয়ার্ড নিশ্চিত করুন")}</Label>
            <Input type="password" value={pw2} onChange={(e) => setPw2(e.target.value)} autoComplete="new-password" />
            {pw2 && pw !== pw2 && (
              <p className="text-xs text-destructive flex items-center gap-1"><AlertCircle className="h-3 w-3" /> {tr("Passwords do not match", "পাসওয়ার্ড মিলছে না")}</p>
            )}
          </div>
          <Alert>
            <ShieldCheck className="h-4 w-4" />
            <AlertDescription className="text-xs">
              {tr(
                "After changing your password, you will be automatically signed out and asked to sign in again.",
                "পাসওয়ার্ড পরিবর্তনের পরে স্বয়ংক্রিয়ভাবে সাইন-আউট হয়ে আবার লগইন করতে বলা হবে।"
              )}
            </AlertDescription>
          </Alert>
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
