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
      supabase.from("subjects").select("id, name, price_cents, active, sort_order, is_trial").order("sort_order"),
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
    tutor_timezone?: string;
    cancellation_hours?: number;
    credit_expiry_months?: number;
  }) =>
    z
      .object({
        zoom_link: z.string().url().max(500).optional().or(z.literal("")),
        tutor_name: z.string().max(120).optional(),
        tutor_email: z.string().email().max(200).optional().or(z.literal("")),
        tutor_bio: z.string().max(4000).optional(),
        tutor_timezone: z.string().min(1).max(80).optional(),
        cancellation_hours: z.number().int().min(0).max(168).optional(),
        credit_expiry_months: z.number().int().min(1).max(60).optional(),
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
      tutor_timezone?: string;
      cancellation_hours?: number;
      credit_expiry_months?: number;
    } = {};
    if (data.zoom_link !== undefined) patch.zoom_link = data.zoom_link;
    if (data.tutor_name !== undefined) patch.tutor_name = data.tutor_name;
    if (data.tutor_email !== undefined) patch.tutor_email = data.tutor_email;
    if (data.tutor_bio !== undefined) patch.tutor_bio = data.tutor_bio;
    if (data.tutor_timezone !== undefined) patch.tutor_timezone = data.tutor_timezone;
    if (data.cancellation_hours !== undefined) patch.cancellation_hours = data.cancellation_hours;
    if (data.credit_expiry_months !== undefined) patch.credit_expiry_months = data.credit_expiry_months;

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
      .select("id, credit_id, status, starts_at, google_event_id")
      .eq("id", data.lessonId)
      .maybeSingle();
    if (!lesson) throw new Error("Lesson not found");
    if (lesson.status !== "scheduled") throw new Error("Lesson is not scheduled");

    const hoursUntil = (new Date(lesson.starts_at).getTime() - Date.now()) / (1000 * 60 * 60);

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

    let googleCancelled = false;
    if (lesson.google_event_id) {
      try {
        const { deleteCalendarEvent } = await import("@/lib/calendar.server");
        googleCancelled = await deleteCalendarEvent(lesson.google_event_id);
      } catch (e) {
        console.error("[cancelLessonAsAdmin] calendar delete error:", e);
      }
    }

    if (!googleCancelled) {
      try {
        const { sendLessonUpdateEmails } = await import("@/lib/lesson-emails.server");
        await sendLessonUpdateEmails({
          supabaseAdmin: supabase as any,
          lessonId: lesson.id,
          kind: "cancelled",
          startsAtISO: lesson.starts_at,
          refunded: !!data.refund,
          lateCancel: hoursUntil < 24,
          reason: data.reason,
        });
      } catch (e) {
        console.error("[cancelLessonAsAdmin] email dispatch error:", e);
      }
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
      .select("id, status, starts_at, duration_minutes, google_event_id")
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

    const previousStartsAtISO = lesson.starts_at;
    const { error } = await supabase
      .from("lessons")
      .update({ starts_at: newStart.toISOString(), reminder_sent_at: null })
      .eq("id", lesson.id);
    if (error) throw new Error(error.message);

    let googleUpdated = false;
    if (lesson.google_event_id) {
      try {
        const { updateCalendarEvent, loadLessonForCalendar } = await import(
          "@/lib/calendar.server"
        );
        const payload = await loadLessonForCalendar(supabase as any, lesson.id);
        if (payload) {
          googleUpdated = await updateCalendarEvent(lesson.google_event_id, payload);
        }
      } catch (e) {
        console.error("[rescheduleLessonAsAdmin] calendar update error:", e);
      }
    }

    if (!googleUpdated) {
      try {
        const { sendLessonUpdateEmails } = await import("@/lib/lesson-emails.server");
        await sendLessonUpdateEmails({
          supabaseAdmin: supabase as any,
          lessonId: lesson.id,
          kind: "rescheduled",
          startsAtISO: newStart.toISOString(),
          previousStartsAtISO,
        });
      } catch (e) {
        console.error("[rescheduleLessonAsAdmin] email dispatch error:", e);
      }
    }
    return { ok: true };
  });

export const updateSubject = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: {
    id: string;
    name?: string;
    price_cents?: number;
    active?: boolean;
    description?: string;
    sort_order?: number;
    is_trial?: boolean;
  }) =>
    z
      .object({
        id: z.string().uuid(),
        name: z.string().trim().min(1).max(120).optional(),
        price_cents: z.number().int().min(0).max(1_000_000).optional(),
        active: z.boolean().optional(),
        description: z.string().max(1000).optional(),
        sort_order: z.number().int().min(0).max(9999).optional(),
        is_trial: z.boolean().optional(),
      })
      .parse(input),
  )
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;
    await assertAdmin(supabase, userId);

    const patch: {
      name?: string;
      price_cents?: number;
      active?: boolean;
      description?: string;
      sort_order?: number;
      is_trial?: boolean;
    } = {};
    if (data.name !== undefined) patch.name = data.name;
    if (data.price_cents !== undefined) patch.price_cents = data.price_cents;
    if (data.active !== undefined) patch.active = data.active;
    if (data.description !== undefined) patch.description = data.description;
    if (data.sort_order !== undefined) patch.sort_order = data.sort_order;
    if (data.is_trial !== undefined) patch.is_trial = data.is_trial;

    const { error } = await supabase.from("subjects").update(patch).eq("id", data.id);
    if (error) throw new Error(error.message);
    return { ok: true };
  });

