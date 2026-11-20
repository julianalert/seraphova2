# Seraphova

A daily horoscope written from each member's birth chart.

Visitors take a seven-step quiz (birth date, birth time, city, focus, what keeps repeating, delivery
hour, name and email),
see their chart on the order page, pay $67 for one year, and then receive a personal reading every
morning at the hour they chose. Every reading is kept in their private timeline.

## How it works

| Piece | Where |
| --- | --- |
| Landing page | `app/page.tsx` |
| Quiz funnel (seven steps, adults only) | `app/begin/` |
| Order page and Stripe Checkout | `app/order/`, `app/welcome/route.ts`, `app/api/stripe/webhook/` |
| Sign-in by emailed link | `app/login/`, `app/auth/confirm/` |
| Timeline, reading pages, "On your mind" editor | `app/timeline/` |
| Birth chart and daily transits (real astronomy, via `astronomy-engine`) | `lib/astro/` |
| Transit dates and the slow chapters (Saturn return and the like) | `lib/astro/timing.ts`, `lib/astro/transits.ts` |
| Reading writer (OpenAI) | `lib/reading.ts` |
| Check of each reading against the computed sky | `lib/astro/factcheck.ts` |
| Engine verification against published events | `scripts/verify-astro.ts` |
| Member memory, summarized every 7 readings | `lib/memory.ts` |
| Emails (Resend): daily reading, sign-in, reminders | `lib/email.ts` |
| Daily delivery job | `app/api/cron/daily/route.ts` |
| Abandoned-cart reminders | `lib/cart.ts`, `app/api/cron/abandoned-cart/route.ts` |
| Funnel tracking | `lib/funnel.ts`, `lib/funnel-server.ts`, `app/api/track/route.ts` |
| Owner dashboard | `app/admin/`, `lib/admin-data.ts` |
| Design system (dark and light themes) | `app/globals.css` |
| Database schema | `supabase/schema.sql` |

**Readings.** Each morning the delivery job finds members whose chosen local hour has arrived,
computes the planets' positions for that moment against their chart, and asks the model to write the
reading from those transits plus their focus and personal note. It saves the reading and emails it
in full, with the transits behind it listed underneath ("Where this comes from").

**Voice.** The reading itself is in everyday language, with no astrology vocabulary: the astrology
is named only in the notes underneath, which are the reader's proof that it came from their chart.

**Dates.** For each transit the engine works out when it came into range, when it is exact, when it
ends and whether it comes back (`lib/astro/timing.ts`). It also finds the slow chapters: Saturn,
Uranus, Neptune or Pluto within a few degrees of a personal point, and the Saturn return, with the
dates each began and is over for good. The writer is given those dates, so a reading can say "this
eases by Friday" or "around next autumn" truthfully.

**First reading.** The order page shows the opening of the visitor's first reading, written when
they finish the quiz. It is saved, so it becomes the reading they receive the moment they join.

**Writing style.** A reading talks about the person and their day in everyday words. Its text
contains no astrology vocabulary (no planets, signs, houses or aspects); the astrology behind it is
listed at the end under "Where this comes from". Both rules are checked by machine, and a draft that
breaks them is rewritten once.

**Accuracy.** Positions are computed, not fetched: the same engine casts the birth chart and each
day's sky. `npm run verify:astro` checks it against published equinoxes, eclipses, the 2020 great
conjunction, Mercury retrogrades and historical timezone rules. Every reading is then checked against
the computed data (`lib/astro/factcheck.ts`): if it names a planet in the wrong sign, a wrong rising
sign, an aspect that is not there or a calendar date it was never given, it is rewritten once.

**Memory.** Readings build on each other. The writer is given the member's memory (a running summary
in `seraphova_profiles.memory`) and the readings sent since that summary, in brief. Once seven
readings have accumulated they are folded into the memory. Members can change what is on their mind
from their timeline; every version is kept in `seraphova_notes`, the latest one is used in all later
readings, and the change is carried into the memory.

**Funnel.** Each visitor gets a random id in their browser. Every quiz step, the order page view,
the checkout start and the payment are recorded once per visitor in `seraphova_funnel_events`.

**Abandoned cart.** Someone who finishes the quiz but does not pay gets up to four reminders, at
30 minutes, 24 hours, 72 hours and 120 hours. The sequence stops when they pay or unsubscribe.

**Dashboard.** `/admin` shows revenue, the funnel step by step, daily trends, reminder results, who
is filling the quiz, recent orders and unpaid leads. It is protected by `ADMIN_PASSWORD`.

**Themes.** Dark is the original Seraphova design. Light is derived from it. The site follows the
visitor's system setting, and the round button at the bottom right switches and remembers.

## Setup

1. **Supabase**: create a project, open the SQL editor and run `supabase/schema.sql`. It is safe to
   run again after an update. Copy the project URL, the anon key and the service role key.
2. **Stripe**: copy your secret key. Add a webhook endpoint at
   `https://YOUR_DOMAIN/api/stripe/webhook` for the event `checkout.session.completed` and copy its
   signing secret. No product needs to be created: the price is set in `lib/env.ts`.
3. **Resend**: verify your sending domain and create an API key.
4. **OpenAI**: create an API key. Readings use `gpt-5-mini` unless `OPENAI_MODEL` says otherwise.
5. Copy `.env.example` to `.env.local` and fill it in, including `ADMIN_PASSWORD` for the dashboard.
   Add the same variables to the Vercel project.
6. **Vercel**: import the project and deploy. `vercel.json` schedules the two jobs every 15 minutes,
   which needs a Pro plan (Hobby only allows one cron run per day). On Hobby, call
   `/api/cron/daily` and `/api/cron/abandoned-cart` every 15 minutes from any scheduler instead,
   sending the header `Authorization: Bearer $CRON_SECRET`.

## Local development

```bash
npm run dev
```

To receive Stripe webhooks locally:

```bash
stripe listen --forward-to localhost:3000/api/stripe/webhook
```

To run the jobs by hand:

```bash
curl -H "Authorization: Bearer $CRON_SECRET" http://localhost:3000/api/cron/daily
```

```bash
curl -H "Authorization: Bearer $CRON_SECRET" http://localhost:3000/api/cron/abandoned-cart
```

## Notes

- The city list in `data/cities.json` is built from GeoNames data (CC BY 4.0) by
  `scripts/build-cities.mjs`.
