import { db } from "@/lib/db";
import { logAssetAudit } from "./assetAudit";

/**
 * Insert a small set of demo asset scenarios for the given office.
 * - 2 categories (quantity + serial)
 * - 3 assets covering: in-stock with movement, installed, and a disposal w/ loss
 * - stock rows, movement, maintenance, disposal
 *
 * Idempotent-ish: skips if codes already exist for this office.
 */
export async function seedDemoAssets(officeId: string, userId: string | null): Promise<{ created: number; skipped: boolean; }> {
  // Check if already seeded
  const probe = await db.from("assets" as any)
    .select("id").eq("office_id", officeId).eq("asset_code", "DEMO-PUMP-001").limit(1);
  if (probe.data && probe.data.length > 0) return { created: 0, skipped: true };

  const ts = new Date().toISOString().slice(0, 10);

  // Categories
  const catIns = await db.from("asset_categories" as any).insert([
    { office_id: officeId, code: "DEMO-EQ", name_en: "Demo Equipment", name_bn: "ডেমো যন্ত্রপাতি", tracking_mode: "serial", is_active: true },
    { office_id: officeId, code: "DEMO-CONS", name_en: "Demo Consumables", name_bn: "ডেমো ভোগ্যপণ্য", tracking_mode: "quantity", is_active: true },
  ]).select("id, code");
  if (catIns.error) throw catIns.error;
  const eqCat = (catIns.data as any[]).find(c => c.code === "DEMO-EQ")?.id;
  const consCat = (catIns.data as any[]).find(c => c.code === "DEMO-CONS")?.id;

  // Assets
  const assetIns = await db.from("assets" as any).insert([
    { office_id: officeId, asset_category_id: eqCat, asset_code: "DEMO-PUMP-001", serial_no: "SN-PUMP-001", name_en: "Demo Pump", name_bn: "ডেমো পাম্প", tracking_mode: "serial", purchase_price: 45000, current_status: "installed", unit: "pcs" },
    { office_id: officeId, asset_category_id: eqCat, asset_code: "DEMO-MOTOR-002", serial_no: "SN-MOT-002", name_en: "Demo Motor", name_bn: "ডেমো মোটর", tracking_mode: "serial", purchase_price: 32000, current_status: "in_stock", unit: "pcs" },
    { office_id: officeId, asset_category_id: consCat, asset_code: "DEMO-PIPE-003", serial_no: null, name_en: "Demo Pipe", name_bn: "ডেমো পাইপ", tracking_mode: "quantity", purchase_price: 250, current_status: "in_stock", unit: "ft" },
    { office_id: officeId, asset_category_id: eqCat, asset_code: "DEMO-OLD-004", serial_no: "SN-OLD-004", name_en: "Demo Retired Unit", name_bn: "ডেমো অবসর ইউনিট", tracking_mode: "serial", purchase_price: 18000, current_status: "disposed", unit: "pcs" },
  ]).select("id, asset_code");
  if (assetIns.error) throw assetIns.error;
  const A: Record<string, string> = {};
  for (const r of assetIns.data as any[]) A[r.asset_code] = r.id;

  // Stocks (use null location_id since locations vary per project)
  await db.from("asset_stocks" as any).insert([
    { office_id: officeId, asset_id: A["DEMO-MOTOR-002"], location_id: null, quantity: 1 },
    { office_id: officeId, asset_id: A["DEMO-PIPE-003"], location_id: null, quantity: 120 },
  ]);

  // Movement (consumable transfer)
  await db.from("asset_movements" as any).insert({
    office_id: officeId, asset_id: A["DEMO-PIPE-003"], movement_date: ts,
    from_location_id: null, to_location_id: null, quantity: 30,
    moved_by: userId, remarks: "Demo: site delivery 30 ft",
  });

  // Maintenance (closed)
  await db.from("asset_maintenance_logs" as any).insert({
    office_id: officeId, asset_id: A["DEMO-PUMP-001"],
    started_at: ts, ended_at: ts, vendor: "Demo Service Co.",
    cost: 1500, status: "completed", remarks: "Demo: routine maintenance",
  });

  // Disposal with loss (sale 5000 vs book 12000)
  const disp = await db.from("asset_disposals" as any).insert({
    office_id: officeId, asset_id: A["DEMO-OLD-004"], disposal_date: ts,
    method: "scrap_sale", sale_amount: 5000, book_value: 12000, gain_loss: -7000,
    remarks: "Demo: scrap sale below book value", created_by: userId,
  }).select("id").single();

  await logAssetAudit({
    office_id: officeId, entity: "demo_seed", action_type: "create",
    remarks: `Seeded 4 demo assets, 1 movement, 1 maintenance, 1 disposal (id=${(disp.data as any)?.id?.slice(0, 8) ?? "?"})`,
  });

  return { created: 4, skipped: false };
}
