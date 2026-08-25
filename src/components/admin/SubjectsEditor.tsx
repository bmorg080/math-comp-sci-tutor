import { useEffect, useState } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { toast } from "sonner";
import { createSubject, deleteSubject, updateSubject } from "@/lib/admin.functions";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Switch } from "@/components/ui/switch";
import { BookOpen, Plus, Save, Trash2 } from "lucide-react";

interface Subject {
  id: string;
  name: string;
  price_cents: number;
  active: boolean;
  sort_order: number;
  is_trial: boolean;
}

export function SubjectsEditor({ subjects }: { subjects: Subject[] }) {
  const qc = useQueryClient();
  const doUpdate = useServerFn(updateSubject);
  const doCreate = useServerFn(createSubject);
  const doDelete = useServerFn(deleteSubject);
  const [rows, setRows] = useState<Subject[]>(subjects);
  const [dirty, setDirty] = useState<Record<string, boolean>>({});
  const [newName, setNewName] = useState("");
  const [newPrice, setNewPrice] = useState("65");

  useEffect(() => {
    setRows(subjects);
    setDirty({});
  }, [subjects]);

  function invalidate() {
    qc.invalidateQueries({ queryKey: ["admin-overview"] });
    qc.invalidateQueries({ queryKey: ["public-data"] });
    qc.invalidateQueries({ queryKey: ["public-home"] });
    qc.invalidateQueries({ queryKey: ["account-overview"] });
  }

  const saveMut = useMutation({
    mutationFn: async (subject: Subject) =>
      doUpdate({
        data: {
          id: subject.id,
          name: subject.name,
          price_cents: subject.price_cents,
          active: subject.active,
          sort_order: subject.sort_order,
          is_trial: subject.is_trial,
        },
      }),
    onSuccess: (_r, subject) => {
      toast.success(`Saved "${subject.name}"`);
      setDirty((d) => ({ ...d, [subject.id]: false }));
      invalidate();
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const createMut = useMutation({
    mutationFn: async () => {
      const cents = Math.round(Number(newPrice || "0") * 100);
      if (!newName.trim()) throw new Error("Enter a subject name");
      if (cents <= 0) throw new Error("Enter a positive price");
      return doCreate({ data: { name: newName.trim(), price_cents: cents } });
    },
    onSuccess: () => {
      toast.success(`Added "${newName}"`);
      setNewName("");
      setNewPrice("65");
      invalidate();
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const deleteMut = useMutation({
    mutationFn: async (subject: Subject) => {
      if (!confirm(`Remove "${subject.name}"?`)) throw new Error("cancelled");
      return doDelete({ data: { id: subject.id } });
    },
    onSuccess: (res, subject) => {
      toast.success(res.softDeleted ? `"${subject.name}" archived (has past lessons)` : `Removed "${subject.name}"`);
      invalidate();
    },
    onError: (e: Error) => {
      if (e.message !== "cancelled") toast.error(e.message);
    },
  });

  function patch(id: string, next: Partial<Subject>) {
    setRows((rs) => rs.map((r) => (r.id === id ? { ...r, ...next } : r)));
    setDirty((d) => ({ ...d, [id]: true }));
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <BookOpen className="h-4 w-4 text-primary" /> Subjects & pricing
        </CardTitle>
        <CardDescription>
          Set the single-lesson price for each subject. Inactive subjects are hidden from customers.
        </CardDescription>
      </CardHeader>
      <CardContent>
        <div className="overflow-hidden rounded-md border border-border/50">
          <table className="w-full text-sm">
            <thead className="bg-muted/40 text-left text-xs uppercase tracking-wide text-muted-foreground">
              <tr>
                <th className="px-3 py-2">Subject</th>
                <th className="px-3 py-2">Price (USD)</th>
                <th className="px-3 py-2 text-center">Sort</th>
                <th className="px-3 py-2 text-center">Trial</th>
                <th className="px-3 py-2 text-center">Active</th>
                <th className="px-3 py-2" />
              </tr>
            </thead>
            <tbody className="divide-y divide-border/50">
              {rows.map((r) => {
                const isDirty = dirty[r.id];
                return (
                  <tr key={r.id} className="align-middle">
                    <td className="px-3 py-2">
                      <Input
                        value={r.name}
                        onChange={(e) => patch(r.id, { name: e.target.value })}
                        maxLength={120}
                      />
                    </td>
                    <td className="px-3 py-2">
                      <Input
                        type="number"
                        min={0}
                        step="0.01"
                        className="w-28"
                        value={(r.price_cents / 100).toFixed(2)}
                        onChange={(e) =>
                          patch(r.id, {
                            price_cents: Math.round(Number(e.target.value || 0) * 100),
                          })
                        }
                      />
                    </td>
                    <td className="px-3 py-2 text-center">
                      <Input
                        type="number"
                        min={0}
                        className="mx-auto w-16 text-center"
                        value={r.sort_order}
                        onChange={(e) => patch(r.id, { sort_order: Number(e.target.value || 0) })}
                      />
                    </td>
                    <td className="px-3 py-2 text-center">
                      <div className="flex justify-center">
                        <Switch
                          checked={r.is_trial}
                          onCheckedChange={(v) => patch(r.id, { is_trial: v })}
                        />
                      </div>
                    </td>
                    <td className="px-3 py-2 text-center">
                      <div className="flex justify-center">
                        <Switch
                          checked={r.active}
                          onCheckedChange={(v) => patch(r.id, { active: v })}
                        />
                      </div>
                    </td>
                    <td className="px-3 py-2 text-right">
                      <div className="flex justify-end gap-1">
                        <Button
                          size="sm"
                          variant={isDirty ? "default" : "ghost"}
                          disabled={!isDirty || saveMut.isPending}
                          onClick={() => saveMut.mutate(r)}
                        >
                          <Save className="mr-1 h-4 w-4" />
                          {isDirty ? "Save" : "Saved"}
                        </Button>
                        <Button
                          size="sm"
                          variant="ghost"
                          disabled={deleteMut.isPending}
                          onClick={() => deleteMut.mutate(r)}
                          title="Remove subject"
                        >
                          <Trash2 className="h-4 w-4 text-destructive" />
                        </Button>
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>

        <div className="mt-6 rounded-md border border-dashed border-border/60 p-4">
          <p className="mb-3 text-sm font-medium">Add a new subject</p>
          <div className="grid gap-3 sm:grid-cols-[1fr_120px_auto_auto]">
            <Input
              placeholder="Subject name (e.g. AP Calculus BC)"
              value={newName}
              onChange={(e) => setNewName(e.target.value)}
              maxLength={120}
            />
            <Input
              type="number"
              min={0}
              step="0.01"
              placeholder="Price"
              value={newPrice}
              onChange={(e) => setNewPrice(e.target.value)}
            />
            <label className="flex items-center gap-2 text-sm text-muted-foreground">
              <Switch checked={newIsTrial} onCheckedChange={setNewIsTrial} />
              <Sparkles className="h-3.5 w-3.5" /> Trial
            </label>
            <Button onClick={() => createMut.mutate()} disabled={createMut.isPending}>
              <Plus className="mr-1 h-4 w-4" /> Add
            </Button>
          </div>
          <p className="mt-2 text-xs text-muted-foreground">
            A matching Stripe product and single-lesson price are created automatically. Non-trial subjects also get a 5-pack price.
          </p>
        </div>

        <p className="mt-3 text-xs text-muted-foreground">
          Price changes apply to new purchases going forward. Existing credits keep their original value.
          Subjects with past lessons are archived (kept for history) rather than deleted.
        </p>
      </CardContent>
    </Card>
  );
}