function slugify(name: string): string {
  return name
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, "_")
    .replace(/^_+|_+$/g, "")
    .slice(0, 60) || "subject";
}

export const createSubject = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: { name: string; price_cents: number; is_trial?: boolean }) =>
    z
      .object({
        name: z.string().trim().min(1).max(120),
        price_cents: z.number().int().min(0).max(1_000_000),
        is_trial: z.boolean().optional(),
      })
      .parse(input),
  )
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;
    await assertAdmin(supabase, userId);

    // Determine sort order (append to end)
    const { data: last } = await supabase
      .from("subjects")
      .select("sort_order")
      .order("sort_order", { ascending: false })
      .limit(1)
      .maybeSingle();
    const sortOrder = (last?.sort_order ?? 0) + 1;

    // Build a unique slug for Stripe lookup keys
    const base = slugify(data.name);
    let slug = base;
    for (let i = 2; i < 20; i++) {
      const { data: dupe } = await supabase
        .from("subjects")
        .select("id")
        .eq("stripe_product_slug", slug)
        .maybeSingle();
      if (!dupe) break;
      slug = `${base}_${i}`;
    }

    const { data: inserted, error } = await supabase
      .from("subjects")
      .insert({
        name: data.name,
        price_cents: data.price_cents,
        active: true,
        sort_order: sortOrder,
        stripe_product_slug: slug,
        is_trial: data.is_trial ?? false,
      })
      .select("id")
      .single();
    if (error) throw new Error(error.message);

    // Create matching Stripe product + prices (best-effort — subject exists
    // even if Stripe is briefly unreachable; admin can re-run).
    try {
      const { createStripeClient } = await import("@/lib/stripe.server");
      const stripe = createStripeClient("sandbox");
      const product = await stripe.products.create({
        name: data.name,
        metadata: { slug },
      });
      await stripe.prices.create({
        product: product.id,
        unit_amount: data.price_cents,
        currency: "usd",
        lookup_key: `${slug}_single`,
        transfer_lookup_key: true,
      });
      if (!data.is_trial) {
        const { bundle_discount_pct } = await context.supabase
          .from("settings")
          .select("bundle_discount_pct")
          .single()
          .then((r) => r.data ?? { bundle_discount_pct: 10 });
        const pct = bundle_discount_pct ?? 10;
        await stripe.prices.create({
          product: product.id,
          unit_amount: Math.round(data.price_cents * 5 * (1 - pct / 100)),
          currency: "usd",
          lookup_key: `${slug}_pack5`,
          transfer_lookup_key: true,
        });
      }
    } catch (e) {
      console.error("[createSubject] Stripe product creation failed:", e);
    }

    return { ok: true, id: inserted.id };
  });

export const deleteSubject = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: { id: string }) =>
    z.object({ id: z.string().uuid() }).parse(input),
  )
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;
    await assertAdmin(supabase, userId);

    // Any lessons reference this subject?
    const { count: lessonCount } = await supabase
      .from("lessons")
      .select("*", { count: "exact", head: true })
      .eq("subject_id", data.id);
    if ((lessonCount ?? 0) > 0) {
      // Soft-delete: mark inactive so history stays intact
      const { error } = await supabase
        .from("subjects")
        .update({ active: false })
        .eq("id", data.id);
      if (error) throw new Error(error.message);
      return { ok: true, softDeleted: true };
    }

    // No references — safe to hard-delete
    const { error } = await supabase.from("subjects").delete().eq("id", data.id);
    if (error) throw new Error(error.message);
    return { ok: true, softDeleted: false };
  });

const availabilitySchema = z.record(
  z.string().regex(/^[0-6]$/), // 0=Sun ... 6=Sat
  z.array(
    z.object({
      start: z.string().regex(/^([01]\d|2[0-3]):[0-5]\d$/, "Use HH:MM"),
      end: z.string().regex(/^([01]\d|2[0-3]):[0-5]\d$/, "Use HH:MM"),
    }),
  ),
);

export const updateAvailability = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: { weekly_availability: Record<string, Array<{ start: string; end: string }>> }) =>
    z.object({ weekly_availability: availabilitySchema }).parse(input),
  )
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;
    await assertAdmin(supabase, userId);

    // Validate each range: end > start, then flatten to the array shape the
    // booking functions consume: [{ day, start, end }, ...].
    const flat: Array<{ day: number; start: string; end: string }> = [];
    for (const [day, ranges] of Object.entries(data.weekly_availability)) {
      for (const r of ranges) {
        if (r.end <= r.start) {
          throw new Error(`Day ${day}: end time must be after start time`);
        }
        flat.push({ day: Number(day), start: r.start, end: r.end });
      }
    }

    const { error } = await supabase
      .from("settings")
      .update({ weekly_availability: flat })
      .eq("id", 1);
    if (error) throw new Error(error.message);
    return { ok: true };
  });
