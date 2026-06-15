import { supabase } from "@/integrations/supabase/client";

export type MemberCheck = {
  ok: boolean;
  reason?: string;
  farmer?: { status?: string | null; member_no?: string | null; name_en?: string | null };
};

/**
 * Savings & Loans transactions are member-only:
 * a farmer may transact savings/loans ONLY when the farmer is an active member
 * (status === 'active') AND has a member number (member_no).
 * Every farmer is not a member, but every member is a farmer.
 * This check does NOT apply to irrigation/other modules.
 */
export async function checkMemberEligibility(
  farmerId: string,
  tx: (en: string, bn: string) => string,
): Promise<MemberCheck> {
  if (!farmerId) return { ok: false, reason: tx("Select a farmer", "ফার্মার নির্বাচন করুন") };
  const { data } = await supabase
    .from("farmers")
    .select("status,member_no,name_en")
    .eq("id", farmerId)
    .maybeSingle();
  const name = data?.name_en || tx("This farmer", "এই ফার্মার");
  if (!data) return { ok: false, reason: tx("Farmer not found", "ফার্মার পাওয়া যায়নি") };
  if (String(data.status) !== "active") {
    return {
      ok: false,
      farmer: data,
      reason: `${name} ${tx("is not an active member — savings/loan transactions are not allowed.", "একটিভ সদস্য নয় — সঞ্চয়/ঋণ ট্রানজেকশন করা যাবে না।")}`,
    };
  }
  if (!data.member_no || String(data.member_no).trim() === "") {
    return {
      ok: false,
      farmer: data,
      reason: `${name} ${tx("has no member number — savings/loan transactions are not allowed.", "এর সদস্য নাম্বার নেই — সঞ্চয়/ঋণ ট্রানজেকশন করা যাবে না।")}`,
    };
  }
  return { ok: true, farmer: data };
}
