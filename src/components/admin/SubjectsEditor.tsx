import { useEffect, useState } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { toast } from "sonner";
import { updateSubject } from "@/lib/admin.functions";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { BookOpen, Save } from "lucide-react";

interface Subject {
  id: string;
  name: string;
  price_cents: number;
  active: boolean;
  sort_order: number;
}

export function SubjectsEditor({ subjects }: { subjects: Subject[] }) {
  const qc = useQueryClient();
  const doUpdate = useServerFn(updateSubject);
  const [rows, setRows] = useState<Subject[]>(subjects);
  const [dirty, setDirty] = useState<Record<string, boolean>>({});

  useEffect(() => {
    setRows(subjects);
    setDirty({});
  }, [subjects]);

  const saveMut = useMutation({
    mutationFn: async (subject: Subject) =>
      doUpdate({
        data: {
          id: subject.id,
          name: subject.name,
          price_cents: subject.price_cents,
          active: subject.active,
          sort_order: subject.sort_order,
        },
      }),
    onSuccess: (_r, subject) => {
      toast.success(`Saved "${subject.name}"`);
      setDirty((d) => ({ ...d, [subject.id]: false }));
      qc.invalidateQueries({ queryKey: ["admin-overview"] });
      qc.invalidateQueries({ queryKey: ["public-data"] });
    },
    onError: (e: Error) => toast.error(e.message),
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
          Note: package (5-pack) prices are managed in Stripe.
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
                          checked={r.active}
                          onCheckedChange={(v) => patch(r.id, { active: v })}
                        />
                      </div>
                    </td>
                    <td className="px-3 py-2 text-right">
                      <Button
                        size="sm"
                        variant={isDirty ? "default" : "ghost"}
                        disabled={!isDirty || saveMut.isPending}
                        onClick={() => saveMut.mutate(r)}
                      >
                        <Save className="mr-1 h-4 w-4" />
                        {isDirty ? "Save" : "Saved"}
                      </Button>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
        <p className="mt-3 text-xs text-muted-foreground">
          Price changes apply to new purchases going forward. Existing credits keep their original value.
        </p>
      </CardContent>
    </Card>
  );
}
