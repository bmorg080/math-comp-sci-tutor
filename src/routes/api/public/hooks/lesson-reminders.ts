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
            "id, starts_at, account_id, student_id, subject_id, students(name, email), subjects(name), accounts(timezone, user_id)",
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
            timeZoneName: "short",
          }).format(new Date(d));

        let sent = 0;
        const processed: string[] = [];

        for (const l of lessons ?? []) {
          const student = (l as any).students;
          const subject = (l as any).subjects;
          const account = (l as any).accounts;
          const studentName = student?.name ?? "Student";
          const subjectName = subject?.name ?? "Lesson";
          const customerTZ = account?.timezone ?? tutorTZ;

          // Look up parent email
          let parentEmail: string | undefined;
          let parentName = "there";
          if (account?.user_id) {
            const { data: userRes } =
              await supabaseAdmin.auth.admin.getUserById(account.user_id);
            parentEmail = userRes?.user?.email ?? undefined;
            parentName =
              (userRes?.user?.user_metadata as { full_name?: string } | undefined)
                ?.full_name ?? "there";
          }

          try {
            if (parentEmail) {
              await sendTemplateEmail("lesson-reminder", parentEmail, {
                idempotencyKey: `lesson-reminder-student-${l.id}`,
                templateData: {
                  recipientName: parentName,
                  studentName,
                  subjectName,
                  whenForRecipient: fmt(l.starts_at, customerTZ),
                  zoomLink,
                  isTutor: false,
                },
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

        return new Response(
          JSON.stringify({
            ok: true,
            scanned: lessons?.length ?? 0,
            processed: processed.length,
            emails_sent: sent,
          }),
          { headers: { "Content-Type": "application/json" } },
        );
      },
    },
  },
});
