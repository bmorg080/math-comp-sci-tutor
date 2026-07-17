import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

async function assertAdmin(supabase: any, userId: string) {
  const { data } = await supabase.rpc("has_role", { _user_id: userId, _role: "admin" });
  if (!data) throw new Error("Forbidden: admin role required");
}

// Bootstrap: if no admin exists yet, promote the caller. Safe to call anytime.
export const bootstrapAdminIfNone = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { supabase, userId } = context;
    // Any admin?
    const { count } = await supabase
      .from("user_roles")
      .select("*", { count: "exact", head: true })
      .eq("role", "admin");
    if ((count ?? 0) > 0) return { promoted: false };

    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { error } = await supabaseAdmin
      .from("user_roles")
      .upsert({ user_id: userId, role: "admin" }, { onConflict: "user_id,role" });
    if (error) throw new Error(error.message);
    return { promoted: true };
  });

export const getAdminOverview = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { supabase, userId } = context;
    await assertAdmin(supabase, userId);

    const nowIso = new Date().toISOString();
    const [settingsRes, upcomingRes, recentRes, accountsRes, subjectsRes, creditsRes, lessonStatsRes] = await Promise.all([
      supabase
        .from("settings")
        .select("zoom_link, tutor_name, tutor_email, tutor_timezone, tutor_bio, cancellation_hours, credit_expiry_months, bundle_size, bundle_discount_pct, weekly_availability")
        .eq("id", 1)
        .maybeSingle(),
      supabase
        .from("lessons")
        .select("id, starts_at, status, credit_id, account_id, student_id, subject_id, student:students(id, name), subject:subjects(id, name), account:accounts(id, display_name)")
        .eq("status", "scheduled")
        .gte("starts_at", nowIso)
        .order("starts_at", { ascending: true })
        .limit(100),
      supabase
        .from("lessons")
        .select("id, starts_at, status, student:students(name), subject:subjects(name), account:accounts(display_name)")
        .lt("starts_at", nowIso)
        .order("starts_at", { ascending: false })
        .limit(50),
      supabase
        .from("accounts")
        .select("id, display_name, timezone, created_at")
        .order("created_at", { ascending: false }),
      supabase.from("subjects").select("id, name, price_cents, active, sort_order").order("sort_order"),
      supabase
        .from("credits")
        .select("account_id, consumed_lesson_id, refunded_at, expires_at")
        .is("consumed_lesson_id", null)
        .is("refunded_at", null)
        .gt("expires_at", nowIso),
      supabase.from("lessons").select("account_id, status"),
    ]);

    const creditBalance = new Map<string, number>();
    for (const c of creditsRes.data ?? []) {
      creditBalance.set(c.account_id, (creditBalance.get(c.account_id) ?? 0) + 1);
    }
    const lessonCounts = new Map<string, { upcoming: number; completed: number; cancelled: number }>();
    for (const l of lessonStatsRes.data ?? []) {
      const bucket = lessonCounts.get(l.account_id) ?? { upcoming: 0, completed: 0, cancelled: 0 };
      if (l.status === "scheduled") bucket.upcoming += 1;
      else if (l.status === "completed") bucket.completed += 1;
      else if (l.status === "cancelled") bucket.cancelled += 1;
      lessonCounts.set(l.account_id, bucket);
    }
    const accounts = (accountsRes.data ?? []).map((a) => ({
      ...a,
      credits: creditBalance.get(a.id) ?? 0,
      lessons: lessonCounts.get(a.id) ?? { upcoming: 0, completed: 0, cancelled: 0 },
    }));

    return {
      settings: settingsRes.data,
      upcoming: upcomingRes.data ?? [],
      recent: recentRes.data ?? [],
      accounts,
      subjects: subjectsRes.data ?? [],
    };
  });

