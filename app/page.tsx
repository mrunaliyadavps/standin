import Link from "next/link";
import { loadStudies } from "@/lib/studies";
import { engineLabel, finished, OUTCOME_LABEL, REPO_URL } from "@/lib/ui";
import { PERSONAS } from "@/src/personas";

export default function Home() {
  const studies = loadStudies();
  const before = studies.find((s) => s.id === "clinic-before");
  const after = studies.find((s) => s.id === "clinic-after");
  const firstStudy = before ?? studies[0];

  return (
    <>
      <section className="hero">
        <p className="eyebrow">Usability testing, round zero</p>
        <h1>Send stand-in users through your site before real ones arrive.</h1>
        <p className="lede">
          Give Standin a website and a task. Four personas with different constraints try it in a real browser, think out loud, and show you exactly where they got stuck.
        </p>
        <div className="cta-row">
          {firstStudy && (
            <Link href={`/study/${firstStudy.id}`} className="btn btn-primary">
              Watch a replay
              <span aria-hidden="true">→</span>
            </Link>
          )}
          {REPO_URL && (
            <a href={REPO_URL} className="btn btn-quiet">
              View the source
            </a>
          )}
        </div>
      </section>

      {before && after && (
        <section className="compare" aria-labelledby="compare-h">
          <div className="section-head">
            <h2 id="compare-h">Same task, same personas, before and after the fixes</h2>
            <p>
              Task: &ldquo;{before.task}&rdquo; on a demo clinic site with deliberately planted problems. {engineLabel(before)}.
            </p>
          </div>
          <div className="compare-grid">
            {[before, after].map((s, i) => (
              <Link key={s.id} href={`/study/${s.id}`} className={`compare-card ${i === 0 ? "is-before" : "is-after"}`}>
                <span className="tag">{i === 0 ? "Before the fixes" : "After the fixes"}</span>
                <span className="big">
                  <span className="num">{finished(s)}</span>
                  <span className="of">of {s.runs.length} personas finished</span>
                </span>
                <span className="meter" aria-hidden="true">
                  {s.runs.map((r) => (
                    <span key={r.persona} className={`seg ${r.outcome}`} />
                  ))}
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
                  <span>
                    {s.findings.length} {s.findings.length === 1 ? "finding" : "findings"}
                  </span>
                  <span className="more-link">
                    Watch the replays <span aria-hidden="true">→</span>
                  </span>
                </span>
              </Link>
            ))}
          </div>
        </section>
      )}

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
