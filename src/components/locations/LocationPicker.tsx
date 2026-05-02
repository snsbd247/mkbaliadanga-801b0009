import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";

export type LocationValue = {
  division_id?: string | null;
  district_id?: string | null;
  upazila_id?: string | null;
  union_id?: string | null;
  ward_id?: string | null;
  mouza_id?: string | null;
};

type Row = { id: string; name: string; name_bn?: string | null };

const NONE = "__none__";

interface Props {
  value: LocationValue;
  onChange: (v: LocationValue) => void;
  className?: string;
}

/**
 * Cascading picker for division → district → upazila → union → ward → mouza.
 * All fields are optional. Existing records without locations stay valid.
 */
export function LocationPicker({ value, onChange, className }: Props) {
  const [divisions, setDivisions] = useState<Row[]>([]);
  const [districts, setDistricts] = useState<Row[]>([]);
  const [upazilas, setUpazilas] = useState<Row[]>([]);
  const [unions, setUnions] = useState<Row[]>([]);
  const [wards, setWards] = useState<Row[]>([]);
  const [mouzas, setMouzas] = useState<Row[]>([]);

  // Load divisions once
  useEffect(() => {
    supabase.from("divisions").select("id,name,name_bn").eq("is_active", true).order("name")
      .then(({ data }) => setDivisions((data as any) ?? []));
  }, []);

  // Cascading loaders
  useEffect(() => {
    if (!value.division_id) { setDistricts([]); return; }
    supabase.from("districts").select("id,name,name_bn").eq("division_id", value.division_id).eq("is_active", true).order("name")
      .then(({ data }) => setDistricts((data as any) ?? []));
  }, [value.division_id]);

  useEffect(() => {
    if (!value.district_id) { setUpazilas([]); return; }
    supabase.from("upazilas").select("id,name,name_bn").eq("district_id", value.district_id).eq("is_active", true).order("name")
      .then(({ data }) => setUpazilas((data as any) ?? []));
  }, [value.district_id]);

  useEffect(() => {
    if (!value.upazila_id) { setUnions([]); return; }
    supabase.from("unions").select("id,name,name_bn").eq("upazila_id", value.upazila_id).eq("is_active", true).order("name")
      .then(({ data }) => setUnions((data as any) ?? []));
  }, [value.upazila_id]);

  useEffect(() => {
    if (!value.union_id) { setWards([]); setMouzas([]); return; }
    supabase.from("wards").select("id,name,name_bn").eq("union_id", value.union_id).eq("is_active", true).order("name")
      .then(({ data }) => setWards((data as any) ?? []));
    // Mouzas linked via union (ward optional)
    supabase.from("mouzas").select("id,name,name_bn,ward_id").eq("union_id", value.union_id).eq("is_active", true).order("name")
      .then(({ data }) => setMouzas((data as any) ?? []));
  }, [value.union_id]);

  const set = (patch: Partial<LocationValue>) => onChange({ ...value, ...patch });

  const toVal = (id: string | null | undefined) => id ?? NONE;
  const fromVal = (v: string) => (v === NONE ? null : v);

  const filteredMouzas = value.ward_id
    ? mouzas.filter((m: any) => m.ward_id === value.ward_id || !m.ward_id)
    : mouzas;

  return (
    <div className={"grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3 " + (className ?? "")}>
      <div>
        <Label className="text-xs">Division</Label>
        <Select value={toVal(value.division_id)} onValueChange={(v) => set({
          division_id: fromVal(v), district_id: null, upazila_id: null, union_id: null, ward_id: null, mouza_id: null,
        })}>
          <SelectTrigger><SelectValue placeholder="—" /></SelectTrigger>
          <SelectContent>
            <SelectItem value={NONE}>—</SelectItem>
            {divisions.map((d) => <SelectItem key={d.id} value={d.id}>{d.name}{d.name_bn ? ` (${d.name_bn})` : ""}</SelectItem>)}
          </SelectContent>
        </Select>
      </div>
      <div>
        <Label className="text-xs">District</Label>
        <Select disabled={!value.division_id} value={toVal(value.district_id)} onValueChange={(v) => set({
          district_id: fromVal(v), upazila_id: null, union_id: null, ward_id: null, mouza_id: null,
        })}>
          <SelectTrigger><SelectValue placeholder="—" /></SelectTrigger>
          <SelectContent>
            <SelectItem value={NONE}>—</SelectItem>
            {districts.map((d) => <SelectItem key={d.id} value={d.id}>{d.name}</SelectItem>)}
          </SelectContent>
        </Select>
      </div>
      <div>
        <Label className="text-xs">Upazila</Label>
        <Select disabled={!value.district_id} value={toVal(value.upazila_id)} onValueChange={(v) => set({
          upazila_id: fromVal(v), union_id: null, ward_id: null, mouza_id: null,
        })}>
          <SelectTrigger><SelectValue placeholder="—" /></SelectTrigger>
          <SelectContent>
            <SelectItem value={NONE}>—</SelectItem>
            {upazilas.map((d) => <SelectItem key={d.id} value={d.id}>{d.name}</SelectItem>)}
          </SelectContent>
        </Select>
      </div>
      <div>
        <Label className="text-xs">Union</Label>
        <Select disabled={!value.upazila_id} value={toVal(value.union_id)} onValueChange={(v) => set({
          union_id: fromVal(v), ward_id: null, mouza_id: null,
        })}>
          <SelectTrigger><SelectValue placeholder="—" /></SelectTrigger>
          <SelectContent>
            <SelectItem value={NONE}>—</SelectItem>
            {unions.map((d) => <SelectItem key={d.id} value={d.id}>{d.name}</SelectItem>)}
          </SelectContent>
        </Select>
      </div>
      <div>
        <Label className="text-xs">Ward</Label>
        <Select disabled={!value.union_id} value={toVal(value.ward_id)} onValueChange={(v) => set({
          ward_id: fromVal(v), mouza_id: null,
        })}>
          <SelectTrigger><SelectValue placeholder="—" /></SelectTrigger>
          <SelectContent>
            <SelectItem value={NONE}>—</SelectItem>
            {wards.map((d) => <SelectItem key={d.id} value={d.id}>{d.name}</SelectItem>)}
          </SelectContent>
        </Select>
      </div>
      <div>
        <Label className="text-xs">Mouza</Label>
        <Select disabled={!value.union_id} value={toVal(value.mouza_id)} onValueChange={(v) => set({ mouza_id: fromVal(v) })}>
          <SelectTrigger><SelectValue placeholder="—" /></SelectTrigger>
          <SelectContent>
            <SelectItem value={NONE}>—</SelectItem>
            {filteredMouzas.map((d) => <SelectItem key={d.id} value={d.id}>{d.name}</SelectItem>)}
          </SelectContent>
        </Select>
      </div>
    </div>
  );
}
