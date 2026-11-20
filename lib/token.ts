import "server-only";
import { createHmac, timingSafeEqual } from "node:crypto";
import { requireEnv } from "./env";

/** Signature that lets an email link act for one user without a login. */
export function signUserToken(userId: string, purpose: string) {
  return createHmac("sha256", requireEnv("APP_SECRET")).update(`${purpose}:${userId}`).digest("hex");
}

export function verifyUserToken(userId: string, purpose: string, token: string) {
  const expected = Buffer.from(signUserToken(userId, purpose));
  const given = Buffer.from(token);
  return expected.length === given.length && timingSafeEqual(expected, given);
}
