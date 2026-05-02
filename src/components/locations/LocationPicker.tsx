import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Loader2 } from "lucide-react";

export type LocationValue = {
  division_id?: string | null;
  district_id?: string | null;
  upazila_id?: string | null;
  union_id?: string | null;
  ward_id?: string | null;
  village_id?: string | null;
  mouza_id?: string | null;
};

type Row = { id: string; name: string; name_bn?: string | null };

const NONE = "__none__";

export type PickerLevel =
  | "division" | "district" | "upazila" | "union" | "ward" | "village" | "mouza";

interface Props {
  value: LocationValue;
  onChange: (v: LocationValue) => void;
  className?: string;
  /** Highlight a specific level as invalid (red ring + inline message). */
  errorLevel?: PickerLevel | null;
  /** Inline message shown under the highlighted Select. */
  errorMessage?: string | null;
  /** Translated labels for each level (BN/EN aware). Falls back to English. */
  labels?: Partial<Record<PickerLevel, string>>;
}

/**
 * Strict cascading picker: division → district → upazila → union → ward → village → mouza.
 * Each child is disabled until its parent is selected; changing a parent resets all descendants.
 * All fields are optional at submit-time (existing records without locations stay valid),
 * but the chain is enforced — you cannot pick a child without its ancestors.
 */
export function LocationPicker({ value, onChange, className }: Props) {
  const [divisions, setDivisions] = useState<Row[]>([]);
  const [districts, setDistricts] = useState<Row[]>([]);
  const [upazilas, setUpazilas] = useState<Row[]>([]);
  const [unions, setUnions] = useState<Row[]>([]);
  const [wards, setWards] = useState<Row[]>([]);
  const [villages, setVillages] = useState<Row[]>([]);
  const [mouzas, setMouzas] = useState<Row[]>([]);

  const [loading, setLoading] = useState({
    div: false, dis: false, upa: false, uni: false, war: false, vil: false, mou: false,
  });

  const setL = (k: keyof typeof loading, v: boolean) => setLoading((s) => ({ ...s, [k]: v }));

  // Divisions once
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

  useEffect(() => {
    if (!value.upazila_id) { setUnions([]); return; }
    setL("uni", true);
    supabase.from("unions").select("id,name,name_bn").eq("upazila_id", value.upazila_id).eq("is_active", true).order("name")
      .then(({ data }) => { setUnions((data as any) ?? []); setL("uni", false); });
  }, [value.upazila_id]);

  useEffect(() => {
    if (!value.union_id) { setWards([]); return; }
    setL("war", true);
    supabase.from("wards").select("id,name,name_bn").eq("union_id", value.union_id).eq("is_active", true).order("name")
      .then(({ data }) => { setWards((data as any) ?? []); setL("war", false); });
  }, [value.union_id]);

  useEffect(() => {
    if (!value.ward_id) { setVillages([]); return; }
    setL("vil", true);
    (supabase.from as any)("villages").select("id,name,name_bn").eq("ward_id", value.ward_id).eq("is_active", true).order("name")
      .then(({ data }: any) => { setVillages((data as any) ?? []); setL("vil", false); });
  }, [value.ward_id]);

  useEffect(() => {
    if (!value.village_id) { setMouzas([]); return; }
    setL("mou", true);
    // Mouzas in this picker are strictly scoped to the chosen village's ward + union.
    // Schema: mouzas.union_id (required), mouzas.ward_id (optional).
    let q: any = supabase.from("mouzas").select("id,name,name_bn,ward_id,union_id").eq("is_active", true).order("name");
    if (value.union_id) q = q.eq("union_id", value.union_id);
    if (value.ward_id) q = q.or(`ward_id.eq.${value.ward_id},ward_id.is.null`);
    q.then(({ data }: any) => { setMouzas((data as any) ?? []); setL("mou", false); });
  }, [value.village_id, value.ward_id, value.union_id]);

  const set = (patch: Partial<LocationValue>) => onChange({ ...value, ...patch });

  const toVal = (id: string | null | undefined) => id ?? NONE;
  const fromVal = (v: string) => (v === NONE ? null : v);

  const renderSelect = (
    label: string,
    list: Row[],
    selected: string | null | undefined,
    enabled: boolean,
    isLoading: boolean,
    onPick: (v: string | null) => void,
    parentLabel?: string,
  ) => (
    <div>
      <Label className="text-xs">{label}</Label>
      <Select value={toVal(selected)} disabled={!enabled || isLoading} onValueChange={(v) => onPick(fromVal(v))}>
        <SelectTrigger>
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
    </div>
  );

  return (
    <div className={"grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3 " + (className ?? "")}>
      {renderSelect("Division", divisions, value.division_id, true, loading.div,
        (v) => set({ division_id: v, district_id: null, upazila_id: null, union_id: null, ward_id: null, village_id: null, mouza_id: null }))}

      {renderSelect("District", districts, value.district_id, !!value.division_id, loading.dis,
        (v) => set({ district_id: v, upazila_id: null, union_id: null, ward_id: null, village_id: null, mouza_id: null }), "Division")}

      {renderSelect("Upazila", upazilas, value.upazila_id, !!value.district_id, loading.upa,
        (v) => set({ upazila_id: v, union_id: null, ward_id: null, village_id: null, mouza_id: null }), "District")}

      {renderSelect("Union", unions, value.union_id, !!value.upazila_id, loading.uni,
        (v) => set({ union_id: v, ward_id: null, village_id: null, mouza_id: null }), "Upazila")}

      {renderSelect("Ward", wards, value.ward_id, !!value.union_id, loading.war,
        (v) => set({ ward_id: v, village_id: null, mouza_id: null }), "Union")}

      {renderSelect("Village", villages, value.village_id, !!value.ward_id, loading.vil,
        (v) => set({ village_id: v, mouza_id: null }), "Ward")}

      {renderSelect("Mouza", mouzas, value.mouza_id, !!value.village_id, loading.mou,
        (v) => set({ mouza_id: v }), "Village")}
    </div>
  );
}
