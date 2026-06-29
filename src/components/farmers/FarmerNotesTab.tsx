import { useEffect, useState } from "react";
import { db } from "@/lib/db";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Pin, PinOff, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { useAuth } from "@/auth/AuthProvider";
import { fmtDate } from "@/lib/format";

const sb = db as any;

interface Note {
  id: string;
  farmer_id: string;
  note: string;
  pinned: boolean;
  created_by: string | null;
  created_at: string;
}

export default function FarmerNotesTab({ farmerId }: { farmerId: string }) {
  const { user } = useAuth();
  const [notes, setNotes] = useState<Note[]>([]);
  const [text, setText] = useState("");
  const [saving, setSaving] = useState(false);

  async function load() {
    const { data, error } = await sb
      .from("farmer_notes")
      .select("*")
      .eq("farmer_id", farmerId)
      .order("pinned", { ascending: false })
      .order("created_at", { ascending: false });
    if (error) return toast.error(error.message);
    setNotes((data as Note[]) ?? []);
  }

  useEffect(() => { load(); }, [farmerId]);

  async function add() {
    if (!text.trim()) return;
    setSaving(true);
    const { error } = await sb.from("farmer_notes").insert({
      farmer_id: farmerId, note: text.trim(), created_by: user?.id,
    });
    setSaving(false);
    if (error) return toast.error(error.message);
    toast.success("নোট যোগ হয়েছে");
    setText(""); load();
  }

  async function togglePin(n: Note) {
    const { error } = await sb.from("farmer_notes").update({ pinned: !n.pinned }).eq("id", n.id);
    if (error) return toast.error(error.message);
    load();
  }

  async function remove(n: Note) {
    if (!confirm("নোটটি ডিলিট করবেন?")) return;
    const { error } = await sb.from("farmer_notes").delete().eq("id", n.id);
    if (error) return toast.error(error.message);
    load();
  }

  return (
    <Card>
      <CardContent className="pt-6 space-y-4">
        <div className="space-y-2">
          <Textarea
            placeholder="অভ্যন্তরীণ নোট লিখুন (শুধু স্টাফ দেখতে পারবে)…"
            value={text}
            onChange={(e) => setText(e.target.value)}
            rows={3}
          />
          <div className="flex justify-end">
            <Button size="sm" onClick={add} disabled={saving || !text.trim()}>
              {saving ? "…" : "নোট যোগ করুন"}
            </Button>
          </div>
        </div>

        <div className="space-y-2">
          {notes.length === 0 && (
            <p className="text-center py-6 text-sm text-muted-foreground">কোন নোট নেই</p>
          )}
          {notes.map((n) => (
            <div
              key={n.id}
              className={`rounded-md border p-3 ${n.pinned ? "bg-yellow-50 dark:bg-yellow-950/20 border-yellow-300" : "bg-muted/20"}`}
            >
              <div className="flex items-start justify-between gap-3">
                <div className="flex-1">
                  {n.pinned && <Badge variant="outline" className="mb-1">📌 পিন</Badge>}
                  <p className="whitespace-pre-wrap text-sm">{n.note}</p>
                  <p className="mt-1 text-[11px] text-muted-foreground">{fmtDate(n.created_at)}</p>
                </div>
                <div className="flex flex-col gap-1">
                  <Button size="icon" variant="ghost" onClick={() => togglePin(n)} title={n.pinned ? "Unpin" : "Pin"}>
                    {n.pinned ? <PinOff className="h-4 w-4" /> : <Pin className="h-4 w-4" />}
                  </Button>
                  <Button size="icon" variant="ghost" onClick={() => remove(n)} title="Delete">
                    <Trash2 className="h-4 w-4 text-destructive" />
                  </Button>
                </div>
              </div>
            </div>
          ))}
        </div>
      </CardContent>
    </Card>
  );
}
