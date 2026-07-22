// Google Calendar sync for tutoring lessons.
// Uses the workspace-linked google_calendar App connector (gateway).
// The connected Google account is the tutor's — events are inserted onto
// their primary calendar and the parent/student are added as attendees so
// Google emails them the invite (with the tutor's Zoom link).

const GATEWAY_BASE = "https://connector-gateway.lovable.dev/google_calendar";

function isConfigured(): boolean {
  return !!process.env.LOVABLE_API_KEY && !!process.env.GOOGLE_CALENDAR_API_KEY;
}

async function gatewayFetch(path: string, init: RequestInit = {}): Promise<Response> {
  const headers = new Headers(init.headers);
  headers.set("Authorization", `Bearer ${process.env.LOVABLE_API_KEY}`);
  headers.set("X-Connection-Api-Key", process.env.GOOGLE_CALENDAR_API_KEY!);
  if (!headers.has("Content-Type") && init.body) {
    headers.set("Content-Type", "application/json");
  }
  return fetch(`${GATEWAY_BASE}${path}`, { ...init, headers });
}

type LessonForCalendar = {
  lessonId: string;
  startsAtISO: string;
  durationMinutes: number;
  subjectName: string;
  studentName: string;
  parentName: string;
  parentEmail: string | null;
  studentEmail: string | null;
  tutorName: string;
  tutorEmail: string | null;
  tutorTimezone: string;
  zoomLink: string;
};

function buildEventBody(l: LessonForCalendar) {
  const start = new Date(l.startsAtISO);
  const end = new Date(start.getTime() + l.durationMinutes * 60_000);

  const attendees: Array<{ email: string; displayName?: string; responseStatus?: string }> = [];
  if (l.parentEmail) attendees.push({ email: l.parentEmail, displayName: l.parentName });
  if (l.studentEmail && l.studentEmail !== l.parentEmail) {
    attendees.push({ email: l.studentEmail, displayName: l.studentName });
  }

  const summary = `${l.subjectName} — ${l.studentName}`;
  const descriptionParts = [
    `Tutoring session with ${l.tutorName}.`,
    l.zoomLink ? `\nJoin here: ${l.zoomLink}` : "",
    "\n\nManage or reschedule this lesson from your account dashboard.",
  ];

  return {
    summary,
    description: descriptionParts.join(""),
    location: l.zoomLink || undefined,
    start: { dateTime: start.toISOString(), timeZone: l.tutorTimezone },
    end: { dateTime: end.toISOString(), timeZone: l.tutorTimezone },
    attendees,
    reminders: {
      useDefault: false,
      overrides: [
        { method: "email", minutes: 24 * 60 },
        { method: "popup", minutes: 15 },
      ],
    },
    extendedProperties: {
      private: { lessonId: l.lessonId },
    },
  };
}

export async function createCalendarEvent(l: LessonForCalendar): Promise<string | null> {
  if (!isConfigured()) return null;
  try {
    // sendUpdates=all → Google emails the tutor and every attendee with an invite.
    const res = await gatewayFetch(
      "/calendar/v3/calendars/primary/events?sendUpdates=all",
      { method: "POST", body: JSON.stringify(buildEventBody(l)) },
    );
    if (!res.ok) {
      const body = await res.text();
      console.error(`[calendar] create failed [${res.status}]: ${body}`);
      return null;
    }
    const data = (await res.json()) as { id?: string };
    return data.id ?? null;
  } catch (e) {
    console.error("[calendar] create error:", e);
    return null;
  }
}

export async function updateCalendarEvent(
  eventId: string,
  l: LessonForCalendar,
): Promise<boolean> {
  if (!isConfigured()) return false;
  try {
    const res = await gatewayFetch(
      `/calendar/v3/calendars/primary/events/${encodeURIComponent(eventId)}?sendUpdates=all`,
      { method: "PATCH", body: JSON.stringify(buildEventBody(l)) },
    );
    if (!res.ok) {
      const body = await res.text();
      console.error(`[calendar] update failed [${res.status}]: ${body}`);
      return false;
    }
    return true;
  } catch (e) {
    console.error("[calendar] update error:", e);
    return false;
  }
}

export async function deleteCalendarEvent(eventId: string): Promise<boolean> {
  if (!isConfigured()) return false;
  try {
    // sendUpdates=all → Google emails a cancellation notice to attendees.
    const res = await gatewayFetch(
      `/calendar/v3/calendars/primary/events/${encodeURIComponent(eventId)}?sendUpdates=all`,
      { method: "DELETE" },
    );
    if (!res.ok && res.status !== 404 && res.status !== 410) {
      const body = await res.text();
      console.error(`[calendar] delete failed [${res.status}]: ${body}`);
      return false;
    }
    return true;
  } catch (e) {
    console.error("[calendar] delete error:", e);
    return false;
  }
}

// Load everything needed to build a calendar event for a lesson.
export async function loadLessonForCalendar(
  supabaseAdmin: any,
  lessonId: string,
): Promise<LessonForCalendar | null> {
  const { data: lesson } = await supabaseAdmin
    .from("lessons")
    .select(
      "id, starts_at, duration_minutes, account_id, student_id, subject_id, google_event_id",
    )
    .eq("id", lessonId)
    .maybeSingle();
  if (!lesson) return null;

  const [{ data: student }, { data: subject }, { data: settings }, { data: members }] =
    await Promise.all([
      supabaseAdmin
        .from("students")
        .select("name, email")
        .eq("id", lesson.student_id)
        .maybeSingle(),
      supabaseAdmin
        .from("subjects")
        .select("name")
        .eq("id", lesson.subject_id)
        .maybeSingle(),
      supabaseAdmin
        .from("settings")
        .select("zoom_link, tutor_name, tutor_email, tutor_timezone")
        .eq("id", 1)
        .maybeSingle(),
      supabaseAdmin
        .from("account_members")
        .select("email, account:accounts(display_name)")
        .eq("account_id", lesson.account_id)
        .eq("member_role", "parent")
        .limit(1),
    ]);

  const parent = (members ?? [])[0];
  const parentDisplay = (parent?.account as unknown as { display_name?: string } | undefined)
    ?.display_name;

  return {
    lessonId: lesson.id,
    startsAtISO: lesson.starts_at,
    durationMinutes: lesson.duration_minutes ?? 60,
    subjectName: subject?.name ?? "Tutoring",
    studentName: student?.name ?? "Student",
    parentName: parentDisplay ?? "Family",
    parentEmail: parent?.email ?? null,
    studentEmail: student?.email ?? null,
    tutorName: settings?.tutor_name ?? "Tutor",
    tutorEmail: settings?.tutor_email ?? null,
    tutorTimezone: settings?.tutor_timezone ?? "UTC",
    zoomLink: settings?.zoom_link ?? "",
  };
}

export function isCalendarConfigured(): boolean {
  return isConfigured();
}
