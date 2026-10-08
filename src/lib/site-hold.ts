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

/**
 * The router's location object. `search` is a parsed object, so the raw query
 * string is read from `searchStr` (falling back to `href`).
 */
export type HoldLocation = { pathname: string; searchStr?: string; href?: string };

function rawSearch(loc: HoldLocation): string {
  if (typeof loc.searchStr === "string") return loc.searchStr;
  if (typeof loc.href === "string") {
    const q = loc.href.indexOf("?");
    if (q < 0) return "";
    const rest = loc.href.slice(q + 1);
    const h = rest.indexOf("#");
    return h >= 0 ? rest.slice(0, h) : rest;
  }
  return "";
}

function isBypassParam(loc: HoldLocation) {
  try {
    return new URLSearchParams(rawSearch(loc)).get(HOLD_PARAM) === HOLD_OFF;
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

export function isHoldingPageBypassed(loc: HoldLocation) {
  if (!HOLDING_PAGE_ENABLED) return true;
  if (ALWAYS_ALLOWED.some((p) => loc.pathname === p || loc.pathname.startsWith(p + "/"))) {
    return true;
  }
  return isBypassParam(loc) || hasStoredBypass();
}

/**
 * Call from a route's beforeLoad. Throws a redirect to "/" when the hold applies.
 */
export function guardWithHoldingPage(loc: HoldLocation) {
  if (!isHoldingPageBypassed(loc)) {
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
  try {
    const raw = new URLSearchParams(window.location.search).get(HOLD_PARAM);
    if (raw === HOLD_OFF) window.localStorage.setItem(STORAGE_KEY, HOLD_OFF);
    else if (raw === HOLD_ON) window.localStorage.removeItem(STORAGE_KEY);
  } catch {
    /* private mode / storage blocked — the query param still works for this visit */
  }
}
