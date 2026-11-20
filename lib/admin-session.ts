// Signed cookie for the /admin dashboard. Uses Web Crypto only, so it also runs in proxy.ts.
// The signature is keyed on ADMIN_PASSWORD: changing the password signs everyone out.

export const ADMIN_COOKIE = "seraphova_admin";
export const ADMIN_MAX_AGE_SECONDS = 30 * 24 * 3600;

async function sign(message: string, secret: string) {
  const encoder = new TextEncoder();
  const key = await crypto.subtle.importKey("raw", encoder.encode(secret), { name: "HMAC", hash: "SHA-256" }, false, ["sign"]);
  const signature = await crypto.subtle.sign("HMAC", key, encoder.encode(message));
  return Array.from(new Uint8Array(signature), (b) => b.toString(16).padStart(2, "0")).join("");
}

function sameString(a: string, b: string) {
  if (a.length !== b.length) return false;
  let diff = 0;
  for (let i = 0; i < a.length; i++) diff |= a.charCodeAt(i) ^ b.charCodeAt(i);
  return diff === 0;
}

export async function createAdminToken(password: string) {
  const expires = Date.now() + ADMIN_MAX_AGE_SECONDS * 1000;
  return `${expires}.${await sign(String(expires), password)}`;
}

export async function verifyAdminToken(token: string | undefined, password: string | undefined) {
  if (!token || !password) return false;
  const [expires, signature] = token.split(".");
  if (!expires || !signature || Number(expires) < Date.now()) return false;
  return sameString(signature, await sign(expires, password));
}
