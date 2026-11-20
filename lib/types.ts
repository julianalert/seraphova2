import type { NatalChart } from "./astro/chart";
import type { DailySky } from "./astro/transits";

export const FOCUS_AREAS = [
  { id: "love", emoji: "💛", label: "Love & relationships" },
  { id: "career", emoji: "🏔", label: "Career & purpose" },
  { id: "self", emoji: "🌿", label: "Self & identity" },
  { id: "change", emoji: "🌊", label: "Change & transitions" },
  { id: "wellbeing", emoji: "✨", label: "Wellbeing & energy" },
  { id: "clarity", emoji: "🔮", label: "Decisions & clarity" },
] as const;
export type FocusId = (typeof FOCUS_AREAS)[number]["id"];

/** Seraphova is for adults only. */
export const MIN_AGE = 18;

export const DELIVERY_HOURS = [6, 7, 8, 9] as const;
export const RECOMMENDED_HOUR = 7;

export type Profile = {
  id: string;
  email: string;
  first_name: string;
  birth_date: string;
  birth_time: string | null;
  birth_city: string;
  birth_lat: number;
  birth_lon: number;
  birth_tz: string;
  focus: FocusId;
  /** What the member said is on their mind, in their own words. */
  context: string | null;
  context_updated_at: string | null;
  /** Running summary of earlier readings and of what the member has shared. */
  memory: string | null;
  /** Date of the last reading already folded into `memory`. */
  memory_through: string | null;
  memory_updated_at: string | null;
  visitor_id: string | null;
  cart_emails_sent: number;
  cart_last_email_at: string | null;
  delivery_hour: number;
  timezone: string;
  chart: NatalChart;
  status: "lead" | "active" | "expired";
  paid_at: string | null;
  access_until: string | null;
  next_send_at: string | null;
  email_paused: boolean;
  stripe_customer_id: string | null;
  stripe_session_id: string | null;
  created_at: string;
};

export type ReadingSection = { heading: string; body: string };

export type Reading = {
  id: string;
  user_id: string;
  reading_date: string;
  headline: string;
  theme: string;
  opening: string;
  sections: ReadingSection[];
  invitation: string;
  sky: DailySky;
  model: string | null;
  sent_at: string | null;
  created_at: string;
};

export type Note = {
  id: string;
  user_id: string;
  focus: FocusId;
  note: string | null;
  created_at: string;
};

export function focusLabel(id: string) {
  return FOCUS_AREAS.find((f) => f.id === id)?.label ?? "Self & identity";
}
