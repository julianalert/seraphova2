import "server-only";
import { Resend } from "resend";
import { placementOf } from "./astro/chart";
import { computeDailySky, describeTransit } from "./astro/transits";
import { PRICE_LABEL, appUrl, requireEnv } from "./env";
import { formatLongDate } from "./time";
import { signUserToken } from "./token";
import { focusLabel, type Profile, type Reading } from "./types";

// Emails use the dark Seraphova look everywhere: mail clients do not switch themes reliably.
const NIGHT = "#08090f";
const CARD = "#161929";
const TEXT = "#e8e4da";
const BODY = "rgba(232,228,218,0.72)";
const FAINT = "rgba(232,228,218,0.42)";
const GOLD = "#c9a84c";
const LINE = "rgba(255,255,255,0.08)";
const SANS = "'DM Sans',Arial,Helvetica,sans-serif";
const SERIF = "Georgia,'Times New Roman',serif";

function escapeHtml(value: string) {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

const p = (html: string) =>
  `<p style="margin:0 0 16px;color:${BODY};font-size:15px;line-height:1.8;">${html}</p>`;

function paragraphs(text: string) {
  return text
    .split(/\n\s*\n/)
    .map((part) => p(escapeHtml(part.trim())))
    .join("");
}

const heading = (text: string) =>
  `<div style="font-family:${SERIF};font-size:24px;line-height:1.3;color:${TEXT};margin-bottom:16px;">${escapeHtml(text)}</div>`;

const subheading = (text: string) =>
  `<div style="font-family:${SERIF};font-size:19px;line-height:1.35;color:${TEXT};margin:26px 0 10px;">${escapeHtml(text)}</div>`;

/** The astrology behind a reading: the proof that it was worked out from this chart. */
function skyNotes(reading: Reading) {
  const notes = [
    ...(reading.sky.notes ?? []),
    {
      transit: `${reading.sky.moon.phase}, Moon in ${reading.sky.moon.sign}`,
      meaning: "The Moon sets the background mood of the day.",
    },
  ];
  return `<div style="border-top:1px solid ${LINE};margin-top:28px;padding-top:20px;">
<div style="font-size:10px;font-weight:500;letter-spacing:0.16em;text-transform:uppercase;color:${GOLD};margin-bottom:12px;">Where this comes from</div>
${notes
  .map(
    (note) =>
      `<div style="margin:0 0 10px;font-size:13px;line-height:1.6;color:${FAINT};"><span style="color:#c4b8e8;font-weight:500;">${escapeHtml(note.transit)}</span><br>${escapeHtml(note.meaning)}</div>`,
  )
  .join("")}
</div>`;
}

const pills = (labels: string[]) =>
  `<div style="margin:0 0 18px;">${labels
    .map(
      (label) =>
        `<span style="display:inline-block;padding:4px 12px;border-radius:100px;border:1px solid rgba(201,168,76,0.3);color:#c4b8e8;background:rgba(155,142,196,0.1);font-size:12px;font-weight:500;margin:0 4px 6px 0;">${escapeHtml(label)}</span>`,
    )
    .join("")}</div>`;

const insight = (label: string, text: string) =>
  `<div style="background:rgba(201,168,76,0.07);border-left:3px solid ${GOLD};border-radius:0 8px 8px 0;padding:14px 16px;margin:20px 0;">
<div style="font-size:10px;font-weight:500;letter-spacing:0.16em;text-transform:uppercase;color:${GOLD};margin-bottom:6px;">${escapeHtml(label)}</div>
<div style="font-family:${SERIF};font-size:17px;font-style:italic;color:${TEXT};line-height:1.55;">${escapeHtml(text)}</div>
</div>`;

const button = (href: string, label: string) =>
  `<div style="margin:26px 0 8px;text-align:center;"><a href="${href}" style="display:inline-block;background:${GOLD};background:linear-gradient(135deg,#c9a84c 0%,#f2d98a 100%);color:${NIGHT};font-family:${SANS};font-weight:600;font-size:14px;letter-spacing:0.08em;text-transform:uppercase;text-decoration:none;padding:16px 32px;border-radius:100px;">${label}</a></div>`;

const footerLink = (href: string, label: string) =>
  `<a href="${href}" style="color:${FAINT};text-decoration:underline;">${label}</a>`;

function shell({ preheader, header, body, footer }: { preheader: string; header: string; body: string; footer: string }) {
  return `<!doctype html>
<html lang="en">
<head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><meta name="color-scheme" content="dark"></head>
<body style="margin:0;padding:0;background:${NIGHT};font-family:${SANS};">
<div style="display:none;max-height:0;overflow:hidden;opacity:0;">${escapeHtml(preheader)}</div>
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="background:${NIGHT};padding:40px 20px;">
<tr><td align="center">
<div style="margin-bottom:24px;font-family:${SERIF};font-size:22px;letter-spacing:0.22em;text-transform:uppercase;color:${GOLD};">✦ Seraphova</div>
<table role="presentation" width="560" cellpadding="0" cellspacing="0" border="0" style="max-width:560px;width:100%;background:${CARD};border-radius:16px;border:1px solid rgba(255,255,255,0.1);overflow:hidden;">
<tr><td style="background:#0e1120;background:linear-gradient(150deg,#0e1120,#12162a);padding:24px 32px 20px;border-bottom:1px solid ${LINE};">
<div style="font-size:11px;letter-spacing:0.12em;text-transform:uppercase;color:${FAINT};">${escapeHtml(header)}</div>
</td></tr>
<tr><td style="padding:28px 32px 24px;">${body}</td></tr>
<tr><td style="padding:16px 32px 24px;border-top:1px solid ${LINE};">
<div style="font-size:11px;color:${FAINT};line-height:1.7;">${footer}</div>
</td></tr>
</table>
</td></tr>
</table>
</body>
</html>`;
}

export function unsubscribeUrl(userId: string) {
  return `${appUrl()}/api/unsubscribe?u=${userId}&t=${signUserToken(userId, "unsubscribe")}`;
}

function resend() {
  return new Resend(requireEnv("RESEND_API_KEY"));
}

async function send(to: string, subject: string, html: string, unsubscribe?: string) {
  const { error } = await resend().emails.send({
    from: requireEnv("EMAIL_FROM"),
    to,
    subject,
    html,
    ...(unsubscribe
      ? { headers: { "List-Unsubscribe": `<${unsubscribe}>`, "List-Unsubscribe-Post": "List-Unsubscribe=One-Click" } }
      : {}),
  });
  if (error) throw new Error(`Resend: ${error.message}`);
}

// ─── Daily reading ───────────────────────────────────────────────────────────

export function renderDailyEmail(profile: Profile, reading: Reading, first: boolean) {
  const readUrl = `${appUrl()}/timeline/${reading.reading_date}`;
  const intro = first
    ? p(
        `<em>Welcome, ${escapeHtml(profile.first_name)}. Your chart is cast, and this is your first reading. From tomorrow it arrives at ${profile.delivery_hour}am.</em>`,
      )
    : "";

  // The whole reading is in the email: nothing to open, nothing to click through to.
  const body = [
    intro,
    heading(reading.headline),
    paragraphs(reading.opening),
    ...reading.sections.map((section) => subheading(section.heading) + paragraphs(section.body)),
    insight("Today's invitation", reading.invitation),
    skyNotes(reading),
  ].join("");

  const footer = `Worked out from your birth chart and where the planets are today.<br>${footerLink(readUrl, "Read it on the web")} &nbsp;·&nbsp; ${footerLink(`${appUrl()}/timeline#mind`, "Something changed? Tell us")} &nbsp;·&nbsp; ${footerLink(`${appUrl()}/timeline`, "Past readings")} &nbsp;·&nbsp; ${footerLink(unsubscribeUrl(profile.id), "Pause these emails")}`;

  const preheader = reading.opening.split(/(?<=[.?!])\s/)[0] ?? reading.theme;
  return {
    subject: reading.headline,
    html: shell({ preheader, header: formatLongDate(reading.reading_date), body, footer }),
  };
}

export async function sendDailyEmail(profile: Profile, reading: Reading, first = false) {
  const { subject, html } = renderDailyEmail(profile, reading, first);
  await send(profile.email, subject, html, unsubscribeUrl(profile.id));
}

// ─── Sign-in link ────────────────────────────────────────────────────────────

export async function sendLoginEmail(email: string, firstName: string, link: string) {
  const body = [
    heading("Your readings are waiting"),
    p(`${escapeHtml(firstName)}, use the button below to sign in to Seraphova. The link works once and expires in an hour.`),
    button(link, "Sign in →"),
  ].join("");
  await send(
    email,
    "Your Seraphova sign-in link",
    shell({
      preheader: "Sign in to read your horoscope.",
      header: "Sign in",
      body,
      footer: "If you did not ask for this, you can ignore it.",
    }),
  );
}

// ─── Abandoned cart: four reminders for people who cast a chart but did not pay ──

/** Minutes after the quiz was completed at which each reminder becomes due. */
export const CART_DELAYS_MINUTES = [30, 24 * 60, 72 * 60, 120 * 60];

const capital = (text: string) => text.replace(/^./, (c) => c.toUpperCase());

export function renderCartEmail(profile: Profile, index: number, now: Date) {
  const name = escapeHtml(profile.first_name);
  const chart = profile.chart;
  const sun = placementOf(chart, "Sun");
  const moon = placementOf(chart, "Moon");
  const sky = computeDailySky(chart, now);
  const lead = sky.transits.find((t) => t.planet !== "Moon") ?? sky.transits[0];
  const transit = lead ? capital(describeTransit(lead)) : null;
  const focus = focusLabel(profile.focus).toLowerCase();
  const orderUrl = `${appUrl()}/order?p=${profile.id}`;
  const cta = button(orderUrl, `Get my year of readings — ${PRICE_LABEL}`);
  const placements = pills([
    `${sun.sign} Sun`,
    ...(chart.moonSignUncertain ? [] : [`${moon.sign} Moon`]),
    ...(chart.ascendant ? [`${chart.ascendant.sign} Rising`] : []),
  ]);

  const emails = [
    {
      subject: `${profile.first_name}, your chart is ready. Your reading isn't.`,
      preheader: "You were one step away.",
      body: [
        heading(`${profile.first_name}, your chart is cast.`),
        p(`You gave us your birth details, and we worked out where every planet stood over ${escapeHtml(profile.birth_city)} when you were born. That part is done, and it is saved.`),
        placements,
        transit ? insight("In the sky right now", `${transit}.`) : "",
        p(`What is missing is the reading: what that means for you today, with an eye on ${escapeHtml(focus)}. It is one step away.`),
        cta,
      ],
    },
    {
      subject: "What your chart says about right now",
      preheader: "This is what a sun-sign column cannot know.",
      body: [
        heading("This is what a horoscope column cannot know."),
        transit
          ? p(`Today, ${escapeHtml(describeTransit(lead!))}. A sun-sign column has no way of saying that, ${name}, because it does not know where anything in your chart is. It knows one thing about you: the month you were born.`)
          : p(`A sun-sign column knows one thing about you, ${name}: the month you were born. It has no idea where anything else in your chart is.`),
        p("Your Seraphova reading starts from the other end. Each morning we measure where the planets are against your own chart, and write to you about what is actually being touched."),
        placements,
        p(`You told us that ${escapeHtml(focus)} is what is most on your mind. Every reading is written toward it.`),
        cta,
      ],
    },
    {
      subject: "The sky has moved since you cast your chart",
      preheader: "It shifts every morning. That is what the readings follow.",
      body: [
        heading("The sky has already moved."),
        p(`Since you cast your chart, ${name}, the Moon has travelled on. It is in ${sky.moon.sign} now, ${sky.moon.phase.toLowerCase()}.`),
        transit ? insight("Touching your chart today", `${transit}.`) : "",
        p("It shifts like this every day, which is why one reading is never enough and why each of yours is written fresh that morning."),
        p(`<strong style="color:${TEXT};font-weight:600;">What a year includes:</strong><br>✦ &nbsp;365 readings from your full natal chart<br>✦ &nbsp;The whole reading in your inbox at ${profile.delivery_hour}am, your time<br>✦ &nbsp;When each phase peaks and when it eases<br>✦ &nbsp;Readings that remember, and build on each other<br>✦ &nbsp;One payment of ${PRICE_LABEL}. No subscription.`),
        cta,
      ],
    },
    {
      subject: "This is the last time we'll reach out.",
      preheader: "Your chart stays saved. This is our last note.",
      body: [
        heading("One last note, then we will leave you be."),
        p(`${name}, this is the last email we will send about your chart. It stays saved, and the link below keeps working whenever you are ready.`),
        placements,
        p(`If the readings do not feel genuinely personal to you, write to us within 7 days of joining and we refund you in full.`),
        cta,
        p(`<span style="color:${FAINT};">You will not hear from us again unless you join.</span>`),
      ],
    },
  ];

  const email = emails[index];
  const footer = `You are receiving this because you cast a chart on Seraphova.<br>${footerLink(unsubscribeUrl(profile.id), "Stop these emails")} &nbsp;·&nbsp; ${footerLink(appUrl(), "seraphova.com")}`;
  return {
    subject: email.subject,
    html: shell({ preheader: email.preheader, header: "Your birth chart", body: email.body.join(""), footer }),
  };
}

export async function sendCartEmail(profile: Profile, index: number, now: Date) {
  const { subject, html } = renderCartEmail(profile, index, now);
  await send(profile.email, subject, html, unsubscribeUrl(profile.id));
}
