import { useMemo, useState } from "react";
import { Button } from "@/components/ui/button";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Command, CommandEmpty, CommandGroup, CommandInput, CommandItem, CommandList } from "@/components/ui/command";
import { ChevronsUpDown, Check } from "lucide-react";
import { cn } from "@/lib/utils";
import { useLang } from "@/i18n/LanguageProvider";

export type SearchableOption = { value: string; label: string };

interface Props {
  value: string;
  onChange: (value: string) => void;
  options: SearchableOption[];
  placeholder?: string;
  searchPlaceholder?: string;
  className?: string;
  disabled?: boolean;
}

/** Generic searchable single-select combobox. */
export function SearchableSelect({
  value, onChange, options, placeholder, searchPlaceholder, className, disabled,
}: Props) {
  const { tx } = useLang();
  const [open, setOpen] = useState(false);
  const [search, setSearch] = useState("");
  const selected = useMemo(() => options.find((o) => o.value === value), [options, value]);
  const filtered = useMemo(() => {
    const s = search.trim().toLowerCase();
    if (!s) return options;
    return options.filter((o) => o.label.toLowerCase().includes(s));
  }, [options, search]);

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button
          type="button"
          variant="outline"
          role="combobox"
          aria-expanded={open}
          disabled={disabled}
          className={cn("w-full justify-between font-normal", !selected && "text-muted-foreground", className)}
        >
          <span className="truncate">{selected?.label || placeholder || tx("Select…", "নির্বাচন…")}</span>
          <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-[--radix-popover-trigger-width] p-0" align="start">
        <Command shouldFilter={false}>
          <CommandInput
            placeholder={searchPlaceholder ?? tx("Search…", "খুঁজুন…")}
            value={search}
            onValueChange={setSearch}
          />
          <CommandList>
            <CommandEmpty>{tx("No match", "মিল নেই")}</CommandEmpty>
            <CommandGroup>
              {filtered.map((o) => (
                <CommandItem
                  key={o.value}
                  value={o.value}
                  onSelect={() => { onChange(o.value); setOpen(false); setSearch(""); }}
                >
                  <Check className={cn("mr-2 h-4 w-4", value === o.value ? "opacity-100" : "opacity-0")} />
                  {o.label}
                </CommandItem>
              ))}
            </CommandGroup>
          </CommandList>
        </Command>
      </PopoverContent>
    </Popover>
  );
}