export const updateSettings = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: {
    zoom_link?: string;
    tutor_name?: string;
    tutor_email?: string;
    tutor_bio?: string;
    cancellation_hours?: number;
  }) =>
    z
      .object({
        zoom_link: z.string().url().max(500).optional().or(z.literal("")),
        tutor_name: z.string().max(120).optional(),
        tutor_email: z.string().email().max(200).optional().or(z.literal("")),
        tutor_bio: z.string().max(4000).optional(),
        cancellation_hours: z.number().int().min(0).max(168).optional(),
      })
      .parse(input),
  )
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;
    await assertAdmin(supabase, userId);

    const patch: {
      zoom_link?: string;
      tutor_name?: string;
      tutor_email?: string;
      tutor_bio?: string;
      cancellation_hours?: number;
    } = {};
    if (data.zoom_link !== undefined) patch.zoom_link = data.zoom_link;
    if (data.tutor_name !== undefined) patch.tutor_name = data.tutor_name;
    if (data.tutor_email !== undefined) patch.tutor_email = data.tutor_email;
    if (data.tutor_bio !== undefined) patch.tutor_bio = data.tutor_bio;
    if (data.cancellation_hours !== undefined) patch.cancellation_hours = data.cancellation_hours;

    const { error } = await supabase.from("settings").update(patch).eq("id", 1);
    if (error) throw new Error(error.message);
    return { ok: true };
  });

export const grantCredits = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: { accountId: string; quantity: number; note?: string }) =>
    z
      .object({
        accountId: z.string().uuid(),
        quantity: z.number().int().min(1).max(50),
        note: z.string().max(200).optional(),
      })
      .parse(input),
  )
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;
    await assertAdmin(supabase, userId);

    const { data: settings } = await supabase
      .from("settings")
      .select("credit_expiry_months")
      .eq("id", 1)
      .maybeSingle();
    const months = settings?.credit_expiry_months ?? 9;
    const expiresAt = new Date();
    expiresAt.setMonth(expiresAt.getMonth() + months);

    const rows = Array.from({ length: data.quantity }, () => ({
      account_id: data.accountId,
      source: "admin_grant" as const,
      expires_at: expiresAt.toISOString(),
      note: data.note ?? null,
    }));

    const { error } = await supabase.from("credits").insert(rows);
    if (error) throw new Error(error.message);
    return { ok: true, inserted: rows.length };
  });

export const cancelLessonAsAdmin = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: { lessonId: string; reason?: string; refund?: boolean }) =>
    z
      .object({
        lessonId: z.string().uuid(),
        reason: z.string().max(500).optional(),
        refund: z.boolean().default(true),
      })
      .parse(input),
  )
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;
    await assertAdmin(supabase, userId);

    const { data: lesson } = await supabase
      .from("lessons")
      .select("id, credit_id, status")
      .eq("id", data.lessonId)
      .maybeSingle();
    if (!lesson) throw new Error("Lesson not found");
    if (lesson.status !== "scheduled") throw new Error("Lesson is not scheduled");

    const { error } = await supabase
      .from("lessons")
      .update({
        status: "cancelled",
        cancelled_at: new Date().toISOString(),
        cancelled_by: userId,
        cancellation_reason: data.reason ?? "Cancelled by tutor",
      })
      .eq("id", lesson.id);
    if (error) throw new Error(error.message);

    if (data.refund && lesson.credit_id) {
      await supabase.from("credits").update({ consumed_lesson_id: null }).eq("id", lesson.credit_id);
    }
    return { ok: true };
  });

export const rescheduleLessonAsAdmin = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: { lessonId: string; startsAt: string }) =>
    z
      .object({
        lessonId: z.string().uuid(),
        startsAt: z.string().datetime(),
      })
      .parse(input),
  )
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;
    await assertAdmin(supabase, userId);

    const { data: lesson } = await supabase
      .from("lessons")
      .select("id, status, starts_at, duration_minutes")
      .eq("id", data.lessonId)
      .maybeSingle();
    if (!lesson) throw new Error("Lesson not found");
    if (lesson.status !== "scheduled") throw new Error("Only scheduled lessons can be rescheduled");

    const newStart = new Date(data.startsAt);
    if (isNaN(newStart.getTime())) throw new Error("Invalid start time");
    if (newStart.getTime() < Date.now()) throw new Error("New time must be in the future");

    // Check conflict (unique index on scheduled starts_at will also block, but give a nicer error)
    const { data: conflict } = await supabase
      .from("lessons")
      .select("id")
      .eq("status", "scheduled")
      .eq("starts_at", newStart.toISOString())
      .neq("id", lesson.id)
      .maybeSingle();
    if (conflict) throw new Error("Another scheduled lesson already occupies that time");

    const { error } = await supabase
      .from("lessons")
      .update({ starts_at: newStart.toISOString(), reminder_sent_at: null })
      .eq("id", lesson.id);
    if (error) throw new Error(error.message);
    return { ok: true };
  });
