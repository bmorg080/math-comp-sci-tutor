import { createFileRoute } from "@tanstack/react-router";
import { sendTemplateEmail } from "@/lib/email-templates/send-email";

export const Route = createFileRoute("/api/public/hooks/lesson-reminders")({
  server: {
    handlers: {
      POST: async ({ request }) => {
        // Auth: require Supabase anon key in apikey header
        const apikey = request.headers.get("apikey");
        if (!apikey || apikey !== process.env.SUPABASE_PUBLISHABLE_KEY) {
          return new Response(JSON.stringify({ error: "unauthorized" }), {
            status: 401,
            headers: { "Content-Type": "application/json" },
          });
        }

        const { supabaseAdmin } = await import(
          "@/integrations/supabase/client.server"
        );

        const now = new Date();
        // Window: lessons starting between 23h and 25h from now that haven't been reminded
        const from = new Date(now.getTime() + 23 * 60 * 60 * 1000).toISOString();
        const to = new Date(now.getTime() + 25 * 60 * 60 * 1000).toISOString();

        const { data: lessons, error } = await supabaseAdmin
          .from("lessons")
          .select(
            "id, starts_at, account_id, student_id, subject_id, students(name, email), subjects(name), accounts(display_name, timezone)",
          )
          .eq("status", "scheduled")
          .is("reminder_sent_at", null)
          .gte("starts_at", from)
          .lte("starts_at", to);

        if (error) {
          console.error("[reminders] query failed:", error);
          return new Response(JSON.stringify({ error: error.message }), {
            status: 500,
            headers: { "Content-Type": "application/json" },
          });
        }

        const { data: settings } = await supabaseAdmin
          .from("settings")
          .select("zoom_link, tutor_name, tutor_email, tutor_timezone")
          .eq("id", 1)
          .maybeSingle();

        const zoomLink = settings?.zoom_link ?? "";
        const tutorTZ = settings?.tutor_timezone ?? "UTC";
        const tutorEmail = settings?.tutor_email;
        const tutorName = settings?.tutor_name ?? "Tutor";

        const fmt = (d: string, tz: string) =>
          new Intl.DateTimeFormat("en-US", {
            timeZone: tz,
            weekday: "long",
            month: "short",
            day: "numeric",
            hour: "numeric",
            minute: "2-digit",
            hour12: true,
            timeZoneName: "short",
          }).format(new Date(d));

        let sent = 0;
        const processed: string[] = [];

        for (const l of lessons ?? []) {
          const student = (l as any).students;
          const subject = (l as any).subjects;
          const account = (l as any).accounts;
          const studentName = student?.name ?? "Student";
          const studentEmail: string | undefined = student?.email ?? undefined;
          const subjectName = subject?.name ?? "Lesson";
          const customerTZ = account?.timezone ?? tutorTZ;

          // Look up parent email from the account membership (parent first)
          let parentEmail: string | undefined;
          const parentName = account?.display_name ?? "there";
          const { data: members } = await supabaseAdmin
            .from("account_members")
            .select("email, member_role")
            .eq("account_id", l.account_id);
          const parentMember =
            (members ?? []).find((m: any) => m.member_role === "parent") ?? (members ?? [])[0];
          parentEmail = (parentMember as any)?.email ?? undefined;

          try {
            const customerTemplateData = {
              studentName,
              subjectName,
              whenForRecipient: fmt(l.starts_at, customerTZ),
              zoomLink,
              isTutor: false,
            };
            if (parentEmail) {
              await sendTemplateEmail("lesson-reminder", parentEmail, {
                idempotencyKey: `lesson-reminder-parent-${l.id}`,
                templateData: { ...customerTemplateData, recipientName: parentName },
              });
              sent++;
            }
            if (studentEmail && studentEmail !== parentEmail) {
              await sendTemplateEmail("lesson-reminder", studentEmail, {
                idempotencyKey: `lesson-reminder-student-${l.id}`,
                templateData: { ...customerTemplateData, recipientName: studentName },
              });
              sent++;
            }
            if (tutorEmail) {
              await sendTemplateEmail("lesson-reminder", tutorEmail, {
                idempotencyKey: `lesson-reminder-tutor-${l.id}`,
                templateData: {
                  recipientName: tutorName,
                  studentName,
                  subjectName,
                  whenForRecipient: fmt(l.starts_at, tutorTZ),
                  zoomLink,
                  isTutor: true,
                },
              });
              sent++;
            }

            await supabaseAdmin
              .from("lessons")
              .update({ reminder_sent_at: new Date().toISOString() })
              .eq("id", l.id);
            processed.push(l.id);
          } catch (e) {
            console.error(`[reminders] lesson ${l.id} failed:`, e);
          }
        }

        console.log(
          `[reminders] scanned=${lessons?.length ?? 0} processed=${processed.length} emails_sent=${sent}`,
        );

        // Auto-complete: mark past scheduled lessons as completed
        // A lesson is done once its end time (starts_at + duration_minutes) has passed.
        const nowIso = now.toISOString();
        const { data: completed, error: completeErr } = await supabaseAdmin
          .from("lessons")
          .update({ status: "completed" })
          .eq("status", "scheduled")
          .lt("starts_at", new Date(now.getTime() - 60 * 60 * 1000).toISOString())
          .select("id");
        if (completeErr) console.error("[reminders] auto-complete failed:", completeErr);
        const completedCount = completed?.length ?? 0;
        if (completedCount > 0) {
          console.log(`[reminders] auto-completed ${completedCount} past lessons at ${nowIso}`);
        }

        return new Response(
          JSON.stringify({
            ok: true,
            scanned: lessons?.length ?? 0,
            processed: processed.length,
            emails_sent: sent,
            auto_completed: completedCount,
          }),
          { headers: { "Content-Type": "application/json" } },
        );
      },
    },
  },
});
