import { supabase } from "@/integrations/supabase/client";

export type MemberCheck = {
  ok: boolean;
  reason?: string;
  farmer?: { status?: string | null; member_no?: string | null; name_en?: string | null };
};

/** Allowed member number format: 1–20 chars, digits/letters/-// and must contain a digit. */
const MEMBER_NO_RE = /^[0-9A-Za-z\-/]{1,20}$/;

/** Pure, synchronous validation of a member number string. */
export function isValidMemberNo(memberNo: unknown): boolean {
  if (memberNo == null) return false;
  const s = String(memberNo).trim();
  if (s === "") return false;
  if (!MEMBER_NO_RE.test(s)) return false;
  return /\d/.test(s); // must contain at least one digit
}

/** Pure, synchronous eligibility rule shared by all callers. */
export function evaluateMemberEligibility(
  farmer: { status?: string | null; member_no?: string | null; name_en?: string | null } | null | undefined,
  tx: (en: string, bn: string) => string,
): MemberCheck {
  const name = farmer?.name_en || tx("This farmer", "এই ফার্মার");
  if (!farmer) return { ok: false, reason: tx("Farmer not found", "ফার্মার পাওয়া যায়নি") };
  if (String(farmer.status) !== "active") {
    return {
      ok: false,
      farmer,
      reason: `${name} ${tx("is not an active member — savings/loan transactions are not allowed.", "একটিভ সদস্য নয় — সঞ্চয়/ঋণ ট্রানজেকশন করা যাবে না।")}`,
    };
  }
  if (!isValidMemberNo(farmer.member_no)) {
    return {
      ok: false,
      farmer,
      reason: `${name} ${tx("has a missing or invalid member number — savings/loan transactions are not allowed.", "এর সদস্য নাম্বার নেই বা সঠিক নয় — সঞ্চয়/ঋণ ট্রানজেকশন করা যাবে না।")}`,
    };
  }
  return { ok: true, farmer };
}

/**
 * Savings & Loans transactions are member-only:
 * a farmer may transact savings/loans ONLY when the farmer is an active member
 * (status === 'active') AND has a valid member number (member_no).
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
  return evaluateMemberEligibility(data, tx);
}
