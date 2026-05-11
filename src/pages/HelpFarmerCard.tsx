import { useState } from "react";
import { Link } from "react-router-dom";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { ArrowLeft, IdCard, Languages, Printer, Download } from "lucide-react";

type Lang = "bn" | "en";

const STEPS_BN = [
  {
    title: "একক ফার্মারের কার্ড",
    items: [
      { text: "সাইডবার থেকে Members → Farmers এ যান।", img: "02_farmers_list_bn.png" },
      { text: "তালিকা থেকে কাঙ্ক্ষিত ফার্মারের নামে ক্লিক করে Detail পেজ খুলুন।", img: "22_farmer_detail.png" },
      { text: "উপরের ডানে \"Membership Card\" বা \"Print Card\" বোতামে ক্লিক করুন।" },
      { text: "নতুন ট্যাবে কার্ডের প্রিভিউ আসবে। ব্রাউজারের Print ডায়লগ থেকে \"Save as PDF\" নির্বাচন করুন।", img: "23_membership_card.png" },
      { text: "Save করলে আপনার ডিভাইসের Downloads ফোল্ডারে .pdf ফাইল চলে আসবে।" },
    ],
  },
  {
    title: "একসাথে অনেক কার্ড (Bulk)",
    items: [
      { text: "সাইডবার → Members → Bulk Cards এ যান।", img: "06_bulk_cards_bn.png" },
      { text: "অফিস/গ্রাম/তারিখ ফিল্টার দিয়ে ফার্মার তালিকা ফিল্টার করুন।" },
      { text: "চেকবক্স দিয়ে কার্ড ছাপাতে চাওয়া ফার্মারদের নির্বাচন করুন।" },
      { text: "\"Generate PDF\" বোতাম চাপলে একটি কম্বাইন্ড PDF তৈরি হয়ে ডাউনলোড শুরু হবে।" },
      { text: "PDF টি প্রিন্ট করে কার্ড স্টকে ছাপাতে পারবেন (A4 এ একাধিক কার্ড)।" },
    ],
  },
];

const STEPS_EN = [
  {
    title: "Single Farmer Card",
    items: [
      { text: "Sidebar → Members → Farmers.", img: "02_farmers_list_bn.png" },
      { text: "Click the farmer's name to open the Detail page.", img: "22_farmer_detail.png" },
      { text: "Click \"Membership Card\" / \"Print Card\" at the top right." },
      { text: "A preview opens in a new tab. From the browser print dialog, choose \"Save as PDF\".", img: "23_membership_card.png" },
      { text: "The .pdf is saved to your device's Downloads folder." },
    ],
  },
  {
    title: "Bulk Cards",
    items: [
      { text: "Sidebar → Members → Bulk Cards.", img: "06_bulk_cards_bn.png" },
      { text: "Filter farmers by office / village / date." },
      { text: "Tick the checkboxes for the farmers whose cards you want." },
      { text: "Click \"Generate PDF\" — a combined PDF downloads automatically." },
      { text: "Print the PDF onto your card stock (multiple cards per A4)." },
    ],
  },
];

export default function HelpFarmerCard() {
  const [lang, setLang] = useState<Lang>("bn");
  const tx = (bn: string, en: string) => (lang === "bn" ? bn : en);
  const sections = lang === "bn" ? STEPS_BN : STEPS_EN;

  return (
    <div className="container mx-auto p-4 md:p-6 space-y-6 max-w-3xl">
      <div className="flex items-center justify-between flex-wrap gap-2">
        <Button asChild variant="ghost" size="sm">
          <Link to="/help"><ArrowLeft className="h-4 w-4 mr-1" /> {tx("সাহায্য পেজে ফিরুন", "Back to Help")}</Link>
        </Button>
        <div className="flex gap-2">
          <Button size="sm" variant={lang === "bn" ? "default" : "outline"} onClick={() => setLang("bn")}>
            <Languages className="h-4 w-4 mr-1" /> বাংলা
          </Button>
          <Button size="sm" variant={lang === "en" ? "default" : "outline"} onClick={() => setLang("en")}>
            <Languages className="h-4 w-4 mr-1" /> English
          </Button>
        </div>
      </div>

      <header className="space-y-2">
        <div className="flex items-center gap-2">
          <IdCard className="h-7 w-7 text-primary" />
          <h1 className="text-2xl md:text-3xl font-bold">
            {tx("ফার্মার কার্ড ডাউনলোড টিউটোরিয়াল", "Farmer Card Download Tutorial")}
          </h1>
        </div>
        <p className="text-muted-foreground text-sm">
          {tx(
            "একক বা একাধিক সদস্যের মেম্বারশিপ/প্রোফাইল কার্ড কিভাবে তৈরি ও ডাউনলোড করবেন তার বিস্তারিত নির্দেশনা।",
            "How to generate and download single or bulk membership/profile cards."
          )}
        </p>
      </header>

      {sections.map((sec, idx) => (
        <Card key={idx}>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Badge variant={idx === 0 ? "default" : "secondary"}>{idx + 1}</Badge> {sec.title}
            </CardTitle>
            <CardDescription>
              {idx === 0
                ? tx("একজন ফার্মারের কার্ড দ্রুত প্রিন্ট/ডাউনলোডের জন্য।", "Quickly print/download a single farmer's card.")
                : tx("একসাথে অনেক ফার্মারের কার্ড একটি PDF এ ডাউনলোডের জন্য।", "Download many farmers' cards in one combined PDF.")}
            </CardDescription>
          </CardHeader>
          <CardContent>
            <ol className="list-decimal pl-5 space-y-3 text-sm">
              {sec.items.map((it, i) => (
                <li key={i} className="space-y-2">
                  <span>{it.text}</span>
                  {it.img && (
                    <a href={`/help/screens/${it.img}`} target="_blank" rel="noreferrer" className="block">
                      <img
                        src={`/help/screens/${it.img}`}
                        alt=""
                        className="rounded border max-w-full md:max-w-md"
                        loading="lazy"
                      />
                    </a>
                  )}
                </li>
              ))}
            </ol>
          </CardContent>
        </Card>
      ))}

      <Card className="bg-muted/30">
        <CardHeader className="pb-2">
          <CardTitle className="text-base">{tx("ফাইল কোথায় পাব?", "Where is the file saved?")}</CardTitle>
        </CardHeader>
        <CardContent className="text-sm space-y-2">
          <p className="flex items-start gap-2"><Download className="h-4 w-4 mt-0.5" />
            {tx(
              "Save as PDF করার পর ফাইলটি আপনার ডিভাইসের ডিফল্ট Downloads ফোল্ডারে যাবে। মোবাইলে Files/Downloads অ্যাপ থেকে পাবেন।",
              "After Save as PDF, the file goes to your device's default Downloads folder. On mobile, find it via the Files / Downloads app."
            )}
          </p>
          <p className="flex items-start gap-2"><Printer className="h-4 w-4 mt-0.5" />
            {tx(
              "সরাসরি ছাপাতে চাইলে Print ডায়লগে আপনার প্রিন্টার নির্বাচন করে Print করুন।",
              "To print directly, choose your printer in the Print dialog and click Print."
            )}
          </p>
          <div className="pt-2 flex gap-2 flex-wrap">
            <Button asChild size="sm" variant="outline"><Link to="/farmers">{tx("Farmers এ যান", "Go to Farmers")}</Link></Button>
            <Button asChild size="sm" variant="outline"><Link to="/admin/bulk-cards">{tx("Bulk Cards এ যান", "Go to Bulk Cards")}</Link></Button>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
