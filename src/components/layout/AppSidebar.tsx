import { NavLink, useLocation } from "react-router-dom";
import {
  LayoutDashboard, Building2, Users, MapPin, CalendarDays, Wallet,
  HandCoins, Droplets, Receipt, FileBarChart, ShieldCheck, ScrollText, Sprout
} from "lucide-react";
import {
  Sidebar, SidebarContent, SidebarGroup, SidebarGroupContent, SidebarGroupLabel,
  SidebarMenu, SidebarMenuButton, SidebarMenuItem, SidebarHeader, useSidebar,
} from "@/components/ui/sidebar";
import { useLang } from "@/i18n/LanguageProvider";
import { useAuth } from "@/auth/AuthProvider";

export function AppSidebar() {
  const { state } = useSidebar();
  const collapsed = state === "collapsed";
  const { pathname } = useLocation();
  const { t } = useLang();
  const { isAdmin, isSuper } = useAuth();

  const main = [
    { url: "/", icon: LayoutDashboard, label: t("dashboard") },
    { url: "/farmers", icon: Users, label: t("farmers") },
    { url: "/seasons", icon: CalendarDays, label: t("seasons") },
    { url: "/savings", icon: Wallet, label: t("savings") },
    { url: "/loans", icon: HandCoins, label: t("loans") },
    { url: "/irrigation", icon: Droplets, label: t("irrigation") },
    { url: "/payments", icon: Receipt, label: t("payments") },
    { url: "/reports", icon: FileBarChart, label: t("reports") },
  ];
  const admin = [
    ...(isAdmin ? [{ url: "/offices", icon: Building2, label: t("offices") }] : []),
    ...(isSuper ? [{ url: "/users", icon: ShieldCheck, label: t("users") }] : []),
    ...(isSuper ? [{ url: "/audit", icon: ScrollText, label: t("auditLogs") }] : []),
  ];

  const isActive = (url: string) => url === "/" ? pathname === "/" : pathname.startsWith(url);

  return (
    <Sidebar collapsible="icon">
      <SidebarHeader className="border-b border-sidebar-border px-4 py-4">
        <div className="flex items-center gap-2">
          <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-md bg-accent text-accent-foreground">
            <Sprout className="h-5 w-5" />
          </div>
          {!collapsed && (
            <div className="flex flex-col">
              <span className="text-sm font-bold text-sidebar-foreground leading-tight">{t("appNameShort")}</span>
              <span className="text-[10px] text-sidebar-foreground/70 leading-tight">{t("appName")}</span>
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
