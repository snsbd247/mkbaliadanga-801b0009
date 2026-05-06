import { Outlet, Navigate, Link } from "react-router-dom";
import { useEffect, useState } from "react";
import { SidebarProvider, SidebarTrigger } from "@/components/ui/sidebar";
import { AppSidebar } from "./AppSidebar";
import { useAuth } from "@/auth/AuthProvider";
import { useLang } from "@/i18n/LanguageProvider";
import { Button } from "@/components/ui/button";
import { LogOut, Languages, UserCircle } from "lucide-react";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuSeparator, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { NotificationBell } from "@/components/NotificationBell";
import { MenuSearch } from "./MenuSearch";
import { MenuShortcutsHelp } from "./MenuShortcutsHelp";
import { MissingI18nPanel } from "@/components/dev/MissingI18nPanel";
import { useBranding } from "@/lib/branding";
import { SiteFooter } from "./SiteFooter";

export function AppLayout() {
  const { user, loading, signOut, roles } = useAuth();
  const { lang, setLang, t } = useLang();
  const brand = useBranding();

  const sidebarKey = `sidebar:open:${user?.id ?? "guest"}`;
  const [sidebarOpen, setSidebarOpen] = useState<boolean>(() => {
    if (typeof window === "undefined") return true;
    try {
      const v = localStorage.getItem(sidebarKey);
      return v === null ? true : v === "1";
    } catch { return true; }
  });
  useEffect(() => {
    try { localStorage.setItem(sidebarKey, sidebarOpen ? "1" : "0"); } catch { /* noop */ }
  }, [sidebarOpen, sidebarKey]);

  if (loading) {
    return <div className="flex h-screen items-center justify-center text-muted-foreground">Loading…</div>;
  }
  if (!user) return <Navigate to="/auth" replace />;

  const initial = (user.email ?? "U").charAt(0).toUpperCase();
  const roleLabel = roles.includes("super_admin") ? t("superAdmin") : roles.includes("admin") ? t("admin") : t("staff");

  return (
    <SidebarProvider open={sidebarOpen} onOpenChange={setSidebarOpen}>
      <div className="flex min-h-screen w-full bg-gradient-surface">
        <AppSidebar />
        <div className="flex flex-1 flex-col min-w-0">
          <header className="sticky top-0 z-10 flex h-14 items-center justify-between gap-2 border-b bg-card/80 backdrop-blur px-2 sm:px-4 no-print">
            <div className="flex items-center gap-2 min-w-0 flex-1">
              <SidebarTrigger
                aria-label="Toggle menu"
                className="shrink-0 sidebar-trigger-mobile md:h-9 md:w-9 md:rounded-md md:border md:bg-card md:shadow-sm md:hover:bg-accent/10"
              />
              <span className="hidden md:inline truncate text-sm font-medium text-foreground max-w-[180px] lg:max-w-[240px]">
                {lang === "bn" && brand.company_name_bn ? brand.company_name_bn : brand.company_name}
              </span>
              <div className="flex-1 min-w-0 max-w-md">
                <MenuSearch />
              </div>
              <MenuShortcutsHelp />
            </div>
            <div className="hidden sm:flex items-center gap-2 shrink-0">
              <NotificationBell />
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <Button variant="outline" size="sm" className="gap-1.5">
                    <Languages className="h-4 w-4" />
                    <span>{lang === "en" ? "EN" : "বাং"}</span>
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end">
                  <DropdownMenuItem onClick={() => setLang("en")}>English</DropdownMenuItem>
                  <DropdownMenuItem onClick={() => setLang("bn")}>বাংলা</DropdownMenuItem>
                </DropdownMenuContent>
              </DropdownMenu>

              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <button className="flex items-center gap-2 rounded-md border bg-card px-2 py-1 text-sm hover:bg-accent/10 max-w-[260px]">
                    <Avatar className="h-7 w-7 shrink-0"><AvatarFallback className="bg-primary text-primary-foreground text-xs">{initial}</AvatarFallback></Avatar>
                    <div className="text-left min-w-0">
                      <div className="text-xs font-medium leading-tight truncate">{user.email}</div>
                      <div className="text-[10px] text-muted-foreground leading-tight">{roleLabel}</div>
                    </div>
                  </button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end">
                  <DropdownMenuItem asChild>
                    <Link to="/profile"><UserCircle className="mr-2 h-4 w-4" />{lang === "bn" ? "প্রোফাইল ও পাসওয়ার্ড" : "Profile & Password"}</Link>
                  </DropdownMenuItem>
                  <DropdownMenuSeparator />
                  <DropdownMenuItem onClick={signOut}><LogOut className="mr-2 h-4 w-4" />{t("logout")}</DropdownMenuItem>
                </DropdownMenuContent>
              </DropdownMenu>
            </div>
            {/* Mobile compact controls */}
            <div className="flex sm:hidden items-center gap-1 shrink-0">
              <NotificationBell />
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <Button variant="outline" size="icon" className="h-9 w-9" aria-label="Account menu">
                    <Avatar className="h-7 w-7"><AvatarFallback className="bg-primary text-primary-foreground text-xs">{initial}</AvatarFallback></Avatar>
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end" className="w-56">
                  <div className="px-2 py-1.5 border-b mb-1">
                    <div className="text-xs font-medium truncate">{user.email}</div>
                    <div className="text-[10px] text-muted-foreground">{roleLabel}</div>
                  </div>
                  <DropdownMenuItem onClick={() => setLang(lang === "en" ? "bn" : "en")}>
                    <Languages className="mr-2 h-4 w-4" />
                    {lang === "en" ? "বাংলা" : "English"}
                  </DropdownMenuItem>
                  <DropdownMenuItem asChild>
                    <Link to="/profile"><UserCircle className="mr-2 h-4 w-4" />{lang === "bn" ? "প্রোফাইল ও পাসওয়ার্ড" : "Profile & Password"}</Link>
                  </DropdownMenuItem>
                  <DropdownMenuItem onClick={signOut}><LogOut className="mr-2 h-4 w-4" />{t("logout")}</DropdownMenuItem>
                </DropdownMenuContent>
              </DropdownMenu>
            </div>
          </header>
          <main className="flex-1 min-w-0 p-3 sm:p-4 md:p-6 animate-fade-in overflow-x-hidden">
            <Outlet />
          </main>
          <SiteFooter />
        </div>
        <MissingI18nPanel />
      </div>
    </SidebarProvider>
  );
}
