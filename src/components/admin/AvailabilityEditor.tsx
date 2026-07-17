import { useEffect, useState } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { toast } from "sonner";
import { updateAvailability } from "@/lib/admin.functions";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { CalendarDays, Plus, Save, Trash2 } from "lucide-react";

type Range = { start: string; end: string };
type Availability = Record<string, Range[]>;

const DAYS = [
  { key: "0", label: "Sunday" },
  { key: "1", label: "Monday" },
  { key: "2", label: "Tuesday" },
  { key: "3", label: "Wednesday" },
  { key: "4", label: "Thursday" },
  { key: "5", label: "Friday" },
  { key: "6", label: "Saturday" },
];

export function AvailabilityEditor({
  weeklyAvailability,
  tutorTimezone,
}: {
  weeklyAvailability: unknown;
  tutorTimezone: string | null | undefined;
}) {
  const qc = useQueryClient();
  const doUpdate = useServerFn(updateAvailability);
  const [avail, setAvail] = useState<Availability>({});

  useEffect(() => {
    const seed: Availability = {};
    for (const d of DAYS) seed[d.key] = [];
    const raw = weeklyAvailability;
    if (Array.isArray(raw)) {
      // Legacy shape: [{ day: 0-6, start, end }, ...]
      for (const item of raw as Array<{ day: number | string; start: string; end: string }>) {
        const key = String(item?.day);
        if (seed[key]) seed[key].push({ start: item.start, end: item.end });
      }
    } else if (raw && typeof raw === "object") {
      const obj = raw as Record<string, unknown>;
      for (const d of DAYS) {
        const v = obj[d.key];
        if (Array.isArray(v)) {
          seed[d.key] = v.filter(
            (r): r is Range =>
              !!r && typeof r === "object" &&
              typeof (r as Range).start === "string" &&
              typeof (r as Range).end === "string",
          );
        }
      }
    }
    setAvail(seed);
  }, [weeklyAvailability]);

  const saveMut = useMutation({
    mutationFn: () => doUpdate({ data: { weekly_availability: avail } }),
    onSuccess: () => {
      toast.success("Availability saved.");
      qc.invalidateQueries({ queryKey: ["admin-overview"] });
      qc.invalidateQueries({ queryKey: ["public-data"] });
    },
    onError: (e: Error) => toast.error(e.message),
  });

  function updateRange(day: string, idx: number, next: Partial<Range>) {
    setAvail((a) => ({
      ...a,
      [day]: a[day].map((r, i) => (i === idx ? { ...r, ...next } : r)),
    }));
  }

  function addRange(day: string) {
    setAvail((a) => ({
      ...a,
      [day]: [...(a[day] ?? []), { start: "16:00", end: "20:00" }],
    }));
  }

  function removeRange(day: string, idx: number) {
    setAvail((a) => ({
      ...a,
      [day]: a[day].filter((_, i) => i !== idx),
    }));
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <CalendarDays className="h-4 w-4 text-primary" /> Weekly availability
        </CardTitle>
        <CardDescription>
          Recurring windows when students can book. Times are in your tutor timezone
          ({tutorTimezone ?? "UTC"}). Add multiple ranges per day for split shifts.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-3">
        {DAYS.map((d) => (
          <div key={d.key} className="grid gap-2 md:grid-cols-[8rem_1fr] md:items-start">
            <div className="pt-2 text-sm font-medium">{d.label}</div>
            <div className="space-y-2">
              {(avail[d.key] ?? []).length === 0 ? (
                <p className="text-xs text-muted-foreground">Closed</p>
              ) : (
                (avail[d.key] ?? []).map((r, idx) => (
                  <div key={idx} className="flex items-center gap-2">
                    <Input
                      type="time"
                      className="w-32"
                      value={r.start}
                      onChange={(e) => updateRange(d.key, idx, { start: e.target.value })}
                    />
                    <span className="text-xs text-muted-foreground">to</span>
                    <Input
                      type="time"
                      className="w-32"
                      value={r.end}
                      onChange={(e) => updateRange(d.key, idx, { end: e.target.value })}
                    />
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => removeRange(d.key, idx)}
                      aria-label="Remove range"
                    >
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  </div>
                ))
              )}
              <Button variant="outline" size="sm" onClick={() => addRange(d.key)}>
                <Plus className="mr-1 h-4 w-4" /> Add range
              </Button>
            </div>
          </div>
        ))}
        <div className="flex justify-end pt-2">
          <Button onClick={() => saveMut.mutate()} disabled={saveMut.isPending}>
            <Save className="mr-1.5 h-4 w-4" />
            {saveMut.isPending ? "Saving…" : "Save availability"}
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}
