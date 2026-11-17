"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { BASE, OUTCOME_LABEL } from "@/lib/ui";
import { PERSONAS } from "@/src/personas";
import type { PersonaId, Step, Study } from "@/src/types";

// Screenshots are taken at this viewport size, so boxes are positioned as percentages of it.
const VIEW = { w: 1280, h: 800 };

const ACTION_LABEL: Record<Step["action"]["type"], string> = {
  click: "Click",
  type: "Type",
  scroll: "Scroll",
  back: "Go back",
  give_up: "Give up",
  done: "Done",
};

function pct(box: { x: number; y: number; w: number; h: number }) {
  return {
    left: `${(box.x / VIEW.w) * 100}%`,
    top: `${(box.y / VIEW.h) * 100}%`,
    width: `${(box.w / VIEW.w) * 100}%`,
    height: `${(box.h / VIEW.h) * 100}%`,
  };
}

export default function StudyView({ study }: { study: Study }) {
  const [personaId, setPersonaId] = useState<PersonaId>(study.runs[0].persona);
  const [stepIndex, setStepIndex] = useState(0);
  const [playing, setPlaying] = useState(false);
  const replayRef = useRef<HTMLElement>(null);
  const listRef = useRef<HTMLOListElement>(null);

  const run = study.runs.find((r) => r.persona === personaId) ?? study.runs[0];
  const step = run.steps[Math.min(stepIndex, run.steps.length - 1)];
  const last = run.steps.length - 1;

  const go = useCallback(
    (persona: PersonaId, index: number, scroll = false) => {
      setPersonaId(persona);
      setStepIndex(index);
      setPlaying(false);
      if (scroll) replayRef.current?.scrollIntoView({ behavior: "smooth", block: "start" });
    },
    [],
  );

  useEffect(() => {
    if (!playing) return;
    if (stepIndex >= last) {
      setPlaying(false);
      return;
    }
    const t = setTimeout(() => setStepIndex((i) => i + 1), 1400);
    return () => clearTimeout(t);
  }, [playing, stepIndex, last]);

  // Keep the current line of the transcript in view.
  useEffect(() => {
    const el = listRef.current?.querySelector<HTMLElement>('[aria-current="step"]');
    const list = listRef.current;
    if (el && list) list.scrollTo({ top: el.offsetTop - list.clientHeight / 2 + el.clientHeight / 2, behavior: "smooth" });
  }, [stepIndex, personaId]);

  const onKey = (e: React.KeyboardEvent) => {
    if (e.key === "ArrowRight") setStepIndex((i) => Math.min(i + 1, last));
    if (e.key === "ArrowLeft") setStepIndex((i) => Math.max(i - 1, 0));
  };

  return (
    <>
      <section aria-labelledby="personas-h">
        <div className="section-head">
          <h2 id="personas-h">Who tried it</h2>
          <p>Pick a persona to watch its attempt.</p>
        </div>
        <div className="persona-grid">
          {study.runs.map((r) => {
            const p = PERSONAS[r.persona];
            const friction = r.steps.reduce((n, s) => n + s.friction.filter((f) => f.type !== "gave-up").length, 0);
            return (
              <button key={r.persona} className="persona-card" aria-pressed={r.persona === personaId} onClick={() => go(r.persona, 0)}>
                <span className={`chip ${r.outcome}`}>{OUTCOME_LABEL[r.outcome]}</span>
                <strong>{p.name}</strong>
                <span className="blurb">{p.blurb}</span>
                <span className="meta">
                  {r.steps.length} steps · {friction} friction {friction === 1 ? "point" : "points"}
                </span>
              </button>
            );
          })}
        </div>
      </section>

      <section ref={replayRef} className="replay" aria-labelledby="replay-h" onKeyDown={onKey}>
        <div className="section-head">
          <h2 id="replay-h">Replay: {PERSONAS[run.persona].name}</h2>
          <p>
            Step {step.index} of {run.steps.length} · <code>{step.path}</code>
          </p>
        </div>
        <div className="replay-body">
          <div className="stage">
            <div className="screen">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={`${BASE}/runs/${study.id}/${step.screenshot}`} alt={`Screenshot of ${step.path} at step ${step.index}`} width={VIEW.w} height={VIEW.h} />
              {step.action.box && (step.action.type === "click" || step.action.type === "type" || step.action.type === "scroll") && (
                <span className="hit" style={pct(step.action.box)} aria-hidden="true" />
              )}
              {step.missed.map((m) => (
                <span key={m.name} className="miss" style={pct(m.box)} aria-hidden="true" />
              ))}
            </div>
            <div className="controls">
              <button onClick={() => go(run.persona, Math.max(stepIndex - 1, 0))} disabled={stepIndex === 0}>
                ← Previous
              </button>
              <button
                className="play"
                onClick={() => {
                  if (stepIndex >= last) setStepIndex(0);
                  setPlaying((p) => !p);
                }}
              >
                {playing ? "Pause" : stepIndex >= last ? "Replay" : "Play"}
              </button>
              <button onClick={() => go(run.persona, Math.min(stepIndex + 1, last))} disabled={stepIndex === last}>
                Next →
              </button>
              <input
                type="range"
                min={0}
                max={last}
                value={stepIndex}
                onChange={(e) => go(run.persona, Number(e.target.value))}
                aria-label="Step"
              />
            </div>
            <p className="kbd-hint">
              Tip: use <kbd>←</kbd> <kbd>→</kbd> to step through, or pick any line in the transcript.
            </p>
            {step.missed.length > 0 && (
              <div className="missed-note">
                <strong>On this page but out of reach for this persona</strong>
                <ul>
                  {step.missed.map((m) => (
                    <li key={m.name}>
                      &ldquo;{m.name}&rdquo;: {m.reason}.
                    </li>
                  ))}
                </ul>
              </div>
            )}
          </div>

          <ol className="transcript" ref={listRef} aria-label="Think-aloud transcript">
            {run.steps.map((s, i) => (
              <li key={s.index} aria-current={i === stepIndex ? "step" : undefined}>
                <button onClick={() => go(run.persona, i)}>
                  <span className="n">{s.index}</span>
                  <span className="body">
                    <span className="thought">{s.thought}</span>
                    <span className="act">
                      {ACTION_LABEL[s.action.type]}
                      {s.action.target ? `: ${s.action.target}` : ""}
                    </span>
                    {s.friction.map((f) => (
                      <span key={f.type} className="flag">
                        {f.detail}.
                      </span>
                    ))}
                  </span>
                </button>
              </li>
            ))}
          </ol>
        </div>
      </section>

      <section aria-labelledby="findings-h">
        <div className="section-head">
          <h2 id="findings-h">Findings</h2>
          <p>{study.findings.length === 0 ? "No friction recorded. Every persona finished cleanly." : "Ranked by how badly each one hurt. Open the evidence to see the moment it happened."}</p>
        </div>
        <ul className="findings">
          {study.findings.map((f) => (
            <li key={f.id} className={f.severity}>
              <div className="sev">
                <span>{f.severity}</span>
              </div>
              <div>
                <h3>{f.title}</h3>
                <p>{f.detail}</p>
                <p className="fix">
                  <strong>Fix:</strong> {f.recommendation}
                </p>
                <p className="refs">
                  <code>{f.path}</code>
                  {f.wcag && <span>WCAG {f.wcag}</span>}
                  {f.evidence.map((e) => (
                    <button key={e.persona} onClick={() => go(e.persona, e.step - 1, true)}>
                      {PERSONAS[e.persona].name}, step {e.step}
                    </button>
                  ))}
                </p>
              </div>
            </li>
          ))}
        </ul>
      </section>

      {study.a11y.length > 0 && (
        <section aria-labelledby="axe-h">
          <div className="section-head">
            <h2 id="axe-h">Automated accessibility scan</h2>
            <p>From axe-core, run on every page a persona visited. A cross-check on the findings above.</p>
          </div>
          <table className="axe">
            <thead>
              <tr>
                <th>Rule</th>
                <th>Impact</th>
                <th>Page</th>
                <th>Elements</th>
              </tr>
            </thead>
            <tbody>
              {study.a11y.map((a) => (
                <tr key={`${a.rule}${a.path}`}>
                  <td>
                    <a href={a.helpUrl}>{a.help}</a>
                  </td>
                  <td>{a.impact}</td>
                  <td>
                    <code>{a.path}</code>
                  </td>
                  <td>{a.nodes}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </section>
      )}
    </>
  );
}
