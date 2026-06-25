import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Command, CommandEmpty, CommandGroup, CommandInput, CommandItem, CommandList } from "@/components/ui/command";
import { Loader2, ChevronsUpDown, Check } from "lucide-react";
import { cn } from "@/lib/utils";

export type LocationValue = {
  division_id?: string | null;
  district_id?: string | null;
  upazila_id?: string | null;
  mouza_id?: string | null;
  mouza_name?: string | null;
  village?: string | null;
  // Legacy fields kept for backward compatibility (always null/unused).
  union_id?: string | null;
  ward_id?: string | null;
  village_id?: string | null;
};

type Row = { id: string; name: string; name_bn?: string | null; upazila_id?: string | null };

const NONE = "__none__";

export type PickerLevel = "division" | "district" | "upazila" | "mouza" | "village";

interface Props {
  value: LocationValue;
  onChange: (v: LocationValue) => void;
  className?: string;
  errorLevel?: PickerLevel | null;
  errorMessage?: string | null;
  labels?: Partial<Record<PickerLevel, string>>;
  showVillage?: boolean;
  /** When true, hide the Division→Upazila chain and show only a single Mouza select. */
  mouzaOnly?: boolean;
}

/**
 * Cascading picker: division → district → upazila → mouza (+ optional village text).
 * In `mouzaOnly` mode it collapses to a single flat Mouza select.
 */
