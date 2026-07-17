import { createFileRoute, Link, useNavigate, redirect } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { toast } from "sonner";
import { z } from "zod";
import { supabase } from "@/integrations/supabase/client";
import { ensureMyAccount } from "@/lib/account.functions";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Card } from "@/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";

export const Route = createFileRoute("/auth")({
  validateSearch: (search: Record<string, unknown>) => ({
    redirect: typeof search.redirect === "string" ? search.redirect : undefined,
  }),
  component: AuthPage,
});

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

const signUpSchema = z.object({
  parentName: z.string().trim().min(1, "Required").max(120),
  email: z.string().trim().email().max(255),
  password: z.string().min(8, "At least 8 characters").max(72),
  timezone: z.string().min(1),
  studentName: z.string().trim().max(120).optional(),
});

function guessTz() {
  try {
    return Intl.DateTimeFormat().resolvedOptions().timeZone || "America/New_York";
  } catch {
    return "America/New_York";
  }
}

function AuthPage() {
  const search = Route.useSearch();
  const navigate = useNavigate();
  const [tab, setTab] = useState<"signin" | "signup">("signin");

  // Bounce signed-in users through
  useEffect(() => {
    supabase.auth.getSession().then(({ data }) => {
      if (data.session) navigate({ to: search.redirect ?? "/dashboard" });
    });
  }, [navigate, search.redirect]);

  return (
    <div className="min-h-screen bg-background">
      <header className="border-b bg-surface">
        <div className="mx-auto max-w-5xl px-6 py-4">
          <Link to="/" className="font-display text-xl font-semibold text-primary">
            Tutoring
          </Link>
        </div>
      </header>
      <main className="mx-auto flex max-w-md flex-col px-6 py-12">
        <Card className="p-6 shadow-soft">
          <Tabs value={tab} onValueChange={(v) => setTab(v as "signin" | "signup")}>
            <TabsList className="grid w-full grid-cols-2">
              <TabsTrigger value="signin">Sign in</TabsTrigger>
              <TabsTrigger value="signup">Create account</TabsTrigger>
            </TabsList>
            <TabsContent value="signin" className="pt-4">
              <SignInForm onDone={() => navigate({ to: search.redirect ?? "/dashboard" })} />
            </TabsContent>
            <TabsContent value="signup" className="pt-4">
              <SignUpForm onDone={() => navigate({ to: "/dashboard" })} />
            </TabsContent>
          </Tabs>
        </Card>
        <p className="mt-6 text-center text-sm text-muted-foreground">
          One account per family. Parents sign up; you can add student info later.
        </p>
      </main>
    </div>
  );
}

function SignInForm({ onDone }: { onDone: () => void }) {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [busy, setBusy] = useState(false);

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    const { error } = await supabase.auth.signInWithPassword({ email, password });
    setBusy(false);
    if (error) return toast.error(error.message);
    toast.success("Welcome back!");
    onDone();
  }

  return (
    <form onSubmit={onSubmit} className="space-y-4">
      <div className="space-y-2">
        <Label htmlFor="signin-email">Email</Label>
        <Input id="signin-email" type="email" required value={email} onChange={(e) => setEmail(e.target.value)} autoComplete="email" />
      </div>
      <div className="space-y-2">
        <Label htmlFor="signin-password">Password</Label>
        <Input id="signin-password" type="password" required value={password} onChange={(e) => setPassword(e.target.value)} autoComplete="current-password" />
      </div>
      <Button type="submit" className="w-full" disabled={busy}>
        {busy ? "Signing in…" : "Sign in"}
      </Button>
    </form>
  );
}

function SignUpForm({ onDone }: { onDone: () => void }) {
  const [form, setForm] = useState({
    parentName: "",
    email: "",
    password: "",
    timezone: guessTz(),
    studentName: "",
  });
  const [busy, setBusy] = useState(false);

  function set<K extends keyof typeof form>(k: K, v: (typeof form)[K]) {
    setForm((f) => ({ ...f, [k]: v }));
  }

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    const parsed = signUpSchema.safeParse(form);
    if (!parsed.success) {
      return toast.error(parsed.error.issues[0]?.message ?? "Please check the form");
    }
    setBusy(true);
    const { error } = await supabase.auth.signUp({
      email: parsed.data.email,
      password: parsed.data.password,
      options: {
        emailRedirectTo: `${window.location.origin}/dashboard`,
        data: { parent_name: parsed.data.parentName, timezone: parsed.data.timezone },
      },
    });
    if (error) {
      setBusy(false);
      return toast.error(error.message);
    }
    // If session was created immediately (auto-confirm), provision the account.
    const { data: sessionData } = await supabase.auth.getSession();
    if (sessionData.session) {
      try {
        await ensureMyAccount({
          data: {
            displayName: parsed.data.parentName,
            timezone: parsed.data.timezone,
            studentName: parsed.data.studentName || undefined,
          },
        });
        toast.success("Account created!");
        onDone();
      } catch (err) {
        toast.error(err instanceof Error ? err.message : "Setup failed");
      } finally {
        setBusy(false);
      }
    } else {
      setBusy(false);
      toast.success("Check your email to confirm your account.");
    }
  }

  return (
    <form onSubmit={onSubmit} className="space-y-4">
      <div className="space-y-2">
        <Label htmlFor="parent-name">Parent name</Label>
        <Input id="parent-name" required value={form.parentName} onChange={(e) => set("parentName", e.target.value)} />
      </div>
      <div className="space-y-2">
        <Label htmlFor="signup-email">Parent email</Label>
        <Input id="signup-email" type="email" required value={form.email} onChange={(e) => set("email", e.target.value)} autoComplete="email" />
      </div>
      <div className="space-y-2">
        <Label htmlFor="signup-password">Password</Label>
        <Input id="signup-password" type="password" required minLength={8} value={form.password} onChange={(e) => set("password", e.target.value)} autoComplete="new-password" />
      </div>
      <div className="space-y-2">
        <Label htmlFor="signup-tz">Timezone</Label>
        <Select value={form.timezone} onValueChange={(v) => set("timezone", v)}>
          <SelectTrigger id="signup-tz"><SelectValue /></SelectTrigger>
          <SelectContent>
            {TIMEZONES.map((tz) => (
              <SelectItem key={tz} value={tz}>{tz.replace("_", " ")}</SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>
      <div className="space-y-2">
        <Label htmlFor="student-name">Student name (optional)</Label>
        <Input id="student-name" value={form.studentName} onChange={(e) => set("studentName", e.target.value)} placeholder="You can add more later" />
      </div>
      <Button type="submit" className="w-full" disabled={busy}>
        {busy ? "Creating account…" : "Create account"}
      </Button>
    </form>
  );
}
