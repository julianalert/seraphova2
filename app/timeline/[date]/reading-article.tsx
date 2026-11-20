import Link from "next/link";
import { formatLongDate } from "@/lib/time";
import type { Reading } from "@/lib/types";

export function ReadingArticle({ reading }: { reading: Reading }) {
  const paragraphs = reading.opening.split(/\n\s*\n/);

  return (
    <article className="screen">
      <Link href="/timeline" className="nav-action">
        ← All readings
      </Link>

      <header className="reading-head">
        <p className="section-eyebrow">{formatLongDate(reading.reading_date)}</p>
        <h1 className="reading-title">{reading.headline}</h1>
        <div className="chips">
          <span className="chip">{reading.theme}</span>
        </div>
      </header>

      <div className="reading-body">
        {paragraphs.map((text, i) => (
          <p key={i}>{text}</p>
        ))}

        {reading.sections.map((section) => (
          <section key={section.heading}>
            <h2>{section.heading}</h2>
            {section.body.split(/\n\s*\n/).map((text, i) => (
              <p key={i}>{text}</p>
            ))}
          </section>
        ))}

        <div className="horo-insight">
          <p className="horo-insight-label">Today&rsquo;s invitation</p>
          <p className="horo-insight-text">{reading.invitation}</p>
        </div>
      </div>

      <aside className="reading-sky">
        <p className="section-eyebrow">Where this comes from</p>
        <ul>
          {(reading.sky.notes ?? []).map((note) => (
            <li key={note.transit}>
              <strong>{note.transit}</strong>
              <span>{note.meaning}</span>
            </li>
          ))}
          <li>
            <strong>
              {reading.sky.moon.phase}, Moon in {reading.sky.moon.sign}
            </strong>
            <span>The Moon sets the background mood of the day.</span>
          </li>
        </ul>
        <p className="reading-sky-foot">Worked out from your birth chart and where the planets are today.</p>
      </aside>
    </article>
  );
}
