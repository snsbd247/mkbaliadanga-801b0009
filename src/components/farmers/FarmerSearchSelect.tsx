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
};

interface Props {
  value: string | null | undefined;
  onChange: (id: string | null, farmer: FarmerLite | null) => void;
  excludeIds?: string[];
  placeholder?: string;
  disabled?: boolean;
  className?: string;
}

/** Searchable, debounced farmer combobox. Searches name / code / account / member / mobile. */
export function FarmerSearchSelect({ value, onChange, excludeIds = [], placeholder = "Search farmer…", disabled, className }: Props) {
  const [open, setOpen] = useState(false);
  const [q, setQ] = useState("");
  const [loading, setLoading] = useState(false);
  const [items, setItems] = useState<FarmerLite[]>([]);
  const [selected, setSelected] = useState<FarmerLite | null>(null);
  const debounceRef = useRef<any>(null);

  // Hydrate selected label when value comes from outside
  useEffect(() => {
    if (!value) { setSelected(null); return; }
    if (selected?.id === value) return;
    supabase.from("farmers").select("id,name_en,name_bn,farmer_code,member_no,account_number,mobile").eq("id", value).maybeSingle()
      .then(({ data }) => setSelected((data as any) ?? null));
  }, [value]);

  useEffect(() => {
    if (!open) return;
    if (debounceRef.current) clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(async () => {
      setLoading(true);
      let qy = supabase.from("farmers").select("id,name_en,name_bn,farmer_code,member_no,account_number,mobile").order("name_en").limit(20);
      const term = q.trim();
      if (term) {
        qy = qy.or(`name_en.ilike.%${term}%,name_bn.ilike.%${term}%,farmer_code.ilike.%${term}%,account_number.ilike.%${term}%,member_no.ilike.%${term}%,mobile.ilike.%${term}%`);
      }
      const { data } = await qy;
      const filtered = ((data as any[]) ?? []).filter((r) => !excludeIds.includes(r.id));
      setItems(filtered as any);
      setLoading(false);
    }, 200);
    return () => { if (debounceRef.current) clearTimeout(debounceRef.current); };
  }, [q, open]); // eslint-disable-line react-hooks/exhaustive-deps

  const display = selected ? `${selected.name_en} • ${selected.account_number ?? selected.farmer_code}${selected.mobile ? " • " + selected.mobile : ""}` : "";

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
          <Input autoFocus placeholder="Type name, ID, account, mobile…" value={q} onChange={(e) => setQ(e.target.value)} />
        </div>
        <div className="max-h-72 overflow-y-auto">
          {loading && (
            <div className="flex items-center justify-center py-4 text-sm text-muted-foreground">
              <Loader2 className="h-4 w-4 mr-2 animate-spin" />Searching…
            </div>
          )}
          {!loading && items.length === 0 && (
            <div className="py-6 text-center text-sm text-muted-foreground">No farmer found</div>
          )}
          {!loading && items.map((it) => (
            <button
              key={it.id}
              type="button"
              onClick={() => { setSelected(it); onChange(it.id, it); setOpen(false); }}
              className="w-full flex items-start gap-2 px-3 py-2 text-left hover:bg-accent"
            >
              <Check className={cn("h-4 w-4 mt-1 shrink-0", value === it.id ? "opacity-100" : "opacity-0")} />
              <div className="flex-1 min-w-0">
                <div className="text-sm font-medium truncate">{it.name_en}{it.name_bn ? ` (${it.name_bn})` : ""}</div>
                <div className="text-xs text-muted-foreground truncate">
                  {(it.account_number ?? it.farmer_code)}
                  {it.member_no ? ` • Member #${it.member_no}` : ""}
                  {it.mobile ? ` • ${it.mobile}` : ""}
                </div>
              </div>
            </button>
          ))}
        </div>
      </PopoverContent>
    </Popover>
  );
}
