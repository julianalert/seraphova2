'use client';

import Link from 'next/link';
import { useEffect, useRef } from 'react';
import { PRICE_CENTS } from '@/lib/env';

const PRICE = PRICE_CENTS / 100;
const CENTS_PER_DAY = Math.round(PRICE_CENTS / 365);

export default function LandingPage() {
  const canvasRef = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    // Canvas starfield
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    let w = (canvas.width = window.innerWidth);
    let h = (canvas.height = window.innerHeight);
    const stars = Array.from({ length: 120 }, () => ({
      x: Math.random() * w,
      y: Math.random() * h,
      r: Math.random() * 1.2 + 0.2,
      o: Math.random() * 0.6 + 0.1,
      speed: Math.random() * 0.3 + 0.05,
    }));
    let t = 0;
    let animId: number;
    // Star colour comes from the theme, and is re-read when the theme changes.
    const readStarRgb = () =>
      getComputedStyle(document.documentElement).getPropertyValue('--star-rgb').trim() || '232,228,218';
    let starRgb = readStarRgb();
    const themeObserver = new MutationObserver(() => { starRgb = readStarRgb(); });
    themeObserver.observe(document.documentElement, { attributes: true, attributeFilter: ['data-theme'] });
    const schemeQuery = window.matchMedia('(prefers-color-scheme: light)');
    const onScheme = () => { starRgb = readStarRgb(); };
    schemeQuery.addEventListener('change', onScheme);

    function draw() {
      ctx!.clearRect(0, 0, w, h);
      t += 0.008;
      for (const s of stars) {
        const pulse = s.o + Math.sin(t * s.speed + s.x) * 0.15;
        ctx!.beginPath();
        ctx!.arc(s.x, s.y, s.r, 0, Math.PI * 2);
        ctx!.fillStyle = `rgba(${starRgb},${pulse})`;
        ctx!.fill();
      }
      animId = requestAnimationFrame(draw);
    }
    draw();

    function onResize() {
      w = canvas!.width = window.innerWidth;
      h = canvas!.height = window.innerHeight;
    }
    window.addEventListener('resize', onResize);

    // Nav scroll show/hide
    const nav = document.getElementById('landingNav');
    function onNavScroll() {
      if (!nav) return;
      if (window.scrollY > 20) {
        nav.classList.add('visible', 'scrolled');
      } else {
        nav.classList.remove('visible', 'scrolled');
      }
    }
    onNavScroll();
    window.addEventListener('scroll', onNavScroll, { passive: true });

    // Mobile drawer
    let menuOpen = false;
    const backdrop = document.getElementById('navBackdrop');
    const drawer = document.getElementById('navDrawer');
    const burger = document.getElementById('navBurger');

    function openMenu() {
      menuOpen = true;
      backdrop?.classList.add('visible');
      drawer?.classList.add('open');
      drawer?.setAttribute('aria-hidden', 'false');
      burger?.setAttribute('aria-expanded', 'true');
      document.body.style.overflow = 'hidden';
    }
    function closeMenu() {
      menuOpen = false;
      backdrop?.classList.remove('visible');
      drawer?.classList.remove('open');
      drawer?.setAttribute('aria-hidden', 'true');
      burger?.setAttribute('aria-expanded', 'false');
      document.body.style.overflow = '';
    }

    burger?.addEventListener('click', () => { if (menuOpen) closeMenu(); else openMenu(); });
    backdrop?.addEventListener('click', closeMenu);

    const onEsc = (e: KeyboardEvent) => { if (e.key === 'Escape' && menuOpen) closeMenu(); };
    document.addEventListener('keydown', onEsc);

    // Close drawer on drawer link click
    drawer?.querySelectorAll('a').forEach(a => a.addEventListener('click', closeMenu));

    // FAQ accordion
    const faqItems = document.querySelectorAll('.faq-item');
    const faqHandlers: Array<[Element, () => void]> = [];
    faqItems.forEach(item => {
      const btn = item.querySelector('.faq-q');
      if (!btn) return;
      const handler = () => {
        const isOpen = item.classList.contains('open');
        faqItems.forEach(i => i.classList.remove('open'));
        if (!isOpen) item.classList.add('open');
      };
      btn.addEventListener('click', handler);
      faqHandlers.push([btn, handler]);
    });

    // Scroll reveal
    const observer = new IntersectionObserver(
      entries =>
        entries.forEach(el => {
          if (el.isIntersecting) {
            (el.target as HTMLElement).style.opacity = '1';
            (el.target as HTMLElement).style.transform = 'none';
          }
        }),
      { threshold: 0.1 }
    );
    document
      .querySelectorAll('.problem-item, .how-step, .testi-card, .agitate-item')
      .forEach(el => {
        (el as HTMLElement).style.opacity = '0';
        (el as HTMLElement).style.transform = 'translateY(20px)';
        (el as HTMLElement).style.transition = 'opacity 0.6s ease, transform 0.6s ease';
        observer.observe(el);
      });

    return () => {
      cancelAnimationFrame(animId);
      window.removeEventListener('resize', onResize);
      window.removeEventListener('scroll', onNavScroll);
      document.removeEventListener('keydown', onEsc);
      faqHandlers.forEach(([btn, handler]) => btn.removeEventListener('click', handler));
      observer.disconnect();
      themeObserver.disconnect();
      schemeQuery.removeEventListener('change', onScheme);
    };
  }, []);

  return (
    <>
      <canvas ref={canvasRef} className="stars-canvas" />
      <div className="aurora" />

      {/* Mobile nav backdrop */}
      <div className="drawer-backdrop" id="navBackdrop" />

      {/* Mobile nav drawer */}
      <div className="nav-drawer drawer" id="navDrawer" aria-hidden="true">
        <div className="nav-drawer-header">
          <div className="nav-drawer-logo"><span>✦</span> SERAPHOVA</div>
        </div>
        <a href="#problem" className="nav-drawer-item">The problem</a>
        <a href="#how" className="nav-drawer-item">How it works</a>
        <a href="#features" className="nav-drawer-item">What you get</a>
        <a href="#pricing" className="nav-drawer-item">Pricing</a>
        <a href="#faq" className="nav-drawer-item">FAQ</a>
        <Link href="/login" className="nav-drawer-item">Sign in</Link>
        <div className="nav-drawer-divider" />
        <Link href="/begin" className="nav-drawer-item">Start my reading →</Link>
      </div>

      {/* Fixed navbar — hidden until scroll */}
      <nav className="landing-nav" id="landingNav">
        <Link href="/" className="landing-nav-logo">
          <span className="landing-nav-mark">✦</span> SERAPHOVA
        </Link>
        <div className="landing-nav-links">
          <a href="#problem">The problem</a>
          <a href="#how">How it works</a>
          <a href="#features">What you get</a>
          <a href="#pricing">Pricing</a>
          <a href="#faq">FAQ</a>
          <Link href="/login">Sign in</Link>
        </div>
        <div className="landing-nav-ctas">
          <button
            type="button"
            className="landing-nav-burger"
            id="navBurger"
            aria-label="Open menu"
            aria-expanded="false"
          >
            <span className="burger-icon" aria-hidden="true">
              <span /><span /><span />
            </span>
          </button>
          <Link href="/begin" className="btn btn-gold">Start my reading</Link>
        </div>
      </nav>

      <div className="page">

        {/* HERO */}
        <section className="hero">
          <div className="hero-orbit">
            <div className="hero-orbit-dot" />
            <div className="hero-center">✦</div>
          </div>
          
          <h1 className="hero-title">
            You know your chart.<br /><em>Now use it, every morning.</em>
          </h1>
          <p className="hero-desc">
            Each morning we work out what the sky is doing to your birth chart and send you one
            calm, specific reading: what is being stirred today, and what to do about it.
          </p>
          <div className="hero-ctas">
            <Link href="/begin" className="btn btn-gold btn-xl">Start your reading →</Link>
          </div>
          <p className="hero-trust">
            One payment of ${PRICE} for a year · No subscription · 7-day money-back guarantee
          </p>
          <div className="scroll-hint">
            <div className="scroll-hint-line" />
            <span>Scroll</span>
          </div>
        </section>

        {/* EMAIL PREVIEW */}
        <div className="email-preview-wrap">
          <div className="container" style={{ display: 'flex', justifyContent: 'center' }}>
            <div className="email-preview">
              <div className="email-header">
                <div className="email-avatar">✦</div>
                <div className="email-meta">
                  <div className="email-from">Seraphova · Your Daily Reading</div>
                  <div className="email-subject">
                    The conversation you&apos;ve been circling is finally speakable
                  </div>
                </div>
                <div className="email-time">7:02 AM</div>
              </div>
              <div className="email-body">
                <div className="email-date-line">Thursday · June 18 · Your chart</div>
                <div className="email-greeting">Good morning, Sofia.</div>
                <p className="email-text">
                  There&apos;s a conversation you&apos;ve been circling for weeks, with someone close
                  to you. You tend to hold things in until you&apos;ve found the perfect wording — and
                  then the moment has passed. Today is different:{' '}
                  <strong>the simple version is enough, and it will be heard.</strong>
                </p>
                <p className="email-text">
                  Words come easier than usual this morning. Use that. Say the true thing plainly,
                  before lunch if you can. The window stays open until the weekend.
                </p>
                <div className="email-divider" />
                <div className="email-date-line">Where this comes from</div>
                <div className="email-planet-row">
                  <span className="email-planet-tag">☿ Mercury trine your Venus</span>
                  <span className="email-planet-tag">♀ Venus in your 7th house</span>
                  <span className="email-planet-tag">Eases Saturday</span>
                </div>
                <p className="email-footer-note">
                  An example. Yours is written from your own chart, in plain words, with the astrology
                  behind it listed underneath.
                </p>
              </div>
            </div>
          </div>
        </div>

        {/* PROBLEM */}
        <section className="section-problem" id="problem">
          <div className="container">
            <p className="section-eyebrow">The problem</p>
            <h2 className="section-title">
              You have the chart.<br /><em>Nobody translates it.</em>
            </h2>
            <p className="section-body">
              You know your big three. You&apos;ve read what your placements mean. What you
              don&apos;t have is someone who looks at the sky each morning and tells you what it is
              doing to your chart today.
            </p>
            <ol className="problem-list">
              <li className="problem-item">
                <div className="problem-left">
                  <span className="problem-num">01</span>
                  <span className="problem-label">🔁 Stuck in a cycle</span>
                </div>
                <div className="problem-right">
                  <p>
                    The same pattern in love, the same wall at work, a heavy stretch that has lasted
                    two or three years. You suspect a slow transit is behind it.{' '}
                    <strong>Nobody has told you which one, or when it ends.</strong>
                  </p>
                </div>
              </li>
              <li className="problem-item">
                <div className="problem-left">
                  <span className="problem-num">02</span>
                  <span className="problem-label">🌫 Apps that speak in riddles</span>
                </div>
                <div className="problem-right">
                  <p>
                    A notification that is blunt before your first coffee. A line about
                    &ldquo;your shadow.&rdquo; <strong>A warning with no advice attached.</strong>{' '}
                    You swipe it away and get on with your day.
                  </p>
                </div>
              </li>
              <li className="problem-item">
                <div className="problem-left">
                  <span className="problem-num">03</span>
                  <span className="problem-label">🌑 Transits that sound scary</span>
                </div>
                <div className="problem-right">
                  <p>
                    Pluto, Saturn, eclipse season. You look up what is coming, read something
                    alarming at midnight and sleep badly.{' '}
                    <strong>What you needed was how it touches your chart, and what to do.</strong>
                  </p>
                </div>
              </li>
              <li className="problem-item">
                <div className="problem-left">
                  <span className="problem-num">04</span>
                  <span className="problem-label">💳 Subscriptions that never end</span>
                </div>
                <div className="problem-right">
                  <p>
                    A cheap trial that turns into a weekly charge. Another monthly fee for something
                    you read twice. <strong>You&apos;ve learned to check the small print.</strong>
                  </p>
                </div>
              </li>
            </ol>
          </div>
        </section>

        {/* AGITATE */}
        <section className="agitate">
          <div className="container">
            <p className="section-eyebrow">The real cost</p>
            <blockquote className="agitate-quote">
              I&apos;ve been into astrology for years. I know my chart. I just can&apos;t figure out
              how to apply it to my actual life, every actual day.
            </blockquote>
            <p className="agitate-author">— What every astrology-curious person says eventually</p>
            <div className="agitate-list">
              {[
                {
                  icon: '⚡',
                  text: (
                    <>
                      You know your Scorpio rising means you feel things more intensely than you
                      show. You know your Libra moon means you avoid conflict. But{' '}
                      <strong>nobody tells you what to do with that information today</strong>, when
                      Venus is squaring your natal Mars.
                    </>
                  ),
                },
                {
                  icon: '🔁',
                  text: (
                    <>
                      You open Co-Star. It says something cryptic about &ldquo;your shadow.&rdquo;
                      You open your daily horoscope. It says{' '}
                      <strong>this is a good day for creativity</strong>. You close both apps and go
                      about your day.
                    </>
                  ),
                },
                {
                  icon: '💭',
                  text: (
                    <>
                      You&apos;ve saved the chart, read the placement threads, maybe asked a forum
                      why you keep repeating the same thing.{' '}
                      <strong>You got three answers that didn&apos;t agree</strong>, and your chart
                      went back to sitting there, unread.
                    </>
                  ),
                },
              ].map((item, i) => (
                <div className="agitate-item" key={i}>
                  <span className="agitate-item-icon">{item.icon}</span>
                  <p>{item.text}</p>
                </div>
              ))}
            </div>
          </div>
        </section>

        {/* SOLUTION */}
        <section className="solution" id="how">
          <div className="container">
            <div className="solution-intro">
              <div>
                <p className="section-eyebrow">The solution</p>
                <h2 className="section-title">A daily letter that actually <em>knows you.</em></h2>
              </div>
              <div>
                <p className="section-body">Seraphova takes your complete natal chart — sun, moon, rising, Venus, Mars, every house — measures it against today&apos;s real planetary transits, and writes you a reading that lands in your inbox before you start your day.</p>
                <p className="section-body" style={{ marginTop: 16 }}>It reads like a note from a friend who knows your chart: what today is likely to stir, one thing worth doing, and when the window closes. The astrology behind it is listed at the end, so you can check it.</p>
              </div>
            </div>
            <div className="solution-steps">
              {[
                { n: '1', title: 'Answer a short quiz', desc: "Tell us your birth date, time, and place. Add a few details about what's on your mind — love, work, decisions, transitions. Takes 3 minutes." },
                { n: '2', title: 'We build your complete chart', desc: 'Every planet. Every house. Every transit happening today. Your chart becomes the permanent lens through which your readings are written.' },
                { n: '3', title: 'Your reading arrives every morning', desc: "At the hour you choose, before your day starts. The whole reading is in the email: what today's sky means for your chart, and one concrete thing to do with it." },
              ].map(s => (
                <div className="solution-step" key={s.n}>
                  <div className="step-number">{s.n}</div>
                  <div className="step-content">
                    <h3>{s.title}</h3>
                    <p>{s.desc}</p>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </section>

        {/* WHAT YOU GET */}
        <section className="section-features" id="features">
          <div className="container">
            <p className="section-eyebrow">What&apos;s inside every reading</p>
            <h2 className="section-title">
              Everything that&apos;s <em>actually</em> relevant.
            </h2>
            <ol className="problem-list">
              {[
                {
                  n: '01',
                  icon: '🌙',
                  title: 'Full natal chart analysis',
                  desc: 'Sun, moon, rising, Venus, Mars, Jupiter, Saturn — your complete placements shape every reading you receive.',
                },
                {
                  n: '02',
                  icon: '🌍',
                  title: 'Real-time transits',
                  desc: "Each morning we measure where the planets are against your own chart and write about what is actually being touched. In plain words — with the transits behind it listed at the end, so you can check them.",
                },
                {
                  n: '03',
                  icon: '🗓',
                  title: 'Dates, not just moods',
                  desc: "When a stretch began, when it peaks and when it eases, worked out for your chart. That includes the slow, heavy ones, like a Saturn return.",
                },
                {
                  n: '04',
                  icon: '💫',
                  title: 'Your personal focus areas',
                  desc: "Love, career, decisions, change — your reading is weighted toward what you're actually navigating right now, and toward the pattern you tell us keeps repeating.",
                },
                {
                  n: '05',
                  icon: '📬',
                  title: 'Delivered before you start',
                  desc: "Every morning at the hour you choose, the whole reading in your inbox. No app to open. No notification to ignore.",
                },
                {
                  n: '06',
                  icon: '✦',
                  title: 'One clear, actionable insight',
                  desc: "Not a wall of cosmic theory. A specific, concrete thing to know — or do — based on what the sky is doing to your chart today.",
                },
                {
                  n: '07',
                  icon: '🔮',
                  title: 'New moon & full moon callouts',
                  desc: 'New moons and full moons flagged in advance — and always in the context of what they mean for your specific placements.',
                },
              ].map(f => (
                <li className="problem-item" key={f.n}>
                  <div className="problem-left">
                    <span className="problem-num">{f.n}</span>
                    <span className="problem-label">
                      {f.icon} {f.title}
                    </span>
                  </div>
                  <div className="problem-right">
                    <p>{f.desc}</p>
                  </div>
                </li>
              ))}
            </ol>
          </div>
        </section>

        {/* TESTIMONIALS */}
        <section className="testimonials">
          <div className="container">
            <p className="section-eyebrow">The tone</p>
            <h2 className="section-title">
              No doom.<br /><em>No riddles.</em>
            </h2>
            <p className="section-body" style={{ margin: '0 auto' }}>
              Hard days get written kindly. A heavy transit is described as what it is: a phase
              with a start, a peak and an end, and one thing you can do inside it.
            </p>
            <div className="tone-grid">
              <div className="testi-card">
                <div className="tone-label">What you&apos;re used to</div>
                <p className="testi-text">
                  &ldquo;The cosmos invites transformation today. Embrace the shadow.&rdquo;
                </p>
                <div className="testi-sign">A warning, and nothing to do with it.</div>
              </div>
              <div className="testi-card tone-card-good">
                <div className="tone-label">A hard day, the Seraphova way</div>
                <p className="testi-text">
                  &ldquo;This is a heavy stretch, and it is not in your head. It began last spring,
                  it is at its most demanding now, and it eases for good by early autumn. It is not
                  asking you to fix your whole life this week. Today, pick the one obligation you
                  have outgrown and say so, out loud, to one person.&rdquo;
                </p>
                <div className="testi-sign">An example · Written from a Saturn return at its peak</div>
              </div>
            </div>
          </div>
        </section>

        {/* PRICING */}
        <section className="pricing" id="pricing">
          <div className="container">
            <p className="section-eyebrow">Start your reading</p>
            <h2 className="section-title">
              One price.<br /><em>Every morning.</em>
            </h2>
            <p className="section-body" style={{ margin: '0 auto' }}>
              No free plan with locked features. No confusing tiers. One payment — your full chart,
              your daily reading, every day for a year.
            </p>
            <div className="pricing-wrap">
              <div className="pricing-card featured">
                <div className="pricing-label-sm">Daily personalized horoscope</div>
                <div className="pricing-price">
                  <sup>$</sup>{PRICE}
                </div>
                <div className="pricing-period">one-time payment · 365 daily readings</div>
                <div className="pricing-divider" />
                <div className="pricing-features">
                  {[
                    'Full natal chart reading (every planet, every house)',
                    '365 daily emails — at the hour you choose',
                    'Real-time planetary transits mapped to your chart',
                    'When each phase peaks and when it eases',
                    'Readings that build on each other, day after day',
                    'No subscription, no recurring charge — ever',
                    '7-day money-back guarantee',
                  ].map(feat => (
                    <div className="pricing-feat" key={feat}>
                      <span className="pricing-feat-check">✦</span>
                      {feat}
                    </div>
                  ))}
                </div>
                <Link href="/begin" className="btn btn-gold pricing-btn">
                  Begin your reading →
                </Link>
              </div>
            </div>
            <p className="trial-note">
              About {CENTS_PER_DAY} cents a day · Takes 3 minutes to set up · Your first reading
              arrives within minutes
            </p>
            <p className="trial-note" style={{ marginTop: 8 }}>
              If the readings don&apos;t feel personal to you, tell us within 7 days and we refund
              you in full.
            </p>
          </div>
        </section>

        {/* FAQ */}
        <section className="faq" id="faq">
          <div className="container">
            <p className="section-eyebrow">Questions</p>
            <h2 className="section-title">
              Everything you<br />might be wondering.
            </h2>
            <div className="faq-list">
              {[
                {
                  q: 'How is this different from the astrology apps I already use?',
                  a: "Most apps give you a chart, a feed and a push notification, and leave the translating to you. Seraphova does the translating: every morning it measures the day's transits against your whole chart and writes you one reading about what that means and what to do with it. It comes by email, it remembers what it told you last week, and it tells you when a phase is due to ease.",
                },
                {
                  q: 'How are the readings made? Is it AI?',
                  a: "Two parts. The astronomy is calculated, not guessed: we compute where every planet was when you were born and where it is this morning, and measure one against the other (tropical zodiac, whole sign houses). The writing is done by an AI model that is given those exact positions, your focus and what you've told us. No astrologer writes each email by hand. Before a reading is sent, it is checked against the computed positions, and sent back for a rewrite if it names a placement or an aspect that isn't there. The transits behind each reading are listed at the end, so you can check them against any chart tool you trust.",
                },
                {
                  q: "Do I need to know my exact birth time?",
                  a: "Your birth time gives us your rising sign and your houses, which makes the readings noticeably more specific. It is usually on your birth certificate (ask for the long-form version if yours doesn't show it), or a parent may remember. If you can't find it, tick “I don't know my birth time” in the quiz: we cast your chart for midday, leave out the rising sign and houses, and say so honestly rather than guess.",
                },
                {
                  q: 'Will it make me anxious?',
                  a: "It is written not to. No doom, no riddles, no predictions of disaster. When a hard transit is in play, the reading says so plainly, tells you roughly how long it lasts and gives you one small thing to do inside it. It never tells you what to do about your health, your money or your safety.",
                },
                {
                  q: 'What time does the email arrive?',
                  a: "At the hour you choose — 6, 7, 8 or 9am in your local timezone, every morning. The idea is that it's there before your day starts — a quiet, personal moment before the noise begins.",
                },
                {
                  q: 'Is the reading different every day?',
                  a: "Yes — every reading is generated fresh based on the actual planetary transits of that day, mapped to your specific chart. Some days will be quieter cosmically; those readings reflect that. On significant transit days — a full moon hitting your 1st house, Venus stationing direct — the readings go deeper.",
                },
                {
                  q: 'Is this a subscription?',
                  a: `No. It's one payment of $${PRICE} for a full year of daily readings, about ${CENTS_PER_DAY} cents a day, and it never renews by itself. There is nothing to cancel. If the readings don't feel personal to you, tell us within 7 days and we refund you in full. If you'd rather not get the morning email, one click in any email pauses it — your readings keep waiting for you in your personal space.`,
                },
              ].map(f => (
                <div className="faq-item" key={f.q}>
                  <div className="faq-q">
                    {f.q}
                    <span className="faq-q-icon">+</span>
                  </div>
                  <div className="faq-a">{f.a}</div>
                </div>
              ))}
            </div>
          </div>
        </section>

        {/* FINAL CTA */}
        <section className="final-cta">
          <div className="container">
            <p className="section-eyebrow">Your chart is waiting</p>
            <h2 className="section-title">
              Your chart is cast once.<br /><em>The sky moves every day.</em>
            </h2>
            <p className="section-body">
              You already know what your chart says about you. Find out what today is doing to it,
              and what to do about that.
            </p>
            <Link href="/begin" className="btn btn-gold btn-xl">
              Begin your reading →
            </Link>
            <p className="hero-trust" style={{ marginTop: 20 }}>
              One payment of ${PRICE} · No subscription · 7-day money-back guarantee
            </p>
          </div>
        </section>

        {/* FOOTER */}
        <footer className="landing-footer">
          <div className="footer-logo">✦ Seraphova</div>
          <div className="footer-links">
            <a href="#how">How it works</a>
            <a href="#pricing">Pricing</a>
            <a href="#faq">FAQ</a>
            <Link href="/login">Sign in</Link>
          </div>
          <p className="footer-copy">© 2026 Seraphova. Your chart. Your sky.</p>
        </footer>
      </div>
    </>
  );
}
