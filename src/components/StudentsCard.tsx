import { useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { addStudent, updateStudent } from "@/lib/students.functions";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { GraduationCap, Mail, Pencil, Plus } from "lucide-react";

interface Student {
  id: string;
  name: string;
  email?: string | null;
  grade_level?: string | null;
}

export function StudentsCard({ students }: { students: Student[] }) {
  const qc = useQueryClient();
  const addFn = useServerFn(addStudent);
  const updateFn = useServerFn(updateStudent);
  const [editing, setEditing] = useState<Student | null>(null);
  const [adding, setAdding] = useState(false);
  const [saving, setSaving] = useState(false);
  const [form, setForm] = useState({ name: "", email: "", gradeLevel: "" });

  function openEdit(s: Student) {
    setForm({ name: s.name, email: s.email ?? "", gradeLevel: s.grade_level ?? "" });
    setEditing(s);
  }
  function openAdd() {
    setForm({ name: "", email: "", gradeLevel: "" });
    setAdding(true);
  }
  function close() {
    setEditing(null);
    setAdding(false);
  }

  async function submit() {
    if (!form.name.trim()) {
      toast.error("Name is required");
      return;
    }
    if (form.email.trim() && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(form.email.trim())) {
      toast.error("Please enter a valid email address");
      return;
    }
    setSaving(true);
    try {
      if (editing) {
        await updateFn({
          data: {
            id: editing.id,
            name: form.name.trim(),
            email: form.email.trim(),
            gradeLevel: form.gradeLevel.trim() || undefined,
          },
        });
        toast.success("Student updated");
      } else {
        await addFn({
          data: {
            name: form.name.trim(),
            email: form.email.trim(),
            gradeLevel: form.gradeLevel.trim() || undefined,
          },
        });
        toast.success("Student added");
      }
      qc.invalidateQueries({ queryKey: ["account-overview"] });
      close();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Failed");
    } finally {
      setSaving(false);
    }
  }

  const open = editing !== null || adding;

  return (
    <>
      <Card>
        <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-3">
          <CardTitle className="flex items-center gap-2 text-base">
            <GraduationCap className="h-4 w-4" /> Students
          </CardTitle>
          <Button size="sm" variant="outline" onClick={openAdd}>
            <Plus className="h-4 w-4" /> Add student
          </Button>
        </CardHeader>
        <CardContent>
          {students.length === 0 ? (
            <p className="text-sm text-muted-foreground">
              No students yet. Add one so you can book lessons.
            </p>
          ) : (
            <ul className="divide-y">
              {students.map((s) => (
                <li key={s.id} className="flex items-center justify-between py-3">
                  <div className="min-w-0">
                    <p className="font-medium">{s.name}</p>
                    <p className="mt-0.5 flex items-center gap-1.5 text-xs text-muted-foreground">
                      <Mail className="h-3 w-3" />
                      {s.email ? (
                        <span className="truncate">{s.email}</span>
                      ) : (
                        <span className="italic">No student email — Zoom links go to you only</span>
                      )}
                    </p>
                  </div>
                  <Button size="sm" variant="ghost" onClick={() => openEdit(s)}>
                    <Pencil className="h-4 w-4" /> Edit
                  </Button>
                </li>
              ))}
            </ul>
          )}
        </CardContent>
      </Card>

      <Dialog open={open} onOpenChange={(o) => (!o ? close() : null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{editing ? "Edit student" : "Add student"}</DialogTitle>
            <DialogDescription>
              Adding an email sends every lesson email — confirmation, reminder, cancellation,
              reschedule — to your student too, along with the Zoom link.
            </DialogDescription>
          </DialogHeader>
          <div className="grid gap-3">
            <div className="grid gap-1.5">
              <Label htmlFor="student-name">Name</Label>
              <Input
                id="student-name"
                value={form.name}
                onChange={(e) => setForm({ ...form, name: e.target.value })}
                maxLength={120}
              />
            </div>
            <div className="grid gap-1.5">
              <Label htmlFor="student-email">Student email (optional)</Label>
              <Input
                id="student-email"
                type="email"
                placeholder="student@example.com"
                value={form.email}
                onChange={(e) => setForm({ ...form, email: e.target.value })}
                maxLength={255}
              />
            </div>
            <div className="grid gap-1.5">
              <Label htmlFor="student-grade">Grade level (optional)</Label>
              <Input
                id="student-grade"
                value={form.gradeLevel}
                onChange={(e) => setForm({ ...form, gradeLevel: e.target.value })}
                maxLength={40}
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="ghost" onClick={close} disabled={saving}>
              Cancel
            </Button>
            <Button onClick={submit} disabled={saving}>
              {saving ? "Saving…" : editing ? "Save changes" : "Add student"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
