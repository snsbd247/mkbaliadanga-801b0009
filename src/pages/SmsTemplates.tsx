import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { PageHeader } from "@/components/layout/PageHeader";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";
import { Badge } from "@/components/ui/badge";
import {
  Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle, DialogTrigger,
} from "@/components/ui/dialog";
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { toast } from "sonner";
import { Plus, Pencil, Trash2, MessageSquareText } from "lucide-react";
import { useLang } from "@/i18n/LanguageProvider";

type Template = {
  id: string;
  key: string;
  name: string;
  body: string;
  variables: string[] | null;
  is_active: boolean;
  preferred_provider: string | null;
  updated_at: string;
};

const EMPTY: Omit<Template, "id" | "updated_at"> = {
  key: "", name: "", body: "", variables: [], is_active: true, preferred_provider: null,
};


export default function SmsTemplates() {
  const { lang } = useLang();
  const isBn = lang === "bn";
  const [rows, setRows] = useState<Template[]>([]);
  const [loading, setLoading] = useState(true);
  const [editOpen, setEditOpen] = useState(false);
  const [editing, setEditing] = useState<Template | null>(null);
  const [form, setForm] = useState(EMPTY);
  const [varsText, setVarsText] = useState("");
  const [saving, setSaving] = useState(false);

  async function load() {
    setLoading(true);
    const { data, error } = await supabase
      .from("sms_templates" as any)
      .select("*")
      .order("key");
    if (error) toast.error(error.message);
    setRows((data as any) ?? []);
    setLoading(false);
  }

  useEffect(() => { load(); }, []);

  function openCreate() {
    setEditing(null);
    setForm(EMPTY);
    setVarsText("");
    setEditOpen(true);
  }

  function openEdit(r: Template) {
    setEditing(r);
    setForm({
      key: r.key, name: r.name, body: r.body,
      variables: r.variables ?? [], is_active: r.is_active,
      preferred_provider: r.preferred_provider ?? null,
    });

    setVarsText((r.variables ?? []).join(", "));
    setEditOpen(true);
  }

  async function save() {
    if (!form.key.trim() || !form.name.trim() || !form.body.trim()) {
      toast.error(isBn ? "key, name, body সব required" : "key, name, body are required");
      return;
    }
    setSaving(true);
    const variables = varsText.split(",").map((s) => s.trim()).filter(Boolean);
    const payload = { ...form, variables };
    const { error } = editing
      ? await supabase.from("sms_templates" as any).update(payload).eq("id", editing.id)
      : await supabase.from("sms_templates" as any).insert(payload);
    setSaving(false);
    if (error) { toast.error(error.message); return; }
    toast.success(isBn ? "সংরক্ষিত" : "Saved");
    setEditOpen(false);
    load();
  }

  async function remove(id: string) {
    const { error } = await supabase.from("sms_templates" as any).delete().eq("id", id);
    if (error) { toast.error(error.message); return; }
    toast.success(isBn ? "মুছে ফেলা হয়েছে" : "Deleted");
    load();
  }

  async function toggleActive(r: Template) {
    const { error } = await supabase
      .from("sms_templates" as any)
      .update({ is_active: !r.is_active })
      .eq("id", r.id);
    if (error) { toast.error(error.message); return; }
    load();
  }

  return (
    <div className="space-y-4">
      <PageHeader
        title={isBn ? "SMS টেমপ্লেট লাইব্রেরি" : "SMS Template Library"}
        description={isBn
          ? "Reusable Bangla SMS টেমপ্লেট তৈরি ও পরিচালনা করুন।"
          : "Create and manage reusable Bangla SMS templates."}
      />

      <Card>
        <CardHeader className="flex flex-row items-center justify-between">
          <CardTitle>{isBn ? "টেমপ্লেটসমূহ" : "Templates"} ({rows.length})</CardTitle>
          <Button onClick={openCreate} size="sm">
            <Plus className="h-4 w-4 mr-1" /> {isBn ? "নতুন" : "New"}
          </Button>
        </CardHeader>
        <CardContent>
          {loading ? (
            <p className="text-sm text-muted-foreground">{isBn ? "লোড হচ্ছে…" : "Loading…"}</p>
          ) : rows.length === 0 ? (
            <p className="text-sm text-muted-foreground">{isBn ? "কোনো টেমপ্লেট নেই" : "No templates yet"}</p>
          ) : (
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Key</TableHead>
                    <TableHead>{isBn ? "নাম" : "Name"}</TableHead>
                    <TableHead>{isBn ? "মেসেজ" : "Body"}</TableHead>
                    <TableHead>{isBn ? "ভেরিয়েবল" : "Variables"}</TableHead>
                    <TableHead>{isBn ? "সক্রিয়" : "Active"}</TableHead>
                    <TableHead className="text-right">{isBn ? "অ্যাকশন" : "Actions"}</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {rows.map((r) => (
                    <TableRow key={r.id}>
                      <TableCell className="font-mono text-xs">{r.key}</TableCell>
                      <TableCell>{r.name}</TableCell>
                      <TableCell className="max-w-xs truncate text-xs">{r.body}</TableCell>
                      <TableCell>
                        <div className="flex flex-wrap gap-1">
                          {(r.variables ?? []).map((v) => (
                            <Badge key={v} variant="secondary" className="text-xs">{`{${v}}`}</Badge>
                          ))}
                        </div>
                      </TableCell>
                      <TableCell>
                        <Switch checked={r.is_active} onCheckedChange={() => toggleActive(r)} />
                      </TableCell>
                      <TableCell className="text-right">
                        <Button variant="ghost" size="icon" onClick={() => openEdit(r)}>
                          <Pencil className="h-4 w-4" />
                        </Button>
                        <AlertDialog>
                          <AlertDialogTrigger asChild>
                            <Button variant="ghost" size="icon" className="text-destructive">
                              <Trash2 className="h-4 w-4" />
                            </Button>
                          </AlertDialogTrigger>
                          <AlertDialogContent>
                            <AlertDialogHeader>
                              <AlertDialogTitle>{isBn ? "মুছে ফেলবেন?" : "Delete template?"}</AlertDialogTitle>
                              <AlertDialogDescription>
                                {isBn ? `"${r.name}" টেমপ্লেটটি স্থায়ীভাবে মুছে যাবে।` : `"${r.name}" will be permanently deleted.`}
                              </AlertDialogDescription>
                            </AlertDialogHeader>
                            <AlertDialogFooter>
                              <AlertDialogCancel>{isBn ? "বাতিল" : "Cancel"}</AlertDialogCancel>
                              <AlertDialogAction onClick={() => remove(r.id)}>
                                {isBn ? "মুছুন" : "Delete"}
                              </AlertDialogAction>
                            </AlertDialogFooter>
                          </AlertDialogContent>
                        </AlertDialog>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          )}
        </CardContent>
      </Card>

      <Dialog open={editOpen} onOpenChange={setEditOpen}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>
              {editing ? (isBn ? "টেমপ্লেট সম্পাদনা" : "Edit Template") : (isBn ? "নতুন টেমপ্লেট" : "New Template")}
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-3">
            <div>
              <Label>Key</Label>
              <Input
                value={form.key}
                onChange={(e) => setForm({ ...form, key: e.target.value })}
                placeholder="e.g. payment_receipt"
                disabled={!!editing}
              />
            </div>
            <div>
              <Label>{isBn ? "নাম" : "Name"}</Label>
              <Input value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} />
            </div>
            <div>
              <Label>{isBn ? "মেসেজ বডি" : "Message Body"}</Label>
              <Textarea
                rows={4}
                value={form.body}
                onChange={(e) => setForm({ ...form, body: e.target.value })}
                placeholder="প্রিয় {name}, ৳{amount} গৃহীত হয়েছে।"
              />
              <p className="text-xs text-muted-foreground mt-1">
                {form.body.length} {isBn ? "অক্ষর" : "chars"}
              </p>
            </div>
            <div>
              <Label>{isBn ? "ভেরিয়েবল (comma-separated)" : "Variables (comma-separated)"}</Label>
              <Input
                value={varsText}
                onChange={(e) => setVarsText(e.target.value)}
                placeholder="name, amount, date"
              />
            </div>
            <div className="flex items-center gap-2">
              <Switch
                checked={form.is_active}
                onCheckedChange={(v) => setForm({ ...form, is_active: v })}
              />
              <Label>{isBn ? "সক্রিয়" : "Active"}</Label>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setEditOpen(false)}>
              {isBn ? "বাতিল" : "Cancel"}
            </Button>
            <Button onClick={save} disabled={saving}>
              {saving ? (isBn ? "সংরক্ষণ…" : "Saving…") : (isBn ? "সংরক্ষণ" : "Save")}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
