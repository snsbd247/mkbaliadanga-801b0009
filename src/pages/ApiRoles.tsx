import { useEffect, useState } from "react";
import { ApiShell } from "@/components/api/ApiShell";
import { useRoles, usePermissions, useSyncRolePermissions } from "@/hooks/useAdminApi";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { toast } from "sonner";

export default function ApiRoles() {
  const { data: roles } = useRoles();
  const { data: perms } = usePermissions();
  const sync = useSyncRolePermissions();
  const [active, setActive] = useState<string>("");
  const [selected, setSelected] = useState<Record<string, Set<string>>>({});

  useEffect(() => {
    if (roles?.length && !active) setActive(roles[0].id);
  }, [roles, active]);

  const grouped: Record<string, typeof perms> = {};
  perms?.forEach(p => {
    const k = p.module || "general";
    (grouped[k] ||= []).push(p);
  });

  const togglePerm = (roleId: string, permId: string) => {
    setSelected(s => {
      const set = new Set(s[roleId] ?? []);
      set.has(permId) ? set.delete(permId) : set.add(permId);
      return { ...s, [roleId]: set };
    });
  };

  const save = async (roleId: string) => {
    try {
      await sync.mutateAsync({ id: roleId, permission_ids: Array.from(selected[roleId] ?? []) });
      toast.success("Permissions saved");
    } catch (e: any) { toast.error(e.message); }
  };

  return (
    <ApiShell>
      <div className="container mx-auto p-4 space-y-4">
        <Card>
          <CardHeader><CardTitle>Roles &amp; Permissions</CardTitle></CardHeader>
          <CardContent>
            <Tabs value={active} onValueChange={setActive}>
              <TabsList className="flex-wrap h-auto">
                {roles?.map(r => <TabsTrigger key={r.id} value={r.id}>{r.name}</TabsTrigger>)}
              </TabsList>
              {roles?.map(r => (
                <TabsContent key={r.id} value={r.id} className="space-y-4">
                  <div className="flex justify-end">
                    <Button onClick={() => save(r.id)} disabled={sync.isPending}>Save</Button>
                  </div>
                  {Object.entries(grouped).map(([mod, ps]) => (
                    <div key={mod}>
                      <h3 className="font-semibold capitalize mb-2">{mod}</h3>
                      <div className="grid grid-cols-2 md:grid-cols-3 gap-2">
                        {ps?.map(p => (
                          <label key={p.id} className="flex items-center gap-2 text-sm">
                            <Checkbox
                              checked={selected[r.id]?.has(p.id) ?? false}
                              onCheckedChange={() => togglePerm(r.id, p.id)}
                            />
                            <span className="text-xs">{p.key}</span>
                          </label>
                        ))}
                      </div>
                    </div>
                  ))}
                </TabsContent>
              ))}
            </Tabs>
          </CardContent>
        </Card>
      </div>
    </ApiShell>
  );
}
