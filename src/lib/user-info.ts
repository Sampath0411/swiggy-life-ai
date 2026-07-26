/**
 * Swiggy LifeOS — User info extraction from OAuth tokens.
 *
 * After the Swiggy MCP OAuth flow, we extract user information from
 * the access token JWT. This gives us the phone number (and potentially
 * name) of the authenticated Swiggy user.
 *
 * The access token from Swiggy's MCP auth server is a JWT. We decode
 * the payload client-side (no signature verification needed for display)
 * to read claims like `phone_number` and `name`.
 *
 * Falls back gracefully if the token is not a JWT (opaque token).
 */

const STORAGE_KEY = "swiggy_user_info";

export interface SwiggyUserInfo {
  /** Display name — either from JWT `name` claim or formatted phone */
  displayName: string;
  /** Raw phone number from JWT (if available) */
  phoneNumber?: string;
  /** Raw name from JWT (if available) */
  name?: string;
}

/**
 * Decode the payload of a JWT token.
 * Returns null if the token isn't a valid JWT (e.g. opaque token).
 *
 * Uses TextDecoder for full Unicode support (Devanagari, CJK, emoji
 * in name claims). atob() only handles Latin-1 and would produce
 * garbage for non-ASCII characters.
 */
function decodeJwtPayload(token: string): Record<string, unknown> | null {
  try {
    const parts = token.split(".");
    if (parts.length !== 3) return null; // Not a JWT

    const payload = parts[1];
    // Base64url → base64
    const base64 = payload.replace(/-/g, "+").replace(/_/g, "/");
    // Pad with = to make length a multiple of 4
    const padded = base64.padEnd(base64.length + ((4 - (base64.length % 4)) % 4), "=");

    // Use Uint8Array + TextDecoder for Unicode-safe decoding
    const binary = atob(padded);
    const bytes = new Uint8Array(binary.length);
    for (let i = 0; i < binary.length; i++) {
      bytes[i] = binary.charCodeAt(i);
    }
    const decoded = new TextDecoder("utf-8").decode(bytes);
    return JSON.parse(decoded);
  } catch {
    return null;
  }
}

/**
 * Format a phone number for display.
 * "+919291493225" → "+91 92914 93225"
 * "9291493225" → "92914 93225"
 */
function formatPhone(phone: string): string {
  const cleaned = phone.replace(/[^+\d]/g, "");
  // If it has country code (+91...)
  if (cleaned.startsWith("+91") && cleaned.length === 13) {
    return `+91 ${cleaned.slice(3, 8)} ${cleaned.slice(8)}`;
  }
  // Just a 10-digit number
  if (cleaned.length === 10) {
    return `${cleaned.slice(0, 5)} ${cleaned.slice(5)}`;
  }
  return phone;
}

/**
 * Extract user info from the Swiggy MCP access token.
 * Returns null if we can't extract anything meaningful.
 */
export function extractUserInfoFromToken(token: string): SwiggyUserInfo | null {
  const claims = decodeJwtPayload(token);
  if (!claims) return null;

  // Look for phone number in various claim names
  const phone =
    (claims.phone_number as string) ||
    (claims.phone as string) ||
    (claims.sub as string) ||
    null;

  // Look for name
  const name =
    (claims.name as string) ||
    (claims.given_name as string) ||
    (claims.preferred_username as string) ||
    null;

  if (!phone && !name) return null;

  // Build display name
  let displayName: string;
  if (name) {
    displayName = name;
  } else if (phone) {
    // Show last 4 digits of phone for privacy
    const clean = phone.replace(/[^+\d]/g, "");
    const last4 = clean.slice(-4);
    displayName = `User (+91 XXXXX${last4})`;
  } else {
    return null;
  }

  return { displayName, phoneNumber: phone ?? undefined, name: name ?? undefined };
}

/**
 * Save user info to sessionStorage.
 */
export function saveUserInfo(info: SwiggyUserInfo): void {
  try {
    sessionStorage.setItem(STORAGE_KEY, JSON.stringify(info));
  } catch { /* sessionStorage full or unavailable */ }
}

/**
 * Load user info from sessionStorage.
 */
export function loadUserInfo(): SwiggyUserInfo | null {
  try {
    const raw = sessionStorage.getItem(STORAGE_KEY);
    if (!raw) return null;
    return JSON.parse(raw) as SwiggyUserInfo;
  } catch {
    return null;
  }
}

/**
 * Clear stored user info.
 */
export function clearUserInfo(): void {
  try {
    sessionStorage.removeItem(STORAGE_KEY);
  } catch { /* ignore */ }
}

/**
 * Get a greeting based on the current time of day.
 */
export function getTimeGreeting(): string {
  const hour = new Date().getHours();
  if (hour < 12) return "Good morning";
  if (hour < 17) return "Good afternoon";
  return "Good evening";
}

/**
 * Get the user's display name, with a fallback.
 */
export function getDisplayName(): string {
  const info = loadUserInfo();
  if (info?.displayName) {
    // Extract just the first name for the greeting
    const firstName = info.displayName.split(" ")[0];
    return firstName;
  }
  return "there";
}
