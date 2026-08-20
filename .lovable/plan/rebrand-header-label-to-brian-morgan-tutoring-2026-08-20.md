# Rebrand header label to "Brian Morgan Tutoring"

## What changes
Replace the top-left brand label "Tutoring" with "Brian Morgan Tutoring" in the page headers where it appears as a link to `/`. Also update the footer copyright text and the availability page title/OG tag so the brand name is consistent everywhere.

## Files to edit
- `src/routes/index.tsx` — header link (line 31) + footer copyright (line 177)
- `src/routes/auth.tsx` — header link (line 66)
- `src/routes/_authenticated/dashboard.tsx` — header link (line 116)
- `src/routes/reset-password.tsx` — header link (line 65)
- `src/routes/availability.tsx` — title and og:title "Open lesson times — Tutoring" → "Brian Morgan Tutoring"

## Out of scope
- No logic, styling, or layout changes — text only.
- The `__root.tsx` default title and calendar invite wording ("Tutoring session with…") stay as-is unless you want those updated too.
