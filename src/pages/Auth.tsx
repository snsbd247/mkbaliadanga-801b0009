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

export default function AuthPage() {
  const nav = useNavigate();
  const { user } = useAuth();
  const { t, lang, setLang } = useLang();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [fullName, setFullName] = useState("");
  const [busy, setBusy] = useState(false);

  useEffect(() => { document.title = `${t("login")} — ${t("appName")}`; }, [t]);
  useEffect(() => { if (user) nav("/", { replace: true }); }, [user, nav]);

  const signIn = async (e: React.FormEvent) => {
    e.preventDefault();
    setBusy(true);
    const { error } = await supabase.auth.signInWithPassword({ email, password });
    setBusy(false);
    if (error) toast.error(error.message); else { toast.success(t("welcomeBack")); nav("/", { replace: true }); }
  };

  const signUp = async (e: React.FormEvent) => {
    e.preventDefault();
    setBusy(true);
    const { error } = await supabase.auth.signUp({
      email, password,
      options: { emailRedirectTo: `${window.location.origin}/`, data: { full_name: fullName } },
    });
    setBusy(false);
    if (error) toast.error(error.message); else toast.success("Account created — check your email if confirmation is required.");
  };

  return (
    <div className="flex min-h-screen items-center justify-center bg-gradient-surface p-4">
      <div className="w-full max-w-md">
        <div className="mb-6 text-center">
          <div className="mx-auto mb-3 flex h-14 w-14 items-center justify-center rounded-xl bg-gradient-primary text-primary-foreground shadow-elegant">
            <Sprout className="h-7 w-7" />
          </div>
          <h1 className="text-2xl font-bold">{t("appName")}</h1>
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
                <div><Label>{t("email")}</Label><Input type="email" required value={email} onChange={e => setEmail(e.target.value)} /></div>
                <div><Label>{t("password")}</Label><Input type="password" required value={password} onChange={e => setPassword(e.target.value)} /></div>
                <Button type="submit" className="w-full" disabled={busy}>{busy ? "…" : t("login")}</Button>
              </form>
            </TabsContent>

            <TabsContent value="signup" className="mt-4">
              <p className="text-sm text-muted-foreground mb-4">{t("signUpDesc")}</p>
              <form onSubmit={signUp} className="space-y-3">
                <div><Label>{t("fullName")}</Label><Input required value={fullName} onChange={e => setFullName(e.target.value)} /></div>
                <div><Label>{t("email")}</Label><Input type="email" required value={email} onChange={e => setEmail(e.target.value)} /></div>
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
