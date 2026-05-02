import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { Sprout } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { useAuth } from "@/auth/AuthProvider";
import { useLang } from "@/i18n/LanguageProvider";
import { useBranding } from "@/lib/branding";

export default function AuthPage() {
  const nav = useNavigate();
  const { user } = useAuth();
  const { t, lang, setLang } = useLang();
  const brand = useBranding();
  const [identifier, setIdentifier] = useState("");
  const [password, setPassword] = useState("");
  const [fullName, setFullName] = useState("");
  const [username, setUsername] = useState("");
  const [signupEmail, setSignupEmail] = useState("");
  const [busy, setBusy] = useState(false);

  useEffect(() => { document.title = `${t("login")} — ${brand.company_name}`; }, [t, brand.company_name]);
  useEffect(() => { if (user) nav("/", { replace: true }); }, [user, nav]);

  async function resolveEmail(input: string): Promise<string | null> {
    if (input.includes("@")) return input;
    const { data, error } = await supabase.rpc("email_for_username", { _username: input });
    if (error) return null;
    return (data as string) || null;
  }

  const signIn = async (e: React.FormEvent) => {
    e.preventDefault();
    setBusy(true);
    const email = await resolveEmail(identifier.trim());
    if (!email) { setBusy(false); return toast.error("Username not found"); }
    const { error } = await supabase.auth.signInWithPassword({ email, password });
    setBusy(false);
    if (error) toast.error(error.message);
    else { toast.success(t("welcomeBack")); nav("/", { replace: true }); }
  };

  const signUp = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!username.trim()) return toast.error("Username required");
    setBusy(true);
    const { data, error } = await supabase.auth.signUp({
      email: signupEmail,
      password,
      options: {
        emailRedirectTo: `${window.location.origin}/`,
        data: { full_name: fullName, username: username.trim() },
      },
    });
    if (!error && data.user) {
      // Save username on profile (handle_new_user creates the row)
      await supabase.from("profiles").update({ username: username.trim() }).eq("id", data.user.id);
    }
    setBusy(false);
    if (error) toast.error(error.message);
    else toast.success("Account created — check your email if confirmation is required.");
  };

  return (
    <div className="flex min-h-screen items-center justify-center bg-gradient-surface p-4">
      <div className="w-full max-w-md">
        <div className="mb-6 text-center">
          {brand.logo_url ? (
            <img src={brand.logo_url} alt={brand.company_name} className="mx-auto mb-3 h-14 w-14 rounded-xl object-cover shadow-elegant" />
          ) : (
            <div className="mx-auto mb-3 flex h-14 w-14 items-center justify-center rounded-xl bg-gradient-primary text-primary-foreground shadow-elegant">
              <Sprout className="h-7 w-7" />
            </div>
          )}
          <h1 className="text-2xl font-bold">{lang === "bn" && brand.company_name_bn ? brand.company_name_bn : brand.company_name}</h1>
          <p className="text-sm text-muted-foreground mt-1">Cooperative Management System</p>
          <button onClick={() => setLang(lang === "en" ? "bn" : "en")} className="mt-2 text-xs text-primary underline">
            {lang === "en" ? "বাংলা" : "English"}
          </button>
        </div>

        <Card className="p-6 shadow-elegant">
          <Tabs defaultValue="signin">
            <TabsList className="grid w-full grid-cols-2">
              <TabsTrigger value="signin">{t("login")}</TabsTrigger>
              <TabsTrigger value="signup">{t("signup")}</TabsTrigger>
            </TabsList>

            <TabsContent value="signin" className="mt-4">
              <p className="text-sm text-muted-foreground mb-4">{t("signInDesc")}</p>
              <form onSubmit={signIn} className="space-y-3">
                <div>
                  <Label>Username or Email</Label>
                  <Input required value={identifier} onChange={e => setIdentifier(e.target.value)} placeholder="username or you@example.com" />
                </div>
                <div><Label>{t("password")}</Label><Input type="password" required value={password} onChange={e => setPassword(e.target.value)} /></div>
                <Button type="submit" className="w-full" disabled={busy}>{busy ? "…" : t("login")}</Button>
              </form>
            </TabsContent>

            <TabsContent value="signup" className="mt-4">
              <p className="text-sm text-muted-foreground mb-4">{t("signUpDesc")}</p>
              <form onSubmit={signUp} className="space-y-3">
                <div><Label>{t("fullName")}</Label><Input required value={fullName} onChange={e => setFullName(e.target.value)} /></div>
                <div><Label>Username</Label><Input required pattern="[a-zA-Z0-9_.-]{3,30}" value={username} onChange={e => setUsername(e.target.value)} placeholder="3–30 chars, no spaces" /></div>
                <div><Label>{t("email")}</Label><Input type="email" required value={signupEmail} onChange={e => setSignupEmail(e.target.value)} /></div>
                <div><Label>{t("password")}</Label><Input type="password" required minLength={6} value={password} onChange={e => setPassword(e.target.value)} /></div>
                <Button type="submit" className="w-full" disabled={busy}>{busy ? "…" : t("createAccount")}</Button>
              </form>
            </TabsContent>
          </Tabs>
        </Card>
      </div>
    </div>
  );
}
