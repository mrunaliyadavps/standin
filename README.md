# Standin

**Stand-in users that usability-test a website in a real browser, then show you where they got stuck.**

Give Standin a URL and a task. Four personas with different constraints try to complete it. Each one thinks out loud, and every step is recorded with a screenshot. You get a replay per persona and a ranked list of findings with WCAG references.

**[Open the live demo](https://mrunaliyadavps.github.io/standin/)** to watch the replays.

## Why I built it

As a product designer I run usability tests, and the first round almost always surfaces the same kind of problem: a vague label, a control that only looks like a button, grey text nobody can read. Those should never reach a real participant. I wanted a "round zero" that catches them in a minute, the way a linter catches a typo before code review.

## What it found on the demo site

The repo includes a small clinic booking site with problems planted on purpose, plus a fixed version of the same site. Same task, same personas:

| Persona | Before | After |
| --- | --- | --- |
| First-time visitor | Finished, with friction (12 steps) | Finished (10 steps) |
| In a hurry | Finished, with friction (13 steps) | Finished (10 steps) |
| Screen reader user | **Gave up** | Finished (10 steps) |
| Low-vision user | **Gave up** | Finished (10 steps) |

Before: 2 of 4 finished, 9 findings, 2 of them blockers. After: 4 of 4 finished, 0 findings.

The personas are not told where the problems are. The screen reader persona failed because the service cards were `<div>`s with click handlers, which assistive technology never announces. The low-vision persona filled in the whole form and then could not find the Submit button, which had 1.4:1 contrast. axe-core, run on the same pages, independently confirmed the unlabeled button and the contrast failures.

## The design decision that matters

**A persona's limits are enforced in code, not role-played.**

The obvious way to build this is to tell an AI model "pretend you are blind" and hand it the page. That does not work: the model can still see everything, so it cheats without meaning to.

Standin instead measures every control in the real browser (accessible name, size, text contrast, real control or clickable div) and filters that list per persona *before* any decision is made. The screen reader persona never receives a control that a screen reader would not announce. The low-vision persona never receives text under 12px or under 3:1 contrast. Whatever decides the next step, model or rules, can only choose from what that persona could actually perceive, and a reply that names anything else is rejected.

```
real browser ──> measure every control ──> filter by persona ──> decide ──> act ──> record
 (Playwright)     (name, size, contrast,     (enforced in code)   (AI model     (screenshot,
                   semantic or not)                                or rules)     thought, friction)
```

## Two engines

| Engine | Cost | What decides each step |
| --- | --- | --- |
| Scripted | Free, no key | Rules based on information scent: click the wording that best matches the task |
| AI | Free with a Gemini key, or paid with a Claude key | A language model, given only what the persona can perceive |

The scripted engine exists so the project runs for anyone at zero cost, gives identical results on every run, and can be tested end to end in CI.

**The bundled demo studies were recorded with the scripted engine**, and every report says which engine produced it. The AI engine's prompt building and reply validation are unit tested; I have not yet published a recorded AI run.

## Run it

```bash
npm install
npx playwright install chromium

npm run study -- --demo      # record the two bundled studies (takes about a minute)
npm run dev                  # open the report viewer at localhost:3000
```

Test your own site:

```bash
npm run study -- --url https://your-site.example --task "Sign up for the newsletter" --success-text "Thanks for subscribing"
```

To use the AI engine, copy `.env.example` to `.env` and add a key. A Gemini key is free at [aistudio.google.com/apikey](https://aistudio.google.com/apikey).

Only test sites you own or have permission to test. Standin fills forms with made-up details.

## Trade-offs and limits

- **This does not replace research with people.** Personas are simplified models. They have no real goals, no emotions and no prior experience. Standin is for catching the obvious early so that real participants' time goes on the hard questions.
- **Personas describe constraints, not demographics.** "Low-vision user" and "in a hurry" are situations anyone can be in. I avoided age or background stereotypes.
- **The screen reader persona is an approximation.** It models "is this control exposed with a role and a name", not full screen reader behaviour such as headings navigation or live regions.
- **Success needs a signal.** You tell Standin what "done" looks like (text on the page or a URL). It does not guess.
- **Things I rejected:** letting the model see screenshots (expensive, and it bypasses the perception filter), and scoring pages with a single "usability score" (a number hides the evidence; the replay is the evidence).

## How the code is organised

| Path | What it does |
| --- | --- |
| `src/browser/page-script.ts` | Runs inside the page. Measures every interactive element. |
| `src/personas.ts` | The four personas and what each can perceive. |
| `src/agent/scripted.ts` | The free rule-based engine. |
| `src/agent/llm.ts` | The AI engine: prompt, Gemini and Claude calls, reply validation. |
| `src/agent/run.ts` | The loop: observe, filter, decide, act, record. |
| `src/analysis/` | Groups friction into ranked findings, and runs axe-core. |
| `fixtures/clinic/` | The demo site, flawed and fixed versions in one set of files. |
| `app/`, `components/` | The report viewer (Next.js, static export). |
| `tests/` | Unit tests, plus an end-to-end test that runs the real browser against the demo site. |

There is a plain-language walkthrough in [docs/HOW-IT-WORKS.md](docs/HOW-IT-WORKS.md).

## Built with

TypeScript, Playwright, axe-core, Next.js, Zod, Vitest, GitHub Actions. Built with AI pair programming (Claude); commits are co-authored accordingly.

## License

MIT
