import { useEffect, useRef, useState } from "react";
import { Bell, AlertCircle, Loader2, Archive } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/auth/AuthProvider";
import { fmtDate } from "@/lib/format";
import { useNavigate } from "react-router-dom";
import { useLang } from "@/i18n/LanguageProvider";

const isDev = import.meta.env.DEV;
const devLog = (...args: any[]) => { if (isDev) console.log("[NotificationBell]", ...args); };
const devErr = (...args: any[]) => { if (isDev) console.error("[NotificationBell]", ...args); };

// Module-level counter ensures deterministic uniqueness across StrictMode double-mounts
let mountCounter = 0;

export function NotificationBell() {
  const { user } = useAuth();
  const { tx } = useLang();
  const nav = useNavigate();
  const [items, setItems] = useState<any[]>([]);
  const [view, setView] = useState<"active" | "archived">("active");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [status, setStatus] = useState<"idle" | "connecting" | "subscribed" | "error" | "closed">("idle");
  const retryRef = useRef<number>(0);
  const retryTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  async function load() {
    if (!user) return;
    try {
      const { data, error } = await supabase
        .from("notifications")
        .select("*")
        .order("created_at", { ascending: false })
        .limit(20);
      if (error) throw error;
      setItems(data ?? []);
      setError(null);
    } catch (e: any) {
      devErr("load failed", e);
      setError(e?.message ?? "Failed to load notifications");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    if (!user?.id) {
      setLoading(false);
      return;
    }

    let cancelled = false;
    const channelId = `notifications-bell-${user.id}-${Date.now()}-${++mountCounter}`;
    devLog("mount → creating channel", channelId);

    let ch = supabase.channel(channelId);

    const subscribe = () => {
      if (cancelled) return;
      setStatus("connecting");
      devLog("subscribing", channelId, "attempt", retryRef.current);

      ch.on(
        "postgres_changes",
        { event: "*", schema: "public", table: "notifications" },
        (payload) => {
          devLog("realtime event", payload.eventType);
          load();
        },
      );

      ch.subscribe((s, err) => {
        devLog("status →", s, err ?? "");
        if (s === "SUBSCRIBED") {
          setStatus("subscribed");
          retryRef.current = 0;
        } else if (s === "CHANNEL_ERROR" || s === "TIMED_OUT" || s === "CLOSED") {
          setStatus(s === "CLOSED" ? "closed" : "error");
          if (err) devErr("channel error", err);
          if (!cancelled) scheduleReconnect();
        }
      });
    };

    const scheduleReconnect = () => {
      if (retryTimerRef.current) clearTimeout(retryTimerRef.current);
      const attempt = ++retryRef.current;
      const delay = Math.min(30000, 1000 * 2 ** Math.min(attempt, 5));
      devLog(`reconnect scheduled in ${delay}ms (attempt ${attempt})`);
      retryTimerRef.current = setTimeout(async () => {
        if (cancelled) return;
        try {
          await supabase.removeChannel(ch);
        } catch (e) { devErr("removeChannel failed", e); }
        ch = supabase.channel(`${channelId}-r${attempt}`);
        subscribe();
        load();
      }, delay);
    };

    load();
    subscribe();

    return () => {
      cancelled = true;
      devLog("unmount → removing channel", channelId);
      if (retryTimerRef.current) clearTimeout(retryTimerRef.current);
      supabase.removeChannel(ch).catch((e) => devErr("cleanup removeChannel failed", e));
    };
  }, [user?.id]);

  const unread = items.filter((i) => !i.read).length;

  async function markAll() {
    try {
      await supabase.from("notifications").update({ read: true }).eq("read", false);
      load();
    } catch (e: any) {
      devErr("markAll failed", e);
      setError(e?.message ?? "Failed to mark read");
    }
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
          {status === "error" && (
            <span className="absolute -bottom-1 -right-1 h-2 w-2 rounded-full bg-destructive" title="Realtime disconnected" />
          )}
        </Button>
      </PopoverTrigger>
      <PopoverContent align="end" className="w-80 p-0">
        <div className="flex items-center justify-between border-b px-3 py-2">
          <span className="text-sm font-semibold">{tx("Notifications", "নোটিফিকেশন")}</span>
          <div className="flex items-center gap-2">
            {status === "connecting" && <Loader2 className="h-3 w-3 animate-spin text-muted-foreground" />}
            {status === "error" && <AlertCircle className="h-3 w-3 text-destructive" />}
            {unread > 0 && (
              <button onClick={markAll} className="text-xs text-primary hover:underline">{tx("Mark all read", "সব পঠিত করুন")}</button>
            )}
          </div>
        </div>
        <div className="max-h-96 overflow-auto">
          {loading && (
            <div className="flex items-center gap-2 p-4 text-sm text-muted-foreground">
              <Loader2 className="h-4 w-4 animate-spin" /> Loading…
            </div>
          )}
          {!loading && error && (
            <div className="flex items-start gap-2 p-4 text-sm text-destructive">
              <AlertCircle className="mt-0.5 h-4 w-4 shrink-0" />
              <div className="flex-1">
                <div className="font-medium">{tx("Couldn't load notifications", "নোটিফিকেশন লোড হয়নি")}</div>
                <div className="text-xs opacity-80">{error}</div>
                <button
                  onClick={() => { setLoading(true); load(); }}
                  className="mt-1 text-xs text-primary hover:underline"
                >
                  Retry
                </button>
              </div>
            </div>
          )}
          {!loading && !error && status === "error" && (
            <div className="border-b bg-destructive/10 px-3 py-2 text-xs text-destructive">
              Realtime disconnected — reconnecting…
            </div>
          )}
          {!loading && !error && items.length === 0 && (
            <p className="p-4 text-sm text-muted-foreground">{tx("No notifications", "কোনো নোটিফিকেশন নেই")}</p>
          )}
          {!loading && !error && items.map((n) => (
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
