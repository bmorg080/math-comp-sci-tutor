// Minimal RFC 5545 VEVENT builder used for the "add to calendar" download.

function pad(n: number) {
  return String(n).padStart(2, "0");
}

function toICSDate(d: Date): string {
  return (
    d.getUTCFullYear().toString() +
    pad(d.getUTCMonth() + 1) +
    pad(d.getUTCDate()) +
    "T" +
    pad(d.getUTCHours()) +
    pad(d.getUTCMinutes()) +
    pad(d.getUTCSeconds()) +
    "Z"
  );
}

function escapeText(v: string): string {
  return v.replace(/\\/g, "\\\\").replace(/;/g, "\\;").replace(/,/g, "\\,").replace(/\n/g, "\\n");
}

export type IcsInput = {
  uid: string;
  startsAtISO: string;
  durationMinutes: number;
  title: string;
  description: string;
  location?: string;
  organizerEmail?: string | null;
  organizerName?: string | null;
};

export function buildIcs(input: IcsInput): string {
  const start = new Date(input.startsAtISO);
  const end = new Date(start.getTime() + input.durationMinutes * 60_000);

  const lines = [
    "BEGIN:VCALENDAR",
    "VERSION:2.0",
    "PRODID:-//Brian Morgan Tutoring//Lessons//EN",
    "CALSCALE:GREGORIAN",
    "METHOD:PUBLISH",
    "BEGIN:VEVENT",
    `UID:${input.uid}`,
    `DTSTAMP:${toICSDate(new Date())}`,
    `DTSTART:${toICSDate(start)}`,
    `DTEND:${toICSDate(end)}`,
    `SUMMARY:${escapeText(input.title)}`,
    `DESCRIPTION:${escapeText(input.description)}`,
  ];
  if (input.location) lines.push(`LOCATION:${escapeText(input.location)}`);
  if (input.organizerEmail) {
    lines.push(
      `ORGANIZER;CN=${escapeText(input.organizerName ?? "Tutor")}:mailto:${input.organizerEmail}`,
    );
  }
  lines.push(
    "BEGIN:VALARM",
    "TRIGGER:-PT30M",
    "ACTION:DISPLAY",
    "DESCRIPTION:Lesson starts in 30 minutes",
    "END:VALARM",
    "END:VEVENT",
    "END:VCALENDAR",
  );

  return lines.join("\r\n");
}
