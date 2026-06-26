import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Command, CommandEmpty, CommandGroup, CommandInput, CommandItem, CommandList } from "@/components/ui/command";
import { Loader2, ChevronsUpDown, Check } from "lucide-react";
import { cn } from "@/lib/utils";
import { useLang } from "@/i18n/LanguageProvider";

type MouzaRow = { id: string; name: string; name_bn?: string | null };

interface Props {
  /** Current mouza name (free-text string stored on the record). */
  value: string | null | undefined;
  onChange: (name: string) => void;
  disabled?: boolean;
  placeholder?: string;
  className?: string;
}

/**
 * Searchable Mouza picker that lists all active mouzas from the catalogue.
 * Stores the selected mouza *name* (string) so it is a drop-in replacement for
 * the previous free-text <Input> fields across modules. Falls back to the
 * current value if it is not present in the active list (legacy data).
 */
export function MouzaSelect({ value, onChange, disabled, placeholder, className }: Props) {
  const { tx } = useLang();
  const ph = placeholder ?? tx("Select mouza…", "মৌজা নির্বাচন…");
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [rows, setRows] = useState<MouzaRow[]>([]);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    supabase.from("mouzas").select("id,name,name_bn").eq("is_active", true).order("name")
      .then(({ data }) => { if (!cancelled) { setRows(((data as any[]) ?? []) as MouzaRow[]); setLoading(false); } });
    return () => { cancelled = true; };
  }, []);

  const cur = (value ?? "").trim();
  const names = rows.map((r) => r.name);
  const list: MouzaRow[] = cur && !names.includes(cur)
    ? [{ id: `__cur__${cur}`, name: cur }, ...rows]
    : rows;

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button
          type="button"
          variant="outline"
          role="combobox"
          aria-expanded={open}
          disabled={disabled || loading}
          className={cn("w-full justify-between font-normal", !cur && "text-muted-foreground", className)}
        >
          {loading ? (
            <span className="flex items-center text-muted-foreground"><Loader2 className="h-3 w-3 mr-1 animate-spin" />{tx("Loading…", "লোড হচ্ছে…")}</span>
          ) : (
            <span className="truncate">{cur || ph}</span>
          )}
          <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-[--radix-popover-trigger-width] p-0" align="start">
        <Command>
          <CommandInput placeholder={tx("Search mouza…", "মৌজা খুঁজুন…")} />
          <CommandList>
            <CommandEmpty>{rows.length === 0 ? tx("No mouza configured", "কোনো মৌজা নেই") : tx("No match", "মিল নেই")}</CommandEmpty>
            <CommandGroup>
              {list.map((m) => (
                <CommandItem
                  key={m.id}
                  value={`${m.name} ${m.name_bn ?? ""}`}
                  onSelect={() => { onChange(m.name); setOpen(false); }}
                >
                  <Check className={cn("mr-2 h-4 w-4", cur === m.name ? "opacity-100" : "opacity-0")} />
                  {m.name}{m.name_bn ? ` (${m.name_bn})` : ""}
                </CommandItem>
              ))}
            </CommandGroup>
          </CommandList>
        </Command>
      </PopoverContent>
    </Popover>
  );
}
