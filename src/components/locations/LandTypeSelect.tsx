import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useLang } from "@/i18n/LanguageProvider";

export type LandTypeRow = { id: string; code: string; name: string; name_bn?: string | null };

// Map a catalogue land_type code → legacy `field_type` enum (lands.field_type).
// Custom/extra types fall back to "other" so the enum column stays valid.
export function codeToFieldType(code?: string | null): "high_land" | "medium_land" | "low_land" | "other" {
  switch ((code ?? "").toUpperCase()) {
    case "HIGH": return "high_land";
    case "MEDIUM": return "medium_land";
    case "LOW": return "low_land";
    default: return "other";
  }
}

// Map a legacy field_type enum → catalogue code (for resolving older rows w/o land_type_id).
function fieldTypeToCode(ft?: string | null): string {
  switch ((ft ?? "").toLowerCase()) {
    case "high_land": return "HIGH";
    case "medium_land": return "MEDIUM";
    case "low_land": return "LOW";
    default: return "OTHER";
  }
}

let _cache: LandTypeRow[] | null = null;

/** Shared loader for the active land-type catalogue.
 *  Seeds instantly from a session cache, but ALWAYS refetches on mount so land
 *  types newly added in Irrigation Settings show up without a full page reload. */
export function useLandTypes() {
  const [rows, setRows] = useState<LandTypeRow[]>(_cache ?? []);
  const [loading, setLoading] = useState(!_cache);
  useEffect(() => {
    let cancelled = false;
    supabase.from("land_types" as any)
      .select("id,code,name,name_bn")
      .eq("is_active", true)
      .is("deleted_at", null)
      .order("sort_order")
      .then(({ data }) => {
        if (cancelled) return;
        _cache = ((data as any[]) ?? []) as LandTypeRow[];
        setRows(_cache);
        setLoading(false);
      });
    return () => { cancelled = true; };
  }, []);
  return { rows, loading };
}

/** Resolve a readable land-type label from a row using land_type_id then field_type. */
export function landTypeLabel(
  rows: LandTypeRow[],
  landTypeId?: string | null,
  fieldType?: string | null,
  bn = true,
): string {
  let hit = landTypeId ? rows.find((r) => r.id === landTypeId) : undefined;
  if (!hit && fieldType) {
    const code = fieldTypeToCode(fieldType);
    hit = rows.find((r) => (r.code ?? "").toUpperCase() === code);
  }
  if (hit) return (bn ? hit.name_bn || hit.name : hit.name) || hit.code;
  return fieldType ?? "";
}

interface Props {
  landTypeId: string | null | undefined;
  fieldType: string | null | undefined;
  onChange: (landTypeId: string, fieldType: string) => void;
  disabled?: boolean;
  className?: string;
}

/**
 * Dropdown sourced from the `land_types` catalogue (Irrigation Settings).
 * Stores both `land_type_id` (FK) and the legacy `field_type` enum for backward compat.
 */
export function LandTypeSelect({ landTypeId, fieldType, onChange, disabled, className }: Props) {
  const { tx } = useLang();
  const { rows, loading } = useLandTypes();

  // Derive the currently-selected catalogue id (fall back to matching the legacy enum).
  let currentId = landTypeId ?? "";
  if (!currentId && fieldType) {
    const code = fieldTypeToCode(fieldType);
    const m = rows.find((r) => (r.code ?? "").toUpperCase() === code);
    if (m) currentId = m.id;
  }

  return (
    <Select
      value={currentId}
      disabled={disabled || loading}
      onValueChange={(id) => {
        const row = rows.find((r) => r.id === id);
        onChange(id, codeToFieldType(row?.code));
      }}
    >
      <SelectTrigger className={className}>
        <SelectValue placeholder={loading ? tx("Loading…", "লোড হচ্ছে…") : tx("Select land type", "জমির ধরন নির্বাচন")} />
      </SelectTrigger>
      <SelectContent>
        {rows.length === 0 && !loading && (
          <div className="px-2 py-1.5 text-sm text-muted-foreground">{tx("No land type configured", "কোনো জমির ধরন নেই")}</div>
        )}
        {rows.map((r) => (
          <SelectItem key={r.id} value={r.id}>{r.name_bn || r.name}</SelectItem>
        ))}
      </SelectContent>
    </Select>
  );
}
