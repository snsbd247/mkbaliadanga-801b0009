import { NavLink, useLocation } from "react-router-dom";
import {
  LayoutDashboard, Building2, Users, MapPin, CalendarDays, Wallet,
  HandCoins, Droplets, Receipt, FileBarChart, ShieldCheck, ScrollText, Sprout,
  ScanLine, Settings as SettingsIcon, BookOpen, FileText,
} from "lucide-react";
import {
  Sidebar, SidebarContent, SidebarGroup, SidebarGroupContent, SidebarGroupLabel,
  SidebarMenu, SidebarMenuButton, SidebarMenuItem, SidebarHeader, useSidebar,
} from "@/components/ui/sidebar";
import { useLang } from "@/i18n/LanguageProvider";
import { useAuth } from "@/auth/AuthProvider";
import { useBranding } from "@/lib/branding";
import { usePermissions } from "@/lib/permissions";

export function AppSidebar() {
  const { state } = useSidebar();
  const collapsed = state === "collapsed";
  const { pathname } = useLocation();
  const { t, lang } = useLang();
  const { isSuper } = useAuth();
  const brand = useBranding();
  const { can } = usePermissions();

  const main = [
    { url: "/", icon: LayoutDashboard, label: t("dashboard"), key: "dashboard" as const },
    { url: "/farmers", icon: Users, label: t("farmers"), key: "farmers" as const },
    { url: "/seasons", icon: CalendarDays, label: t("seasons"), key: "seasons" as const },
    { url: "/savings", icon: Wallet, label: t("savings"), key: "savings" as const },
    { url: "/statement", icon: FileText, label: (t as any)("statement") || "Statement", key: "savings" as const },
    { url: "/loans", icon: HandCoins, label: t("loans"), key: "loans" as const },
    { url: "/irrigation", icon: Droplets, label: t("irrigation"), key: "irrigation" as const },
    { url: "/payments", icon: Receipt, label: t("payments"), key: "payments" as const },
    { url: "/cashbook", icon: BookOpen, label: t("cashbook"), key: "reports" as const },
    { url: "/scan", icon: ScanLine, label: t("scanQr"), key: "payments" as const },
    { url: "/reports", icon: FileBarChart, label: t("reports"), key: "reports" as const },
  ].filter((x) => can(x.key, "can_view"));

  const admin = [
    ...(can("offices") ? [{ url: "/offices", icon: Building2, label: t("offices") }] : []),
    ...(isSuper ? [{ url: "/users", icon: ShieldCheck, label: t("users") }] : []),
    ...(isSuper ? [{ url: "/settings", icon: SettingsIcon, label: t("settings") }] : []),
    ...(isSuper ? [{ url: "/audit", icon: ScrollText, label: t("auditLogs") }] : []),
  ];

  const isActive = (url: string) => url === "/" ? pathname === "/" : pathname.startsWith(url);

  return (
    <Sidebar collapsible="icon">
      <SidebarHeader className="border-b border-sidebar-border px-4 py-4">
        <div className="flex items-center gap-2">
          {brand.logo_url ? (
            <img src={brand.logo_url} alt={brand.company_name} className="h-9 w-9 shrink-0 rounded-md object-cover" />
          ) : (
            <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-md bg-accent text-accent-foreground">
              <Sprout className="h-5 w-5" />
            </div>
          )}
          {!collapsed && (
            <div className="flex flex-col overflow-hidden">
              <span className="truncate text-sm font-bold text-sidebar-foreground leading-tight">
                {lang === "bn" && brand.company_name_bn ? brand.company_name_bn : brand.company_name}
              </span>
              <span className="text-[10px] text-sidebar-foreground/70 leading-tight">{t("appNameShort")}</span>
            </div>
          )}
        </div>
      </SidebarHeader>

      <SidebarContent>
        <SidebarGroup>
          <SidebarGroupLabel>{collapsed ? "" : "Main"}</SidebarGroupLabel>
          <SidebarGroupContent>
            <SidebarMenu>
              {main.map((item) => (
                <SidebarMenuItem key={item.url}>
                  <SidebarMenuButton asChild isActive={isActive(item.url)} tooltip={item.label}>
                    <NavLink to={item.url} end={item.url === "/"}>
                      <item.icon className="h-4 w-4" />
                      <span>{item.label}</span>
                    </NavLink>
                  </SidebarMenuButton>
                </SidebarMenuItem>
              ))}
            </SidebarMenu>
          </SidebarGroupContent>
        </SidebarGroup>

        {admin.length > 0 && (
          <SidebarGroup>
            <SidebarGroupLabel>{collapsed ? "" : "Admin"}</SidebarGroupLabel>
            <SidebarGroupContent>
              <SidebarMenu>
                {admin.map((item) => (
                  <SidebarMenuItem key={item.url}>
                    <SidebarMenuButton asChild isActive={isActive(item.url)} tooltip={item.label}>
                      <NavLink to={item.url}>
                        <item.icon className="h-4 w-4" />
                        <span>{item.label}</span>
                      </NavLink>
                    </SidebarMenuButton>
                  </SidebarMenuItem>
                ))}
              </SidebarMenu>
            </SidebarGroupContent>
          </SidebarGroup>
        )}
      </SidebarContent>
    </Sidebar>
  );
}
