# Fix tutor calendar month anchors

## Goal
Prevent calendar navigation from requesting the previous month in timezones ahead of UTC.

## Changes
- Build the dashboard request anchor from the displayed calendar year and month at UTC midnight, rather than converting local midnight to UTC.
- Keep the existing server query window and calendar behavior unchanged.
- Verify navigation under a UTC-ahead browser timezone and confirm lessons after the 8th remain in the requested month.

## Technical details
The displayed month remains a local `Date` for labels and grid construction. Only the server request anchor changes to `new Date(Date.UTC(year, month, 1)).toISOString()`, making the month identity timezone-independent.
