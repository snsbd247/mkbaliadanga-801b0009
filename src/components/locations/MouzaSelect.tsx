import { useEffect, useMemo, useRef, useState } from "react";
import { db } from "@/lib/db";
import { Button } from "@/components/ui/button";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Command, CommandEmpty, CommandGroup, CommandInput, CommandItem, CommandList } from "@/components/ui/command";
import { Loader2, ChevronsUpDown, Check } from "lucide-react";
import { cn } from "@/lib/utils";
import { useLang } from "@/i18n/LanguageProvider";

type MouzaRow = { id: string; name: string; name_bn?: string | null; upazila_id?: string | null; is_active?: boolean };

interface Props {
  /** Current mouza name (free-text string stored on the record). */
  value: string | null | undefined;
  onChange: (name: string) => void;
  disabled?: boolean;
  placeholder?: string;
  className?: string;
  /** Cascading filters — narrow options to the selected geo branch. */
  divisionId?: string | null;
  districtId?: string | null;
  upazilaId?: string | null;
  /** When true, the field is marked invalid until a catalogue value is chosen. */
  required?: boolean;
  /** External validation flag to render the error ring. */
  invalid?: boolean;
}

/** True only when `value` matches a name in the active mouza catalogue. */
export function isCatalogueMouza(value: string | null | undefined, names: string[]): boolean {
  const v = (value ?? "").trim();
  return !!v && names.includes(v);
}

/**
 * Searchable Mouza picker. Stores the selected mouza *name* (string) so it is a
 * drop-in replacement for the previous free-text <Input> fields.
 * - Cascading: filters by division/district/upazila when those props are given.
 * - Legacy fallback: an inactive/unknown current value still renders (flagged).
 * - Debounced, keyboard-friendly search with loading + empty feedback.
 */
export function MouzaSelect({
  value, onChange, disabled, placeholder, className,
  divisionId, districtId, upazilaId, required, invalid,
}: Props) {
  const { tx } = useLang();
  const ph = placeholder ?? tx("Select mouza…", "মৌজা নির্বাচন…");
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [rows, setRows] = useState<MouzaRow[]>([]);
  const [search, setSearch] = useState("");
  const [debounced, setDebounced] = useState("");
  const debTimer = useRef<ReturnType<typeof setTimeout>>();

  // Debounce the search term (keyboard-friendly; cosmetic for client filtering).
  useEffect(() => {
    debTimer.current && clearTimeout(debTimer.current);
    debTimer.current = setTimeout(() => setDebounced(search.trim().toLowerCase()), 200);
    return () => debTimer.current && clearTimeout(debTimer.current);
  }, [search]);

  // Resolve the set of allowed upazila ids from the cascading filters.
  useEffect(() => {
    let cancelled = false;
    (async () => {
      setLoading(true);
      let allowedUpazilas: string[] | null = null;
      if (upazilaId) {
        allowedUpazilas = [upazilaId];
      } else if (districtId) {
        const { data } = await db.from("upazilas").select("id").eq("district_id", districtId);
        allowedUpazilas = ((data as any[]) ?? []).map((u) => u.id);
      } else if (divisionId) {
        const { data: ds } = await db.from("districts").select("id").eq("division_id", divisionId);
        const dIds = ((ds as any[]) ?? []).map((d) => d.id);
        if (dIds.length) {
          const { data: us } = await db.from("upazilas").select("id").in("district_id", dIds);
          allowedUpazilas = ((us as any[]) ?? []).map((u) => u.id);
        } else {
          allowedUpazilas = [];
        }
      }

      let q = db.from("mouzas").select("id,name,name_bn,upazila_id,is_active").eq("is_active", true).order("name");
      if (allowedUpazilas) {
        if (allowedUpazilas.length === 0) {
          if (!cancelled) { setRows([]); setLoading(false); }
          return;
        }
        q = q.in("upazila_id", allowedUpazilas);
      }
      const { data } = await q;
      if (!cancelled) { setRows(((data as any[]) ?? []) as MouzaRow[]); setLoading(false); }
    })();
    return () => { cancelled = true; };
  }, [divisionId, districtId, upazilaId]);

  const cur = (value ?? "").trim();
  const names = useMemo(() => rows.map((r) => r.name), [rows]);
  const isLegacy = !!cur && !names.includes(cur);

  // Legacy fallback: keep the unknown/inactive current value visible at the top.
  const baseList: MouzaRow[] = isLegacy ? [{ id: `__cur__${cur}`, name: cur, is_active: false }, ...rows] : rows;
  const filtered = useMemo(() => {
    if (!debounced) return baseList;
    return baseList.filter((m) => `${m.name} ${m.name_bn ?? ""}`.toLowerCase().includes(debounced));
  }, [baseList, debounced]);

  const showInvalid = invalid ?? (required && (!cur || isLegacy));

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button
          type="button"
          variant="outline"
          role="combobox"
          aria-expanded={open}
          aria-invalid={showInvalid || undefined}
          disabled={disabled || loading}
          className={cn(
            "w-full justify-between font-normal",
            !cur && "text-muted-foreground",
            showInvalid && "border-destructive ring-1 ring-destructive",
            className,
          )}
        >
          {loading ? (
            <span className="flex items-center text-muted-foreground"><Loader2 className="h-3 w-3 mr-1 animate-spin" />{tx("Loading…", "লোড হচ্ছে…")}</span>
          ) : (
            <span className="truncate">
              {cur || ph}
              {isLegacy && <span className="ml-1 text-xs text-destructive">({tx("not in list", "তালিকায় নেই")})</span>}
            </span>
          )}
          <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-[--radix-popover-trigger-width] p-0" align="start">
        <Command shouldFilter={false}>
          <CommandInput
            placeholder={tx("Search mouza…", "মৌজা খুঁজুন…")}
            value={search}
            onValueChange={setSearch}
          />
          <CommandList>
            <CommandEmpty>
              {loading
                ? tx("Loading…", "লোড হচ্ছে…")
                : rows.length === 0
                  ? tx("No mouza configured", "কোনো মৌজা নেই")
                  : tx("No match", "মিল নেই")}
            </CommandEmpty>
            <CommandGroup>
              {filtered.map((m) => (
                <CommandItem
                  key={m.id}
                  value={`${m.id} ${m.name} ${m.name_bn ?? ""}`}
                  onSelect={() => { onChange(m.name); setOpen(false); setSearch(""); }}
                >
                  <Check className={cn("mr-2 h-4 w-4", cur === m.name ? "opacity-100" : "opacity-0")} />
                  {m.name}{m.name_bn ? ` (${m.name_bn})` : ""}
                  {m.is_active === false && <span className="ml-auto text-xs text-muted-foreground">{tx("legacy", "পুরোনো")}</span>}
                </CommandItem>
              ))}
            </CommandGroup>
          </CommandList>
        </Command>
      </PopoverContent>
    </Popover>
  );
}
