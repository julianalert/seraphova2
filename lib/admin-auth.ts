import "server-only";
import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { ADMIN_COOKIE, verifyAdminToken } from "./admin-session";

export async function isAdmin() {
  const token = (await cookies()).get(ADMIN_COOKIE)?.value;
  return verifyAdminToken(token, process.env.ADMIN_PASSWORD);
}

/** Call at the top of every admin page and action. */
export async function requireAdmin() {
  if (!(await isAdmin())) redirect("/admin/login");
}
