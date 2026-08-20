import { useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { updateMyAccount } from "@/lib/account.functions";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

const TIMEZONES = [
  "America/New_York",
  "America/Chicago",
  "America/Denver",
  "America/Phoenix",
  "America/Los_Angeles",
  "America/Anchorage",
  "Pacific/Honolulu",
  "Europe/London",
  "Europe/Paris",
];

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  displayName: string;
  timezone: string;
}

export function AccountSettingsDialog({ open, onOpenChange, displayName, timezone }: Props) {
  const qc = useQueryClient();
  const save = useServerFn(updateMyAccount);
  const [name, setName] = useState(displayName);
  const [tz, setTz] = useState(timezone);
  const [busy, setBusy] = useState(false);

  const options = TIMEZONES.includes(tz) ? TIMEZONES : [tz, ...TIMEZONES];

  async function submit() {
    if (!name.trim()) return toast.error("Name is required");
    setBusy(true);
    try {
      await save({ data: { displayName: name.trim(), timezone: tz } });
      qc.invalidateQueries({ queryKey: ["account-overview"] });
      toast.success("Account updated");
      onOpenChange(false);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Failed to save");
    } finally {
      setBusy(false);
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Account settings</DialogTitle>
          <DialogDescription>
            Your name appears on lesson emails, and all lesson times are shown in your timezone.
          </DialogDescription>
        </DialogHeader>
        <div className="grid gap-3">
          <div className="grid gap-1.5">
            <Label htmlFor="account-name">Family / parent name</Label>
            <Input
              id="account-name"
              value={name}
              maxLength={120}
              onChange={(e) => setName(e.target.value)}
            />
          </div>
          <div className="grid gap-1.5">
            <Label htmlFor="account-tz">Timezone</Label>
            <Select value={tz} onValueChange={setTz}>
              <SelectTrigger id="account-tz">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {options.map((z) => (
                  <SelectItem key={z} value={z}>
                    {z.replace("_", " ")}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <p className="text-xs text-muted-foreground">
            To change your sign-in email or password, sign out and use “Forgot your password?” on
            the sign-in page.
          </p>
        </div>
        <DialogFooter>
          <Button variant="ghost" onClick={() => onOpenChange(false)} disabled={busy}>
            Cancel
          </Button>
          <Button onClick={submit} disabled={busy}>
            {busy ? "Saving…" : "Save changes"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
