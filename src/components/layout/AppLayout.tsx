import { Outlet, Navigate } from "react-router-dom";
import { SidebarProvider, SidebarTrigger } from "@/components/ui/sidebar";
import { AppSidebar } from "./AppSidebar";
import { useAuth } from "@/auth/AuthProvider";
import { useLang } from "@/i18n/LanguageProvider";
import { Button } from "@/components/ui/button";
import { LogOut, Languages } from "lucide-react";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { NotificationBell } from "@/components/NotificationBell";
import { useBranding } from "@/lib/branding";

export function AppLayout() {
  const { user, loading, signOut, roles } = useAuth();
  const { lang, setLang, t } = useLang();
  const brand = useBranding();

  if (loading) {
    return <div className="flex h-screen items-center justify-center text-muted-foreground">Loading…</div>;
  }
  if (!user) return <Navigate to="/auth" replace />;

  const initial = (user.email ?? "U").charAt(0).toUpperCase();
  const roleLabel = roles.includes("super_admin") ? t("superAdmin") : roles.includes("admin") ? t("admin") : t("staff");

  return (
    <SidebarProvider>
      <div className="flex min-h-screen w-full bg-gradient-surface">
        <AppSidebar />
        <div className="flex flex-1 flex-col min-w-0">
          <header className="sticky top-0 z-10 flex h-14 items-center justify-between gap-2 border-b bg-card/80 backdrop-blur px-2 sm:px-4 no-print">
            <div className="flex items-center gap-2 min-w-0">
              <SidebarTrigger />
              <span className="hidden truncate text-sm font-medium text-foreground sm:inline">
                {lang === "bn" && brand.company_name_bn ? brand.company_name_bn : brand.company_name}
              </span>
            </div>
            <div className="flex items-center gap-1 sm:gap-2 shrink-0">
              <NotificationBell />
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <Button variant="outline" size="sm" className="gap-1.5 px-2 sm:px-3">
                    <Languages className="h-4 w-4" />
                    <span className="hidden xs:inline">{lang === "en" ? "EN" : "বাং"}</span>
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end">
                  <DropdownMenuItem onClick={() => setLang("en")}>English</DropdownMenuItem>
                  <DropdownMenuItem onClick={() => setLang("bn")}>বাংলা</DropdownMenuItem>
                </DropdownMenuContent>
              </DropdownMenu>

              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <button className="flex items-center gap-2 rounded-md border bg-card px-2 py-1 text-sm hover:bg-accent/10 max-w-[180px] sm:max-w-[260px]">
                    <Avatar className="h-7 w-7 shrink-0"><AvatarFallback className="bg-primary text-primary-foreground text-xs">{initial}</AvatarFallback></Avatar>
                    <div className="hidden text-left sm:block min-w-0">
                      <div className="text-xs font-medium leading-tight truncate">{user.email}</div>
                      <div className="text-[10px] text-muted-foreground leading-tight">{roleLabel}</div>
                    </div>
                  </button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end">
                  <DropdownMenuItem onClick={signOut}><LogOut className="mr-2 h-4 w-4" />{t("logout")}</DropdownMenuItem>
                </DropdownMenuContent>
              </DropdownMenu>
            </div>
          </header>
          <main className="flex-1 min-w-0 p-3 sm:p-4 md:p-6 animate-fade-in overflow-x-hidden">
            <Outlet />
          </main>
        </div>
      </div>
    </SidebarProvider>
  );
}
