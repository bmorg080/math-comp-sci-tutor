import { createFileRoute, Link, useNavigate, redirect } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { toast } from "sonner";
import { z } from "zod";
import { supabase } from "@/integrations/supabase/client";
import { lovable } from "@/integrations/lovable/index";
import { ensureMyAccount } from "@/lib/account.functions";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Card } from "@/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";

export const Route = createFileRoute("/auth")({
  head: () => ({
    meta: [
      { title: "Sign In or Create Account | Brian Morgan Tutoring" },
      {
        name: "description",
        content:
          "Sign in or create a family account to buy lesson credits and book online math and computer science tutoring with Brian Morgan.",
      },
      { property: "og:title", content: "Sign In or Create Account | Brian Morgan Tutoring" },
      {
        property: "og:description",
        content:
          "Create a family account to buy lesson credits and book online math and computer science tutoring sessions.",
      },
      { property: "og:type", content: "website" },
      { property: "og:url", content: "https://brianmorgantutor.com/auth" },
      { name: "twitter:card", content: "summary" },
      { name: "robots", content: "noindex" },
    ],
    links: [{ rel: "canonical", href: "https://brianmorgantutor.com/auth" }],
  }),
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
            Brian Morgan Tutoring
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
              <GoogleButton label="Continue with Google" />
              <OrDivider />
              <SignInForm onDone={() => navigate({ to: search.redirect ?? "/dashboard" })} />
            </TabsContent>
            <TabsContent value="signup" className="pt-4">
              <GoogleButton label="Sign up with Google" />
              <OrDivider />
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

function OrDivider() {
  return (
    <div className="my-4 flex items-center gap-3">
      <span className="h-px flex-1 bg-border" />
      <span className="text-xs uppercase tracking-wide text-muted-foreground">or</span>
      <span className="h-px flex-1 bg-border" />
    </div>
  );
}

function GoogleButton({ label }: { label: string }) {
  const [busy, setBusy] = useState(false);

  async function onClick() {
    setBusy(true);
    try {
      const result = await lovable.auth.signInWithOAuth("google", {
        redirect_uri: window.location.origin,
      });
      if (result.error) {
        setBusy(false);
        return toast.error(result.error.message ?? "Google sign-in failed");
      }
      if (result.redirected) return;
      window.location.href = "/dashboard";
    } catch (err) {
      setBusy(false);
      toast.error(err instanceof Error ? err.message : "Google sign-in failed");
    }
  }

  return (
    <Button type="button" variant="outline" className="w-full" onClick={onClick} disabled={busy}>
      <svg className="mr-2 h-4 w-4" viewBox="0 0 24 24" aria-hidden="true">
        <path fill="#4285F4" d="M23.5 12.3c0-.8-.1-1.6-.2-2.3H12v4.5h6.5a5.6 5.6 0 0 1-2.4 3.7v3h3.9c2.3-2.1 3.5-5.2 3.5-8.9z" />
        <path fill="#34A853" d="M12 24c3.2 0 5.9-1.1 7.9-2.9l-3.9-3c-1.1.7-2.4 1.2-4 1.2-3.1 0-5.7-2.1-6.6-4.9H1.4v3.1A12 12 0 0 0 12 24z" />
        <path fill="#FBBC05" d="M5.4 14.4a7.2 7.2 0 0 1 0-4.6V6.7H1.4a12 12 0 0 0 0 10.8l4-3.1z" />
        <path fill="#EA4335" d="M12 4.8c1.8 0 3.3.6 4.5 1.8l3.4-3.4A12 12 0 0 0 1.4 6.7l4 3.1C6.3 6.9 8.9 4.8 12 4.8z" />
      </svg>
      {busy ? "Connecting…" : label}
    </Button>
  );
}


function SignInForm({ onDone }: { onDone: () => void }) {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [busy, setBusy] = useState(false);
  const [resetting, setResetting] = useState(false);

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    const { error } = await supabase.auth.signInWithPassword({ email, password });
    setBusy(false);
    if (error) return toast.error(error.message);
    toast.success("Welcome back!");
    onDone();
  }

  async function onForgotPassword() {
    if (!email.trim()) return toast.error("Enter your email first, then tap reset.");
    setResetting(true);
    const { error } = await supabase.auth.resetPasswordForEmail(email.trim(), {
      redirectTo: `${window.location.origin}/reset-password`,
    });
    setResetting(false);
    if (error) return toast.error(error.message);
    toast.success("Password reset link sent — check your email.");
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
      <button
        type="button"
        onClick={onForgotPassword}
        disabled={resetting}
        className="w-full text-center text-sm text-muted-foreground underline underline-offset-2 hover:text-foreground disabled:opacity-50"
      >
        {resetting ? "Sending reset link…" : "Forgot your password?"}
      </button>
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