export function LocationPicker({ value, onChange, className, errorLevel = null, errorMessage = null, labels, showVillage = true, mouzaOnly = false }: Props) {
  const [divisions, setDivisions] = useState<Row[]>([]);
  const [districts, setDistricts] = useState<Row[]>([]);
  const [upazilas, setUpazilas] = useState<Row[]>([]);
  const [mouzas, setMouzas] = useState<Row[]>([]);
  const [mouzaOpen, setMouzaOpen] = useState(false);


  const [loading, setLoading] = useState({ div: false, dis: false, upa: false, mou: false });
  const setL = (k: keyof typeof loading, v: boolean) => setLoading((s) => ({ ...s, [k]: v }));

  // mouzaOnly: load the full active mouza list once (no parent filtering).
  useEffect(() => {
    if (!mouzaOnly) return;
    setL("mou", true);
    supabase.from("mouzas").select("id,name,name_bn").eq("is_active", true).order("name")
      .then(({ data }) => { setMouzas((data as any) ?? []); setL("mou", false); });
  }, [mouzaOnly]);

  useEffect(() => {
    if (mouzaOnly) return;
    setL("div", true);
    supabase.from("divisions").select("id,name,name_bn").eq("is_active", true).order("name")
      .then(({ data }) => { setDivisions((data as any) ?? []); setL("div", false); });
  }, [mouzaOnly]);

  useEffect(() => {
    if (!value.division_id) { setDistricts([]); return; }
    setL("dis", true);
    supabase.from("districts").select("id,name,name_bn").eq("division_id", value.division_id).eq("is_active", true).order("name")
      .then(({ data }) => { setDistricts((data as any) ?? []); setL("dis", false); });
  }, [value.division_id]);

  useEffect(() => {
    if (!value.district_id) { setUpazilas([]); return; }
    setL("upa", true);
    supabase.from("upazilas").select("id,name,name_bn").eq("district_id", value.district_id).eq("is_active", true).order("name")
      .then(({ data }) => { setUpazilas((data as any) ?? []); setL("upa", false); });
  }, [value.district_id]);

  useEffect(() => {
    if (!value.upazila_id) { setMouzas([]); return; }
    setL("mou", true);
    supabase.from("mouzas").select("id,name,name_bn").eq("upazila_id", value.upazila_id).eq("is_active", true).order("name")
      .then(({ data }) => { setMouzas((data as any) ?? []); setL("mou", false); });
  }, [value.upazila_id]);

  const set = (patch: Partial<LocationValue>) => onChange({ ...value, ...patch });
  const toVal = (id: string | null | undefined) => id ?? NONE;
  const fromVal = (v: string) => (v === NONE ? null : v);

  const renderSelect = (
    level: PickerLevel,
    fallbackLabel: string,
    list: Row[],
    selected: string | null | undefined,
    enabled: boolean,
    isLoading: boolean,
    onPick: (v: string | null, row?: Row) => void,
    parentLabel?: string,
  ) => {
    const isErr = errorLevel === level;
    const label = labels?.[level] ?? fallbackLabel;
    return (
      <div data-level={level}>
        <Label className={"text-xs " + (isErr ? "text-destructive" : "")}>{label}{isErr ? " *" : ""}</Label>
        <Select value={toVal(selected)} disabled={!enabled || isLoading} onValueChange={(v) => {
          const id = fromVal(v);
          const row = id ? list.find((r) => r.id === id) : undefined;
          onPick(id, row);
        }}>
          <SelectTrigger
            aria-invalid={isErr || undefined}
            aria-describedby={isErr ? `loc-err-${level}` : undefined}
            className={isErr ? "border-destructive ring-2 ring-destructive/40 focus:ring-destructive" : ""}
            data-testid={`loc-select-${level}`}
          >
            {isLoading ? (
              <span className="flex items-center text-sm text-muted-foreground"><Loader2 className="h-3 w-3 mr-1 animate-spin"/>Loading…</span>
            ) : (
              <SelectValue placeholder={enabled ? "—" : `Select ${parentLabel} first`} />
            )}
          </SelectTrigger>
          <SelectContent>
            <SelectItem value={NONE}>—</SelectItem>
            {list.map((d) => (
              <SelectItem key={d.id} value={d.id}>
                {d.name}{d.name_bn ? ` (${d.name_bn})` : ""}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        {isErr && errorMessage && (
          <p id={`loc-err-${level}`} role="alert" data-testid={`loc-err-${level}`} className="mt-1 text-xs text-destructive">
            {errorMessage}
          </p>
        )}
      </div>
    );
  };

  const villageErr = errorLevel === "village";

  if (mouzaOnly) {
    const isErr = errorLevel === "mouza";
    const label = labels?.mouza ?? "Mouza";
    const selected = mouzas.find((m) => m.id === value.mouza_id);
    return (
      <div className={"grid grid-cols-1 sm:grid-cols-2 gap-3 " + (className ?? "")}>
        <div data-level="mouza">
          <Label className={"text-xs " + (isErr ? "text-destructive" : "")}>{label}{isErr ? " *" : ""}</Label>
          <Popover open={mouzaOpen} onOpenChange={setMouzaOpen}>
            <PopoverTrigger asChild>
              <Button
                variant="outline"
                role="combobox"
                aria-expanded={mouzaOpen}
                aria-invalid={isErr || undefined}
                data-testid="loc-select-mouza"
                disabled={loading.mou}
                className={cn("w-full justify-between font-normal", isErr && "border-destructive ring-2 ring-destructive/40")}
              >
                {loading.mou ? (
                  <span className="flex items-center text-muted-foreground"><Loader2 className="h-3 w-3 mr-1 animate-spin" />Loading…</span>
                ) : (
                  <span className={cn(!selected && "text-muted-foreground")}>
                    {selected ? `${selected.name}${selected.name_bn ? ` (${selected.name_bn})` : ""}` : "—"}
                  </span>
                )}
                <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
              </Button>
            </PopoverTrigger>
            <PopoverContent className="w-[--radix-popover-trigger-width] p-0" align="start">
              <Command>
                <CommandInput placeholder={label} />
                <CommandList>
                  <CommandEmpty>
                    {mouzas.length === 0 ? (labels?.mouza ? `${label}: —` : "No Mouza available") : "No match"}
                  </CommandEmpty>
                  <CommandGroup>
                    {mouzas.map((m) => (
                      <CommandItem
                        key={m.id}
                        value={`${m.name} ${m.name_bn ?? ""}`}
                        onSelect={() => {
                          set({ mouza_id: m.id, mouza_name: m.name, division_id: null, district_id: null, upazila_id: null });
                          setMouzaOpen(false);
                        }}
                      >
                        <Check className={cn("mr-2 h-4 w-4", value.mouza_id === m.id ? "opacity-100" : "opacity-0")} />
                        {m.name}{m.name_bn ? ` (${m.name_bn})` : ""}
                      </CommandItem>
                    ))}
                  </CommandGroup>
                </CommandList>
              </Command>
            </PopoverContent>
          </Popover>
          {isErr && errorMessage && (
            <p id="loc-err-mouza" role="alert" data-testid="loc-err-mouza" className="mt-1 text-xs text-destructive">{errorMessage}</p>
          )}
          {!loading.mou && mouzas.length === 0 && (
            <p className="mt-1 text-xs text-muted-foreground">No Mouza configured — add from Settings → Mouza.</p>
          )}
        </div>
      </div>
    );
  }

  return (
    <div className={"grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3 " + (className ?? "")}>
      {renderSelect("division", labels?.division ?? "Division", divisions, value.division_id, true, loading.div,
        (v) => set({ division_id: v, district_id: null, upazila_id: null, mouza_id: null, mouza_name: null }))}
      {renderSelect("district", labels?.district ?? "District", districts, value.district_id, !!value.division_id, loading.dis,
        (v) => set({ district_id: v, upazila_id: null, mouza_id: null, mouza_name: null }), "Division")}
      {renderSelect("upazila", labels?.upazila ?? "Upazila", upazilas, value.upazila_id, !!value.district_id, loading.upa,
        (v) => set({ upazila_id: v, mouza_id: null, mouza_name: null }), "District")}
      {renderSelect("mouza", labels?.mouza ?? "Mouza", mouzas, value.mouza_id, !!value.upazila_id, loading.mou,
        (v, row) => set({ mouza_id: v, mouza_name: row?.name ?? null }), "Upazila")}
      {showVillage && (
        <div data-level="village">
          <Label className={"text-xs " + (villageErr ? "text-destructive" : "")}>{labels?.village ?? "Village"}</Label>
          <Input
            value={value.village ?? ""}
            onChange={(e) => set({ village: e.target.value || null })}
            placeholder="Village name"
            data-testid="loc-input-village"
            className={villageErr ? "border-destructive ring-2 ring-destructive/40" : ""}
          />
          {villageErr && errorMessage && (
            <p id="loc-err-village" role="alert" className="mt-1 text-xs text-destructive">{errorMessage}</p>
          )}
        </div>
      )}
    </div>
  );
}
