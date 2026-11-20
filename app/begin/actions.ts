"use server";

import { z } from "zod";
import { computeNatalChart } from "@/lib/astro/chart";
import { recordEvent } from "@/lib/funnel-server";
import { supabaseAdmin } from "@/lib/supabase/admin";
import { isValidTimeZone, localDateString } from "@/lib/time";
import { DELIVERY_HOURS, FOCUS_AREAS, MIN_AGE, type Profile } from "@/lib/types";

const Input = z.object({
  birthDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  birthTime: z
    .string()
    .regex(/^([01]\d|2[0-3]):[0-5]\d$/)
    .nullable(),
  city: z.object({
    label: z.string().min(1).max(120),
    lat: z.number().min(-90).max(90),
    lon: z.number().min(-180).max(180),
    tz: z.string().refine(isValidTimeZone),
  }),
  focus: z.enum(FOCUS_AREAS.map((f) => f.id)),
  deliveryHour: z.number().refine((h) => (DELIVERY_HOURS as readonly number[]).includes(h)),
  timezone: z.string().refine(isValidTimeZone),
  firstName: z.string().trim().min(1).max(40),
  email: z.email().max(200),
  context: z.string().trim().max(600),
  visitor: z.string().max(64),
});

export type BeginInput = z.input<typeof Input>;
export type BeginResult =
  | { ok: true; profileId: string }
  | { ok: false; reason: "invalid" | "member" | "error"; message: string };

export async function createProfile(raw: BeginInput): Promise<BeginResult> {
  const parsed = Input.safeParse(raw);
  if (!parsed.success) {
    return { ok: false, reason: "invalid", message: "Some of your answers look off. Please check them." };
  }
  const input = parsed.data;

  const [year, month, day] = input.birthDate.split("-").map(Number);
  const real = new Date(Date.UTC(year, month - 1, day));
  const isRealDate = real.getUTCMonth() === month - 1 && real.getUTCDate() === day;
  const today = localDateString(new Date(), input.city.tz);
  if (!isRealDate || year < 1900 || input.birthDate > today) {
    return { ok: false, reason: "invalid", message: "That birth date does not look right." };
  }
  // Adults only: the birth date must be at least MIN_AGE years before today.
  if (input.birthDate > `${Number(today.slice(0, 4)) - MIN_AGE}${today.slice(4)}`) {
    return { ok: false, reason: "invalid", message: `Seraphova is for adults: you need to be ${MIN_AGE} or older.` };
  }

  const email = input.email.toLowerCase();
  const visitor = /^[0-9a-f-]{36}$/i.test(input.visitor) ? input.visitor : null;
  const fields = {
    visitor_id: visitor,
    email,
    first_name: input.firstName,
    birth_date: input.birthDate,
    birth_time: input.birthTime,
    birth_city: input.city.label,
    birth_lat: input.city.lat,
    birth_lon: input.city.lon,
    birth_tz: input.city.tz,
    focus: input.focus,
    context: input.context || null,
    delivery_hour: input.deliveryHour,
    timezone: input.timezone,
    chart: computeNatalChart({
      date: input.birthDate,
      time: input.birthTime,
      lat: input.city.lat,
      lon: input.city.lon,
      tz: input.city.tz,
    }),
  };

  try {
    const db = supabaseAdmin();
    const existing = await db.from("seraphova_profiles").select("id, status").eq("email", email).maybeSingle();
    const found = existing.data as Pick<Profile, "id" | "status"> | null;

    if (found?.status === "active") {
      return {
        ok: false,
        reason: "member",
        message: "This email already has a Seraphova membership. Sign in to read your horoscope.",
      };
    }

    if (found) {
      const updated = await db.from("seraphova_profiles").update(fields).eq("id", found.id);
      if (updated.error) throw updated.error;
      // They have not started yet, so their answers replace the earlier ones.
      await db.from("seraphova_notes").delete().eq("user_id", found.id);
      await db.from("seraphova_notes").insert({ user_id: found.id, focus: fields.focus, note: fields.context });
      // They came back and redid the quiz: restart the reminder sequence.
      await db.from("seraphova_profiles").update({ cart_emails_sent: 0, cart_last_email_at: null, created_at: new Date().toISOString() }).eq("id", found.id).eq("status", "lead");
      await recordEvent(visitor, "lead", found.id);
      return { ok: true, profileId: found.id };
    }

    const created = await db.auth.admin.createUser({ email, email_confirm: true });
    if (created.error || !created.data.user) throw created.error ?? new Error("No user returned");
    const id = created.data.user.id;

    const inserted = await db.from("seraphova_profiles").insert({ id, ...fields });
    if (inserted.error) {
      await db.auth.admin.deleteUser(id);
      throw inserted.error;
    }
    await db.from("seraphova_notes").insert({ user_id: id, focus: fields.focus, note: fields.context });
    await recordEvent(visitor, "lead", id);
    return { ok: true, profileId: id };
  } catch (error) {
    console.error("createProfile failed", error);
    return {
      ok: false,
      reason: "error",
      message: "We could not save your chart just now. Please try again in a moment.",
    };
  }
}
