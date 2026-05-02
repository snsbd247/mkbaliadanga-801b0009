import { useEffect, useState } from "react";
import { Bell } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/auth/AuthProvider";
import { fmtDate } from "@/lib/format";
import { useNavigate } from "react-router-dom";

export function NotificationBell() {
  const { user } = useAuth();
  const nav = useNavigate();
  const [items, setItems] = useState<any[]>([]);

  async function load() {
    if (!user) return;
    const { data } = await supabase
      .from("notifications")
      .select("*")
      .order("created_at", { ascending: false })
      .limit(20);
    setItems(data ?? []);
  }

  useEffect(() => {
    load();
    // Unique channel name per mount avoids "cannot add postgres_changes after subscribe()"
    // when React StrictMode mounts/unmounts the component twice in development.
    const ch = supabase.channel(`notifications-bell-${Math.random().toString(36).slice(2)}`);
    ch.on(
      "postgres_changes",
      { event: "*", schema: "public", table: "notifications" },
      load,
    );
    ch.subscribe();
    return () => { supabase.removeChannel(ch); };
  }, [user?.id]);

  const unread = items.filter((i) => !i.read).length;

  async function markAll() {
    await supabase.from("notifications").update({ read: true }).eq("read", false);
    load();
  }

  return (
    <Popover>
      <PopoverTrigger asChild>
        <Button variant="outline" size="icon" className="relative">
          <Bell className="h-4 w-4" />
          {unread > 0 && (
            <Badge variant="destructive" className="absolute -right-1 -top-1 h-4 min-w-4 px-1 text-[10px]">
              {unread}
            </Badge>
          )}
        </Button>
      </PopoverTrigger>
      <PopoverContent align="end" className="w-80 p-0">
        <div className="flex items-center justify-between border-b px-3 py-2">
          <span className="text-sm font-semibold">Notifications</span>
          {unread > 0 && (
            <button onClick={markAll} className="text-xs text-primary hover:underline">Mark all read</button>
          )}
        </div>
        <div className="max-h-96 overflow-auto">
          {items.length === 0 && <p className="p-4 text-sm text-muted-foreground">No notifications</p>}
          {items.map((n) => (
            <button
              key={n.id}
              onClick={() => { if (n.link) nav(n.link); }}
              className={`flex w-full flex-col items-start gap-0.5 border-b px-3 py-2 text-left text-sm hover:bg-accent/40 ${!n.read ? "bg-primary/5" : ""}`}
            >
              <div className="font-medium">{n.title}</div>
              {n.body && <div className="text-xs text-muted-foreground">{n.body}</div>}
              <div className="text-[10px] text-muted-foreground">{fmtDate(n.created_at)}</div>
            </button>
          ))}
        </div>
      </PopoverContent>
    </Popover>
  );
}
