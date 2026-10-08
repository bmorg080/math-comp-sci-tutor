import { redirect } from "@tanstack/react-router";

/**
 * Temporary holding page switch.
 *
 * While HOLDING_PAGE_ENABLED is true, every visitor-facing page redirects to "/"
 * and only the biography + email page is shown. Booking, sign-in and the family
 * dashboard are unreachable to parents.
 *
 * Escape hatch (no code change needed):
 *   - "?hold=off" on any URL disables the redirect for this browser and remembers it.
 *   - "?hold=on"  re-enables it.
 * "/admin" and "/tutor" always stay reachable — both are already hard-gated to the
 * tutor's role server-side, so a parent cannot use them to get around the hold.
 */
export const HOLDING_PAGE_ENABLED = true;

const HOLD_PARAM = "hold";
const HOLD_OFF = "off";
const HOLD_ON = "on";
const STORAGE_KEY = "brian-morgan-hold";

/** Tutor-only surfaces that stay reachable while the hold is on. */
const ALWAYS_ALLOWED = ["/admin", "/tutor"];

function isBypassParam(search: string) {
  try {
    return new URLSearchParams(search).get(HOLD_PARAM) === HOLD_OFF;
  } catch {
    return false;
  }
}

function hasStoredBypass() {
  if (typeof window === "undefined") return false;
  try {
    return window.localStorage.getItem(STORAGE_KEY) === HOLD_OFF;
  } catch {
    return false;
  }
}

export function isHoldingPageBypassed(location: { pathname: string; search: string }) {
  if (!HOLDING_PAGE_ENABLED) return true;
  if (ALWAYS_ALLOWED.some((p) => location.pathname === p || location.pathname.startsWith(p + "/"))) {
    return true;
  }
  return isBypassParam(location.search) || hasStoredBypass();
}

/**
 * Call from a route's beforeLoad. Throws a redirect to "/" when the hold applies.
 * `location` is the router's location for the route being loaded.
 */
export function guardWithHoldingPage(location: { pathname: string; search: string }) {
  if (!isHoldingPageBypassed(location)) {
    throw redirect({ to: "/", replace: true });
  }
}

/**
 * Reads ?hold=off / ?hold=on and persists the choice, so the tutor can move
 * through the real app without carrying the query string on every link.
 * Runs once from the root route.
 */
export function syncHoldingPageBypass() {
  if (typeof window === "undefined") return;
  let raw: string | null = null;
  try {
    raw = new URLSearchParams(window.location.search).get(HOLD_PARAM);
    if (raw === HOLD_OFF) window.localStorage.setItem(STORAGE_KEY, HOLD_OFF);
    else if (raw === HOLD_ON) window.localStorage.removeItem(STORAGE_KEY);
  } catch {
    /* private mode / storage blocked — the query param still works for this visit */
  }
}
