import { useEffect, useRef, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { db } from "@/lib/db";
import { Textarea } from "@/components/ui/textarea";
import { Button } from "@/components/ui/button";
import { toast } from "sonner";
import { useLang } from "@/i18n/LanguageProvider";
import { Pencil, Check, X, Paperclip, FileText, Image as ImageIcon, History, Trash2, Loader2 } from "lucide-react";
import { fmtDate } from "@/lib/format";

const NOTE_MAX = 2000;
const BUCKET = "land-note-attachments";
const ALLOWED = ["image/png", "image/jpeg", "image/jpg", "image/webp", "image/gif", "application/pdf"];
const MAX_FILE = 10 * 1024 * 1024; // 10MB

type Attachment = {
  id: string;
  file_path: string;
  file_name: string;
  content_type: string | null;
};

export function LandNoteCell({
  landId,
  officeId,
  note,
  onSaved,
}: {
  landId: string;
  officeId: string | null;
  note: string;
  onSaved?: (note: string) => void;
}) {
  const { tx } = useLang();
  const [editing, setEditing] = useState(false);
  const [value, setValue] = useState(note ?? "");
  const [saving, setSaving] = useState(false);
  const [attachments, setAttachments] = useState<Attachment[]>([]);
  const [uploading, setUploading] = useState(false);
  const [showHistory, setShowHistory] = useState(false);
  const [history, setHistory] = useState<any[] | null>(null);
  const fileRef = useRef<HTMLInputElement>(null);

  useEffect(() => { setValue(note ?? ""); }, [note]);

  useEffect(() => {
    db
      .from("land_note_attachments")
      .select("id,file_path,file_name,content_type")
      .eq("land_id", landId)
      .order("created_at", { ascending: false })
      .then(({ data }) => setAttachments((data as any) ?? []));
  }, [landId]);

  function validate(v: string): string | null {
    const t = v.trim();
    if (t.length > NOTE_MAX) return tx(`Note must be under ${NOTE_MAX} characters`, `নোট ${NOTE_MAX} অক্ষরের কম হতে হবে`);
    return null;
  }

  async function save() {
    const err = validate(value);
    if (err) { toast.error(err); return; }
    const clean = value.trim();
    if (clean === (note ?? "").trim()) { setEditing(false); return; }
    setSaving(true);
    try {
      const { error } = await db.from("lands").update({ notes: clean || null } as any).eq("id", landId);
      if (error) { toast.error(error.message); return; }
      const { data: u } = await supabase.auth.getUser();
      await db.from("land_note_audit").insert({
        land_id: landId,
        office_id: officeId,
        old_note: note ?? null,
        new_note: clean || null,
        changed_by: u?.user?.id ?? null,
      } as any);
      toast.success(tx("Note saved", "নোট সংরক্ষিত হয়েছে"));
      setEditing(false);
      setHistory(null);
      onSaved?.(clean);
    } finally { setSaving(false); }
  }

  async function uploadFiles(files: FileList) {
    const { data: u } = await supabase.auth.getUser();
    setUploading(true);
    try {
      for (const file of Array.from(files)) {
        if (!ALLOWED.includes(file.type)) {
          toast.error(tx("Only images and PDF are allowed", "শুধু ছবি ও পিডিএফ অনুমোদিত"));
          continue;
        }
        if (file.size > MAX_FILE) {
          toast.error(tx("File too large (max 10MB)", "ফাইল অনেক বড় (সর্বোচ্চ ১০ এমবি)"));
          continue;
        }
        const ext = file.name.split(".").pop() || "bin";
        const path = `${landId}/${crypto.randomUUID()}.${ext}`;
        const { error: upErr } = await db.storage.from(BUCKET).upload(path, file, { contentType: file.type });
        if (upErr) { toast.error(upErr.message); continue; }
        const { data, error } = await db.from("land_note_attachments").insert({
          land_id: landId,
          office_id: officeId,
          file_path: path,
          file_name: file.name,
          content_type: file.type,
          size_bytes: file.size,
          created_by: u?.user?.id ?? null,
        } as any).select("id,file_path,file_name,content_type").single();
        if (error) { toast.error(error.message); continue; }
        setAttachments((p) => [data as any, ...p]);
      }
      toast.success(tx("Attachment added", "সংযুক্তি যোগ হয়েছে"));
    } finally {
      setUploading(false);
      if (fileRef.current) fileRef.current.value = "";
    }
  }

  async function openAttachment(a: Attachment) {
    const { data } = await db.storage.from(BUCKET).createSignedUrl(a.file_path, 60);
    if (data?.signedUrl) window.open(data.signedUrl, "_blank");
  }

  async function removeAttachment(a: Attachment) {
    const { error } = await db.from("land_note_attachments").delete().eq("id", a.id);
    if (error) { toast.error(error.message); return; }
    await db.storage.from(BUCKET).remove([a.file_path]);
    setAttachments((p) => p.filter((x) => x.id !== a.id));
  }

  async function loadHistory() {
    if (history) { setShowHistory((s) => !s); return; }
    const { data } = await db
      .from("land_note_audit")
      .select("id,old_note,new_note,changed_by,created_at")
      .eq("land_id", landId)
      .order("created_at", { ascending: false });
    setHistory((data as any) ?? []);
    setShowHistory(true);
  }

  return (
    <div className="mt-0.5 max-w-[200px] text-[11px]">
      {editing ? (
        <div className="space-y-1">
          <Textarea
            value={value}
            rows={3}
            maxLength={NOTE_MAX}
            disabled={saving}
            onChange={(e) => setValue(e.target.value)}
            className="text-[11px] min-h-[60px]"
            placeholder={tx("Add a note…", "নোট লিখুন…")}
          />
          <div className="flex items-center justify-between">
            <span className="text-[10px] text-muted-foreground">{value.length}/{NOTE_MAX}</span>
            <div className="flex gap-1">
              <Button size="sm" variant="ghost" className="h-6 px-1" disabled={saving} onClick={save}>
                {saving ? <Loader2 className="h-3 w-3 animate-spin" /> : <Check className="h-3 w-3" />}
              </Button>
              <Button size="sm" variant="ghost" className="h-6 px-1" disabled={saving} onClick={() => { setValue(note ?? ""); setEditing(false); }}>
                <X className="h-3 w-3" />
              </Button>
            </div>
          </div>
        </div>
      ) : (
        <div className="group flex items-start gap-1">
          <div className="flex-1 whitespace-normal text-muted-foreground">
            {note?.trim() ? <span title={note}>📝 {note}</span> : <span className="italic opacity-60">{tx("No note", "নোট নেই")}</span>}
          </div>
          <button className="opacity-0 group-hover:opacity-100 text-muted-foreground hover:text-foreground" onClick={() => setEditing(true)} title={tx("Edit note", "নোট সম্পাদনা")}>
            <Pencil className="h-3 w-3" />
          </button>
        </div>
      )}

      {attachments.length > 0 && (
        <div className="flex flex-wrap gap-1 mt-1">
          {attachments.map((a) => (
            <span key={a.id} className="inline-flex items-center gap-0.5 bg-muted rounded px-1 py-0.5">
              <button className="inline-flex items-center gap-0.5 hover:underline" onClick={() => openAttachment(a)}>
                {a.content_type?.startsWith("image/") ? <ImageIcon className="h-3 w-3" /> : <FileText className="h-3 w-3" />}
                <span className="max-w-[80px] truncate">{a.file_name}</span>
              </button>
              <button className="text-destructive hover:opacity-70" onClick={() => removeAttachment(a)} title={tx("Remove", "মুছুন")}>
                <Trash2 className="h-3 w-3" />
              </button>
            </span>
          ))}
        </div>
      )}

      <div className="flex items-center gap-2 mt-1">
        <input ref={fileRef} type="file" accept="image/*,application/pdf" multiple className="hidden" onChange={(e) => e.target.files && uploadFiles(e.target.files)} />
        <button className="inline-flex items-center gap-0.5 text-[10px] text-muted-foreground hover:text-foreground" disabled={uploading} onClick={() => fileRef.current?.click()}>
          {uploading ? <Loader2 className="h-3 w-3 animate-spin" /> : <Paperclip className="h-3 w-3" />} {tx("Attach", "সংযুক্ত")}
        </button>
        <button className="inline-flex items-center gap-0.5 text-[10px] text-muted-foreground hover:text-foreground" onClick={loadHistory}>
          <History className="h-3 w-3" /> {tx("History", "ইতিহাস")}
        </button>
      </div>

      {showHistory && (
        <div className="mt-1 border-t pt-1 space-y-1 max-h-40 overflow-auto">
          {(history?.length ?? 0) === 0 ? (
            <div className="text-[10px] text-muted-foreground italic">{tx("No changes recorded", "কোন পরিবর্তন নেই")}</div>
          ) : (
            history!.map((h) => (
              <div key={h.id} className="text-[10px] text-muted-foreground">
                <span className="font-medium">{fmtDate((h.created_at || "").slice(0, 10))}</span>
                {" — "}
                <span>{(h.new_note ?? "").trim() || tx("(cleared)", "(মুছে ফেলা)")}</span>
              </div>
            ))
          )}
        </div>
      )}
    </div>
  );
}
