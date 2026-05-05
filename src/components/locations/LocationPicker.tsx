import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Loader2 } from "lucide-react";

export type LocationValue = {
  division_id?: string | null;
  district_id?: string | null;
  upazila_id?: string | null;
  village?: string | null;
  // Legacy fields kept for backward compatibility (always null/unused).
  union_id?: string | null;
  ward_id?: string | null;
  village_id?: string | null;
  mouza_id?: string | null;
};

type Row = { id: string; name: string; name_bn?: string | null };

const NONE = "__none__";

export type PickerLevel = "division" | "district" | "upazila" | "village";

interface Props {
  value: LocationValue;
  onChange: (v: LocationValue) => void;
  className?: string;
  errorLevel?: PickerLevel | null;
  errorMessage?: string | null;
  labels?: Partial<Record<PickerLevel, string>>;
}

/**
 * Simplified cascading picker: division → district → upazila + free-text village.
 * Each child select is disabled until its parent is selected; changing a parent resets descendants.
 */
export function LocationPicker({ value, onChange, className, errorLevel = null, errorMessage = null, labels }: Props) {
  const [divisions, setDivisions] = useState<Row[]>([]);
  const [districts, setDistricts] = useState<Row[]>([]);
  const [upazilas, setUpazilas] = useState<Row[]>([]);

  const [loading, setLoading] = useState({ div: false, dis: false, upa: false });
  const setL = (k: keyof typeof loading, v: boolean) => setLoading((s) => ({ ...s, [k]: v }));

  useEffect(() => {
    setL("div", true);
    supabase.from("divisions").select("id,name,name_bn").eq("is_active", true).order("name")
      .then(({ data }) => { setDivisions((data as any) ?? []); setL("div", false); });
  }, []);

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
    onPick: (v: string | null) => void,
    parentLabel?: string,
  ) => {
    const isErr = errorLevel === level;
    const label = labels?.[level] ?? fallbackLabel;
    return (
      <div data-level={level}>
        <Label className={"text-xs " + (isErr ? "text-destructive" : "")}>{label}{isErr ? " *" : ""}</Label>
        <Select value={toVal(selected)} disabled={!enabled || isLoading} onValueChange={(v) => onPick(fromVal(v))}>
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
  return (
    <div className={"grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3 " + (className ?? "")}>
      {renderSelect("division", labels?.division ?? "Division", divisions, value.division_id, true, loading.div,
        (v) => set({ division_id: v, district_id: null, upazila_id: null }))}
      {renderSelect("district", labels?.district ?? "District", districts, value.district_id, !!value.division_id, loading.dis,
        (v) => set({ district_id: v, upazila_id: null }), "Division")}
      {renderSelect("upazila", labels?.upazila ?? "Upazila", upazilas, value.upazila_id, !!value.district_id, loading.upa,
        (v) => set({ upazila_id: v }), "District")}
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
    </div>
  );
}
