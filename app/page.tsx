import Link from "next/link";
import { loadStudies } from "@/lib/studies";
import { engineLabel, finished, OUTCOME_LABEL } from "@/lib/ui";
import { PERSONAS } from "@/src/personas";

export default function Home() {
  const studies = loadStudies();
  const before = studies.find((s) => s.id === "clinic-before");
  const after = studies.find((s) => s.id === "clinic-after");

  return (
    <>
      <section className="hero">
        <p className="eyebrow">Usability testing, round zero</p>
        <h1>Send stand-in users through your site before real ones arrive.</h1>
        <p className="lede">
          Give Standin a website and a task. Four personas with different constraints try it in a real browser, think out loud, and show you exactly where they got stuck.
        </p>
      </section>

      {before && after && (
        <section className="compare" aria-labelledby="compare-h">
          <div className="section-head">
            <h2 id="compare-h">Same task, same personas, before and after the fixes</h2>
            <p>Task: &ldquo;{before.task}&rdquo; on a demo clinic site with deliberately planted problems.</p>
          </div>
          <div className="compare-grid">
            {[before, after].map((s, i) => (
              <Link key={s.id} href={`/study/${s.id}`} className="compare-card">
                <span className="tag">{i === 0 ? "Before" : "After"}</span>
                <span className="big">
                  {finished(s)}<small> of {s.runs.length} finished</small>
                </span>
                <ul>
                  {s.runs.map((r) => (
                    <li key={r.persona}>
                      <span>{PERSONAS[r.persona].name}</span>
                      <span className={`chip ${r.outcome}`}>{OUTCOME_LABEL[r.outcome]}</span>
                    </li>
                  ))}
                </ul>
                <span className="more">
                  {s.findings.length} findings · Watch the replays →
                </span>
              </Link>
            ))}
          </div>
        </section>
      )}

      <section aria-labelledby="studies-h">
        <div className="section-head">
          <h2 id="studies-h">Studies</h2>
        </div>
        <ul className="study-list">
          {studies.map((s) => (
            <li key={s.id}>
              <Link href={`/study/${s.id}`}>
                <strong>{s.title}</strong>
                <span>{s.site}</span>
                <span className="meta">
                  {finished(s)}/{s.runs.length} finished · {s.findings.length} findings · {engineLabel(s)}
                </span>
              </Link>
            </li>
          ))}
        </ul>
      </section>

      <section id="how" aria-labelledby="how-h">
        <div className="section-head">
          <h2 id="how-h">How it works</h2>
        </div>
        <ol className="how">
          <li>
            <h3>Measure the page</h3>
            <p>Standin opens the site in a real browser and measures every control: its accessible name, size, text contrast, and whether it is a real button or only looks like one.</p>
          </li>
          <li>
            <h3>Filter by persona</h3>
            <p>Each persona only receives what it could actually perceive. A screen reader persona never sees a clickable div. A low-vision persona never sees 11px grey text. The limits are enforced in code, not role-played.</p>
          </li>
          <li>
            <h3>Decide, act, record</h3>
            <p>An AI model, or a free rule-based engine, picks the next step and says why. Every step is saved with a screenshot, then grouped into ranked findings with WCAG references.</p>
          </li>
        </ol>
      </section>

      <section id="limits" aria-labelledby="limits-h">
        <div className="section-head">
          <h2 id="limits-h">What this is not</h2>
        </div>
        <div className="limits">
          <p>Standin does not replace usability testing with people. Personas are simplified models. They do not get confused by jargon the way people do, and they do not bring real goals or emotions.</p>
          <p>Use it the way you would use a linter: to catch the obvious before you spend real participants&rsquo; time on it.</p>
        </div>
      </section>
    </>
  );
}
