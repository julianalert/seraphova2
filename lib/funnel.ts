// The steps of the funnel, in order, from opening the quiz to paying.
export const FUNNEL_STEPS = [
  { id: "quiz_start", label: "Opened the quiz" },
  { id: "birth_date", label: "Birth date" },
  { id: "birth_time", label: "Birth time" },
  { id: "birth_city", label: "Birth city" },
  { id: "focus", label: "What's on their mind" },
  { id: "situation", label: "What keeps repeating (optional)" },
  { id: "delivery_time", label: "Delivery time" },
  { id: "lead", label: "Name and email (lead)" },
  { id: "order_view", label: "Saw the order page" },
  { id: "checkout_start", label: "Went to checkout" },
  { id: "paid", label: "Paid" },
] as const;

export type FunnelEvent = (typeof FUNNEL_STEPS)[number]["id"];

export function isFunnelEvent(value: unknown): value is FunnelEvent {
  return FUNNEL_STEPS.some((step) => step.id === value);
}
