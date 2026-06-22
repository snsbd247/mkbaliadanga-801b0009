// "জমির ধরন" resolver for the irrigation receipt.
//
// Rule (per client spec):
//  - ধান জাতীয় সিজন (আমন/ইরি/বোরো) হলে জমির উচ্চতা দেখানো হবে: উচু/নিচু/মাঝারি
//    (এই তথ্য land_type_name এ সংরক্ষিত থাকে)।
//  - অন্য ধরন (বিঘা/বিঘাত, পুকুর, সবজি, ভর্তি ফি ইত্যাদি) হলে সেই ক্যাটেগরির
//    নামই দেখানো হবে (irrigation_category_name)।

const RICE_HINTS = ["আমন", "ইরি", "বোরো", "ধান", "aman", "iri", "boro", "paddy", "rice"];

function isRiceCategory(categoryName?: string | null, seasonName?: string | null): boolean {
  const hay = `${categoryName ?? ""} ${seasonName ?? ""}`.toLowerCase();
  return RICE_HINTS.some((h) => hay.includes(h.toLowerCase()));
}

/**
 * Returns the label shown in the "জমির ধরন" row.
 * For rice seasons → land elevation (land_type_name). Otherwise → category name.
 */
export function resolveFieldTypeLabel(opts: {
  categoryName?: string | null;
  landTypeName?: string | null;
  seasonName?: string | null;
}): string | null {
  const { categoryName, landTypeName, seasonName } = opts;
  if (isRiceCategory(categoryName, seasonName)) {
    return (landTypeName && landTypeName.trim()) || (categoryName && categoryName.trim()) || null;
  }
  return (categoryName && categoryName.trim()) || (landTypeName && landTypeName.trim()) || null;
}
