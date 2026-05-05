// Password strength + complexity policy used across Profile and Users pages.
export type PolicyRule = {
  key: string;
  test: (pw: string) => boolean;
  en: string;
  bn: string;
};

export function policyRules(minLen = 10): PolicyRule[] {
  return [
    { key: "len", test: (p) => p.length >= minLen, en: `At least ${minLen} characters`, bn: `কমপক্ষে ${minLen} অক্ষর` },
    { key: "lower", test: (p) => /[a-z]/.test(p), en: "Lowercase letter (a-z)", bn: "ছোট হাতের অক্ষর (a-z)" },
    { key: "upper", test: (p) => /[A-Z]/.test(p), en: "Uppercase letter (A-Z)", bn: "বড় হাতের অক্ষর (A-Z)" },
    { key: "digit", test: (p) => /[0-9]/.test(p), en: "Digit (0-9)", bn: "সংখ্যা (০-৯)" },
    { key: "symbol", test: (p) => /[^A-Za-z0-9]/.test(p), en: "Symbol (e.g. !@#$)", bn: "চিহ্ন (যেমন !@#$)" },
  ];
}

export function passwordScore(pw: string, minLen = 10): { score: 0 | 1 | 2 | 3 | 4; label: string; labelBn: string; passed: number; total: number } {
  const rules = policyRules(minLen);
  const passed = rules.filter((r) => r.test(pw)).length;
  const total = rules.length;
  let score: 0 | 1 | 2 | 3 | 4 = 0;
  if (passed <= 1) score = 0;
  else if (passed === 2) score = 1;
  else if (passed === 3) score = 2;
  else if (passed === 4) score = 3;
  else score = 4;
  const labels = ["Very weak", "Weak", "Fair", "Good", "Strong"];
  const labelsBn = ["খুব দুর্বল", "দুর্বল", "মোটামুটি", "ভালো", "শক্তিশালী"];
  return { score, label: labels[score], labelBn: labelsBn[score], passed, total };
}

export function passwordIssues(pw: string, minLen = 10): string[] {
  return policyRules(minLen).filter((r) => !r.test(pw)).map((r) => r.en);
}
