# i18n Cleanup Report

Found 1006 hardcoded Bengali strings in UI files.

```
src/components/LanguageToggle.tsx:32: aria-label="বাংলায় পরিবর্তন করুন (Switch to Bengali)" /* i18n-ignore */
src/components/LanguageToggle.tsx:34: বাংলা{/* i18n-ignore */}
src/components/NotificationBell.tsx:144: <span className="text-sm font-semibold">{tx("Notifications", "নোটিফিকেশন")}</span>
src/components/NotificationBell.tsx:149: <button onClick={markAll} className="text-xs text-primary hover:underline">{tx("Mark all read", "সব পঠিত করুন")}</button>
src/components/NotificationBell.tsx:163: <div className="font-medium">{tx("Couldn't load notifications", "নোটিফিকেশন লোড হয়নি")}</div>
src/components/NotificationBell.tsx:180: <p className="p-4 text-sm text-muted-foreground">{tx("No notifications", "কোনো নোটিফিকেশন নেই")}</p>
src/components/auth/AccessDenied.tsx:8: const title = lang === "bn" ? "অ্যাক্সেস নেই" : "Access Denied";
src/components/auth/AccessDenied.tsx:10: ? "এই পেজটি দেখার অনুমতি আপনার নেই। প্রয়োজন হলে অ্যাডমিনের সাথে যোগাযোগ করুন।"
src/components/auth/AccessDenied.tsx:12: const back = lang === "bn" ? "ড্যাশবোর্ডে ফিরুন" : "Back to Dashboard";
src/components/auth/PasswordStrength.tsx:21: {tr("Strength", "শক্তি")}: <span className="font-medium text-foreground">{tr(label, labelBn)}</span>
src/components/farmers/VoterHistoryDialog.tsx:33: ? tx("You don't have permission to view this farmer's voter history.", "এই কৃষকের ভোটার ইতিহাস দেখার অনুমতি আপনার নেই।")
src/components/farmers/VoterHistoryDialog.tsx:34: : tx("Failed to load history.", "ইতিহাস লোড করা যায়নি।")
src/components/farmers/VoterHistoryDialog.tsx:47: <DialogHeader><DialogTitle>{tx("Voter Number History", "ভোটার নম্বর ইতিহাস")}</DialogTitle></DialogHeader>
src/components/farmers/VoterHistoryDialog.tsx:50: <Loader2 className="h-4 w-4 mr-2 animate-spin" />{tx("Loading…", "লোড হচ্ছে…")}
src/components/farmers/VoterHistoryDialog.tsx:55: <div className="py-6 text-center text-sm text-muted-foreground">{tx("No history yet", "এখনো কোনো ইতিহাস নেই")}</div>
src/components/farmers/VoterHistoryDialog.tsx:61: <TableHead>{tx("When", "কখন")}</TableHead>
src/components/farmers/VoterHistoryDialog.tsx:62: <TableHead>{tx("Old → New", "পুরাতন → নতুন")}</TableHead>
src/components/farmers/VoterHistoryDialog.tsx:63: <TableHead>{tx("Is Voter", "ভোটার?")}</TableHead>
src/components/farmers/VoterHistoryDialog.tsx:64: <TableHead>{tx("Changed by", "পরিবর্তনকারী")}</TableHead>
src/components/layout/AppLayout.tsx:69: <span>{lang === "en" ? "EN" : "বাং"}</span>
src/components/layout/AppLayout.tsx:74: <DropdownMenuItem onClick={() => setLang("bn")}>বাংলা</DropdownMenuItem>{/* i18n-ignore */}
src/components/layout/AppLayout.tsx:90: <Link to="/profile"><UserCircle className="mr-2 h-4 w-4" />{lang === "bn" ? "প্রোফাইল ও পাসওয়ার্ড" : "Profile & Password"}</Link>
src/components/layout/AppLayout.tsx:113: {lang === "en" ? "বাংলা" : "English"}
src/components/layout/AppLayout.tsx:116: <Link to="/profile"><UserCircle className="mr-2 h-4 w-4" />{lang === "bn" ? "প্রোফাইল ও পাসওয়ার্ড" : "Profile & Password"}</Link>
src/components/layout/AppSidebar.tsx:68: key: "savingsLoans", icon: Wallet, label: t("savingsAndLoans" as any) || "সঞ্চয় ও ঋণ",
src/components/layout/AppSidebar.tsx:81: key: "irrigation", icon: Droplets, label: t("irrigation" as any) || "সেচ",
src/components/layout/AppSidebar.tsx:144: key: "auditMon", icon: ShieldAlert, label: t("auditAndMonitoring" as any) || "অডিট ও মনিটরিং",
src/components/layout/SiteFooter.tsx:5: const BN_DIGITS: Record<string, string> = { "0": "০", "1": "১", "2": "২", "3": "৩", "4": "৪", "5": "৫", "6": "৬", "7": "৭", "8": "৮", "9": "
src/components/payments/IrrigationPaymentPanel.tsx:137: if (grandTotal <= 0) return toast.error(tx("Enter an amount", "একটি পরিমাণ লিখুন"));
src/components/payments/IrrigationPaymentPanel.tsx:139: return toast.error(tx("Select at least one current invoice", "অন্তত একটি বর্তমান ইনভয়েস বাছাই করুন"));
src/components/payments/IrrigationPaymentPanel.tsx:142: return toast.error(tx("Previous due collected exceeds previous due", "পূর্বের বকেয়া থেকে সংগৃহীত পূর্বের মোট বকেয়ার চেয়ে বেশি"));
src/components/payments/IrrigationPaymentPanel.tsx:145: return toast.error(tx("Previous irrigation due must be cleared first", "আগের সেচ বকেয়া সম্পূর্ণ পরিশোধ করতে হবে"));
src/components/payments/IrrigationPaymentPanel.tsx:148: if (!promiseDate) return toast.error(tx("Promise date required", "প্রতিশ্রুতির তারিখ আবশ্যক"));
src/components/payments/IrrigationPaymentPanel.tsx:149: if (!promiseRemarks.trim()) return toast.error(tx("Remarks required for special permission", "বিশেষ অনুমতির জন্য মন্তব্য আবশ্যক"));
src/components/payments/IrrigationPaymentPanel.tsx:370: remark: specialPermission ? `${tx("Special permission until", "বিশেষ অনুমতি — পরিশোধের তারিখ")}: ${promiseDate}${promiseRemarks ? " — " + pr
src/components/payments/IrrigationPaymentPanel.tsx:375: toast.warning(tx("Receipt generation failed — queued for retry", "রসিদ তৈরি ব্যর্থ — রিট্রাই কিউতে যোগ হয়েছে"));
src/components/payments/IrrigationPaymentPanel.tsx:382: ? `\n${tx("Promise date", "প্রতিশ্রুতির তারিখ")}: ${promiseDate}` : "";
src/components/payments/IrrigationPaymentPanel.tsx:385: `সেচের পেমেন্ট গ্রহণ করা হয়েছে।\nবর্তমান: ৳${Number(currentCollected || 0).toLocaleString()}\nপূর্বের বকেয়া: ৳${Number(previousCollected |
src/components/payments/IrrigationPaymentPanel.tsx:396: toast.warning(tx("SMS send failed — queued for retry", "SMS পাঠানো ব্যর্থ — রিট্রাই কিউতে যোগ হয়েছে"));
src/components/payments/IrrigationPaymentPanel.tsx:400: toast.success(tx("Payment recorded", "পেমেন্ট সংরক্ষিত হয়েছে"));
src/components/payments/IrrigationPaymentPanel.tsx:427: <Label>{tx("Select farmer", "ফার্মার বাছাই")}</Label>
src/components/payments/IrrigationPaymentPanel.tsx:432: <div className="text-center py-6 text-muted-foreground"><Loader2 className="h-5 w-5 animate-spin inline mr-2" /> {tx("Loading…", "লোড হচ্ছে…
src/components/payments/IrrigationPaymentPanel.tsx:436: <Alert><AlertDescription>{tx("No outstanding irrigation invoices for this farmer.", "এই ফার্মারের কোনো বকেয়া সেচ ইনভয়েস নেই।")}</AlertDesc
src/components/payments/IrrigationPaymentPanel.tsx:441: <h3 className="font-semibold">{tx("Current Invoice (বর্তমান বকেয়া)", "বর্তমান বকেয়া")}</h3>
src/components/payments/IrrigationPaymentPanel.tsx:446: <TableHead>{tx("Invoice", "ইনভয়েস")}</TableHead>
src/components/payments/IrrigationPaymentPanel.tsx:447: <TableHead>{tx("Season", "সিজন")}</TableHead>
src/components/payments/IrrigationPaymentPanel.tsx:448: <TableHead className="text-right">{tx("Irrigation", "সেচ")}</TableHead>
src/components/payments/IrrigationPaymentPanel.tsx:449: <TableHead className="text-right">{tx("Delay Fee", "বিলম্ব ফি")}</TableHead>
src/components/payments/IrrigationPaymentPanel.tsx:450: <TableHead className="text-right">{tx("Maintenance", "রক্ষণাবেক্ষণ")}</TableHead>
src/components/payments/IrrigationPaymentPanel.tsx:451: <TableHead className="text-right">{tx("Canal", "ক্যানেল")}</TableHead>
src/components/payments/IrrigationPaymentPanel.tsx:452: <TableHead className="text-right">{tx("Due", "বকেয়া")}</TableHead>
src/components/payments/IrrigationPaymentPanel.tsx:484: <span>{tx("Delay fee overridden — reason required", "বিলম্ব ফি পরিবর্তিত — কারণ আবশ্যক")}:</span>
src/components/payments/IrrigationPaymentPanel.tsx:489: placeholder={tx("Reason for override", "পরিবর্তনের কারণ")}
src/components/payments/IrrigationPaymentPanel.tsx:502: {tx("Selected payable", "বাছাইকৃত পরিশোধযোগ্য")}: <span className="font-mono font-semibold">{money(currentPayable)}</span>
src/components/payments/IrrigationPaymentPanel.tsx:505: <Label className="text-sm">{tx("Current invoice received (বকেয়া)", "বকেয়া হতে গৃহীত")}</Label>
src/components/payments/IrrigationPaymentPanel.tsx:521: {tx("This farmer has previous-season unpaid irrigation invoices.", "এই কৃষকের পূর্বের বকেয়া ইনভয়েস রয়েছে")}
src/components/payments/IrrigationPaymentPanel.tsx:526: <ChevronDown className="h-4 w-4" /> {tx("Previous unpaid invoices", "পূর্বের অপরিশোধিত ইনভয়েস")} ({previousInvoices.length})
src/components/payments/IrrigationPaymentPanel.tsx:531: <TableHead>{tx("Season", "সিজন")}</TableHead>
src/components/payments/IrrigationPaymentPanel.tsx:532: <TableHead>{tx("Invoice", "ইনভয়েস")}</TableHead>
src/components/payments/IrrigationPaymentPanel.tsx:533: <TableHead>{tx("Due Date", "নির্ধারিত তারিখ")}</TableHead>
src/components/payments/IrrigationPaymentPanel.tsx:534: <TableHead className="text-right">{tx("Due", "বকেয়া")}</TableHead>
src/components/payments/IrrigationPaymentPanel.tsx:551: {tx("Previous due total", "মোট পূর্বের বকেয়া")}: <span className="font-mono font-semibold">{money(previousDueTotal)}</span>
src/components/payments/IrrigationPaymentPanel.tsx:554: <Label className="text-sm">{tx("Previous due received (পূর্বের বকেয়া হতে)", "পূর্বের বকেয়া হতে গৃহীত")}</Label>
src/components/payments/IrrigationPaymentPanel.tsx:568: <span>{tx("Accept under special permission (বিশেষ অনুমতিতে গ্রহণ)", "বিশেষ অনুমতিতে গ্রহণ করুন")}</span>
src/components/payments/IrrigationPaymentPanel.tsx:570: <Badge variant="outline">{tx("Remaining after this payment", "বাকি থাকবে")}: {money(previousRemainingAfter)}</Badge>
src/components/payments/IrrigationPaymentPanel.tsx:575: <Label className="text-xs">{tx("Promise date", "প্রতিশ্রুতির তারিখ")} *</Label>
src/components/payments/IrrigationPaymentPanel.tsx:579: <Label className="text-xs">{tx("Remarks", "মন্তব্য")} *</Label>
src/components/payments/IrrigationPaymentPanel.tsx:580: <Input value={promiseRemarks} onChange={(e) => setPromiseRemarks(e.target.value)} placeholder={tx("e.g. will clear by Jul 31", "যেমন: ৩১ জুল
src/components/payments/IrrigationPaymentPanel.tsx:593: <Label>{tx("Method", "পেমেন্ট মাধ্যম")}</Label>
src/components/payments/IrrigationPaymentPanel.tsx:597: <Label>{tx("Note", "নোট")}</Label>
src/components/payments/IrrigationPaymentPanel.tsx:603: <div className="text-xs text-muted-foreground">{tx("Grand total received", "মোট গ্রহণ")}</div>
src/components/payments/IrrigationPaymentPanel.tsx:607: {submitting ? <><Loader2 className="h-4 w-4 animate-spin mr-2" />{tx("Saving…", "সংরক্ষণ…")}</> : <><CheckCircle2 className="h-4 w-4 mr-2" /
src/components/payments/IrrigationPaymentPanel.tsx:611: <p className="text-xs text-destructive">{tx("Submit blocked: previous irrigation due not fully cleared. Enable special permission to bypass.
src/components/receipts/ReceiptCopyMenu.tsx:21: <PrintButton title={title ?? tx("Print receipt", "রসিদ প্রিন্ট")} />
src/components/receipts/ReceiptCopyMenu.tsx:24: <Printer className="h-4 w-4 mr-1" />{label ?? tx("Print", "প্রিন্ট")}
src/components/receipts/ReceiptCopyMenu.tsx:29: <DropdownMenuItem onClick={() => onSelect("both")}>{tx("Both copies", "উভয় কপি")}</DropdownMenuItem>
src/components/receipts/ReceiptCopyMenu.tsx:30: <DropdownMenuItem onClick={() => onSelect("farmer")}>{tx("Farmer copy", "কৃষক কপি")}</DropdownMenuItem>
src/components/receipts/ReceiptCopyMenu.tsx:31: <DropdownMenuItem onClick={() => onSelect("office")}>{tx("Office copy", "অফিস কপি")}</DropdownMenuItem>
src/components/receipts/ReceiptSettingsButton.tsx:39: <SelectItem value="bn">বাংলা (Bangla)</SelectItem>{/* i18n-ignore */}
src/components/settings/BanglaFontSelector.tsx:9: const SAMPLE_BN = "যত মত তত পথ — বাংলাদেশের কৃষক সমিতি। কৃষ্ণচূড়া ফোটে। ক্ষুদ্র ঋণ ব্যবস্থা। ২০২৬ সালের সেচ মৌসুম। জ্ঞান, বিজ্ঞান, ঐক্য।";
src/components/settings/BanglaFontSelector.tsx:10: const SAMPLE_DIGITS = "সংখ্যা: ০ ১ ২ ৩ ৪ ৫ ৬ ৭ ৮ ৯ — টাকা ১২,৩৪৫.৬৭";
src/components/settings/BanglaFontSelector.tsx:11: const SAMPLE_CONJUNCTS = "যুক্তাক্ষর: ক্ষ ত্র জ্ঞ ঞ্চ ন্দ্র শ্র হ্ম ণ্ড স্ত্র";
src/components/settings/BanglaFontSelector.tsx:35: toast.success("বাংলা ফন্ট আপডেট হয়েছে — পরবর্তী PDF ও রিসিপ্টে কার্যকর।");
src/components/settings/BanglaFontSelector.tsx:64: toast.error(e?.message ?? "PDF তৈরি ব্যর্থ");
src/components/settings/BanglaFontSelector.tsx:72: <div className="font-semibold mb-1">বাংলা ফন্ট (PDF / রিসিপ্ট)</div>
src/components/settings/BanglaFontSelector.tsx:74: কোন বাংলা ফন্টে সেরা রেন্ডার হয় সেটা বেছে নিন। পছন্দ অটো-সেভ হয় এবং সব PDF/রিসিপ্টে এই ফন্ট subset-embed হয়, ফলে যেকোনো ডিভাইস ও PDF view
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
src/lib/irrigationInvoicePdf.ts:400: await nav.share({ files: [file], title: `সেচ ইনভয়েস ${d.invoice_no}`, text: `ইনভয়েস ${d.invoice_no} — মোট প্রদেয় ${fmt2(d.payable_amount)
src/lib/irrigationInvoicePdf.ts:418: const text = `সেচ ইনভয়েস ${d.invoice_no}\nমোট প্রদেয়: ${fmt2(d.payable_amount)} টাকা\nবকেয়া: ${fmt2(d.due_amount)} টাকা\nমেয়াদ: ${fmtDat
src/lib/irrigationInvoicePdf.ts:428: const subject = `সেচ ইনভয়েস ${d.invoice_no}`;
src/lib/irrigationInvoicePdf.ts:429: const body = `প্রিয় ${d.farmer?.name ?? "কৃষক"},\n\nইনভয়েস নং: ${d.invoice_no}\nমোট প্রদেয়: ${fmt2(d.payable_amount)} টাকা\nপরিশোধিত: ${f
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
src/pages/AuditLogs.tsx:150: const headersBn = ["তারিখ/সময়", "কার্যক্রম", "বিষয়", "অফিস", "কৃষক কোড", "কৃষকের নাম", "ব্যবহারকারী", "রেকর্ড আইডি", "পুরাতন তথ্য", "নতুন 
src/pages/Auth.tsx:61: const uErr = !u ? (lang === "bn" ? "ইউজারনেম দিন" : "Enter your username") : null;
src/pages/Auth.tsx:62: const pErr = !password ? (lang === "bn" ? "পাসওয়ার্ড দিন" : "Enter your password") : null;
src/pages/Auth.tsx:89: ? `"${u}" নামে কোন একাউন্ট নেই। বানান চেক করুন বা ইমেইল দিয়ে চেষ্টা করুন।`
src/pages/Auth.tsx:91: setUsernameError(lang === "bn" ? "ইউজারনেম পাওয়া যায়নি" : "Username not found");
src/pages/Auth.tsx:115: ? (lang === "bn" ? "পাসওয়ার্ড সঠিক নয়। আবার চেষ্টা করুন বা 'পাসওয়ার্ড ভুলে গেছেন' ব্যবহার করুন।" : "Password is incorrect. Try again or u
src/pages/Auth.tsx:117: ? (lang === "bn" ? "ইমেইল এখনও যাচাই হয়নি।" : "Email is not confirmed yet.")
src/pages/Auth.tsx:119: if (isInvalid) setPasswordError(lang === "bn" ? "পাসওয়ার্ড সঠিক নয়" : "Incorrect password");
src/pages/Auth.tsx:253: aria-label={showPassword ? (lang === "bn" ? "পাসওয়ার্ড লুকান" : "Hide password") : (lang === "bn" ? "পাসওয়ার্ড দেখান" : "Show password")}
src/pages/Auth.tsx:262: {lang === "bn" ? "Caps Lock চালু আছে" : "Caps Lock is on"}
src/pages/CardDesigner.tsx:21: company_name_bn: "স্মার্ট সেচ ও সমবায়",
src/pages/DataImport.tsx:559: if (!loanId) throw new Error("ইন্সটলমেন্ট ডাটা অনুপস্থিত। অটো-জেনারেট অথবা ইমপোর্ট সংশোধন করুন।");
src/pages/DataImport.tsx:883: 💡 <strong>account_number</strong> = farmer-এর Voter / Savings A/C No (১২ ডিজিট নম্বর)। Farmer তৈরি করার সময় auto-generate হয়। Bulk Farmer
src/pages/DataImport.tsx:886: 🏷️ <strong>dag_no</strong> এ একটি জমির একাধিক দাগ নম্বর কমা দিয়ে দিতে পারেন (যেমন <code>123, 124/A, 125-B</code>)। প্রতিটি টোকেনে শুধু সংখ
src/pages/FarmerDashboard.tsx:278: <CardHeader><CardTitle className="text-base">{tx("Irrigation invoices", "সেচ ইনভয়েস")}</CardTitle></CardHeader>
src/pages/FarmerDashboard.tsx:283: <TableHead>{tx("Invoice", "ইনভয়েস")}</TableHead>
src/pages/FarmerDashboard.tsx:284: <TableHead>{tx("Season", "সিজন")}</TableHead>
src/pages/FarmerDashboard.tsx:285: <TableHead>{tx("Land", "জমি")}</TableHead>
src/pages/FarmerDashboard.tsx:286: <TableHead>{tx("Due", "মেয়াদ")}</TableHead>
src/pages/FarmerDashboard.tsx:287: <TableHead className="text-right">{tx("Payable", "প্রদেয়")}</TableHead>
src/pages/FarmerDashboard.tsx:288: <TableHead className="text-right">{tx("Paid", "পরিশোধিত")}</TableHead>
src/pages/FarmerDashboard.tsx:289: <TableHead className="text-right">{tx("Outstanding", "বকেয়া")}</TableHead>
src/pages/FarmerDashboard.tsx:290: <TableHead>{tx("Status", "স্ট্যাটাস")}</TableHead>
src/pages/FarmerDetail.tsx:174: ?? (kind === "loan" ? "ঋণের কিস্তি গ্রহণ" : kind === "savings" ? "সঞ্চয় জমা গ্রহণ" : "সেচ চার্জ গ্রহণ");
src/pages/FarmerDetail.tsx:180: bill_info: kind === "irrigation" ? "সেচ চার্জ" : undefined,
src/pages/FarmerDetail.tsx:195: description: s.note ?? `${tx("Savings", "সঞ্চয়")} ${s.type} (${s.status})`,
src/pages/FarmerDetail.tsx:206: description: `${tx("Loan disbursed — total payable", "ঋণ বিতরণ — মোট পরিশোধ্য")} ${money(l.total_payable)}`,
src/pages/FarmerDetail.tsx:230: landOwnerLabel = tx("Self", "নিজ");
src/pages/FarmerDetail.tsx:236: high_land: tx("High land", "উঁচু জমি"),
src/pages/FarmerDetail.tsx:237: medium_land: tx("Medium land", "মাঝারি জমি"),
src/pages/FarmerDetail.tsx:238: low_land: tx("Low land", "নিচু জমি"),
src/pages/FarmerDetail.tsx:239: other: tx("Other", "অন্যান্য"),
src/pages/FarmerDetail.tsx:268: owner_type_bn: land?.owner_type === "borgadar" ? "বর্গাদার" : land?.owner_type === "owner" ? "মালিক" : null,
src/pages/FarmerDetail.tsx:695: ⚠️ {tx("This farmer is not enabled as Voter / Savings A/C. No savings, loan or share data will exist. Toggle Voter from Edit above to enable
src/pages/FarmerDetail.tsx:834: <p className="text-xs text-destructive mt-1">{liveErr} — দয়া করে কমা দিয়ে আলাদা করুন এবং শুধু সংখ্যা/অক্ষর/<code>/</code>/<code>-</code> ব
src/pages/FarmerDetail.tsx:837: একাধিক দাগ নং কমা (,) দিয়ে আলাদা করুন। উদাহরণ: <code>123, 124/A, 125-B</code>
src/pages/FarmerDetail.tsx:838: {preview && preview !== land.dag_no.trim() && <> — সংরক্ষণে রূপান্তরিত হবে: <strong>{preview}</strong></>}
src/pages/FarmerDetail.tsx:1064: <p className="text-xs text-destructive mt-1">{liveErr} — কমা দিয়ে আলাদা করুন; শুধু সংখ্যা/অক্ষর/<code>/</code>/<code>-</code> অনুমোদিত।</p>
src/pages/FarmerDetail.tsx:1067: একাধিক দাগ নং কমা (,) দিয়ে আলাদা করুন। উদাহরণ: <code>123, 124/A, 125-B</code>
src/pages/FarmerDetail.tsx:1068: {preview && preview !== editForm.dag_no.trim() && <> — সংরক্ষণে রূপান্তরিত হবে: <strong>{preview}</strong></>}
src/pages/FarmerProfileReport.tsx:75: case "high_land": return tx("High Land", "উঁচু জমি(High Land)");
src/pages/FarmerProfileReport.tsx:76: case "medium_land": return tx("Medium Land", "মাঝারি জমি(Medium Land)");
src/pages/FarmerProfileReport.tsx:77: case "low_land": return tx("Low Land", "নিচু জমি(Low Land)");
src/pages/FarmerProfileReport.tsx:78: case "other": return tx("Other", "বিবিধ");
src/pages/FarmerProfileReport.tsx:87: const ownerTypeText = isBorga ? tx("Sharecropper", "বর্গাদার") : tx("Owner", "মালিক");
src/pages/FarmerProfileReport.tsx:182: return <div className="p-6 text-sm text-muted-foreground">{tx("Loading report...", "রিপোর্ট লোড হচ্ছে...")}</div>;
src/pages/FarmerProfileReport.tsx:186: return <div className="p-6 text-sm text-muted-foreground">{tx("Farmer not found.", "কৃষক পাওয়া যায়নি।")}</div>;
src/pages/FarmerProfileReport.tsx:387: <div className="farmer-report-rule">{tx("Farmer Information at a Glance", "এক নজরে কৃষকের তথ্য")}</div>
src/pages/FarmerProfileReport.tsx:478: <div className="farmer-year-row">{tx("Irrigation Year:", "সেচ বর্ষ:")} {year}</div>
src/pages/Farmers.tsx:33: "Karim Uddin", "করিম উদ্দিন", "Abdul", "Salma", "1234567890123", "01700000000", // i18n-ignore
src/pages/Farmers.tsx:87: placeholder={tx("Leave blank and press Generate", "খালি রাখলে Generate চাপুন")}
src/pages/Farmers.tsx:106: {hasNumber ? `✓ ${t("voterSavingsActive")}` : tx("If a number is set, will be auto-treated as Voter / Savings member", "নম্বর থাকলেই স্বয়ংক
src/pages/Farmers.tsx:133: if (!error && data === true) setDupErr(tx("This Farmer ID is already in use.", "এই Farmer ID আগে থেকেই ব্যবহৃত।"));
src/pages/Farmers.tsx:149: <span className="text-xs text-muted-foreground">{tx("(auto-generated, Super Admin can change)", "(অটো-জেনারেট, Super Admin পরিবর্তন করতে পার
src/pages/Farmers.tsx:153: "ফরম্যাট: 5-digit, যেমন 00001। 'F-00001', '1', '2026-00000001' এর মতো ইনপুট স্বয়ংক্রিয়ভাবে 00001 হবে।"
src/pages/Farmers.tsx:172: {!isSuper && <p className="mt-1 text-xs text-muted-foreground">{tx("Only Super Admin can change.", "শুধু Super Admin পরিবর্তন করতে পারবে।")}
src/pages/Farmers.tsx:641: <Input placeholder={t("search") + " / দাগ (123, 124/A)…"} value={q} onChange={e => { setQ(e.target.value); setPage(0); }} className="pl-9" /
src/pages/FarmersImport.tsx:100: ["00001", "10001", "Md. Abdur Rahman", "মোঃ আব্দুর রহমান", "Md. Karim Uddin", "01711000000", "Bagbari"],
src/pages/FarmersImport.tsx:101: ["",      "",      "Mst. Rahima Khatun", "মোসাঃ রহিমা খাতুন", "Md. Jashim", "01811000000", "Char Bhabanipur"],
src/pages/FarmersImport.tsx:117: ["farmer_id", "No", "5-digit padded code (e.g. 00001). 'F-00001', '1', '2026-00000001' এর মতো ইনপুট স্বয়ংক্রিয়ভাবে 00001 হবে। existing হলে
src/pages/FarmersImport.tsx:118: ["voter_number", "No", "নম্বর থাকলে অটো Voter / Savings active সদস্য।"],
src/pages/FarmersImport.tsx:119: ["name_en", "Yes", "ইংরেজী নাম"],
src/pages/FarmersImport.tsx:120: ["name_bn", "No", "বাংলা নাম"],
src/pages/FarmersImport.tsx:123: ["village", "No", "Free-text গ্রাম"],
src/pages/FarmersImport.tsx:239: description={tx("Upload a .csv or .xlsx file. If voter_number is set, the farmer auto-becomes a Voter / Savings active member.", ".csv বা .x
src/pages/FarmersImport.tsx:270: "Farmer ID ফরম্যাট: 5-digit padded (যেমন 00001)। 'F-00001', '1', '2026-00000001' এর মতো ইনপুট স্বয়ংক্রিয়ভাবে 00001 হবে। অক্ষর / সংখ্যা ছাড
src/pages/FarmersImport.tsx:274: {tx("If farmer_id is given, existing farmer is updated, else a new one is created.", "farmer_id দিলে existing farmer থাকলে update, না থাকলে 
src/pages/FarmersImport.tsx:275: <span className="ml-2">{tx("If voter_number is given, auto Voter / Savings active member.", "voter_number দিলে অটো Voter / Savings active সদ
src/pages/FarmersImport.tsx:295: {tx("Only rows containing name_en will be imported.", "শুধু যেসব row-তে name_en আছে সেগুলোই import হবে।")}
src/pages/IrrigationInvoices.tsx:55: case "draft": return tx("Draft", "খসড়া");
src/pages/IrrigationInvoices.tsx:56: case "generated": return tx("Issued", "ইস্যু");
src/pages/IrrigationInvoices.tsx:57: case "partial_paid": return tx("Partial", "আংশিক");
src/pages/IrrigationInvoices.tsx:58: case "paid": return tx("Paid", "পরিশোধিত");
src/pages/IrrigationInvoices.tsx:59: case "overdue": return tx("Overdue", "মেয়াদোত্তীর্ণ");
src/pages/IrrigationInvoices.tsx:60: case "cancelled": return tx("Cancelled", "বাতিল");
src/pages/IrrigationInvoices.tsx:74: document.title = `${tx("Irrigation Invoices", "সেচ ইনভয়েস")} — ${t("appName")}`;
src/pages/IrrigationInvoices.tsx:83: <PageHeader title={tx("Irrigation Invoices", "সেচ ইনভয়েস")} description={tx("Create, list and configure invoices. Receive payments from the
src/pages/IrrigationInvoices.tsx:86: <TabsTrigger value="list">{tx("Invoice list", "ইনভয়েস তালিকা")}</TabsTrigger>
src/pages/IrrigationInvoices.tsx:87: <TabsTrigger value="generate">{tx("Create invoice", "ইনভয়েস তৈরি")}</TabsTrigger>
src/pages/IrrigationInvoices.tsx:88: <TabsTrigger value="settings">{tx("Settings", "সেটিংস")}</TabsTrigger>
src/pages/IrrigationInvoices.tsx:159: title: tx("Cancel invoice?", "ইনভয়েস বাতিল করুন?"),
src/pages/IrrigationInvoices.tsx:160: description: `${inv.invoice_no} — ${money(inv.payable_amount)} ${tx("BDT. This cannot be undone.", "টাকা। এটি পুনরুদ্ধার করা যাবে না।")}`,
src/pages/IrrigationInvoices.tsx:161: destructive: true, confirmText: tx("Cancel it", "বাতিল করুন"),
src/pages/IrrigationInvoices.tsx:169: toast.success(tx("Invoice cancelled", "ইনভয়েস বাতিল করা হয়েছে")); load();
src/pages/IrrigationInvoices.tsx:174: title: tx("Delete invoice?", "ইনভয়েস মুছে ফেলবেন?"),
src/pages/IrrigationInvoices.tsx:175: description: `${inv.invoice_no} — ${tx("Deleted invoices won't appear in the list.", "মুছে ফেলা ইনভয়েস তালিকায় দেখাবে না।")}`,
src/pages/IrrigationInvoices.tsx:176: destructive: true, confirmText: tx("Delete", "মুছুন"),
src/pages/IrrigationInvoices.tsx:184: toast.success(tx("Invoice deleted", "ইনভয়েস মুছে ফেলা হয়েছে")); load();
src/pages/IrrigationInvoices.tsx:224: toast.error(e?.message ?? tx("Failed to generate PDF", "পিডিএফ তৈরি ব্যর্থ"));
src/pages/IrrigationInvoices.tsx:238: toast.error(e?.message ?? tx("Failed to preview PDF", "প্রিভিউ তৈরি ব্যর্থ"));
src/pages/IrrigationInvoices.tsx:246: if (!items.length) return toast.error(tx("Select invoices first", "প্রথমে ইনভয়েস নির্বাচন করুন"));
src/pages/IrrigationInvoices.tsx:249: title: tx("Large batch", "বড় ব্যাচ"),
src/pages/IrrigationInvoices.tsx:250: description: tx("This may take a while and use a lot of memory. Continue?", "এটি সময়সাপেক্ষ এবং প্রচুর মেমরি ব্যবহার করতে পারে। চালিয়ে যাব
src/pages/IrrigationInvoices.tsx:258: toast.success(tx(`Downloaded ${items.length} invoices`, `${items.length} টি ইনভয়েস ডাউনলোড হয়েছে`));
src/pages/IrrigationInvoices.tsx:260: toast.error(e?.message ?? tx("Bulk download failed", "ব্যাচ ডাউনলোড ব্যর্থ"));
src/pages/IrrigationInvoices.tsx:266: if (!items.length) return toast.error(tx("Select invoices first", "প্রথমে ইনভয়েস নির্বাচন করুন"));
src/pages/IrrigationInvoices.tsx:274: toast.error(e?.message ?? tx("Preview failed", "প্রিভিউ ব্যর্থ"));
src/pages/IrrigationInvoices.tsx:282: toast.info(tx("Sharing not supported — PDF downloaded instead. Attach it manually.", "শেয়ার সাপোর্ট নেই — PDF ডাউনলোড হয়েছে। ম্যানুয়ালি স
src/pages/IrrigationInvoices.tsx:285: toast.error(e?.message ?? tx("Share failed", "শেয়ার ব্যর্থ"));
src/pages/IrrigationInvoices.tsx:303: toast.success(tx("Preset applied", "প্রিসেট প্রয়োগ হয়েছে"));
src/pages/IrrigationInvoices.tsx:323: <Label>{tx("Season", "সিজন")}</Label>
src/pages/IrrigationInvoices.tsx:327: <SelectItem value="all">{tx("All", "সব")}</SelectItem>
src/pages/IrrigationInvoices.tsx:334: <Label>{tx("Office", "অফিস")}</Label>
src/pages/IrrigationInvoices.tsx:338: <SelectItem value="all">{tx("All", "সব")}</SelectItem>
src/pages/IrrigationInvoices.tsx:345: <Label>{tx("Status", "স্ট্যাটাস")}</Label>
src/pages/IrrigationInvoices.tsx:349: <SelectItem value="all">{tx("All", "সব")}</SelectItem>
src/pages/IrrigationInvoices.tsx:350: <SelectItem value="generated">{tx("Issued", "ইস্যু")}</SelectItem>
src/pages/IrrigationInvoices.tsx:351: <SelectItem value="partial_paid">{tx("Partial", "আংশিক")}</SelectItem>
src/pages/IrrigationInvoices.tsx:352: <SelectItem value="paid">{tx("Paid", "পরিশোধিত")}</SelectItem>
src/pages/IrrigationInvoices.tsx:353: <SelectItem value="overdue">{tx("Overdue", "মেয়াদোত্তীর্ণ")}</SelectItem>
src/pages/IrrigationInvoices.tsx:354: <SelectItem value="cancelled">{tx("Cancelled", "বাতিল")}</SelectItem>
src/pages/IrrigationInvoices.tsx:359: <Label>{tx("Search", "খুঁজুন")}</Label>
src/pages/IrrigationInvoices.tsx:360: <Input placeholder={tx("Invoice no / farmer / code / mobile / dag / mouza", "ইনভয়েস নং / কৃষক / কোড / মোবাইল / দাগ / মৌজা")} value={search}
src/pages/IrrigationInvoices.tsx:364: <p className="text-sm text-muted-foreground">{filtered.length} {tx("invoices", "টি ইনভয়েস")} {loading && tx("(loading…)", "(লোড হচ্ছে…)")}<
src/pages/IrrigationInvoices.tsx:378: <span className="font-semibold">{selected.size}</span> {tx("invoices selected", "টি ইনভয়েস নির্বাচিত")}
src/pages/IrrigationInvoices.tsx:381: <Button size="sm" variant="ghost" onClick={() => setSelected(new Set())}>{tx("Clear", "মুছুন")}</Button>
src/pages/IrrigationInvoices.tsx:385: <Files className="h-4 w-4 mr-1" />{bulkBusy ? tx("Working…", "প্রস্তুত…") : tx("Download set as PDF", "সেট PDF ডাউনলোড")}
src/pages/IrrigationInvoices.tsx:390: <Eye className="h-4 w-4 mr-2" />{tx("Preview combined PDF", "যৌথ PDF প্রিভিউ")}
src/pages/IrrigationInvoices.tsx:393: <DropdownMenuItem onClick={() => bulkDownload("both")}>{tx("Both copies (per page)", "উভয় কপি (প্রতি পেজ)")}</DropdownMenuItem>
src/pages/IrrigationInvoices.tsx:394: <DropdownMenuItem onClick={() => bulkDownload("office")}>{tx("Office copies only", "শুধু অফিস কপি")}</DropdownMenuItem>
src/pages/IrrigationInvoices.tsx:395: <DropdownMenuItem onClick={() => bulkDownload("farmer")}>{tx("Farmer copies only", "শুধু কৃষক কপি")}</DropdownMenuItem>
src/pages/IrrigationInvoices.tsx:408: <TableHead>{tx("Invoice No", "ইনভয়েস নং")}</TableHead>
src/pages/IrrigationInvoices.tsx:409: <TableHead>{tx("Farmer", "কৃষক")}</TableHead>
src/pages/IrrigationInvoices.tsx:410: <TableHead>{tx("Land", "জমি")}</TableHead>
src/pages/IrrigationInvoices.tsx:411: <TableHead>{tx("Season", "সিজন")}</TableHead>
src/pages/IrrigationInvoices.tsx:412: <TableHead className="text-right">{tx("Payable", "প্রদেয়")}</TableHead>
src/pages/IrrigationInvoices.tsx:413: <TableHead className="text-right">{tx("Paid", "পরিশোধিত")}</TableHead>
src/pages/IrrigationInvoices.tsx:414: <TableHead className="text-right">{tx("Due", "বকেয়া")}</TableHead>
src/pages/IrrigationInvoices.tsx:415: <TableHead>{tx("Due date", "মেয়াদ")}</TableHead>
src/pages/IrrigationInvoices.tsx:416: <TableHead>{tx("Status", "স্ট্যাটাস")}</TableHead>
src/pages/IrrigationInvoices.tsx:427: <div className="text-xs text-muted-foreground">{r.farmers?.farmer_code} {r.is_borga && <span className="ml-1">🤝 {tx("Sharecropper", "বর্গা"
src/pages/IrrigationInvoices.tsx:445: <Button size="sm" variant="ghost" title={tx("View", "দেখুন")} onClick={() => setPreviewId(r.id)}><Eye className="h-4 w-4" /></Button>
src/pages/IrrigationInvoices.tsx:448: <Button size="sm" variant="ghost" title={tx("Print", "প্রিন্ট")}><Printer className="h-4 w-4" /></Button>
src/pages/IrrigationInvoices.tsx:452: <Eye className="h-4 w-4 mr-2" />{tx("Preview PDF", "PDF প্রিভিউ")}
src/pages/IrrigationInvoices.tsx:456: {lastCopy === "both" ? "✓ " : ""}{tx("Both copies (A4)", "উভয় কপি (A4)")}
src/pages/IrrigationInvoices.tsx:459: {lastCopy === "office" ? "✓ " : ""}{tx("Office copy", "অফিস কপি")}
src/pages/IrrigationInvoices.tsx:462: {lastCopy === "farmer" ? "✓ " : ""}{tx("Farmer copy", "কৃষকের কপি")}
src/pages/IrrigationInvoices.tsx:466: <Share2 className="h-4 w-4 mr-2" />{tx("Share PDF…", "PDF শেয়ার…")}
src/pages/IrrigationInvoices.tsx:469: <MessageCircle className="h-4 w-4 mr-2" />{tx("WhatsApp summary", "WhatsApp বার্তা")}
src/pages/IrrigationInvoices.tsx:472: <Mail className="h-4 w-4 mr-2" />{tx("Email summary", "ইমেইল বার্তা")}
src/pages/IrrigationInvoices.tsx:476: <SettingsIcon className="h-4 w-4 mr-2" />{tx("PDF settings", "PDF সেটিংস")}
src/pages/IrrigationInvoices.tsx:481: <Button size="sm" variant="ghost" title={tx("Edit", "এডিট")} onClick={() => setEditInv(r)}><Pencil className="h-4 w-4" /></Button>
src/pages/IrrigationInvoices.tsx:484: <Button size="sm" variant="ghost" title={tx("Cancel", "বাতিল")} onClick={() => cancelInvoice(r)}><Ban className="h-4 w-4 text-destructive" /
src/pages/IrrigationInvoices.tsx:487: <Button size="sm" variant="ghost" title={tx("Delete", "মুছুন")} onClick={() => deleteInvoice(r)}><Trash2 className="h-4 w-4 text-destructive
src/pages/IrrigationInvoices.tsx:494: <TableRow><TableCell colSpan={11} className="text-center py-6 text-muted-foreground">{tx("No invoices", "কোন ইনভয়েস নেই")}</TableCell></Tab
src/pages/IrrigationInvoices.tsx:509: <DialogHeader><DialogTitle>{tx("Invoice PDF preview", "ইনভয়েস PDF প্রিভিউ")}</DialogTitle></DialogHeader>
src/pages/IrrigationInvoices.tsx:514: <Button variant="outline" onClick={() => { if (pdfPreviewUrl) URL.revokeObjectURL(pdfPreviewUrl); setPdfPreviewUrl(null); }}>{tx("Close", "ব
src/pages/IrrigationInvoices.tsx:521: <DialogHeader><DialogTitle>{tx("Invoice PDF settings", "ইনভয়েস PDF সেটিংস")}</DialogTitle></DialogHeader>
src/pages/IrrigationInvoices.tsx:524: <Label className="text-xs font-semibold">{tx("Printer preset", "প্রিন্টার প্রিসেট")}</Label>
src/pages/IrrigationInvoices.tsx:526: <SelectTrigger><SelectValue placeholder={tx("Choose a preset to apply…", "প্রিসেট বাছাই করুন…")} /></SelectTrigger>
src/pages/IrrigationInvoices.tsx:533: <p className="text-[11px] text-muted-foreground">{tx("Quickly set paper size, margins and cut-line for common printers.", "সাধারণ প্রিন্টারে
src/pages/IrrigationInvoices.tsx:536: <p className="text-xs text-muted-foreground">{tx("Adjust paper, margins and the cut-line position so the office and farmer copies fit your p
src/pages/IrrigationInvoices.tsx:538: <div className="col-span-2"><Label>{tx("Paper size", "পেজ সাইজ")}</Label>
src/pages/IrrigationInvoices.tsx:547: <div><Label>{tx("Top margin (mm)", "উপরের মার্জিন (mm)")}</Label>
src/pages/IrrigationInvoices.tsx:549: <div><Label>{tx("Bottom margin (mm)", "নিচের মার্জিন (mm)")}</Label>
src/pages/IrrigationInvoices.tsx:551: <div><Label>{tx("Left margin (mm)", "বাম মার্জিন (mm)")}</Label>
src/pages/IrrigationInvoices.tsx:553: <div><Label>{tx("Right margin (mm)", "ডান মার্জিন (mm)")}</Label>
src/pages/IrrigationInvoices.tsx:555: <div className="col-span-2"><Label>{tx("Cut-line position from top (mm)", "কাট-লাইন অবস্থান উপর থেকে (mm)")}</Label>
src/pages/IrrigationInvoices.tsx:557: <p className="text-[11px] text-muted-foreground mt-1">{tx("A4 mid = 148.5 · Letter mid = 139.7", "A4 মাঝ = 148.5 · Letter মাঝ = 139.7")}</p>
src/pages/IrrigationInvoices.tsx:561: <h4 className="text-sm font-semibold">{tx("Signatures", "স্বাক্ষর")}</h4>
src/pages/IrrigationInvoices.tsx:562: <p className="text-[11px] text-muted-foreground">{tx("Pick a staff member to auto-fill the signature name, or type a custom value.", "স্বাক্
src/pages/IrrigationInvoices.tsx:564: <div><Label>{tx("Farmer sign label", "কৃষকের স্বাক্ষর লেবেল")}</Label>
src/pages/IrrigationInvoices.tsx:566: <div><Label>{tx("Farmer name (optional)", "কৃষকের নাম (ঐচ্ছিক)")}</Label>
src/pages/IrrigationInvoices.tsx:567: <Input value={pdfSettings.farmerSignName} onChange={(e) => setPdfSettings({ ...pdfSettings, farmerSignName: e.target.value })} placeholder={
src/pages/IrrigationInvoices.tsx:568: <div><Label>{tx("Collector sign label", "আদায়কারীর স্বাক্ষর লেবেল")}</Label>
src/pages/IrrigationInvoices.tsx:570: <div><Label>{tx("Collector — staff list", "আদায়কারী — স্টাফ তালিকা")}</Label>
src/pages/IrrigationInvoices.tsx:575: <SelectTrigger><SelectValue placeholder={tx("Select staff…", "স্টাফ নির্বাচন…")} /></SelectTrigger>
src/pages/IrrigationInvoices.tsx:580: {!staff.length && <div className="px-3 py-2 text-xs text-muted-foreground">{tx("No staff available", "কোন স্টাফ নেই")}</div>}
src/pages/IrrigationInvoices.tsx:584: <div className="col-span-2"><Label>{tx("Collector name / title", "আদায়কারীর নাম / পদবি")}</Label>
src/pages/IrrigationInvoices.tsx:585: <Input value={pdfSettings.collectorSignName} onChange={(e) => setPdfSettings({ ...pdfSettings, collectorSignName: e.target.value })} placeho
src/pages/IrrigationInvoices.tsx:586: <div><Label>{tx("Farmer — staff list", "কৃষক স্বাক্ষর — স্টাফ তালিকা")}</Label>
src/pages/IrrigationInvoices.tsx:591: <SelectTrigger><SelectValue placeholder={tx("Select staff…", "স্টাফ নির্বাচন…")} /></SelectTrigger>
src/pages/IrrigationInvoices.tsx:603: <Button variant="outline" onClick={() => { setPdfSettings({ ...DEFAULT_INVOICE_SETTINGS }); }}>{tx("Reset", "রিসেট")}</Button>
src/pages/IrrigationInvoices.tsx:604: <Button variant="outline" onClick={() => setPdfSettingsOpen(false)}>{tx("Close", "বন্ধ")}</Button>
src/pages/IrrigationInvoices.tsx:605: <Button onClick={() => { saveInvoiceSettings(pdfSettings); toast.success(tx("Saved", "সংরক্ষণ হয়েছে")); setPdfSettingsOpen(false); }}>{tx("
src/pages/IrrigationInvoices.tsx:635: if (oc < 0 || df < 0) return toast.error(tx("Negative values not allowed", "ঋণাত্মক মান দেওয়া যাবে না"));
src/pages/IrrigationInvoices.tsx:636: if (!dueDate) return toast.error(tx("Enter due date", "মেয়াদ তারিখ দিন"));
src/pages/IrrigationInvoices.tsx:659: toast.success(tx("Invoice updated", "ইনভয়েস হালনাগাদ হয়েছে"));
src/pages/IrrigationInvoices.tsx:666: <DialogHeader><DialogTitle>{tx("Edit invoice", "ইনভয়েস এডিট")} — {inv.invoice_no}</DialogTitle></DialogHeader>
src/pages/IrrigationInvoices.tsx:669: <Label>{tx("Due date", "মেয়াদ তারিখ")}</Label>
src/pages/IrrigationInvoices.tsx:674: <Label>{tx("Other charge", "অন্যান্য চার্জ")}</Label>
src/pages/IrrigationInvoices.tsx:678: <Label>{tx("Late fee", "বিলম্ব ফি")}</Label>
src/pages/IrrigationInvoices.tsx:683: <Label>{tx("Note", "মন্তব্য")}</Label>
src/pages/IrrigationInvoices.tsx:687: {tx("Use \"Recalculate\" to change irrigation/maintenance/canal amounts.", "সেচ/রক্ষণাবেক্ষণ/খাল চার্জ পরিবর্তনের জন্য “পুনঃগণনা” ব্যবহার কর
src/pages/IrrigationInvoices.tsx:691: <Button variant="outline" onClick={onClose} disabled={busy}>{tx("Close", "বন্ধ")}</Button>
src/pages/IrrigationInvoices.tsx:692: <Button onClick={save} disabled={busy}>{busy ? tx("Saving…", "সংরক্ষণ…") : tx("Save", "সংরক্ষণ করুন")}</Button>
src/pages/IrrigationInvoices.tsx:709: if (reason.trim().length < 3) return toast.error(tx("Enter a reason (at least 3 chars)", "কারণ লিখুন (অন্তত ৩ অক্ষর)"));
src/pages/IrrigationInvoices.tsx:716: toast.success(tx("Invoice recalculated", "ইনভয়েস পুনঃগণনা হয়েছে"));
src/pages/IrrigationInvoices.tsx:729: {tx("Invoice", "ইনভয়েস")} {inv.invoice_no}
src/pages/IrrigationInvoices.tsx:730: {inv.is_manual_rate && <Badge variant="outline" className="text-xs">{tx("Manual rate", "ম্যানুয়াল রেট")}</Badge>}
src/pages/IrrigationInvoices.tsx:731: <Badge variant="secondary" className="text-xs gap-1"><ShieldCheck className="h-3 w-3" />{tx("Snapshot protected", "স্ন্যাপশট সুরক্ষিত")}</Ba
src/pages/IrrigationInvoices.tsx:735: <Row k={tx("Farmer", "কৃষক")} v={`${inv.farmers?.name_bn ?? inv.farmers?.name_en} (${inv.farmers?.farmer_code})`} />
src/pages/IrrigationInvoices.tsx:736: <Row k={tx("Type", "ধরন")} v={inv.is_borga ? `🤝 ${tx("Sharecropper", "বর্গাদার")}` : `🏠 ${tx("Owner", "নিজ মালিক")}`} />
src/pages/IrrigationInvoices.tsx:737: <Row k={tx("Land", "জমি")} v={`${inv.lands?.mouza ?? ""} • Dag ${formatDagNumbers(inv.lands?.dag_no) || "—"} • ${formatLandSize(inv.lands?.l
src/pages/IrrigationInvoices.tsx:738: <Row k={tx("Land type", "জমির ধরন")} v={inv.land_type_name ?? "—"} />
src/pages/IrrigationInvoices.tsx:739: <Row k={tx("Season", "সিজন")} v={`${inv.seasons?.name ?? inv.seasons?.type} ${inv.seasons?.year}`} />
src/pages/IrrigationInvoices.tsx:740: <Row k={tx("Season rate / shotok", "সিজন রেট/শতক")} v={inv.season_rate != null ? money(inv.season_rate) : "—"} />
src/pages/IrrigationInvoices.tsx:741: <Row k={tx("Due date", "মেয়াদ")} v={fmtDate(inv.due_date)} />
src/pages/IrrigationInvoices.tsx:743: <Row k={tx("Irrigation charge", "সেচ চার্জ")} v={money(inv.irrigation_amount)} />
src/pages/IrrigationInvoices.tsx:744: <Row k={tx("Maintenance charge", "রক্ষণাবেক্ষণ চার্জ")} v={money(inv.maintenance_amount)} />
src/pages/IrrigationInvoices.tsx:745: <Row k={tx("Canal charge", "খাল/নালা চার্জ")} v={money(inv.canal_amount)} />
src/pages/IrrigationInvoices.tsx:746: <Row k={tx("Other", "অন্যান্য")} v={money(inv.other_charge)} />
src/pages/IrrigationInvoices.tsx:747: <Row k={tx("Late fee", "বিলম্ব ফি")} v={money(inv.delay_fee)} />
src/pages/IrrigationInvoices.tsx:749: <Row k={tx("Total payable", "মোট প্রদেয়")} v={money(inv.payable_amount)} bold />
src/pages/IrrigationInvoices.tsx:750: <Row k={tx("Paid", "পরিশোধিত")} v={money(inv.paid_amount)} />
src/pages/IrrigationInvoices.tsx:751: <Row k={tx("Due", "বকেয়া")} v={money(inv.due_amount)} bold />
src/pages/IrrigationInvoices.tsx:753: <Row k={tx("Status", "স্ট্যাটাস")} v={statusLabel(tx, inv.invoice_status as InvoiceStatus)} />
src/pages/IrrigationInvoices.tsx:754: <Row k={tx("Created", "তৈরির তারিখ")} v={fmtDate(inv.generated_at)} />
src/pages/IrrigationInvoices.tsx:755: {inv.recalculated_at && <Row k={tx("Last recalculation", "শেষ পুনঃগণনা")} v={fmtDate(inv.recalculated_at)} />}
src/pages/IrrigationInvoices.tsx:756: {inv.manual_rate_reason && <Row k={tx("Manual rate reason", "ম্যানুয়াল রেটের কারণ")} v={inv.manual_rate_reason} />}
src/pages/IrrigationInvoices.tsx:759: <summary className="cursor-pointer text-xs text-muted-foreground">{tx("Calculation snapshot (immutable)", "গণনা স্ন্যাপশট (অপরিবর্তনীয়)")}<
src/pages/IrrigationInvoices.tsx:769: <RefreshCw className="h-4 w-4 mr-1" />{tx("Recalculate", "পুনঃগণনা")}
src/pages/IrrigationInvoices.tsx:772: <Button variant="outline" onClick={onClose}>{tx("Close", "বন্ধ করুন")}</Button>
src/pages/IrrigationInvoices.tsx:777: <DialogHeader><DialogTitle>{tx("Recalculate invoice", "ইনভয়েস পুনঃগণনা")}</DialogTitle></DialogHeader>
src/pages/IrrigationInvoices.tsx:780: <AlertTitle>{tx("Warning", "সতর্কতা")}</AlertTitle>
src/pages/IrrigationInvoices.tsx:782: {tx("This invoice will be recalculated using the current season rate. The previous snapshot is preserved in the audit log.", "বর্তমান সিজন র
src/pages/IrrigationInvoices.tsx:786: <Label>{tx("Reason *", "কারণ *")}</Label>
src/pages/IrrigationInvoices.tsx:788: placeholder={tx("e.g. rate was misconfigured", "যেমন: রেট ভুল কনফিগার করা হয়েছিল")} />
src/pages/IrrigationInvoices.tsx:791: <Button variant="outline" onClick={() => setRecalcOpen(false)}>{tx("Cancel", "বাতিল")}</Button>
src/pages/IrrigationInvoices.tsx:792: <Button onClick={recalc} disabled={busy}>{busy ? "…" : tx("Recalculate", "পুনঃগণনা করুন")}</Button>
src/pages/IrrigationInvoices.tsx:829: if (!seasonId) return toast.error(tx("Select a season", "সিজন বাছাই করুন"));
src/pages/IrrigationInvoices.tsx:872: toast.success(`${previewArr.length} ${tx("preview", "টি প্রিভিউ")}${noRate ? ` • ${noRate} ${tx("lands have no rate", "টি জমিতে রেট নেই")}` 
src/pages/IrrigationInvoices.tsx:921: toast.success(`${success} ${tx("created", "টি তৈরি হয়েছে")}${failed ? `, ${failed} ${tx("failed", "ব্যর্থ")}` : ""}`);
src/pages/IrrigationInvoices.tsx:932: <Label>{tx("Season *", "সিজন *")}</Label>
src/pages/IrrigationInvoices.tsx:942: <Label>{tx("Office (optional)", "অফিস (ঐচ্ছিক)")}</Label>
src/pages/IrrigationInvoices.tsx:946: <SelectItem value="all">{tx("All offices", "সব অফিস")}</SelectItem>
src/pages/IrrigationInvoices.tsx:953: <Label>{tx("Fallback rate / shotok", "ফলব্যাক রেট/শতক")} <span className="text-xs text-muted-foreground">{tx("(if type rate missing)", "(ধরন
src/pages/IrrigationInvoices.tsx:957: <Label>{tx("Due *", "মেয়াদ *")}</Label>
src/pages/IrrigationInvoices.tsx:964: ? `${tx("Configured rates:", "কনফিগার্ড রেট:")} ${Object.entries(rateMap).map(([k, v]) => `${k}=${v}`).join(", ")}`
src/pages/IrrigationInvoices.tsx:965: : tx("No per-land-type rate for this season — set them on the Seasons page or provide a fallback rate.", "এই সিজনে কোনো জমির ধরনভিত্তিক রেট 
src/pages/IrrigationInvoices.tsx:969: <div className="text-xs text-destructive">{skippedNoRate} {tx("lands had no rate — skipped.", "টি জমিতে রেট পাওয়া যায়নি — বাদ দেওয়া হয়েছ
src/pages/IrrigationInvoices.tsx:973: <Label htmlFor="skip">{tx("Skip already-created invoices (prevent duplicates)", "আগে তৈরি হওয়া ইনভয়েস বাদ দিন (ডুপ্লিকেট প্রতিরোধ)")}</Lab
src/pages/IrrigationInvoices.tsx:977: <Sparkles className="h-4 w-4 mr-1" /> {tx("Preview", "প্রিভিউ")}
src/pages/IrrigationInvoices.tsx:981: {busy ? tx("Processing…", "প্রক্রিয়াকরণ…") : `${tx("Create", "তৈরি করুন")} ${previewRows.length} ${tx("invoices", "টি ইনভয়েস")}`}
src/pages/IrrigationInvoices.tsx:984: <Button variant="outline" onClick={() => setManualOpen(true)}><Plus className="h-4 w-4 mr-1" /> {tx("Manual", "ম্যানুয়াল")}</Button>
src/pages/IrrigationInvoices.tsx:992: <h3 className="font-semibold mb-3">{tx("Preview", "প্রিভিউ")} — {previewRows.length} {tx("invoices", "টি ইনভয়েস")}</h3>
src/pages/IrrigationInvoices.tsx:997: <TableHead>{tx("Land", "জমি")}</TableHead>
src/pages/IrrigationInvoices.tsx:998: <TableHead>{tx("Billed to", "বিল প্রাপক")}</TableHead>
src/pages/IrrigationInvoices.tsx:999: <TableHead className="text-right">{tx("Irrigation", "সেচ")}</TableHead>
src/pages/IrrigationInvoices.tsx:1000: <TableHead className="text-right">{tx("Maint.", "রক্ষণা.")}</TableHead>
src/pages/IrrigationInvoices.tsx:1001: <TableHead className="text-right">{tx("Canal", "খাল")}</TableHead>
src/pages/IrrigationInvoices.tsx:1002: <TableHead className="text-right">{tx("Payable", "প্রদেয়")}</TableHead>
src/pages/IrrigationInvoices.tsx:1009: <TableCell className="text-xs">{r.billed.is_borga ? `🤝 ${tx("Sharecropper", "বর্গাদার")}` : `🏠 ${tx("Owner", "মালিক")}`}</TableCell>
src/pages/IrrigationInvoices.tsx:1018: {previewRows.length > 100 && <p className="text-xs text-muted-foreground mt-2">{tx("Showing first 100 only", "শুধু প্রথম ১০০ টি দেখানো হয়েছ
src/pages/IrrigationInvoices.tsx:1075: if (!farmerId || !landId || !seasonId || !rate) return toast.error(tx("Fill all fields", "সব ফিল্ড পূরণ করুন"));
src/pages/IrrigationInvoices.tsx:1076: if (isManualRate && manualReason.trim().length < 3) return toast.error(tx("Enter manual rate reason (at least 3 chars)", "ম্যানুয়াল রেটের ক
src/pages/IrrigationInvoices.tsx:1127: toast.success(`${tx("Invoice", "ইনভয়েস")} ${invoice_no} ${tx("created", "তৈরি হয়েছে")}`);
src/pages/IrrigationInvoices.tsx:1138: <DialogHeader><DialogTitle>{tx("Create manual invoice", "ম্যানুয়াল ইনভয়েস তৈরি")}</DialogTitle></DialogHeader>
src/pages/IrrigationInvoices.tsx:1141: <Label>{tx("Farmer", "কৃষক")}</Label>
src/pages/IrrigationInvoices.tsx:1142: <FarmerSearchSelect value={farmerId} onChange={(id) => { setFarmerId(id); setLandId(""); }} placeholder={tx("Search farmer", "কৃষক খুঁজুন")}
src/pages/IrrigationInvoices.tsx:1145: <Label>{tx("Land", "জমি")}</Label>
src/pages/IrrigationInvoices.tsx:1159: <Label>{tx("Season", "সিজন")}</Label>
src/pages/IrrigationInvoices.tsx:1168: <Label>{tx("Due date", "মেয়াদ")}</Label>
src/pages/IrrigationInvoices.tsx:1172: <Label>{tx("Rate / shotok", "রেট/শতক")}</Label>
src/pages/IrrigationInvoices.tsx:1176: <Label>{tx("Other charge", "অন্যান্য চার্জ")}</Label>
src/pages/IrrigationInvoices.tsx:1184: <AlertTitle>{tx("Season rate not configured", "সিজন রেট কনফিগার নেই")}</AlertTitle>
src/pages/IrrigationInvoices.tsx:1186: <p>{tx("No irrigation rate is configured for this season and land type. Enter a manual rate and reason below, or configure the season rate f
src/pages/IrrigationInvoices.tsx:1188: <Link to="/seasons" target="_blank">{tx("Go to season rates", "সিজন রেটে যান")}</Link>
src/pages/IrrigationInvoices.tsx:1191: <Label>{tx("Manual rate reason *", "ম্যানুয়াল রেটের কারণ *")}</Label>
src/pages/IrrigationInvoices.tsx:1193: placeholder={tx("e.g. one-off pilot invoice", "যেমন: এক-বার পরীক্ষামূলক ইনভয়েস")} />
src/pages/IrrigationInvoices.tsx:1199: {tx("Auto rate applied:", "স্বয়ংক্রিয় রেট প্রয়োগ:")} {rateRow?.land_type_name} → {money(rateRow?.rate_per_shotok ?? 0)}/{tx("shotok", "শত
src/pages/IrrigationInvoices.tsx:1205: <Button variant="outline" onClick={() => onOpenChange(false)}>{tx("Cancel", "বাতিল")}</Button>
src/pages/IrrigationInvoices.tsx:1206: <Button onClick={save} disabled={busy}>{busy ? "…" : tx("Create", "তৈরি করুন")}</Button>
src/pages/IrrigationInvoices.tsx:1234: if (!officeId) return toast.error(tx("Select an office", "একটি অফিস নির্বাচন করুন"));
src/pages/IrrigationInvoices.tsx:1247: toast.success(tx("Settings saved", "সেটিংস সংরক্ষিত হয়েছে"));
src/pages/IrrigationInvoices.tsx:1254: <Label>{tx("Office", "অফিস")}</Label>
src/pages/IrrigationInvoices.tsx:1256: <SelectTrigger><SelectValue placeholder={tx("Select an office", "অফিস নির্বাচন করুন")} /></SelectTrigger>
src/pages/IrrigationInvoices.tsx:1266: <Label>{tx("Maintenance % (on irrigation charge)", "রক্ষণাবেক্ষণ % (সেচ চার্জের উপর)")}</Label>
src/pages/IrrigationInvoices.tsx:1271: <Label>{tx("Canal charge %", "খাল/নালা চার্জ %")}</Label>
src/pages/IrrigationInvoices.tsx:1276: <Label>{tx("Late fee %", "বিলম্ব ফি %")}</Label>
src/pages/IrrigationInvoices.tsx:1281: <Label>{tx("Grace period (days)", "গ্রেস পিরিয়ড (দিন)")}</Label>
src/pages/IrrigationInvoices.tsx:1289: <Label htmlFor="auto">{tx("Apply late fee automatically", "স্বয়ংক্রিয়ভাবে বিলম্ব ফি প্রযোজ্য করুন")}</Label>
src/pages/IrrigationInvoices.tsx:1291: <Button onClick={save}>{tx("Save", "সংরক্ষণ করুন")}</Button>
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
src/pages/Payments.tsx:183: toast.success(`${matched.length} ${tx("invoices preloaded", "টি ইনভয়েস প্রিলোড হয়েছে")}`);
src/pages/Payments.tsx:234: return toast.error(`${v.reason} (নির্ধারিত: ৳${v.required.toFixed(2)}, প্রদত্ত: ৳${Number(a.amount).toFixed(2)})`);
src/pages/Payments.tsx:237: if (!window.confirm(`⚠ নির্ধারিত: ৳${v.required.toFixed(2)} | প্রদত্ত: ৳${Number(a.amount).toFixed(2)}\nতবুও সংরক্ষণ করবেন?`)) return;
src/pages/Payments.tsx:240: const reason = window.prompt("আংশিক পেমেন্ট override কারণ লিখুন (অডিটে সংরক্ষিত হবে):", "")?.trim();
src/pages/Payments.tsx:241: if (!reason) return toast.error("Override কারণ আবশ্যক");
src/pages/Payments.tsx:316: const message = tx(`BDT ${irrTotal.toLocaleString()} received against your irrigation invoice.${receiptNo ? `\nReceipt no: ${receiptNo}` : "
src/pages/Payments.tsx:466: <Button variant="outline" size="sm" disabled={!farmerId}><ArrowDownToLine className="h-4 w-4 mr-1" />{tx("Withdraw savings", "সঞ্চয় উত্তোলন
src/pages/Payments.tsx:469: <DialogHeader><DialogTitle>{tx("Savings withdrawal request", "সঞ্চয় উত্তোলনের অনুরোধ")}</DialogTitle></DialogHeader>
src/pages/Payments.tsx:472: <span>{tx("Available balance", "উপলব্ধ ব্যালেন্স")}</span>
src/pages/Payments.tsx:473: <span className="font-mono font-semibold">৳{savingsBalance.toLocaleString()}</span>
src/pages/Payments.tsx:475: <div><Label>{tx("Amount", "পরিমাণ")}</Label>
src/pages/Payments.tsx:483: <Button onClick={submitWithdraw}>{tx("Submit", "জমা দিন")}</Button>
src/pages/Payments.tsx:491: <TabsTrigger value="quick">{tx("Quick / Multi-allocation", "দ্রুত / মিশ্র")}</TabsTrigger>
src/pages/Payments.tsx:492: <TabsTrigger value="irrigation">{tx("Structured Irrigation Payment", "কাঠামোবদ্ধ সেচ পেমেন্ট")}</TabsTrigger>
src/pages/Payments.tsx:646: ?? (kind === "loan" ? tx("Loan installment received", "ঋণের কিস্তি গ্রহণ")
src/pages/Payments.tsx:647: : kind === "savings" ? tx("Savings deposit received", "সঞ্চয় জমা গ্রহণ")
src/pages/Payments.tsx:648: : tx("Irrigation charge received", "সেচ চার্জ গ্রহণ"));
src/pages/Payments.tsx:652: f?.is_voter ? "ভোটার নং" : f?.account_number ? "সঞ্চয়ী নং" : null;
src/pages/Payments.tsx:681: const fieldTypeBn = ({ high_land: tx("High land","উঁচু জমি"), medium_land: tx("Medium land","মাঝারি জমি"), low_land: tx("Low land","নিচু জমি
src/pages/Payments.tsx:688: owner_type_bn: primaryCharge?.is_borga ? "বর্গাদার" : "মালিক",
src/pages/Payments.tsx:691: ? "নিজ"
src/pages/Payments.tsx:713: bill_info: kind === "irrigation" ? "সেচ চার্জ" : undefined,
src/pages/ReceiptTemplate.tsx:44: company_name_bn: "স্মার্ট সেচ ও সমবায়",
src/pages/Savings.tsx:193: if (!vchk?.is_voter) return toast.error(`${vchk?.name_en ?? "এই ফার্মার"} এর Voter / Savings A/C এনাবল নেই — সঞ্চয়/শেয়ার এন্ট্রি করা যাবে 
src/pages/Savings.tsx:217: return toast.error(`Insufficient balance. Available: ৳${available.toLocaleString()}`);
src/pages/Savings.tsx:272: title: status === "approved" ? "উত্তোলন অনুমোদিত" : "উত্তোলন প্রত্যাখ্যাত",
src/pages/Savings.tsx:273: body: `${txn?.farmers?.name_en ?? ""} — ৳${Number(txn?.amount ?? 0).toLocaleString()}${reject_reason ? ` (${reject_reason})` : ""}`,
src/pages/Savings.tsx:349: <SelectItem value="deposit">Savings Deposit (min ৳10)</SelectItem>
src/pages/Savings.tsx:350: <SelectItem value="share_deposit">Share Deposit (min ৳50)</SelectItem>
src/pages/Savings.tsx:401: <SelectContent>{plans.map(p => <SelectItem key={p.id} value={p.id}>{p.name} — {p.duration_months}mo / {p.installment_type} ৳{p.installment_a
src/pages/ScanPayment.tsx:74: ?? (kind === "loan" ? "ঋণের কিস্তি গ্রহণ"
src/pages/ScanPayment.tsx:75: : kind === "savings" ? "সঞ্চয় জমা গ্রহণ"
src/pages/ScanPayment.tsx:76: : "সেচ চার্জ গ্রহণ");
src/pages/ScanPayment.tsx:85: bill_info: kind === "irrigation" ? "সেচ চার্জ" : undefined,
src/pages/ScanPayment.tsx:305: <div><span className="text-muted-foreground">Amount:</span> <span className="font-mono font-semibold">৳ {fmt(done.amount)}</span></div>
src/pages/Seasons.tsx:67: if (!form.season_type_id) return toast.error(tx("Choose a season type", "সিজন টাইপ বাছাই করুন"));
src/pages/Seasons.tsx:69: if (!stype) return toast.error(tx("Invalid type", "অবৈধ টাইপ"));
src/pages/Seasons.tsx:111: <Label>{tx("Season type", "সিজন টাইপ")}</Label>
src/pages/Seasons.tsx:126: <Label>{tx("Name", "নাম")}</Label>
src/pages/Seasons.tsx:127: <Input value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} placeholder={tx("e.g. Boro 2026", "উদাহরণ: বোরো ২০২৬")
src/pages/Seasons.tsx:130: <Label>{tx("Fiscal year", "অর্থবছর")}</Label>
src/pages/Seasons.tsx:134: <Label>{tx("Status", "স্ট্যাটাস")}</Label>
src/pages/Seasons.tsx:138: <SelectItem value="active">{tx("Active", "সক্রিয়")}</SelectItem>
src/pages/Seasons.tsx:139: <SelectItem value="closed">{tx("Closed", "বন্ধ")}</SelectItem>
src/pages/Seasons.tsx:140: <SelectItem value="draft">{tx("Draft", "খসড়া")}</SelectItem>
src/pages/Seasons.tsx:145: <Label>{tx("Start date", "শুরুর তারিখ")}</Label>
src/pages/Seasons.tsx:149: <Label>{tx("End date", "শেষের তারিখ")}</Label>
src/pages/Seasons.tsx:153: <Label>{tx("Invoice due date", "ইনভয়েস মেয়াদ (Due Date)")}</Label>
src/pages/Seasons.tsx:170: <TableHead>{tx("Season", "সিজন")}</TableHead>
src/pages/Seasons.tsx:171: <TableHead>{tx("Fiscal year", "অর্থবছর")}</TableHead>
src/pages/Seasons.tsx:172: <TableHead>{tx("Due", "মেয়াদ")}</TableHead>
src/pages/Seasons.tsx:173: <TableHead>{tx("Status", "স্ট্যাটাস")}</TableHead>
src/pages/Seasons.tsx:174: <TableHead className="text-right">{tx("Actions", "কাজ")}</TableHead>
src/pages/Seasons.tsx:190: <DollarSign className="h-3.5 w-3.5 mr-1" /> {tx("Rate config", "রেট কনফিগ")}
src/pages/Seasons.tsx:246: toast.success(tx("Rates saved — only new invoices will be affected.", "রেট সংরক্ষিত হয়েছে — শুধুমাত্র নতুন ইনভয়েসে প্রভাব পড়বে।"));
src/pages/Seasons.tsx:262: <DialogTitle>{seasonLabel} — {tx("Rate per shotok", "শতক প্রতি রেট")}</DialogTitle>
src/pages/Seasons.tsx:265: {tx("Rate per land type. Existing invoices will not be affected (snapshot).", "প্রতি জমির ধরন অনুযায়ী রেট। পুরোনো ইনভয়েসে রেট পরিবর্তনের ক
src/pages/Seasons.tsx:281: <p className="text-sm text-muted-foreground">{tx("No land types — add from Irrigation Settings → Land Types.", "কোনো জমির ধরন নেই — সেচ সেটি
src/pages/Seasons.tsx:285: <div className="text-xs text-muted-foreground">{tx("Total configured rate", "মোট কনফিগারড রেট")}: {total.toFixed(2)}</div>
src/pages/Seasons.tsx:288: <Button variant="outline" onClick={() => onOpenChange(false)}>{tx("Cancel", "বাতিল")}</Button>
src/pages/Seasons.tsx:289: <Button onClick={save} disabled={busy || landTypes.length === 0}>{busy ? "…" : tx("Save", "সংরক্ষণ")}</Button>
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
src/pages/Settings.tsx:223: name: lang === "bn" ? "করিম মিয়া" : "Karim Mia",
src/pages/Settings.tsx:225: village: lang === "bn" ? "বালিয়াডাঙ্গা" : "Baliadanga",
src/pages/Settings.tsx:227: mouza: lang === "bn" ? "বালিয়াডাঙ্গা" : "Baliadanga",
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
src/pages/SmsSettings.tsx:224: secretsHint: "API টোকেন ব্যাকএন্ড সিক্রেটে নিরাপদে রাখা আছে এবং ফ্রন্টএন্ডে দেখানো হয় না। স্মরণিকা প্রতিদিন চলে এবং প্রতিটি বকেয়ার জন্য এক
src/pages/SmsSettings.tsx:225: triggers: "ট্রিগার ইভেন্ট",
src/pages/SmsSettings.tsx:226: trg_savings_deposit: "সঞ্চয় জমা",
src/pages/SmsSettings.tsx:227: trg_savings_withdraw: "সঞ্চয় উত্তোলন",
src/pages/SmsSettings.tsx:228: trg_loan_approved: "ঋণ অনুমোদিত",
src/pages/SmsSettings.tsx:229: trg_loan_payment: "ঋণ পরিশোধ গৃহীত",
src/pages/SmsSettings.tsx:230: trg_irrigation_payment: "সেচ পেমেন্ট",
src/pages/SmsSettings.tsx:231: trg_due_reminder: "বকেয়া স্মরণিকা",
src/pages/SmsSettings.tsx:232: perOffice: "অফিস-ভিত্তিক ওভাররাইড",
src/pages/SmsSettings.tsx:233: perOfficeHint: "নির্দিষ্ট অফিসের জন্য এসএমএস বন্ধ করুন বা ভিন্ন সেন্ডার আইডি ব্যবহার করুন। সেন্ডার আইডি খালি রাখলে গ্লোবাল সেটিং প্রযোজ্য হব
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
src/pages/SmsSettings.tsx:263: schedulerHint: "নির্দিষ্ট তারিখ পরিসরে ঋণ/সেচ বকেয়ার জন্য স্মরণিকা পাঠান। একই আইটেমের জন্য পুনরাবৃত্ত স্মরণিকা স্বয়ংক্রিয়ভাবে এড়ানো হয়।
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
src/pages/SmsSettings.tsx:277: overrideHint: "বন্ধ: কোনো সক্রিয় টেমপ্লেটে প্রয়োজনীয় ট্যাগ অনুপস্থিত থাকলে সংরক্ষণ ব্লক হবে। চালু: সতর্কতা থাকবে কিন্তু সংরক্ষণ করা যাবে।
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
src/pages/SmsSettings.tsx:349: const [testMsg, setTestMsg] = useState(lang === "bn" ? "পরীক্ষামূলক বার্তা — Smart Irrigation" : "Test message — Smart Irrigation");
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
src/pages/VerifyReceipt.tsx:138: <Button size="sm" variant={lang === "bn" ? "default" : "outline"} className="h-7 px-2" onClick={() => setLang("bn")}>বাংলা</Button>
src/pages/VerifyReceipt.tsx:192: <Row k={T.amount} v={`৳ ${fmt(data.receipt.amount)}`} mono />
src/pages/VoterList.tsx:136: description: `${t("pgSavingsBalanceLbl" as any)}: ৳${fmt(d.savings_balance)} • ${t("pgLoanDueLbl" as any)}: ৳${fmt(d.loan_due)} • ${t("pgIrr
src/pages/VoterList.tsx:373: <div className={"font-mono font-semibold " + (bad ? "text-destructive" : "")}>৳{fmt(value)}</div>
src/pages/admin/AuditTimeline.tsx:66: document.title = tx("Audit Timeline", "অডিট টাইমলাইন");
src/pages/admin/AuditTimeline.tsx:99: title={tx("Audit Timeline", "অডিট টাইমলাইন")}
src/pages/admin/AuditTimeline.tsx:106: <RefreshCw className="h-4 w-4 mr-1" />{tx("Refresh", "রিফ্রেশ")}
src/pages/admin/AuditTimeline.tsx:114: <Label>{tx("Module", "মডিউল")}</Label>
src/pages/admin/AuditTimeline.tsx:123: <Label>{tx("Search", "অনুসন্ধান")}</Label>
src/pages/admin/AuditTimeline.tsx:124: <Input value={search} onChange={e => setSearch(e.target.value)} placeholder={tx("action / id / data", "অ্যাকশন / আইডি / ডেটা")} />
src/pages/admin/AuditTimeline.tsx:127: <Label>{tx("From", "হতে")}</Label>
src/pages/admin/AuditTimeline.tsx:131: <Label>{tx("To", "পর্যন্ত")}</Label>
src/pages/admin/AuditTimeline.tsx:136: {tx("Showing", "দেখাচ্ছে")}: <b>{filtered.length}</b> {tx("of", "/")} {rows.length}
src/pages/admin/AuditTimeline.tsx:137: {!isSuper && <span> • {tx("Office-scoped view", "অফিস-স্কোপড দৃশ্য")}</span>}
src/pages/admin/AuditTimeline.tsx:144: <TableHead>{tx("Time", "সময়")}</TableHead>
src/pages/admin/AuditTimeline.tsx:145: <TableHead>{tx("Module", "মডিউল")}</TableHead>
src/pages/admin/AuditTimeline.tsx:146: <TableHead>{tx("Action", "অ্যাকশন")}</TableHead>
src/pages/admin/AuditTimeline.tsx:147: <TableHead>{tx("Reference", "রেফারেন্স")}</TableHead>
src/pages/admin/AuditTimeline.tsx:148: <TableHead>{tx("Details", "বিস্তারিত")}</TableHead>
src/pages/admin/AuditTimeline.tsx:154: <TableRow><TableCell colSpan={5} className="text-center text-muted-foreground py-6">{tx("No audit records", "কোনো অডিট রেকর্ড নেই")}</TableC
src/pages/admin/AuditTimeline.tsx:164: {expandedId === r.id ? tx("Hide", "লুকান") : tx("Show", "দেখুন")}
src/pages/admin/AuditTimeline.tsx:172: <div className="font-semibold mb-1">{tx("Old", "পুরাতন")}</div>
src/pages/admin/AuditTimeline.tsx:176: <div className="font-semibold mb-1">{tx("New", "নতুন")}</div>
src/pages/admin/DemoManager.tsx:241: <CardDescription>{tx("Quick presets — auto-fill size + modules. Choose Custom to configure manually.", "দ্রুত preset — size + module অটো-সেট
src/pages/admin/DemoManager.tsx:264: <span>{tx("Transactional — auto-rollback partial data on error", "ট্রানজ্যাকশনাল — error হলে আংশিক ডেটা auto-মুছে যাবে")}</span>
src/pages/admin/DemoManager.tsx:318: <CardDescription>{tx("Set how many of every N farmers become voters and the voter/account number format. Tokens:", "প্রতি কতজনে ১জন voter হব
src/pages/admin/DemoManager.tsx:343: {tx("If a CSV is uploaded, these names are used instead of demo names. Columns: name_en, name_bn, father_name, mother_name, mobile, nid (onl
src/pages/admin/DemoManager.tsx:371: if (!rows.length) { toast.error(tx("name_en column not found", "name_en কলাম পাওয়া যায়নি")); return; }
src/pages/admin/DemoManager.tsx:374: toast.success(`${rows.length} ${tx("farmer names loaded", "জন farmer নাম লোড হয়েছে")}`);
src/pages/admin/DemoManager.tsx:376: toast.error(tx("Could not read file: ", "ফাইল পড়া যায়নি: ") + (err?.message ?? "unknown"));
src/pages/admin/DemoManager.tsx:381: <Badge>{customNames.length} {tx("names loaded:", "নাম লোড:")} {csvFileName}</Badge>
src/pages/admin/DemoManager.tsx:382: <Button size="sm" variant="ghost" onClick={() => { setCustomNames(null); setCsvFileName(""); }}>{tx("Remove", "সরান")}</Button>
src/pages/admin/DemoManager.tsx:526: <CardDescription>{verification.ok ? "সব ফার্মার ঠিকঠাক — non-voter দের কোনো সেভিং/লোন/শেয়ার নেই।" : `${verification.issues.length} টি সমস্য
src/pages/admin/DemoManager.tsx:545: <CardDescription>{locationVerification.ok ? "সব Division/District/Upazila/Mouza ঠিকঠাক sit হয়েছে।" : `${locationVerification.missing.length
src/pages/admin/DemoManager.tsx:577: <CardDescription>{tx("View the first few farmers' names (EN/BN) and mouza_id.", "প্রথম কয়েকজন farmer-এর নাম (EN/BN) এবং mouza_id দেখুন।")}<
src/pages/admin/DemoManager.tsx:613: {tx("Module Row-Count + Page Mapping", "মডিউল Row-Count + পেজ Mapping")} ({rowCountReport.ok}/{rowCountReport.total})
src/pages/admin/DemoManager.tsx:617: ? tx("Every required table is populated — no module is empty.", "সব required টেবিলে ডেটা আছে — কোনো মডিউল খালি নেই।")
src/pages/admin/DemoManager.tsx:618: : `${rowCountReport.failed} ${tx("required tables empty", "required টেবিল খালি")}, ${rowCountReport.warnings} ${tx("optional warnings", "opt
src/pages/admin/DemoManager.tsx:658: <CardDescription>{tx("Each farmer's voter status and which modules were seeded", "প্রতিটি ফার্মারের voter status এবং কোন মডিউলে seed হয়েছে"
src/pages/admin/DemoManager.tsx:704: if (!confirm(tx("Delete all audit logs? This cannot be undone.", "সব audit log মুছে ফেলবেন? এটা ফেরানো যাবে না।"))) return;
src/pages/admin/IrrigationDueMismatch.tsx:86: useEffect(() => { document.title = tx("Irrigation Due Mismatch", "সেচ বকেয়া অমিল"); load(); }, []);
src/pages/admin/IrrigationDueMismatch.tsx:89: if (!rows.length) return toast.error(tx("Nothing to export", "এক্সপোর্ট করার মতো কিছু নেই"));
src/pages/admin/IrrigationDueMismatch.tsx:101: if (!rows.length) return toast.error(tx("Nothing to export", "এক্সপোর্ট করার মতো কিছু নেই"));
src/pages/admin/IrrigationDueMismatch.tsx:116: const tid = toast.loading(tx("Recalculating…", "রিক্যালকুলেট হচ্ছে…"));
src/pages/admin/IrrigationDueMismatch.tsx:168: toast.success(tx(`Recalculated ${updated} invoices`, `${updated}টি ইনভয়েস রিক্যালকুলেট হয়েছে`), { id: tid });
src/pages/admin/IrrigationDueMismatch.tsx:171: toast.error(e?.message || tx("Recalculate failed", "রিক্যালকুলেট ব্যর্থ"), { id: tid });
src/pages/admin/IrrigationDueMismatch.tsx:180: title={tx("Irrigation Due Mismatch", "সেচ বকেয়া অমিল")}
src/pages/admin/IrrigationDueMismatch.tsx:190: <RefreshCw className="h-4 w-4 mr-1" />{tx("Refresh", "রিফ্রেশ")}
src/pages/admin/IrrigationDueMismatch.tsx:199: "ইনভয়েসের paid_amount ও বিভাজন-পেমেন্ট মোটের তুলনা। অমিল থাকলে রিক্যালকুলেট করুন।",
src/pages/admin/IrrigationDueMismatch.tsx:206: <TableHead>{tx("Farmer", "কৃষক")}</TableHead>
src/pages/admin/IrrigationDueMismatch.tsx:207: <TableHead>{tx("Code", "কোড")}</TableHead>
src/pages/admin/IrrigationDueMismatch.tsx:208: <TableHead className="text-right">{tx("Invoiced Due", "ইনভয়েস বকেয়া")}</TableHead>
src/pages/admin/IrrigationDueMismatch.tsx:209: <TableHead className="text-right">{tx("Invoice Paid", "ইনভয়েস পরিশোধিত")}</TableHead>
src/pages/admin/IrrigationDueMismatch.tsx:210: <TableHead className="text-right">{tx("Legacy Coll.", "পুরাতন গ্রহণ")}</TableHead>
src/pages/admin/IrrigationDueMismatch.tsx:211: <TableHead className="text-right">{tx("Split (Cur+Prev)", "বিভাজিত")}</TableHead>
src/pages/admin/IrrigationDueMismatch.tsx:212: <TableHead className="text-right">{tx("Δ", "পার্থক্য")}</TableHead>
src/pages/admin/IrrigationDueMismatch.tsx:213: <TableHead className="text-right">{tx("Actions", "অ্যাকশন")}</TableHead>
src/pages/admin/IrrigationDueMismatch.tsx:219: <TableRow><TableCell colSpan={8} className="text-center text-muted-foreground py-6">{tx("No mismatches found ✓", "কোনো অমিল নেই ✓")}</TableC
src/pages/admin/IrrigationDueMismatch.tsx:233: <Button variant="outline" size="sm"><ExternalLink className="h-3.5 w-3.5 mr-1" />{tx("View", "দেখুন")}</Button>
src/pages/admin/IrrigationDueMismatch.tsx:243: {tx("Recalc", "রিক্যাল")}
src/pages/admin/Lookups.tsx:64: if (!form.code.trim() || !form.name.trim()) return toast.error(tx("Enter code and name", "কোড ও নাম দিন"));
src/pages/admin/Lookups.tsx:79: toast.success(tx("Saved", "সংরক্ষিত"));
src/pages/admin/Lookups.tsx:93: toast.success(tx("Deleted", "মুছে ফেলা হয়েছে"));
src/pages/admin/Lookups.tsx:102: <Button size="sm" onClick={openNew}><Plus className="h-4 w-4 mr-1" /> {tx("New", "নতুন")}</Button>
src/pages/admin/Lookups.tsx:107: <TableHead>{tx("Code", "কোড")}</TableHead>
src/pages/admin/Lookups.tsx:108: <TableHead>{tx("Name (EN)", "নাম (EN)")}</TableHead>
src/pages/admin/Lookups.tsx:109: <TableHead>{tx("Bangla", "বাংলা")}</TableHead>
src/pages/admin/Lookups.tsx:110: <TableHead className="text-right">{tx("Order", "ক্রম")}</TableHead>
src/pages/admin/Lookups.tsx:111: <TableHead>{tx("Status", "স্ট্যাটাস")}</TableHead>
src/pages/admin/Lookups.tsx:112: <TableHead className="text-right">{tx("Actions", "কাজ")}</TableHead>
src/pages/admin/Lookups.tsx:123: <Badge variant={r.is_active ? "default" : "secondary"}>{r.is_active ? tx("Active", "সক্রিয়") : tx("Inactive", "নিষ্ক্রিয়")}</Badge>
src/pages/admin/Lookups.tsx:135: <TableCell colSpan={6} className="text-center text-muted-foreground">{tx("No data", "কোনো ডেটা নেই")}</TableCell>
src/pages/admin/Lookups.tsx:144: <DialogTitle>{form.id ? tx("Edit", "সম্পাদনা") : tx("New", "নতুন")} — {title}</DialogTitle>
src/pages/admin/Lookups.tsx:148: <Label>{tx("Code (slug, unique)", "কোড (slug, ইউনিক)")}</Label>
src/pages/admin/Lookups.tsx:153: <Label>{tx("Name (English)", "নাম (English)")}</Label>
src/pages/admin/Lookups.tsx:157: <Label>{tx("Bangla name", "বাংলা নাম")}</Label>
src/pages/admin/Lookups.tsx:163: <Label>{tx("Order", "ক্রম")}</Label>
src/pages/admin/Lookups.tsx:168: <Label htmlFor={`active-${table}`}>{tx("Active", "সক্রিয়")}</Label>
src/pages/admin/Lookups.tsx:173: <Button variant="outline" onClick={() => setOpen(false)}>{tx("Cancel", "বাতিল")}</Button>
src/pages/admin/Lookups.tsx:174: <Button onClick={save} disabled={busy}>{busy ? "…" : tx("Save", "সংরক্ষণ")}</Button>
src/pages/admin/Lookups.tsx:185: useEffect(() => { document.title = tx("Irrigation Settings — Admin", "সেচ সেটিংস — Admin"); }, [tx]);
src/pages/admin/Lookups.tsx:188: <PageHeader title={tx("Irrigation Settings", "সেচ সেটিংস")} description={tx("Manage season types and land types", "সিজন টাইপ ও জমির ধরন ব্যব
src/pages/admin/Lookups.tsx:191: <TabsTrigger value="season">{tx("Season type", "সিজন টাইপ")}</TabsTrigger>
src/pages/admin/Lookups.tsx:192: <TabsTrigger value="land">{tx("Land type", "জমির ধরন")}</TabsTrigger>
src/pages/admin/Lookups.tsx:194: <TabsContent value="season"><LookupTable table="irrigation_season_types" title={tx("Season types", "সিজনের ধরন")} /></TabsContent>
src/pages/admin/Lookups.tsx:195: <TabsContent value="land"><LookupTable table="land_types" title={tx("Land types", "জমির ধরন")} /></TabsContent>
src/pages/admin/PatwariDetail.tsx:32: document.title = `${tx("Patwari", "পাটুয়ারী")} — ${p?.name_bn || p?.name || ""}`;
src/pages/admin/PatwariDetail.tsx:63: if (loading) return <div className="p-6 text-muted-foreground">{tx("Loading…", "লোড হচ্ছে…")}</div>;
src/pages/admin/PatwariDetail.tsx:64: if (!patwari) return <div className="p-6 text-muted-foreground">{tx("Patwari not found.", "পাটুয়ারী পাওয়া যায়নি।")}</div>;
src/pages/admin/PatwariDetail.tsx:69: title={`${tx("Patwari", "পাটুয়ারী")}: ${patwari.name_bn || patwari.name}`}
src/pages/admin/PatwariDetail.tsx:72: <Button variant="outline" size="sm"><ArrowLeft className="h-4 w-4 mr-1" />{tx("Back to list", "তালিকায় ফিরুন")}</Button>
src/pages/admin/PatwariDetail.tsx:79: <div><div className="text-muted-foreground text-xs">{tx("Name", "নাম")}</div><div className="font-medium">{patwari.name_bn || patwari.name}<
src/pages/admin/PatwariDetail.tsx:80: <div><div className="text-muted-foreground text-xs">{tx("Mobile", "মোবাইল")}</div><div className="font-medium">{patwari.mobile ?? "—"}</div>
src/pages/admin/PatwariDetail.tsx:81: <div><div className="text-muted-foreground text-xs">{tx("Assigned mouza", "দায়িত্বরত মৌজা")}</div><div className="font-medium">{patwari.mou
src/pages/admin/PatwariDetail.tsx:82: <div><div className="text-muted-foreground text-xs">{tx("Office", "অফিস")}</div><div className="font-medium">{patwari.offices?.name ?? "—"}<
src/pages/admin/PatwariDetail.tsx:84: <div><div className="text-muted-foreground text-xs">{tx("Address", "ঠিকানা")}</div><div className="font-medium">{patwari.address ?? "—"}</di
src/pages/admin/PatwariDetail.tsx:85: <div><div className="text-muted-foreground text-xs">{tx("Status", "স্ট্যাটাস")}</div>
src/pages/admin/PatwariDetail.tsx:86: {patwari.is_active ? <Badge>{tx("Active", "সক্রিয়")}</Badge> : <Badge variant="secondary">{tx("Inactive", "নিষ্ক্রিয়")}</Badge>}
src/pages/admin/PatwariDetail.tsx:89: {patwari.note && <p className="text-xs text-muted-foreground mt-3">{tx("Note", "নোট")}: {patwari.note}</p>}
src/pages/admin/PatwariDetail.tsx:94: <TabsTrigger value="farmers">{tx("Farmers", "কৃষক")} ({farmers.length})</TabsTrigger>
src/pages/admin/PatwariDetail.tsx:95: <TabsTrigger value="lands">{tx("Lands", "জমি")} ({lands.length})</TabsTrigger>
src/pages/admin/PatwariDetail.tsx:96: <TabsTrigger value="overrides">{tx("Special entries", "বিশেষ এন্ট্রি")} ({overrides.length})</TabsTrigger>
src/pages/admin/PatwariDetail.tsx:103: <TableHead>{tx("Code", "কোড")}</TableHead><TableHead>{tx("Name", "নাম")}</TableHead><TableHead>{tx("Mobile", "মোবাইল")}</TableHead>
src/pages/admin/PatwariDetail.tsx:113: {farmers.length === 0 && <TableRow><TableCell colSpan={3} className="text-center text-muted-foreground py-6">{tx("No farmers in this mouza",
src/pages/admin/PatwariDetail.tsx:123: <TableHead>{tx("Dag no.", "দাগ নং")}</TableHead><TableHead>{tx("Size (shotok)", "আকার (শতক)")}</TableHead><TableHead>{tx("Farmer", "কৃষক")}<
src/pages/admin/PatwariDetail.tsx:133: {lands.length === 0 && <TableRow><TableCell colSpan={3} className="text-center text-muted-foreground py-6">{tx("No lands in this mouza", "এই
src/pages/admin/PatwariDetail.tsx:140: <p className="text-xs text-muted-foreground mb-2">{tx("Irrigation entries where this patwari was specifically assigned.", "যেসব সেচ এন্ট্রিত
src/pages/admin/PatwariDetail.tsx:144: <TableHead>{tx("Date", "তারিখ")}</TableHead><TableHead>{tx("Farmer", "কৃষক")}</TableHead><TableHead>{tx("Dag", "দাগ")}</TableHead>
src/pages/admin/PatwariDetail.tsx:145: <TableHead>{tx("Total", "মোট")}</TableHead><TableHead>{tx("Paid", "পরিশোধ")}</TableHead>
src/pages/admin/PatwariDetail.tsx:157: {overrides.length === 0 && <TableRow><TableCell colSpan={5} className="text-center text-muted-foreground py-6">{tx("No special entries", "কো
src/pages/admin/Patwaris.tsx:51: useEffect(() => { document.title = tx("Patwari — list", "পাটুয়ারী — তালিকা"); load(); }, [showInactive]);
src/pages/admin/Patwaris.tsx:84: if (!form.name?.trim()) return toast.error(tx("Enter name", "নাম দিন"));
src/pages/admin/Patwaris.tsx:104: toast.success(tx("Saved", "সংরক্ষিত হয়েছে"));
src/pages/admin/Patwaris.tsx:122: title={tx("Patwari management", "পাটুয়ারী ব্যবস্থাপনা")}
src/pages/admin/Patwaris.tsx:126: <Button onClick={openNew}><Plus className="h-4 w-4 mr-1" />{tx("New patwari", "নতুন পাটুয়ারী")}</Button>
src/pages/admin/Patwaris.tsx:129: <DialogHeader><DialogTitle>{editId ? tx("Edit patwari", "পাটুয়ারী এডিট") : tx("New patwari", "নতুন পাটুয়ারী")}</DialogTitle></DialogHeader
src/pages/admin/Patwaris.tsx:131: <div><Label>{tx("Name (English) *", "নাম (English) *")}</Label><Input value={form.name} onChange={(e) => setForm({ ...form, name: e.target.v
src/pages/admin/Patwaris.tsx:132: <div><Label>{tx("Name (Bangla)", "নাম (বাংলা)")}</Label><Input value={form.name_bn} onChange={(e) => setForm({ ...form, name_bn: e.target.va
src/pages/admin/Patwaris.tsx:133: <div><Label>{tx("Mobile", "মোবাইল")}</Label><Input value={form.mobile} onChange={(e) => setForm({ ...form, mobile: e.target.value })} /></di
src/pages/admin/Patwaris.tsx:135: <div className="col-span-2"><Label>{tx("Address", "ঠিকানা")}</Label><Input value={form.address} onChange={(e) => setForm({ ...form, address:
src/pages/admin/Patwaris.tsx:137: <Label>{tx("Mouza (assigned)", "মৌজা (দায়িত্বরত)")}</Label>
src/pages/admin/Patwaris.tsx:141: <SelectItem value="none">{tx("— None —", "— কোনটি না —")}</SelectItem>
src/pages/admin/Patwaris.tsx:150: <Label>{tx("Office", "অফিস")}</Label>
src/pages/admin/Patwaris.tsx:154: <SelectItem value="none">{tx("— None —", "— কোনটি না —")}</SelectItem>
src/pages/admin/Patwaris.tsx:164: <Label>{tx("Active", "সক্রিয়")}</Label>
src/pages/admin/Patwaris.tsx:166: <div className="col-span-2"><Label>{tx("Note", "নোট")}</Label><Input value={form.note} onChange={(e) => setForm({ ...form, note: e.target.va
src/pages/admin/Patwaris.tsx:169: <Button variant="outline" onClick={() => setOpen(false)}>{tx("Cancel", "বাতিল")}</Button>
src/pages/admin/Patwaris.tsx:170: <Button onClick={save}>{tx("Save", "সংরক্ষণ")}</Button>
src/pages/admin/Patwaris.tsx:178: <Input className="max-w-xs" placeholder={tx("Search by name, mobile, mouza…", "নাম, মোবাইল, মৌজা খুঁজুন…")} value={search} onChange={(e) => 
src/pages/admin/Patwaris.tsx:181: {tx("Show inactive", "নিষ্ক্রিয় দেখান")}
src/pages/admin/Patwaris.tsx:183: <span className="text-xs text-muted-foreground ml-auto">{tx("Total", "মোট")}: {filtered.length}</span>
src/pages/admin/Patwaris.tsx:190: <TableHead>{tx("Name", "নাম")}</TableHead>
src/pages/admin/Patwaris.tsx:191: <TableHead>{tx("Mobile", "মোবাইল")}</TableHead>
src/pages/admin/Patwaris.tsx:192: <TableHead>{tx("Mouza", "মৌজা")}</TableHead>
src/pages/admin/Patwaris.tsx:193: <TableHead>{tx("Status", "স্ট্যাটাস")}</TableHead>
src/pages/admin/Patwaris.tsx:194: <TableHead className="text-right">{tx("Actions", "অ্যাকশন")}</TableHead>
src/pages/admin/Patwaris.tsx:204: {r.is_active ? <Badge variant="default">{tx("Active", "সক্রিয়")}</Badge> : <Badge variant="secondary">{tx("Inactive", "নিষ্ক্রিয়")}</Badge
src/pages/admin/Patwaris.tsx:208: <ViewButton title={tx("Profile", "প্রোফাইল")} />
src/pages/admin/Patwaris.tsx:210: <EditButton onClick={() => openEdit(r)} title={tx("Edit", "এডিট")} />
src/pages/admin/Patwaris.tsx:215: <TableRow><TableCell colSpan={5} className="text-center text-muted-foreground py-6">{tx("No patwari found", "কোন পাটুয়ারী নেই")}</TableCell
src/pages/admin/RateAuditLog.tsx:52: insert: tx("New", "নতুন"),
src/pages/admin/RateAuditLog.tsx:53: update: tx("Update", "পরিবর্তন"),
src/pages/admin/RateAuditLog.tsx:54: delete: tx("Delete", "মুছে ফেলা"),
src/pages/admin/RateAuditLog.tsx:58: document.title = tx("Rate change history", "রেট পরিবর্তন ইতিহাস");
src/pages/admin/RateAuditLog.tsx:91: const officeName = (id: string | null) => offices.find((o) => o.id === id)?.name || (id ? id.slice(0, 6) : tx("All offices", "সব অফিস"));
src/pages/admin/RateAuditLog.tsx:116: title={tx("Rate change history", "রেট পরিবর্তন ইতিহাস")}
src/pages/admin/RateAuditLog.tsx:117: description={tx("Full history of who, when and what rate changes were made in season rate config.", "সিজন রেট কনফিগারেশনে কখন, কে, কোন রেট প
src/pages/admin/RateAuditLog.tsx:123: <Label>{tx("Season", "সিজন")}</Label>
src/pages/admin/RateAuditLog.tsx:127: <SelectItem value="all">{tx("All", "সব")}</SelectItem>
src/pages/admin/RateAuditLog.tsx:133: <Label>{tx("Land type", "জমির ধরন")}</Label>
src/pages/admin/RateAuditLog.tsx:137: <SelectItem value="all">{tx("All", "সব")}</SelectItem>
src/pages/admin/RateAuditLog.tsx:144: <Label>{tx("Office", "অফিস")}</Label>
src/pages/admin/RateAuditLog.tsx:148: <SelectItem value="all">{tx("All", "সব")}</SelectItem>
src/pages/admin/RateAuditLog.tsx:155: <Label>{tx("From", "থেকে")}</Label>
src/pages/admin/RateAuditLog.tsx:159: <Label>{tx("To", "পর্যন্ত")}</Label>
src/pages/admin/RateAuditLog.tsx:164: <p className="text-sm text-muted-foreground">{rows.length} {tx("entries", "টি এন্ট্রি")} {loading && tx("(loading…)", "(লোড হচ্ছে…)")}</p>
src/pages/admin/RateAuditLog.tsx:166: <Download className="h-4 w-4 mr-1" /> {tx("CSV export", "CSV এক্সপোর্ট")}
src/pages/admin/RateAuditLog.tsx:173: <TableHead>{tx("Time", "সময়")}</TableHead>
src/pages/admin/RateAuditLog.tsx:174: <TableHead>{tx("Action", "অ্যাকশন")}</TableHead>
src/pages/admin/RateAuditLog.tsx:175: <TableHead>{tx("Office", "অফিস")}</TableHead>
src/pages/admin/RateAuditLog.tsx:176: <TableHead>{tx("Season", "সিজন")}</TableHead>
src/pages/admin/RateAuditLog.tsx:177: <TableHead>{tx("Land type", "জমির ধরন")}</TableHead>
src/pages/admin/RateAuditLog.tsx:178: <TableHead className="text-right">{tx("Old rate", "পুরোনো রেট")}</TableHead>
src/pages/admin/RateAuditLog.tsx:179: <TableHead className="text-right">{tx("New rate", "নতুন রেট")}</TableHead>
src/pages/admin/RateAuditLog.tsx:180: <TableHead className="text-right">{tx("Difference", "পার্থক্য")}</TableHead>
src/pages/admin/RateAuditLog.tsx:204: <TableRow><TableCell colSpan={8} className="text-center py-6 text-muted-foreground">{tx("No entries", "কোন এন্ট্রি নেই")}</TableCell></Table
src/pages/admin/RetryJobs.tsx:56: document.title = tx("Retry Jobs", "রিট্রাই কিউ");
src/pages/admin/RetryJobs.tsx:62: toast.success(tx("Queued for immediate retry", "অবিলম্বে রিট্রাই কিউ-তে যোগ হয়েছে"));
src/pages/admin/RetryJobs.tsx:71: title={tx("Background Retry Jobs", "ব্যাকগ্রাউন্ড রিট্রাই কিউ")}
src/pages/admin/RetryJobs.tsx:74: <RefreshCw className="h-4 w-4 mr-1" />{tx("Refresh", "রিফ্রেশ")}
src/pages/admin/RetryJobs.tsx:81: <span>{tx(`${failedCount} permanently failed job(s) need attention`, `${failedCount}টি জব স্থায়ীভাবে ব্যর্থ — অ্যাটেনশন প্রয়োজন`)}</span>
src/pages/admin/RetryJobs.tsx:89: <SelectItem value="all">{tx("All statuses", "সব স্ট্যাটাস")}</SelectItem>
src/pages/admin/RetryJobs.tsx:102: <SelectItem value="all">{tx("All types", "সব টাইপ")}</SelectItem>
src/pages/admin/RetryJobs.tsx:115: <TableHead>{tx("Type", "টাইপ")}</TableHead>
src/pages/admin/RetryJobs.tsx:116: <TableHead>{tx("Ref", "রেফ")}</TableHead>
src/pages/admin/RetryJobs.tsx:117: <TableHead>{tx("Status", "স্ট্যাটাস")}</TableHead>
src/pages/admin/RetryJobs.tsx:118: <TableHead className="text-right">{tx("Attempts", "প্রচেষ্টা")}</TableHead>
src/pages/admin/RetryJobs.tsx:119: <TableHead>{tx("Next retry", "পরবর্তী রিট্রাই")}</TableHead>
src/pages/admin/RetryJobs.tsx:120: <TableHead>{tx("Last error", "শেষ ত্রুটি")}</TableHead>
src/pages/admin/RetryJobs.tsx:121: <TableHead className="text-right">{tx("Action", "অ্যাকশন")}</TableHead>
src/pages/admin/RetryJobs.tsx:127: <TableRow><TableCell colSpan={7} className="text-center text-muted-foreground py-6">{tx("No jobs", "কোনো জব নেই")}</TableCell></TableRow>
src/pages/admin/RetryJobs.tsx:140: <RotateCw className="h-3.5 w-3.5 mr-1" />{tx("Retry", "রিট্রাই")}
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
src/pages/reports/InvoiceReport.tsx:33: document.title = tx("Invoice Report", "ইনভয়েস রিপোর্ট");
src/pages/reports/InvoiceReport.tsx:87: tx("Invoice", "ইনভয়েস"), tx("Farmer", "কৃষক"), tx("Mouza/Dag", "মৌজা/দাগ"),
src/pages/reports/InvoiceReport.tsx:88: tx("Season", "সিজন"), tx("Type", "ধরন"),
src/pages/reports/InvoiceReport.tsx:89: tx("Payable", "প্রদেয়"), tx("Paid", "জমা"), tx("Due", "বকেয়া"),
src/pages/reports/InvoiceReport.tsx:90: tx("Late fee", "বিলম্ব ফি"), tx("Status", "অবস্থা"),
src/pages/reports/InvoiceReport.tsx:97: r.is_borga ? tx("Sharecropper", "বর্গা") : tx("Owner", "নিজ"),
src/pages/reports/InvoiceReport.tsx:104: <PageHeader title={tx("Invoice Report", "ইনভয়েস রিপোর্ট")} description={tx("Overdue, late-fee, sharecropper and season-wise invoice report"
src/pages/reports/InvoiceReport.tsx:110: <Label>{tx("Office", "অফিস")}</Label>
src/pages/reports/InvoiceReport.tsx:114: <SelectItem value="all">{tx("All offices", "সকল অফিস")}</SelectItem>
src/pages/reports/InvoiceReport.tsx:121: <Label>{tx("Season", "সিজন")}</Label>
src/pages/reports/InvoiceReport.tsx:125: <SelectItem value="all">{tx("All seasons", "সকল সিজন")}</SelectItem>
src/pages/reports/InvoiceReport.tsx:131: <Label>{tx("Filter", "ফিল্টার")}</Label>
src/pages/reports/InvoiceReport.tsx:135: <SelectItem value="all">{tx("All invoices", "সব ইনভয়েস")}</SelectItem>
src/pages/reports/InvoiceReport.tsx:136: <SelectItem value="overdue">{tx("Overdue", "ওভারডিউ")}</SelectItem>
src/pages/reports/InvoiceReport.tsx:137: <SelectItem value="delay_fee">{tx("Late fee applied", "বিলম্ব ফি প্রযোজ্য")}</SelectItem>
src/pages/reports/InvoiceReport.tsx:138: <SelectItem value="borga">{tx("Sharecropper", "বর্গা")}</SelectItem>
src/pages/reports/InvoiceReport.tsx:139: <SelectItem value="paid">{tx("Paid", "পরিশোধিত")}</SelectItem>
src/pages/reports/InvoiceReport.tsx:140: <SelectItem value="cancelled">{tx("Cancelled", "বাতিল")}</SelectItem>
src/pages/reports/InvoiceReport.tsx:145: <Label>{tx("Search", "খুঁজুন")}</Label>
src/pages/reports/InvoiceReport.tsx:146: <Input placeholder={tx("Invoice no / farmer / code / mobile", "ইনভয়েস নং / কৃষক / কোড / মোবাইল")} value={search} onChange={(e) => setSearch
src/pages/reports/InvoiceReport.tsx:154: <p className="text-sm text-muted-foreground">{filtered.length} {tx("rows", "টি")} {loading && tx("(loading…)", "(লোড হচ্ছে...)")}</p>
src/pages/reports/InvoiceReport.tsx:177: <TableHead>{tx("Invoice", "ইনভয়েস")}</TableHead>
src/pages/reports/InvoiceReport.tsx:178: <TableHead>{tx("Farmer", "কৃষক")}</TableHead>
src/pages/reports/InvoiceReport.tsx:179: <TableHead>{tx("Mouza/Dag", "মৌজা/দাগ")}</TableHead>
src/pages/reports/InvoiceReport.tsx:180: <TableHead>{tx("Season", "সিজন")}</TableHead>
src/pages/reports/InvoiceReport.tsx:181: <TableHead>{tx("Type", "ধরন")}</TableHead>
src/pages/reports/InvoiceReport.tsx:182: <TableHead className="text-right">{tx("Payable", "প্রদেয়")}</TableHead>
src/pages/reports/InvoiceReport.tsx:183: <TableHead className="text-right">{tx("Paid", "জমা")}</TableHead>
src/pages/reports/InvoiceReport.tsx:184: <TableHead className="text-right">{tx("Due", "বকেয়া")}</TableHead>
src/pages/reports/InvoiceReport.tsx:185: <TableHead className="text-right">{tx("Late fee", "বিলম্ব ফি")}</TableHead>
src/pages/reports/InvoiceReport.tsx:186: <TableHead>{tx("Status", "অবস্থা")}</TableHead>
src/pages/reports/InvoiceReport.tsx:196: <TableCell><Badge variant={r.is_borga ? "secondary" : "outline"}>{r.is_borga ? tx("Sharecropper", "বর্গা") : tx("Owner", "নিজ")}</Badge></Ta
src/pages/reports/InvoiceReport.tsx:205: <TableRow><TableCell colSpan={10} className="text-center text-muted-foreground py-6">{tx("No data", "কোন তথ্য নেই")}</TableCell></TableRow>
src/pages/reports/InvoiceReport.tsx:211: <div>{tx("Payable", "প্রদেয়")}: <span className="font-semibold">{money(totals.payable)}</span></div>
src/pages/reports/InvoiceReport.tsx:212: <div>{tx("Paid", "জমা")}: <span className="font-semibold text-success">{money(totals.paid)}</span></div>
src/pages/reports/InvoiceReport.tsx:213: <div>{tx("Due", "বকেয়া")}: <span className="font-semibold text-destructive">{money(totals.due)}</span></div>
src/pages/reports/InvoiceReport.tsx:214: <div>{tx("Late fee", "বিলম্ব ফি")}: <span className="font-semibold">{money(totals.delay)}</span></div>
src/pages/reports/LoanOverdueReport.tsx:15: const money = (n: any) => `৳ ${Number(n || 0).toLocaleString("bn-BD", { maximumFractionDigits: 2 })}`;
src/pages/reports/LoanPenaltyReport.tsx:13: const money = (n: any) => `৳ ${Number(n || 0).toLocaleString("bn-BD", { maximumFractionDigits: 2 })}`;
src/pages/reports/PromiseDueReport.tsx:48: document.title = tx("Promise Due Report", "প্রতিশ্রুতি বকেয়া রিপোর্ট");
src/pages/reports/PromiseDueReport.tsx:124: <PageHeader title={tx("Promise Due Report", "প্রতিশ্রুতি বকেয়া রিপোর্ট")} />
src/pages/reports/PromiseDueReport.tsx:129: <Label>{tx("Office", "অফিস")}</Label>
src/pages/reports/PromiseDueReport.tsx:133: <SelectItem value="all">{tx("All", "সব")}</SelectItem>
src/pages/reports/PromiseDueReport.tsx:140: <Label>{tx("Status", "অবস্থা")}</Label>
src/pages/reports/PromiseDueReport.tsx:144: <SelectItem value="all">{tx("All", "সব")}</SelectItem>
src/pages/reports/PromiseDueReport.tsx:153: <Label>{tx("From", "হতে")}</Label>
src/pages/reports/PromiseDueReport.tsx:157: <Label>{tx("To", "পর্যন্ত")}</Label>
src/pages/reports/PromiseDueReport.tsx:167: {tx("Total promises", "মোট প্রতিশ্রুতি")}: <b>{totals.count}</b> • {tx("Total amount", "মোট পরিমাণ")}: <b>{money(totals.amount)}</b>
src/pages/reports/PromiseDueReport.tsx:175: <TableHead>{tx("Farmer", "কৃষক")}</TableHead>
src/pages/reports/PromiseDueReport.tsx:176: <TableHead>{tx("Code", "কোড")}</TableHead>
src/pages/reports/PromiseDueReport.tsx:177: <TableHead className="text-right">{tx("Previous Due", "পূর্বের বকেয়া")}</TableHead>
src/pages/reports/PromiseDueReport.tsx:178: <TableHead>{tx("Promise Date", "প্রতিশ্রুতির তারিখ")}</TableHead>
src/pages/reports/PromiseDueReport.tsx:179: <TableHead>{tx("Status", "অবস্থা")}</TableHead>
src/pages/reports/PromiseDueReport.tsx:180: <TableHead>{tx("Remarks", "মন্তব্য")}</TableHead>
src/pages/reports/PromiseDueReport.tsx:185: {!loading && filtered.length === 0 && <TableRow><TableCell colSpan={6} className="text-center text-muted-foreground">{tx("No records", "কোনো
```
