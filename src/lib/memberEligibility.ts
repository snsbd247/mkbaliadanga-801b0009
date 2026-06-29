import { supabase } from "@/integrations/supabase/client";

import { db } from "@/lib/db";
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
      reason: `${name} ${tx(
        "is not an active member — savings/loan transactions are blocked. Fix: set the member status to Active in the farmer profile.",
        "একটিভ সদস্য নয় — সঞ্চয়/ঋণ ট্রানজেকশন বন্ধ। সমাধান: ফার্মার প্রোফাইলে সদস্য স্ট্যাটাস 'একটিভ' করুন।",
      )}`,
    };
  }
  if (!isValidMemberNo(farmer.member_no)) {
    return {
      ok: false,
      farmer,
      reason: `${name} ${tx(
        "has a missing or invalid member number — savings/loan transactions are blocked. Fix: add a valid member number (digits, 1–20 characters) in the farmer profile.",
        "এর সদস্য নাম্বার নেই বা সঠিক নয় — সঞ্চয়/ঋণ ট্রানজেকশন বন্ধ। সমাধান: ফার্মার প্রোফাইলে সঠিক সদস্য নাম্বার (সংখ্যা, ১–২০ অক্ষর) দিন।",
      )}`,
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
  const { data } = await db
    .from("farmers")
    .select("status,member_no,name_en,office_id")
    .eq("id", farmerId)
    .maybeSingle();
  return evaluateMemberEligibility(data, tx);
}

/** Determine the block reason code from a farmer record (for audit). */
function blockReasonCode(farmer: { status?: string | null; member_no?: string | null } | null): string | null {
  if (!farmer) return "FARMER_MISSING";
  if (String(farmer.status) !== "active") return "MEMBER_INACTIVE";
  if (!isValidMemberNo(farmer.member_no)) return "MEMBER_NO_INVALID";
  return null;
}

/**
 * Checks eligibility for a savings/loan transaction and, when blocked, records an
 * audit row (user, office, farmer, type, reason). Returns the eligibility result.
 */
export async function guardSavingsLoan(
  farmerId: string,
  transactionType: "savings" | "loan",
  tx: (en: string, bn: string) => string,
): Promise<MemberCheck> {
  if (!farmerId) return { ok: false, reason: tx("Select a farmer", "ফার্মার নির্বাচন করুন") };
  const { data } = await db
    .from("farmers")
    .select("status,member_no,name_en,office_id")
    .eq("id", farmerId)
    .maybeSingle();
  const result = evaluateMemberEligibility(data as any, tx);
  if (!result.ok) {
    const reason = blockReasonCode(data as any) ?? "BLOCKED";
    try {
      const { data: auth } = await supabase.auth.getUser();
      await db.from("member_block_audit").insert({
        attempted_by: auth?.user?.id ?? null,
        office_id: (data as any)?.office_id ?? null,
        farmer_id: farmerId,
        transaction_type: transactionType,
        reason,
        member_no: (data as any)?.member_no ?? null,
      });
    } catch { /* audit must never break the user flow */ }
  }
  return result;
}

