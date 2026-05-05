import { useEffect, useRef, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Input } from "@/components/ui/input";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Button } from "@/components/ui/button";
import { ChevronsUpDown, Loader2, X, Check } from "lucide-react";
import { cn } from "@/lib/utils";

export type FarmerLite = {
  id: string;
  name_en: string;
  name_bn?: string | null;
  farmer_code: string;
  member_no?: string | null;
  account_number?: string | null;
  mobile?: string | null;
  voter_number?: string | null;
};

interface Props {
  value: string | null | undefined;
  onChange: (id: string | null, farmer: FarmerLite | null) => void;
  excludeIds?: string[];
  placeholder?: string;
  disabled?: boolean;
  className?: string;
}

const SELECT_COLS = "id,name_en,name_bn,farmer_code,member_no,account_number,mobile,voter_number";
const MIN_SEARCH = 2;

function highlight(text: string | null | undefined, q: string): React.ReactNode {
  if (!text) return null;
  if (!q) return text;
  const idx = text.toLowerCase().indexOf(q.toLowerCase());
  if (idx < 0) return text;
  return (
    <>
      {text.slice(0, idx)}
      <mark className="bg-primary/20 text-foreground rounded px-0.5">{text.slice(idx, idx + q.length)}</mark>
      {text.slice(idx + q.length)}
    </>
  );
}

/** Searchable, debounced farmer combobox. Searches name / code / account / mobile / voter / member. */
export function FarmerSearchSelect({ value, onChange, excludeIds = [], placeholder = "Search farmer…", disabled, className }: Props) {
  const [open, setOpen] = useState(false);
  const [q, setQ] = useState("");
  const [loading, setLoading] = useState(false);
  const [items, setItems] = useState<FarmerLite[]>([]);
  const [selected, setSelected] = useState<FarmerLite | null>(null);
  const [activeIdx, setActiveIdx] = useState(0);
  const debounceRef = useRef<any>(null);
  const cacheRef = useRef<Map<string, FarmerLite[]>>(new Map());
  const reqIdRef = useRef(0);
  const listRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!value) { setSelected(null); return; }
    if (selected?.id === value) return;
    supabase.from("farmers").select(SELECT_COLS).eq("id", value).maybeSingle()
      .then(({ data }) => setSelected((data as any) ?? null));
  }, [value]);

  useEffect(() => {
    if (!open) return;
    if (debounceRef.current) clearTimeout(debounceRef.current);
    const term = q.trim().toLowerCase();
    // Require min chars (unless empty -> show recent default list)
    if (term.length > 0 && term.length < MIN_SEARCH) {
      setItems([]); setLoading(false); return;
    }
    const cached = cacheRef.current.get(term);
    if (cached) {
      setItems(cached.filter((r) => !excludeIds.includes(r.id)));
      setLoading(false);
    }
    debounceRef.current = setTimeout(async () => {
      const myReq = ++reqIdRef.current;
      if (!cached) setLoading(true);
      let qy = supabase.from("farmers").select(SELECT_COLS).order("name_en").limit(20);
      if (term) {
        const esc = term.replace(/[%,()]/g, " ");
        qy = qy.or(`name_en.ilike.%${esc}%,name_bn.ilike.%${esc}%,farmer_code.ilike.%${esc}%,account_number.ilike.%${esc}%,member_no.ilike.%${esc}%,mobile.ilike.%${esc}%,voter_number.ilike.%${esc}%`);
      }
      const { data } = await qy;
      if (myReq !== reqIdRef.current) return;
      const list = ((data as any[]) ?? []) as FarmerLite[];
      if (cacheRef.current.size > 50) {
        const firstKey = cacheRef.current.keys().next().value;
        if (firstKey !== undefined) cacheRef.current.delete(firstKey);
      }
      cacheRef.current.set(term, list);
      setItems(list.filter((r) => !excludeIds.includes(r.id)));
      setActiveIdx(0);
      setLoading(false);
    }, 300);
    return () => { if (debounceRef.current) clearTimeout(debounceRef.current); };
  }, [q, open]); // eslint-disable-line react-hooks/exhaustive-deps

  function pick(it: FarmerLite) { setSelected(it); onChange(it.id, it); setOpen(false); }

  function onKey(e: React.KeyboardEvent) {
    if (e.key === "ArrowDown") { e.preventDefault(); setActiveIdx(i => Math.min(i + 1, items.length - 1)); }
    else if (e.key === "ArrowUp") { e.preventDefault(); setActiveIdx(i => Math.max(i - 1, 0)); }
    else if (e.key === "Enter") { e.preventDefault(); if (items[activeIdx]) pick(items[activeIdx]); }
    else if (e.key === "Escape") { setOpen(false); }
  }

  const display = selected
    ? `${selected.member_no ?? selected.farmer_code} — ${selected.name_en}${selected.mobile ? ` (${selected.mobile})` : ""}`
    : "";
  const term = q.trim();
  const tooShort = term.length > 0 && term.length < MIN_SEARCH;

  return (
    <Popover open={open} onOpenChange={(o) => { setOpen(o); if (o) setQ(""); }}>
      <PopoverTrigger asChild>
        <Button type="button" variant="outline" disabled={disabled}
          className={cn("w-full justify-between font-normal", !display && "text-muted-foreground", className)}>
          <span className="truncate">{display || placeholder}</span>
          {selected ? (
            <X className="h-4 w-4 shrink-0 opacity-60 hover:opacity-100" onClick={(e) => { e.stopPropagation(); setSelected(null); onChange(null, null); }} />
          ) : (
            <ChevronsUpDown className="h-4 w-4 shrink-0 opacity-60" />
          )}
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-[--radix-popover-trigger-width] p-0" align="start">
        <div className="p-2 border-b">
          <Input autoFocus placeholder="Type name, account, mobile, voter no…" value={q}
            onChange={(e) => setQ(e.target.value)} onKeyDown={onKey} />
        </div>
        <div ref={listRef} className="max-h-72 overflow-y-auto">
          {loading && (
            <div className="flex items-center justify-center py-4 text-sm text-muted-foreground">
              <Loader2 className="h-4 w-4 mr-2 animate-spin" />Searching…
            </div>
          )}
          {!loading && tooShort && (
            <div className="py-6 text-center text-xs text-muted-foreground">Type at least {MIN_SEARCH} characters…</div>
          )}
          {!loading && !tooShort && items.length === 0 && (
            <div className="py-6 text-center text-sm text-muted-foreground">No farmer found</div>
          )}
          {!loading && items.map((it, idx) => (
            <button
              key={it.id}
              type="button"
              onMouseEnter={() => setActiveIdx(idx)}
              onClick={() => pick(it)}
              className={cn("w-full flex items-start gap-2 px-3 py-2 text-left hover:bg-accent",
                idx === activeIdx && "bg-accent")}
            >
              <Check className={cn("h-4 w-4 mt-1 shrink-0", value === it.id ? "opacity-100" : "opacity-0")} />
              <div className="flex-1 min-w-0">
                <div className="text-sm font-medium truncate">
                  {highlight(it.name_en, term)}{it.name_bn ? <> ({highlight(it.name_bn, term)})</> : null}
                </div>
                <div className="text-xs text-muted-foreground truncate">
                  {highlight(it.member_no ?? it.farmer_code, term)}
                  {it.mobile ? <> • {highlight(it.mobile, term)}</> : null}
                  {it.voter_number ? <> • Voter {highlight(it.voter_number, term)}</> : null}
                </div>
              </div>
            </button>
          ))}
        </div>
      </PopoverContent>
    </Popover>
  );
}
