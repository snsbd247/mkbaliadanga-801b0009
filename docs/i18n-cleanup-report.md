# i18n Cleanup Report

Found 421 truly hardcoded Bengali strings (excludes lines that already use lang/tx).

```
src/components/LanguageToggle.tsx:32: aria-label="বাংলায় পরিবর্তন করুন (Switch to Bengali)" /* i18n-ignore */
src/components/LanguageToggle.tsx:34: বাংলা{/* i18n-ignore */}
src/components/auth/AccessDenied.tsx:10: ? "এই পেজটি দেখার অনুমতি আপনার নেই। প্রয়োজন হলে অ্যাডমিনের সাথে যোগাযোগ করুন।"
src/components/auth/PasswordStrength.tsx:21: {tr("Strength", "শক্তি")}: <span className="font-medium text-foreground">{tr(label, labelBn)}</span>
src/components/layout/AppLayout.tsx:69: <span>{lang === "en" ? "EN" : "বাং"}</span>
src/components/layout/AppLayout.tsx:74: <DropdownMenuItem onClick={() => setLang("bn")}>বাংলা</DropdownMenuItem>{/* i18n-ignore */}
src/components/layout/AppLayout.tsx:113: {lang === "en" ? "বাংলা" : "English"}
src/components/layout/AppSidebar.tsx:68: key: "savingsLoans", icon: Wallet, label: t("savingsAndLoans" as any) || "সঞ্চয় ও ঋণ",
src/components/layout/AppSidebar.tsx:81: key: "irrigation", icon: Droplets, label: t("irrigation" as any) || "সেচ",
src/components/layout/AppSidebar.tsx:144: key: "auditMon", icon: ShieldAlert, label: t("auditAndMonitoring" as any) || "অডিট ও মনিটরিং",
src/components/layout/SiteFooter.tsx:5: const BN_DIGITS: Record<string, string> = { "0": "০", "1": "১", "2": "২", "3": "৩", "4": "৪", "5": "৫", "6": "৬", "7": "৭", "8": "৮", "9": "৯" };
src/components/payments/IrrigationPaymentPanel.tsx:385: `সেচের পেমেন্ট গ্রহণ করা হয়েছে।\nবর্তমান: ৳${Number(currentCollected || 0).toLocaleString()}\nপূর্বের বকেয়া: ৳${Number(previousCollected || 0).toLocaleString(
src/components/receipts/ReceiptSettingsButton.tsx:39: <SelectItem value="bn">বাংলা (Bangla)</SelectItem>{/* i18n-ignore */}
src/components/settings/BanglaFontSelector.tsx:9: const SAMPLE_BN = "যত মত তত পথ — বাংলাদেশের কৃষক সমিতি। কৃষ্ণচূড়া ফোটে। ক্ষুদ্র ঋণ ব্যবস্থা। ২০২৬ সালের সেচ মৌসুম। জ্ঞান, বিজ্ঞান, ঐক্য।";
src/components/settings/BanglaFontSelector.tsx:10: const SAMPLE_DIGITS = "সংখ্যা: ০ ১ ২ ৩ ৪ ৫ ৬ ৭ ৮ ৯ — টাকা ১২,৩৪৫.৬৭";
src/components/settings/BanglaFontSelector.tsx:11: const SAMPLE_CONJUNCTS = "যুক্তাক্ষর: ক্ষ ত্র জ্ঞ ঞ্চ ন্দ্র শ্র হ্ম ণ্ড স্ত্র";
src/components/settings/BanglaFontSelector.tsx:35: toast.success("বাংলা ফন্ট আপডেট হয়েছে — পরবর্তী PDF ও রিসিপ্টে কার্যকর।");
src/components/settings/BanglaFontSelector.tsx:64: toast.error(e?.message ?? "PDF তৈরি ব্যর্থ");
src/components/settings/BanglaFontSelector.tsx:72: <div className="font-semibold mb-1">বাংলা ফন্ট (PDF / রিসিপ্ট)</div>
src/components/settings/BanglaFontSelector.tsx:74: কোন বাংলা ফন্টে সেরা রেন্ডার হয় সেটা বেছে নিন। পছন্দ অটো-সেভ হয় এবং সব PDF/রিসিপ্টে এই ফন্ট subset-embed হয়, ফলে যেকোনো ডিভাইস ও PDF viewer-এ একই দেখাবে। ফন্
src/components/settings/BanglaFontSelector.tsx:110: {busy ? "…" : "QA নমুনা PDF ডাউনলোড"}
src/components/settings/BanglaFontSelector.tsx:118: মাল্টি-viewer QA গাইড →
src/components/settings/BanglaFontSelector.tsx:122: QA গাইডে Chrome, Adobe Reader, মোবাইল PDF অ্যাপে কীভাবে যাচাই করবেন তা ধাপে ধাপে দেওয়া আছে।
src/lib/exports.ts:43: doc.text(brand?.company_name || (useBn ? "প্রতিবেদন" : "Report"), pageW / 2, 12, { align: "center" });
src/lib/exports.ts:52: const periodLabel = useBn ? "সময়কাল" : "Period";
src/lib/exports.ts:53: const toWord = useBn ? "থেকে" : "to";
src/lib/exports.ts:58: const printedLabel = useBn ? "মুদ্রিত" : "Printed";
src/lib/exports.ts:59: const pageLabel = useBn ? "পৃষ্ঠা" : "Page";
src/lib/irrigationExports.ts:11: invoiceNo: "ইনভয়েস নং",
src/lib/irrigationExports.ts:12: farmer: "কৃষক",
src/lib/irrigationExports.ts:13: farmerCode: "কৃষক কোড",
src/lib/irrigationExports.ts:14: mobile: "মোবাইল",
src/lib/irrigationExports.ts:15: mouza: "মৌজা",
src/lib/irrigationExports.ts:16: dag: "দাগ নং",
src/lib/irrigationExports.ts:17: landSize: "জমির পরিমাণ",
src/lib/irrigationExports.ts:18: landType: "জমির ধরন",
src/lib/irrigationExports.ts:19: season: "সিজন",
src/lib/irrigationExports.ts:20: year: "বছর",
src/lib/irrigationExports.ts:21: rate: "প্রতি ইউনিট রেট",
src/lib/irrigationExports.ts:22: baseAmount: "মূল চার্জ",
src/lib/irrigationExports.ts:23: lateFee: "বিলম্ব ফি",
src/lib/irrigationExports.ts:24: maintenance: "রক্ষণাবেক্ষণ চার্জ",
src/lib/irrigationExports.ts:25: payable: "প্রদেয়",
src/lib/irrigationExports.ts:26: paid: "পরিশোধিত",
src/lib/irrigationExports.ts:27: due: "বকেয়া",
src/lib/irrigationExports.ts:28: status: "স্ট্যাটাস",
src/lib/irrigationExports.ts:29: generatedAt: "ইস্যু তারিখ",
src/lib/irrigationExports.ts:30: dueDate: "মেয়াদ",
src/lib/irrigationExports.ts:31: isManual: "ম্যানুয়াল রেট",
src/lib/irrigationExports.ts:32: manualReason: "ম্যানুয়াল কারণ",
src/lib/irrigationExports.ts:33: recalculated: "পুনঃগণনা",
src/lib/irrigationExports.ts:34: borga: "বর্গা",
src/lib/irrigationExports.ts:38: draft: "খসড়া", generated: "ইস্যু", partial_paid: "আংশিক",
src/lib/irrigationExports.ts:39: paid: "পরিশোধিত", overdue: "মেয়াদোত্তীর্ণ", cancelled: "বাতিল",
src/lib/irrigationExports.ts:65: [IRR_BN.isManual]: inv.is_manual_rate ? "হ্যাঁ" : "না",
src/lib/irrigationExports.ts:68: [IRR_BN.borga]: inv.is_borga ? "হ্যাঁ" : "না",
src/lib/irrigationInvoicePdf.ts:40: farmerSignTitle: "কৃষকের স্বাক্ষর",
src/lib/irrigationInvoicePdf.ts:42: collectorSignTitle: "আদায়কারীর স্বাক্ষর",
src/lib/irrigationInvoicePdf.ts:57: labelBn: "A4 — সাধারণ অফিস প্রিন্টার",
src/lib/irrigationInvoicePdf.ts:63: labelBn: "A4 — ছোট মার্জিন (বেশি জায়গা)",
src/lib/irrigationInvoicePdf.ts:69: labelBn: "A4 — ইঙ্কজেট (বড় বর্ডার)",
src/lib/irrigationInvoicePdf.ts:75: labelBn: "Letter — সাধারণ অফিস প্রিন্টার",
src/lib/irrigationInvoicePdf.ts:81: labelBn: "Letter — ছোট মার্জিন",
src/lib/irrigationInvoicePdf.ts:156: case "draft": return "খসড়া";
src/lib/irrigationInvoicePdf.ts:157: case "generated": return "ইস্যুকৃত";
src/lib/irrigationInvoicePdf.ts:158: case "partial_paid": return "আংশিক পরিশোধিত";
src/lib/irrigationInvoicePdf.ts:159: case "paid": return "পরিশোধিত";
src/lib/irrigationInvoicePdf.ts:160: case "overdue": return "মেয়াদোত্তীর্ণ";
src/lib/irrigationInvoicePdf.ts:161: case "cancelled": return "বাতিল";
src/lib/irrigationInvoicePdf.ts:177: const regLine = brand.registration_no ? `নিবন্ধন নং: ${toBnDigits(brand.registration_no)}` : "";
src/lib/irrigationInvoicePdf.ts:184: ["কৃষকের নাম", `${farmer.name ?? "—"}${farmer.farmer_code ? " (" + farmer.farmer_code + ")" : ""}`],
src/lib/irrigationInvoicePdf.ts:185: ["গ্রাম / মোবাইল", `${farmer.village ?? "—"}${farmer.mobile ? " / " + farmer.mobile : ""}`],
src/lib/irrigationInvoicePdf.ts:186: ["জমির ধরন", d.is_borga ? "বর্গাদার" : "নিজ মালিক"],
src/lib/irrigationInvoicePdf.ts:189: ["সিজন", seasonLabel || "—"],
src/lib/irrigationInvoicePdf.ts:190: ["ইস্যু তারিখ", fmtDate(d.generated_at)],
src/lib/irrigationInvoicePdf.ts:191: ["মেয়াদ তারিখ", fmtDate(d.due_date)],
src/lib/irrigationInvoicePdf.ts:192: ["অবস্থা", statusBn(d.invoice_status)],
src/lib/irrigationInvoicePdf.ts:196: ["সেচ চার্জ", d.irrigation_amount],
src/lib/irrigationInvoicePdf.ts:197: ["রক্ষণাবেক্ষণ", d.maintenance_amount],
src/lib/irrigationInvoicePdf.ts:198: ["খাল / নালা", d.canal_amount],
src/lib/irrigationInvoicePdf.ts:199: ["অন্যান্য", d.other_charge],
src/lib/irrigationInvoicePdf.ts:200: ["বিলম্ব ফি", d.delay_fee],
src/lib/irrigationInvoicePdf.ts:205: <div style="border-top:1px solid #111;padding-top:2px;">${settings.farmerSignTitle || "কৃষকের স্বাক্ষর"}</div>
src/lib/irrigationInvoicePdf.ts:211: <div style="border-top:1px solid #111;padding-top:2px;">${settings.collectorSignTitle || "আদায়কারীর স্বাক্ষর"}</div>
src/lib/irrigationInvoicePdf.ts:222: <div style="font-size:15px;font-weight:700;margin-top:3px;">সেচ ইনভয়েস</div>
src/lib/irrigationInvoicePdf.ts:227: <div>রসিদ নং: <b>${d.invoice_no}</b></div>
src/lib/irrigationInvoicePdf.ts:228: <div>তারিখ: ${fmtDate(d.generated_at)}</div>
src/lib/irrigationInvoicePdf.ts:242: <th style="text-align:left;padding:3px 6px;border-bottom:1px solid #111;">বিবরণ</th>
src/lib/irrigationInvoicePdf.ts:243: <th style="text-align:right;padding:3px 6px;border-bottom:1px solid #111;">টাকা</th>
src/lib/irrigationInvoicePdf.ts:253: <td style="padding:3px 6px;font-weight:700;background:#fafafa;border-top:1px solid #111;">মোট প্রদেয়</td>
src/lib/irrigationInvoicePdf.ts:257: <td style="padding:2px 6px;">পরিশোধিত</td>
src/lib/irrigationInvoicePdf.ts:261: <td style="padding:3px 6px;font-weight:700;background:#fff5f5;color:#b91c1c;">বকেয়া</td>
src/lib/irrigationInvoicePdf.ts:267: <div style="font-size:10px;margin-top:3px;">কথায়: ${amountWords} টাকা মাত্র।</div>
src/lib/irrigationInvoicePdf.ts:268: ${d.note ? `<div style="font-size:10px;margin-top:1px;"><b>মন্তব্য:</b> ${d.note}</div>` : ""}
src/lib/irrigationInvoicePdf.ts:312: const c = await renderCopyToCanvas(d, brand, "অফিস কপি", settings, "office");
src/lib/irrigationInvoicePdf.ts:317: const c = await renderCopyToCanvas(d, brand, "কৃষকের কপি", settings, "farmer");
src/lib/irrigationInvoicePdf.ts:330: pdf.text("— এখান থেকে কেটে আলাদা করুন —", pageW / 2, cutY - 1, { align: "center" });
src/lib/irrigationInvoicePdf.ts:400: await nav.share({ files: [file], title: `সেচ ইনভয়েস ${d.invoice_no}`, text: `ইনভয়েস ${d.invoice_no} — মোট প্রদেয় ${fmt2(d.payable_amount)} টাকা` });
src/lib/irrigationInvoicePdf.ts:418: const text = `সেচ ইনভয়েস ${d.invoice_no}\nমোট প্রদেয়: ${fmt2(d.payable_amount)} টাকা\nবকেয়া: ${fmt2(d.due_amount)} টাকা\nমেয়াদ: ${fmtDate(d.due_date)}`;
src/lib/irrigationInvoicePdf.ts:428: const subject = `সেচ ইনভয়েস ${d.invoice_no}`;
src/lib/irrigationInvoicePdf.ts:429: const body = `প্রিয় ${d.farmer?.name ?? "কৃষক"},\n\nইনভয়েস নং: ${d.invoice_no}\nমোট প্রদেয়: ${fmt2(d.payable_amount)} টাকা\nপরিশোধিত: ${fmt2(d.paid_amount)} 
src/lib/irrigationInvoicePdf.ts:440: const label = role === "office" ? "অফিস কপি" : "কৃষকের কপি";
src/lib/paymentReceiptPdf.ts:49: footer_note_bn: "এটি সিস্টেম-জেনারেটেড রসিদ। অনুগ্রহ করে আপনার রেকর্ডের জন্য সংরক্ষণ করুন।",
src/lib/paymentReceiptPdf.ts:78: title: "পেমেন্ট রসিদ",
src/lib/paymentReceiptPdf.ts:79: receipt: "রসিদ নং",
src/lib/paymentReceiptPdf.ts:80: date: "তারিখ",
src/lib/paymentReceiptPdf.ts:81: office: "অফিস",
src/lib/paymentReceiptPdf.ts:82: farmer: "কৃষক",
src/lib/paymentReceiptPdf.ts:83: name: "নাম", code: "কোড", member: "ফার্মার আইডি", village: "গ্রাম", mobile: "মোবাইল",
src/lib/paymentReceiptPdf.ts:84: qr: "কিউআর কার্ড", token: "টোকেন", status: "অবস্থা",
src/lib/paymentReceiptPdf.ts:85: type: "ধরন", method: "পদ্ধতি", amount: "টাকা (BDT)",
src/lib/paymentReceiptPdf.ts:86: note: "মন্তব্য",
src/lib/paymentReceiptPdf.ts:87: paymentId: "পেমেন্ট আইডি", idem: "ইডেমপোটেন্সি", collected: "গ্রহীতা",
src/lib/paymentReceiptPdf.ts:88: signature: "অনুমোদিত স্বাক্ষর",
src/pages/Accounts.tsx:71: `৳${(n || 0).toLocaleString("en-BD", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
src/pages/Accounts.tsx:275: { code: "1000", name: "Assets", name_bn: "সম্পদ", type: "asset", parent_code: "", is_active: "yes" },
src/pages/Accounts.tsx:276: { code: "1100", name: "Cash", name_bn: "নগদ", type: "asset", parent_code: "1000", is_active: "yes" },
src/pages/AuditLogs.tsx:150: const headersBn = ["তারিখ/সময়", "কার্যক্রম", "বিষয়", "অফিস", "কৃষক কোড", "কৃষকের নাম", "ব্যবহারকারী", "রেকর্ড আইডি", "পুরাতন তথ্য", "নতুন তথ্য"];
src/pages/Auth.tsx:89: ? `"${u}" নামে কোন একাউন্ট নেই। বানান চেক করুন বা ইমেইল দিয়ে চেষ্টা করুন।`
src/pages/CardDesigner.tsx:21: company_name_bn: "স্মার্ট সেচ ও সমবায়",
src/pages/DataImport.tsx:559: if (!loanId) throw new Error("ইন্সটলমেন্ট ডাটা অনুপস্থিত। অটো-জেনারেট অথবা ইমপোর্ট সংশোধন করুন।");
src/pages/DataImport.tsx:883: 💡 <strong>account_number</strong> = farmer-এর Voter / Savings A/C No (১২ ডিজিট নম্বর)। Farmer তৈরি করার সময় auto-generate হয়। Bulk Farmer Import-এ <code>vote
src/pages/DataImport.tsx:886: 🏷️ <strong>dag_no</strong> এ একটি জমির একাধিক দাগ নম্বর কমা দিয়ে দিতে পারেন (যেমন <code>123, 124/A, 125-B</code>)। প্রতিটি টোকেনে শুধু সংখ্যা/অক্ষর/<code>/</c
src/pages/FarmerDetail.tsx:174: ?? (kind === "loan" ? "ঋণের কিস্তি গ্রহণ" : kind === "savings" ? "সঞ্চয় জমা গ্রহণ" : "সেচ চার্জ গ্রহণ");
src/pages/FarmerDetail.tsx:180: bill_info: kind === "irrigation" ? "সেচ চার্জ" : undefined,
src/pages/FarmerDetail.tsx:268: owner_type_bn: land?.owner_type === "borgadar" ? "বর্গাদার" : land?.owner_type === "owner" ? "মালিক" : null,
src/pages/FarmerDetail.tsx:834: <p className="text-xs text-destructive mt-1">{liveErr} — দয়া করে কমা দিয়ে আলাদা করুন এবং শুধু সংখ্যা/অক্ষর/<code>/</code>/<code>-</code> ব্যবহার করুন।</p>
src/pages/FarmerDetail.tsx:837: একাধিক দাগ নং কমা (,) দিয়ে আলাদা করুন। উদাহরণ: <code>123, 124/A, 125-B</code>
src/pages/FarmerDetail.tsx:838: {preview && preview !== land.dag_no.trim() && <> — সংরক্ষণে রূপান্তরিত হবে: <strong>{preview}</strong></>}
src/pages/FarmerDetail.tsx:1064: <p className="text-xs text-destructive mt-1">{liveErr} — কমা দিয়ে আলাদা করুন; শুধু সংখ্যা/অক্ষর/<code>/</code>/<code>-</code> অনুমোদিত।</p>
src/pages/FarmerDetail.tsx:1067: একাধিক দাগ নং কমা (,) দিয়ে আলাদা করুন। উদাহরণ: <code>123, 124/A, 125-B</code>
src/pages/FarmerDetail.tsx:1068: {preview && preview !== editForm.dag_no.trim() && <> — সংরক্ষণে রূপান্তরিত হবে: <strong>{preview}</strong></>}
src/pages/Farmers.tsx:33: "Karim Uddin", "করিম উদ্দিন", "Abdul", "Salma", "1234567890123", "01700000000", // i18n-ignore
src/pages/Farmers.tsx:153: "ফরম্যাট: 5-digit, যেমন 00001। 'F-00001', '1', '2026-00000001' এর মতো ইনপুট স্বয়ংক্রিয়ভাবে 00001 হবে।"
src/pages/Farmers.tsx:641: <Input placeholder={t("search") + " / দাগ (123, 124/A)…"} value={q} onChange={e => { setQ(e.target.value); setPage(0); }} className="pl-9" />
src/pages/FarmersImport.tsx:100: ["00001", "10001", "Md. Abdur Rahman", "মোঃ আব্দুর রহমান", "Md. Karim Uddin", "01711000000", "Bagbari"],
src/pages/FarmersImport.tsx:101: ["",      "",      "Mst. Rahima Khatun", "মোসাঃ রহিমা খাতুন", "Md. Jashim", "01811000000", "Char Bhabanipur"],
src/pages/FarmersImport.tsx:117: ["farmer_id", "No", "5-digit padded code (e.g. 00001). 'F-00001', '1', '2026-00000001' এর মতো ইনপুট স্বয়ংক্রিয়ভাবে 00001 হবে। existing হলে UPDATE, খালি হলে নত
src/pages/FarmersImport.tsx:118: ["voter_number", "No", "নম্বর থাকলে অটো Voter / Savings active সদস্য।"],
src/pages/FarmersImport.tsx:119: ["name_en", "Yes", "ইংরেজী নাম"],
src/pages/FarmersImport.tsx:120: ["name_bn", "No", "বাংলা নাম"],
src/pages/FarmersImport.tsx:123: ["village", "No", "Free-text গ্রাম"],
src/pages/FarmersImport.tsx:270: "Farmer ID ফরম্যাট: 5-digit padded (যেমন 00001)। 'F-00001', '1', '2026-00000001' এর মতো ইনপুট স্বয়ংক্রিয়ভাবে 00001 হবে। অক্ষর / সংখ্যা ছাড়া ভ্যালু রিজেক্ট হব
src/pages/IrrigationRates.tsx:128: if (!confirm("এই অফিস ও সিজনের জন্য একটি রেট আছে — আপডেট করবেন?")) {
src/pages/IrrigationRates.tsx:210: ({form.basis === "per_size" ? "per শতক" : form.basis === "per_day" ? "per day" : "per hour"})
src/pages/IrrigationRates.tsx:217: ≈ {(Number(form.base_rate) * 33).toFixed(2)} per বিঘা (1 বিঘা = 33 শতক)
src/pages/LedgerReconciliation.tsx:107: const headersBn = ["কোড", "হিসাব", "ধরন", "প্রারম্ভিক স্থিতি", "মাস ডেবিট", "মাস ক্রেডিট", "সমাপনী স্থিতি"];
src/pages/LoanDetail.tsx:13: const money = (n: any) => `৳ ${Number(n || 0).toLocaleString("bn-BD", { maximumFractionDigits: 2 })}`;
src/pages/LoanDetail.tsx:31: if (i.status === "paid" || (due > 0 && paid >= due)) return { key: "paid", label: "পরিশোধিত", variant: "default" };
src/pages/LoanDetail.tsx:34: return { key: od ? "overdue" : "partial", label: od ? "মেয়াদোত্তীর্ণ (আংশিক)" : "আংশিক", variant: od ? "destructive" : "secondary" };
src/pages/LoanDetail.tsx:36: if (new Date(i.due_date) < today) return { key: "overdue", label: "মেয়াদোত্তীর্ণ", variant: "destructive" };
src/pages/LoanDetail.tsx:37: return { key: "pending", label: "অপেক্ষমাণ", variant: "outline" };
src/pages/LoanDetail.tsx:90: if (loading) return <div className="p-6 text-sm text-muted-foreground">লোড হচ্ছে…</div>;
src/pages/LoanDetail.tsx:91: if (!loan) return <div className="p-6">ঋণ খুঁজে পাওয়া যায়নি। <Link className="underline" to="/loans">ফিরে যান</Link></div>;
src/pages/LoanDetail.tsx:95: { header: "কিস্তি নং", accessor: r => r.installment_no },
src/pages/LoanDetail.tsx:96: { header: "নির্ধারিত তারিখ", accessor: r => fmtDate(r.due_date) },
src/pages/LoanDetail.tsx:97: { header: "পরিমাণ", accessor: r => Number(r.amount || 0) },
src/pages/LoanDetail.tsx:98: { header: "পরিশোধিত", accessor: r => Number(r.paid_amount || 0) },
src/pages/LoanDetail.tsx:99: { header: "বাকি", accessor: r => Math.max(0, Number(r.amount || 0) - Number(r.paid_amount || 0)) },
src/pages/LoanDetail.tsx:100: { header: "পরিশোধ তারিখ", accessor: r => fmtDate(r.paid_on) },
src/pages/LoanDetail.tsx:101: { header: "জরিমানা", accessor: r => Number(r.penalty_amount || 0) },
src/pages/LoanDetail.tsx:102: { header: "স্ট্যাটাস", accessor: r => deriveStatus(r as Inst, today).label },
src/pages/LoanDetail.tsx:110: <Button variant="ghost" size="sm" onClick={() => nav(-1)}><ArrowLeft className="h-4 w-4 mr-1" /> ফিরে যান</Button>
src/pages/LoanDetail.tsx:111: <h1 className="text-xl md:text-2xl font-bold">ঋণ বিবরণ</h1>
src/pages/LoanDetail.tsx:115: <Button variant="outline" size="sm" onClick={() => window.print()}><Printer className="h-4 w-4 mr-1" />প্রিন্ট</Button>
src/pages/LoanDetail.tsx:117: <Receipt className="h-4 w-4 mr-1" />কিস্তি গ্রহণ
src/pages/LoanDetail.tsx:125: <CardTitle className="text-base">ঋণ সারাংশ</CardTitle>
src/pages/LoanDetail.tsx:129: <Field label="ঋণ নং" value={loan.id?.slice(0, 8).toUpperCase()} />
src/pages/LoanDetail.tsx:130: <Field label="কৃষক" value={
src/pages/LoanDetail.tsx:135: <Field label="হিসাব নং" value={farmer?.farmer_code || "-"} />
src/pages/LoanDetail.tsx:136: <Field label="ঋণ প্ল্যান" value={plan?.name_bn || plan?.name || "—"} />
src/pages/LoanDetail.tsx:137: <Field label="মূল টাকা" value={money(loan.principal)} />
src/pages/LoanDetail.tsx:138: <Field label="সুদ" value={loan.interest_enabled ? `${loan.interest_rate}%` : "নেই"} />
src/pages/LoanDetail.tsx:139: <Field label="মোট পরিশোধ্য" value={<span className="font-bold">{money(summary.totalPayable)}</span> as any} />
src/pages/LoanDetail.tsx:140: <Field label="মোট পরিশোধিত" value={money(summary.totalPaid)} />
src/pages/LoanDetail.tsx:141: <Field label="বাকি" value={<span className="font-bold text-destructive">{money(summary.remaining)}</span> as any} />
src/pages/LoanDetail.tsx:142: <Field label="স্ট্যাটাস" value={<Badge>{loan.status}</Badge> as any} />
src/pages/LoanDetail.tsx:143: <Field label="ঋণ প্রদান তারিখ" value={fmtDate(loan.issued_on)} />
src/pages/LoanDetail.tsx:144: <Field label="শেষ পরিশোধ তারিখ" value={fmtDate(summary.lastPay)} />
src/pages/LoanDetail.tsx:151: <CardHeader className="pb-2"><CardTitle className="text-base">কিস্তি সারাংশ</CardTitle></CardHeader>
src/pages/LoanDetail.tsx:154: <Counter label="মোট কিস্তি" value={summary.counters.total} />
src/pages/LoanDetail.tsx:155: <Counter label="পরিশোধিত" value={summary.counters.paid} tone="success" />
src/pages/LoanDetail.tsx:156: <Counter label="অপেক্ষমাণ" value={summary.counters.pending} />
src/pages/LoanDetail.tsx:157: <Counter label="মেয়াদোত্তীর্ণ" value={summary.counters.overdue} tone="danger" />
src/pages/LoanDetail.tsx:163: <span>শেষ কিস্তির তারিখ:</span>
src/pages/LoanDetail.tsx:170: <span>জরিমানা কার্যকর হবে — কিস্তি #{summary.nextOverdue.installment_no} ({fmtDate(summary.nextOverdue.due_date)})</span>
src/pages/LoanDetail.tsx:179: <CardHeader className="pb-2"><CardTitle className="text-base">কিস্তির তালিকা</CardTitle></CardHeader>
src/pages/LoanDetail.tsx:182: <div className="text-sm text-muted-foreground">কোনো কিস্তি সিডিউল নেই।</div>
src/pages/LoanDetail.tsx:187: <TableHead>কিস্তি নং</TableHead>
src/pages/LoanDetail.tsx:188: <TableHead>নির্ধারিত তারিখ</TableHead>
src/pages/LoanDetail.tsx:189: <TableHead className="text-right">পরিমাণ</TableHead>
src/pages/LoanDetail.tsx:190: <TableHead className="text-right">পরিশোধিত</TableHead>
src/pages/LoanDetail.tsx:191: <TableHead className="text-right">বাকি</TableHead>
src/pages/LoanDetail.tsx:192: <TableHead>পরিশোধ তারিখ</TableHead>
src/pages/LoanDetail.tsx:193: <TableHead className="text-right">জরিমানা</TableHead>
src/pages/LoanDetail.tsx:194: <TableHead>স্ট্যাটাস</TableHead>
src/pages/LoanDetail.tsx:195: <TableHead className="text-right">কার্যক্রম</TableHead>
src/pages/LoanDetail.tsx:215: গ্রহণ
src/pages/LoanDetail.tsx:230: <CardHeader className="pb-2"><CardTitle className="text-base">পরিশোধের ইতিহাস</CardTitle></CardHeader>
src/pages/LoanDetail.tsx:233: <div className="text-sm text-muted-foreground">কোনো পরিশোধ নেই।</div>
src/pages/LoanDetail.tsx:238: <TableHead>তারিখ</TableHead>
src/pages/LoanDetail.tsx:239: <TableHead className="text-right">পরিমাণ</TableHead>
src/pages/LoanDetail.tsx:240: <TableHead>স্ট্যাটাস</TableHead>
src/pages/LoanDetail.tsx:241: <TableHead>মন্তব্য</TableHead>
src/pages/LoanPlans.tsx:139: <TableCell>{r.penalty_type === "percentage" ? `${r.penalty_value}%` : `৳${r.penalty_value}`}</TableCell>
src/pages/Loans.tsx:70: if (!vchk?.is_voter) return toast.error(`${vchk?.name_en ?? "এই ফার্মার"} এর Voter / Savings A/C এনাবল নেই — ঋণ এন্ট্রি করা যাবে না।`);
src/pages/Loans.tsx:109: title: status === "approved" ? "ঋণ অনুমোদিত" : "ঋণ প্রত্যাখ্যাত",
src/pages/Loans.tsx:110: body: `${loan?.farmers?.name_en ?? ""} — ৳${Number(loan?.principal ?? 0).toLocaleString()}`,
src/pages/Payments.tsx:84: if (withdrawForm.amount > savingsBalance) return toast.error(`Insufficient balance. Available: ৳${savingsBalance.toLocaleString()}`);
src/pages/Payments.tsx:234: return toast.error(`${v.reason} (নির্ধারিত: ৳${v.required.toFixed(2)}, প্রদত্ত: ৳${Number(a.amount).toFixed(2)})`);
src/pages/Payments.tsx:237: if (!window.confirm(`⚠ নির্ধারিত: ৳${v.required.toFixed(2)} | প্রদত্ত: ৳${Number(a.amount).toFixed(2)}\nতবুও সংরক্ষণ করবেন?`)) return;
src/pages/Payments.tsx:240: const reason = window.prompt("আংশিক পেমেন্ট override কারণ লিখুন (অডিটে সংরক্ষিত হবে):", "")?.trim();
src/pages/Payments.tsx:241: if (!reason) return toast.error("Override কারণ আবশ্যক");
src/pages/Payments.tsx:473: <span className="font-mono font-semibold">৳{savingsBalance.toLocaleString()}</span>
src/pages/Payments.tsx:652: f?.is_voter ? "ভোটার নং" : f?.account_number ? "সঞ্চয়ী নং" : null;
src/pages/Payments.tsx:688: owner_type_bn: primaryCharge?.is_borga ? "বর্গাদার" : "মালিক",
src/pages/Payments.tsx:691: ? "নিজ"
src/pages/Payments.tsx:713: bill_info: kind === "irrigation" ? "সেচ চার্জ" : undefined,
src/pages/ReceiptTemplate.tsx:44: company_name_bn: "স্মার্ট সেচ ও সমবায়",
src/pages/Savings.tsx:193: if (!vchk?.is_voter) return toast.error(`${vchk?.name_en ?? "এই ফার্মার"} এর Voter / Savings A/C এনাবল নেই — সঞ্চয়/শেয়ার এন্ট্রি করা যাবে না।`);
src/pages/Savings.tsx:217: return toast.error(`Insufficient balance. Available: ৳${available.toLocaleString()}`);
src/pages/Savings.tsx:272: title: status === "approved" ? "উত্তোলন অনুমোদিত" : "উত্তোলন প্রত্যাখ্যাত",
src/pages/Savings.tsx:273: body: `${txn?.farmers?.name_en ?? ""} — ৳${Number(txn?.amount ?? 0).toLocaleString()}${reject_reason ? ` (${reject_reason})` : ""}`,
src/pages/Savings.tsx:349: <SelectItem value="deposit">Savings Deposit (min ৳10)</SelectItem>
src/pages/Savings.tsx:350: <SelectItem value="share_deposit">Share Deposit (min ৳50)</SelectItem>
src/pages/Savings.tsx:401: <SelectContent>{plans.map(p => <SelectItem key={p.id} value={p.id}>{p.name} — {p.duration_months}mo / {p.installment_type} ৳{p.installment_amount} @ {p.interest
src/pages/ScanPayment.tsx:74: ?? (kind === "loan" ? "ঋণের কিস্তি গ্রহণ"
src/pages/ScanPayment.tsx:75: : kind === "savings" ? "সঞ্চয় জমা গ্রহণ"
src/pages/ScanPayment.tsx:76: : "সেচ চার্জ গ্রহণ");
src/pages/ScanPayment.tsx:85: bill_info: kind === "irrigation" ? "সেচ চার্জ" : undefined,
src/pages/ScanPayment.tsx:305: <div><span className="text-muted-foreground">Amount:</span> <span className="font-mono font-semibold">৳ {fmt(done.amount)}</span></div>
src/pages/Settings.tsx:172: { v: "half_up", label: "≥ .50 → ১ টাকা (default)", desc: "≥ .50 হলে উপরে, নিচে হলে ০" },
src/pages/Settings.tsx:173: { v: "half_even", label: "Banker's (half-even)", desc: ".5 হলে নিকটতম জোড় সংখ্যায়" },
src/pages/Settings.tsx:174: { v: "floor", label: "Floor (নিচের দিকে)", desc: "সর্বদা নিচের দিকে" },
src/pages/Settings.tsx:175: { v: "ceil", label: "Ceil (উপরের দিকে)", desc: "সর্বদা উপরের দিকে" },
src/pages/Settings.tsx:179: <div className="font-semibold mb-1">টাকা রাউন্ডিং নিয়ম</div>
src/pages/Settings.tsx:181: ইনভয়েস, রশিদ, পেমেন্ট রিসিপ্ট ও রিপোর্ট সব জায়গায় এই নিয়মে এমাউন্ট পুরো টাকায় দেখাবে।
src/pages/Settings.tsx:190: toast.success("রাউন্ডিং নিয়ম আপডেট হয়েছে। নতুন রিপোর্ট/রশিদে কার্যকর হবে।");
src/pages/Settings.tsx:211: { v: "comma", label: "কমা ( , )" },
src/pages/Settings.tsx:212: { v: "newline", label: "নতুন লাইন" },
src/pages/Settings.tsx:213: { v: "semicolon", label: "সেমিকোলন ( ; )" },
src/pages/Settings.tsx:252: toast.success("নমুনা PDF ডাউনলোড হয়েছে");
src/pages/Settings.tsx:267: toast.success("নমুনা Excel ডাউনলোড হয়েছে");
src/pages/Settings.tsx:273: <div className="font-semibold mb-1">সেচ রিসিপ্ট লে-আউট</div>
src/pages/Settings.tsx:275: মাল্টিপল দাগ নম্বর কীভাবে দেখাবে, রো-এর লেবেল ও স্পেসিং কাস্টমাইজ করুন। লাইভ প্রিভিউ পাশে দেখুন। অন্য মডিউলে প্রভাব পড়বে না।
src/pages/Settings.tsx:281: <div className="text-sm font-medium mb-2">দাগ নম্বর সেপারেটর</div>
src/pages/Settings.tsx:294: <div className="text-xs font-semibold text-muted-foreground uppercase">সেচ লেবেল</div>
src/pages/Settings.tsx:296: <div className="font-medium mb-1">মৌজা/জমির পরিমান (BN)</div>
src/pages/Settings.tsx:298: placeholder="মৌজা / জমির পরিমান:" onChange={(e) => update({ mouzaLabelBn: e.target.value })} />
src/pages/Settings.tsx:306: <div className="font-medium mb-1">দাগ নং (BN)</div>
src/pages/Settings.tsx:308: placeholder="দাগ নং:" onChange={(e) => update({ dagLabelBn: e.target.value })} />
src/pages/Settings.tsx:318: <div className="text-xs font-semibold text-muted-foreground uppercase">সঞ্চয় লেবেল</div>
src/pages/Settings.tsx:320: <div className="font-medium mb-1">বিবরণ (BN) / Description (EN)</div>
src/pages/Settings.tsx:323: placeholder="বিবরণ:" onChange={(e) => update({ savingsDescLabelBn: e.target.value })} />
src/pages/Settings.tsx:329: <div className="font-medium mb-1">বর্তমান স্থিতি / Balance</div>
src/pages/Settings.tsx:332: placeholder="বর্তমান স্থিতি:" onChange={(e) => update({ savingsBalanceLabelBn: e.target.value })} />
src/pages/Settings.tsx:340: <div className="text-xs font-semibold text-muted-foreground uppercase">ঋণ লেবেল</div>
src/pages/Settings.tsx:342: <div className="font-medium mb-1">ঋণের বিবরণ / Loan description</div>
src/pages/Settings.tsx:345: placeholder="ঋণের বিবরণ:" onChange={(e) => update({ loanDescLabelBn: e.target.value })} />
src/pages/Settings.tsx:351: <div className="font-medium mb-1">অবশিষ্ট ঋণ / Loan outstanding</div>
src/pages/Settings.tsx:354: placeholder="অবশিষ্ট ঋণ:" onChange={(e) => update({ loanOutstandingLabelBn: e.target.value })} />
src/pages/Settings.tsx:362: <div className="font-medium mb-1">সেচ রিসিপ্ট রো স্পেসিং (px): {s.rowSpacingPx}</div>
src/pages/Settings.tsx:368: <div className="font-medium mb-1">সঞ্চয় রিসিপ্ট রো স্পেসিং (px): {s.savingsRowSpacingPx}</div>
src/pages/Settings.tsx:374: <div className="font-medium mb-1">ঋণ রিসিপ্ট রো স্পেসিং (px): {s.loanRowSpacingPx}</div>
src/pages/Settings.tsx:384: toast.success("রিসিপ্ট লে-আউট ডিফল্টে রিসেট হয়েছে");
src/pages/Settings.tsx:385: }}>ডিফল্টে রিসেট</Button>
src/pages/Settings.tsx:386: <Button variant="outline" size="sm" onClick={downloadSamplePdf}>নমুনা PDF</Button>
src/pages/Settings.tsx:387: <Button variant="outline" size="sm" onClick={downloadSampleExcel}>নমুনা Excel</Button>
src/pages/Settings.tsx:393: <div className="text-sm font-medium">লাইভ প্রিভিউ (HTML রিসিপ্ট)</div>
src/pages/Settings.tsx:406: পরিবর্তন করার সাথে সাথে এখানে ইনস্ট্যান্টলি দেখাবে। PDF/Excel-এও ঠিক একই লেবেল ও সেপারেটর ব্যবহার হবে।
src/pages/ShareCollection.tsx:91: if (!vchk?.is_voter) return toast.error(`${vchk?.name_en ?? "এই ফার্মার"} এর Voter / Savings A/C এনাবল নেই — শেয়ার সংগ্রহ করা যাবে না।`);
src/pages/ShareCollection.tsx:331: <div><Label>{t("amount")} (৳)</Label>
src/pages/ShareCollection.tsx:352: <p className="text-xs text-muted-foreground">Min ৳{MIN_AMOUNT}.</p>
src/pages/ShareCollection.tsx:436: <div><Label>Amount (৳)</Label>
src/pages/SmsSettings.tsx:69: type: "Loan / ঋণ", // i18n-ignore: intentional bilingual sample value
src/pages/SmsSettings.tsx:99: tpl_savings_deposit: "প্রিয় গ্রাহক, আপনার সঞ্চয়ে ৳{amount} জমা হয়েছে। বর্তমান ব্যালেন্স: ৳{balance}। ধন্যবাদ।",
src/pages/SmsSettings.tsx:100: tpl_savings_withdraw: "প্রিয় গ্রাহক, আপনার সঞ্চয় থেকে ৳{amount} উত্তোলন হয়েছে। বর্তমান ব্যালেন্স: ৳{balance}।",
src/pages/SmsSettings.tsx:101: tpl_loan_approved: "অভিনন্দন! আপনার ঋণ ৳{amount} অনুমোদিত হয়েছে। মোট পরিশোধযোগ্য: ৳{payable}।",
src/pages/SmsSettings.tsx:102: tpl_loan_payment: "আপনার ঋণ পরিশোধ ৳{amount} গৃহীত হয়েছে। অবশিষ্ট বকেয়া: ৳{due}। ধন্যবাদ।",
src/pages/SmsSettings.tsx:103: tpl_irrigation_payment: "আপনার সেচ ফি ৳{amount} গৃহীত হয়েছে। ধন্যবাদ।",
src/pages/SmsSettings.tsx:104: tpl_due_reminder: "স্মরণিকা: আপনার {type} বকেয়া ৳{due} পরিশোধের তারিখ {date}। অনুগ্রহ করে যথাসময়ে পরিশোধ করুন।",
src/pages/SmsSettings.tsx:151: bangla: "বাংলা (Bangla)",
src/pages/SmsSettings.tsx:215: pageTitle: "এসএমএস সেটিংস",
src/pages/SmsSettings.tsx:216: pageDesc: "গ্রিনওয়েব বাল্ক এসএমএস নোটিফিকেশন কনফিগার করুন",
src/pages/SmsSettings.tsx:217: provider: "প্রোভাইডার",
src/pages/SmsSettings.tsx:218: enableSms: "এসএমএস সক্রিয় করুন",
src/pages/SmsSettings.tsx:219: enableSmsHint: "সমস্ত এসএমএস নোটিফিকেশনের প্রধান সুইচ।",
src/pages/SmsSettings.tsx:220: senderId: "সেন্ডার আইডি (ঐচ্ছিক)",
src/pages/SmsSettings.tsx:221: defaultLanguage: "ডিফল্ট ভাষা",
src/pages/SmsSettings.tsx:222: defaultLanguageHint: "বকেয়া স্মরণিকার জন্য ব্যবহৃত।",
src/pages/SmsSettings.tsx:223: reminderDaysBefore: "বকেয়ার আগে স্মরণিকা (দিন)",
src/pages/SmsSettings.tsx:224: secretsHint: "API টোকেন ব্যাকএন্ড সিক্রেটে নিরাপদে রাখা আছে এবং ফ্রন্টএন্ডে দেখানো হয় না। স্মরণিকা প্রতিদিন চলে এবং প্রতিটি বকেয়ার জন্য একবারই পাঠানো হয়।",
src/pages/SmsSettings.tsx:225: triggers: "ট্রিগার ইভেন্ট",
src/pages/SmsSettings.tsx:226: trg_savings_deposit: "সঞ্চয় জমা",
src/pages/SmsSettings.tsx:227: trg_savings_withdraw: "সঞ্চয় উত্তোলন",
src/pages/SmsSettings.tsx:228: trg_loan_approved: "ঋণ অনুমোদিত",
src/pages/SmsSettings.tsx:229: trg_loan_payment: "ঋণ পরিশোধ গৃহীত",
src/pages/SmsSettings.tsx:230: trg_irrigation_payment: "সেচ পেমেন্ট",
src/pages/SmsSettings.tsx:231: trg_due_reminder: "বকেয়া স্মরণিকা",
src/pages/SmsSettings.tsx:232: perOffice: "অফিস-ভিত্তিক ওভাররাইড",
src/pages/SmsSettings.tsx:233: perOfficeHint: "নির্দিষ্ট অফিসের জন্য এসএমএস বন্ধ করুন বা ভিন্ন সেন্ডার আইডি ব্যবহার করুন। সেন্ডার আইডি খালি রাখলে গ্লোবাল সেটিং প্রযোজ্য হবে।",
src/pages/SmsSettings.tsx:234: office: "অফিস",
src/pages/SmsSettings.tsx:235: smsEnabled: "এসএমএস সক্রিয়",
src/pages/SmsSettings.tsx:236: senderIdOverride: "সেন্ডার আইডি (ওভাররাইড)",
src/pages/SmsSettings.tsx:237: noOffices: "কোনো অফিস কনফিগার করা নেই।",
src/pages/SmsSettings.tsx:238: templates: "মেসেজ টেমপ্লেট",
src/pages/SmsSettings.tsx:239: templatesHint: "বাংলা / ইংরেজি টগল করুন। লাইভ প্রিভিউ স্যাম্পল ভ্যালু সহ মেসেজ দেখায়।",
src/pages/SmsSettings.tsx:240: sampleValues: "প্রিভিউয়ের জন্য স্যাম্পল মান",
src/pages/SmsSettings.tsx:241: reset: "রিসেট",
src/pages/SmsSettings.tsx:242: sampleHint: "উপরের মান পরিবর্তন করুন এবং নিচে প্রিভিউ লাইভ আপডেট দেখুন। এগুলো সংরক্ষিত হয় না — শুধু প্রিভিউয়ের জন্য।",
src/pages/SmsSettings.tsx:243: testPhone: "টেস্ট ফোন নম্বর",
src/pages/SmsSettings.tsx:244: testPhoneHint: "প্রতিটি টেমপ্লেটের টেস্ট বোতাম এই নম্বরে রেন্ডার করা প্রিভিউ পাঠাবে।",
src/pages/SmsSettings.tsx:245: bangla: "বাংলা",
src/pages/SmsSettings.tsx:247: preview: "প্রিভিউ",
src/pages/SmsSettings.tsx:248: chars: "অক্ষর",
src/pages/SmsSettings.tsx:249: emptyTpl: "খালি টেমপ্লেট",
src/pages/SmsSettings.tsx:250: missing: "অনুপস্থিত প্লেসহোল্ডার",
src/pages/SmsSettings.tsx:251: missingPlural: "অনুপস্থিত প্লেসহোল্ডার",
src/pages/SmsSettings.tsx:252: missingTail: "। ওভাররাইড চালু না করলে সংরক্ষণ করা যাবে না।",
src/pages/SmsSettings.tsx:253: autoFill: "অটো-ফিল",
src/pages/SmsSettings.tsx:254: autoFillTitle: "অনুপস্থিত প্লেসহোল্ডার টেমপ্লেটে যুক্ত করুন",
src/pages/SmsSettings.tsx:255: resetDefault: "ডিফল্টে ফেরান",
src/pages/SmsSettings.tsx:256: alreadyDefault: "ইতিমধ্যে ডিফল্ট",
src/pages/SmsSettings.tsx:257: restoreWording: "ডিফল্ট লেখা ফিরিয়ে আনুন",
src/pages/SmsSettings.tsx:258: testSend: "টেস্ট পাঠান",
src/pages/SmsSettings.tsx:259: sending: "পাঠানো হচ্ছে…",
src/pages/SmsSettings.tsx:260: enterTestPhone: "উপরে টেস্ট ফোন নম্বর দিন",
src/pages/SmsSettings.tsx:261: sendRenderedPreview: "প্রিভিউ টেস্ট নম্বরে পাঠান",
src/pages/SmsSettings.tsx:262: scheduler: "ম্যানুয়াল বকেয়া স্মরণিকা শিডিউলার",
src/pages/SmsSettings.tsx:263: schedulerHint: "নির্দিষ্ট তারিখ পরিসরে ঋণ/সেচ বকেয়ার জন্য স্মরণিকা পাঠান। একই আইটেমের জন্য পুনরাবৃত্ত স্মরণিকা স্বয়ংক্রিয়ভাবে এড়ানো হয়।",
src/pages/SmsSettings.tsx:264: fromDate: "শুরু তারিখ",
src/pages/SmsSettings.tsx:265: toDate: "শেষ তারিখ",
src/pages/SmsSettings.tsx:266: allOffices: "সব অফিস",
src/pages/SmsSettings.tsx:267: today: "আজ",
src/pages/SmsSettings.tsx:268: runReminders: "এখন স্মরণিকা চালান",
src/pages/SmsSettings.tsx:269: running: "চলছে…",
src/pages/SmsSettings.tsx:270: sendTestCard: "টেস্ট এসএমএস পাঠান",
src/pages/SmsSettings.tsx:271: mobile: "মোবাইল",
src/pages/SmsSettings.tsx:272: message: "মেসেজ",
src/pages/SmsSettings.tsx:273: sendTestBtn: "টেস্ট পাঠান",
src/pages/SmsSettings.tsx:274: saveSettings: "সেটিংস সংরক্ষণ",
src/pages/SmsSettings.tsx:275: saving: "সংরক্ষণ হচ্ছে…",
src/pages/SmsSettings.tsx:276: overrideMissing: "প্রয়োজনীয় প্লেসহোল্ডার অনুপস্থিত থাকলেও সংরক্ষণের অনুমতি দিন",
src/pages/SmsSettings.tsx:277: overrideHint: "বন্ধ: কোনো সক্রিয় টেমপ্লেটে প্রয়োজনীয় ট্যাগ অনুপস্থিত থাকলে সংরক্ষণ ব্লক হবে। চালু: সতর্কতা থাকবে কিন্তু সংরক্ষণ করা যাবে।",
src/pages/SmsSettings.tsx:278: blockedSave: "সংরক্ষণ করা যাবে না: কিছু টেমপ্লেটে প্রয়োজনীয় প্লেসহোল্ডার নেই। তবুও সংরক্ষণ করতে ওভাররাইড চালু করুন।",
src/pages/SmsSettings.tsx:279: saved: "সংরক্ষিত হয়েছে",
src/pages/SmsSettings.tsx:280: confirmTitle: "টেস্ট এসএমএস পাঠাবেন?",
src/pages/SmsSettings.tsx:281: confirmDescPrefix: "একটি প্রকৃত এসএমএস পাঠানো হবে",
src/pages/SmsSettings.tsx:282: confirmDescTpl: "টেমপ্লেট",
src/pages/SmsSettings.tsx:283: confirmDescPreview: "প্রিভিউ",
src/pages/SmsSettings.tsx:284: confirm: "এসএমএস পাঠান",
src/pages/SmsSettings.tsx:285: cancel: "বাতিল",
src/pages/SmsSettings.tsx:286: invalidPhone: "সঠিক ফোন নম্বর দিন (১০–১৫ ডিজিট)",
src/pages/SmsSettings.tsx:287: testSent: "টেস্ট এসএমএস পাঠানো হয়েছে ✓",
src/pages/SmsSettings.tsx:288: testFailed: "ব্যর্থ",
src/pages/SmsSettings.tsx:289: testLogTitle: "টেস্ট ফলাফল লগ",
src/pages/SmsSettings.tsx:290: testLogHint: "সাম্প্রতিক ওয়ান-ক্লিক টেস্টগুলো এখানে দেখানো হয়েছে।",
src/pages/SmsSettings.tsx:291: clearLog: "মুছুন",
src/pages/SmsSettings.tsx:292: noTests: "এখনো কোনো টেস্ট পাঠানো হয়নি।",
src/pages/SmsSettings.tsx:293: time: "সময়",
src/pages/SmsSettings.tsx:294: template: "টেমপ্লেট",
src/pages/SmsSettings.tsx:295: target: "প্রাপক",
src/pages/SmsSettings.tsx:296: status: "অবস্থা",
src/pages/SmsSettings.tsx:297: success: "সফল",
src/pages/SmsSettings.tsx:298: failed: "ব্যর্থ",
src/pages/SmsSettings.tsx:299: autoFilled: "অনুপস্থিত প্লেসহোল্ডার যুক্ত হয়েছে — সংরক্ষণ করুন",
src/pages/SmsSettings.tsx:300: nothingToFill: "যোগ করার কিছু নেই — সব প্লেসহোল্ডার ইতিমধ্যে আছে",
src/pages/SmsSettings.tsx:301: resetToastSaved: "ডিফল্টে ফেরানো হয়েছে — সংরক্ষণ করতে ভুলবেন না",
src/pages/SmsSettings.tsx:302: enterMobile: "মোবাইল দিন",
src/pages/SmsSettings.tsx:303: enterTestNumberFirst: "টেস্টের জন্য উপরে একটি ফোন নম্বর দিন",
src/pages/SmsSettings.tsx:304: tplEmpty: "টেমপ্লেট খালি",
src/pages/SmsSettings.tsx:305: pickBothDates: "দুটি তারিখই নির্বাচন করুন",
src/pages/SmsSettings.tsx:306: fromBeforeTo: "শুরু তারিখ শেষ তারিখের আগে হতে হবে",
src/pages/SmsSettings.tsx:743: <SelectItem value="bn">Bangla (বাংলা)</SelectItem>{/* i18n-ignore */}
src/pages/VerifyReceipt.tsx:43: title: "রসিদ যাচাইকরণ",
src/pages/VerifyReceipt.tsx:44: verifying: "যাচাই করা হচ্ছে…",
src/pages/VerifyReceipt.tsx:45: failed: "যাচাই ব্যর্থ",
src/pages/VerifyReceipt.tsx:46: notFound: "রসিদ পাওয়া যায়নি",
src/pages/VerifyReceipt.tsx:47: voided: "এই রসিদ বাতিল / void করা হয়েছে",
src/pages/VerifyReceipt.tsx:48: rateLimited: "অনেক বেশি অনুরোধ। কিছুক্ষণ পর আবার চেষ্টা করুন।",
src/pages/VerifyReceipt.tsx:49: network: "নেটওয়ার্ক ত্রুটি",
src/pages/VerifyReceipt.tsx:50: genuine: "এই রসিদটি বৈধ।",
src/pages/VerifyReceipt.tsx:51: pending: "এই রসিদ অনুমোদনের অপেক্ষায় আছে।",
src/pages/VerifyReceipt.tsx:52: rejected: "এই রসিদ বাতিল হয়েছে।",
src/pages/VerifyReceipt.tsx:53: company: "প্রতিষ্ঠান",
src/pages/VerifyReceipt.tsx:54: office: "অফিস",
src/pages/VerifyReceipt.tsx:55: receiptNo: "রসিদ নং",
src/pages/VerifyReceipt.tsx:56: date: "তারিখ",
src/pages/VerifyReceipt.tsx:57: type: "ধরন",
src/pages/VerifyReceipt.tsx:58: status: "অবস্থা",
src/pages/VerifyReceipt.tsx:59: amount: "পরিমাণ",
src/pages/VerifyReceipt.tsx:60: method: "মাধ্যম",
src/pages/VerifyReceipt.tsx:61: note: "নোট",
src/pages/VerifyReceipt.tsx:62: farmer: "ফার্মার",
src/pages/VerifyReceipt.tsx:63: name: "নাম",
src/pages/VerifyReceipt.tsx:64: memberNo: "সদস্য নং",
src/pages/VerifyReceipt.tsx:65: village: "গ্রাম",
src/pages/VerifyReceipt.tsx:66: mobile: "মোবাইল",
src/pages/VerifyReceipt.tsx:67: voidedOn: "Void করা হয়েছে",
src/pages/VerifyReceipt.tsx:68: retry: "আবার চেষ্টা করুন",
src/pages/VerifyReceipt.tsx:192: <Row k={T.amount} v={`৳ ${fmt(data.receipt.amount)}`} mono />
src/pages/VoterList.tsx:136: description: `${t("pgSavingsBalanceLbl" as any)}: ৳${fmt(d.savings_balance)} • ${t("pgLoanDueLbl" as any)}: ৳${fmt(d.loan_due)} • ${t("pgIrrigationDueLbl" as an
src/pages/VoterList.tsx:373: <div className={"font-mono font-semibold " + (bad ? "text-destructive" : "")}>৳{fmt(value)}</div>
src/pages/admin/DemoManager.tsx:526: <CardDescription>{verification.ok ? "সব ফার্মার ঠিকঠাক — non-voter দের কোনো সেভিং/লোন/শেয়ার নেই।" : `${verification.issues.length} টি সমস্যা পাওয়া গেছে`}</Car
src/pages/admin/DemoManager.tsx:545: <CardDescription>{locationVerification.ok ? "সব Division/District/Upazila/Mouza ঠিকঠাক sit হয়েছে।" : `${locationVerification.missing.length} টি গরমিল`}</CardDe
src/pages/admin/IrrigationDueMismatch.tsx:199: "ইনভয়েসের paid_amount ও বিভাজন-পেমেন্ট মোটের তুলনা। অমিল থাকলে রিক্যালকুলেট করুন।",
src/pages/admin/RoleMatrix.tsx:29: can_view: { en: "View", bn: "দেখা" },
src/pages/admin/RoleMatrix.tsx:30: can_add: { en: "Add", bn: "যোগ" },
src/pages/admin/RoleMatrix.tsx:31: can_edit: { en: "Edit", bn: "সম্পাদনা" },
src/pages/admin/RoleMatrix.tsx:32: can_delete: { en: "Delete", bn: "মুছুন" },
src/pages/admin/RoleMatrix.tsx:36: dashboard: "ড্যাশবোর্ড", offices: "অফিস", farmers: "কৃষক", seasons: "মৌসুম",
src/pages/admin/RoleMatrix.tsx:37: savings: "সঞ্চয়", loans: "ঋণ", irrigation: "সেচ", payments: "পেমেন্ট",
src/pages/admin/RoleMatrix.tsx:38: reports: "রিপোর্ট", users: "ব্যবহারকারী", audit: "অডিট", settings: "সেটিংস",
src/pages/admin/RoleMatrix.tsx:39: accounting: "হিসাব", cashbook: "ক্যাশবুক", approvals: "অনুমোদন", sms: "এসএমএস",
src/pages/admin/RoleMatrix.tsx:40: locations: "এলাকা",
src/pages/admin/RoleMatrix.tsx:179: title="Role Permission Matrix / রোল পারমিশন ম্যাট্রিক্স"
src/pages/admin/RoleMatrix.tsx:209: placeholder="Search module / মডিউল খুঁজুন"
src/pages/admin/RoleMatrix.tsx:242: <TableHead className="sticky left-0 bg-background z-30">Module / মডিউল</TableHead>
src/pages/reports/InstallmentCollectionReport.tsx:13: const money = (n: any) => `৳ ${Number(n || 0).toLocaleString("bn-BD", { maximumFractionDigits: 2 })}`;
src/pages/reports/LoanOverdueReport.tsx:15: const money = (n: any) => `৳ ${Number(n || 0).toLocaleString("bn-BD", { maximumFractionDigits: 2 })}`;
src/pages/reports/LoanPenaltyReport.tsx:13: const money = (n: any) => `৳ ${Number(n || 0).toLocaleString("bn-BD", { maximumFractionDigits: 2 })}`;
```
