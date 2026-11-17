# How Standin works, in plain language

This is the walkthrough to read before talking about the project in an interview.

## The one-sentence version

Standin opens a website in a real browser, measures everything you can click, hides the things a given persona could not perceive, and then lets that persona try to finish a task while recording every step.

## The loop (`src/agent/run.ts`)

Each persona repeats five things until it finishes, gives up, or runs out of steps:

1. **Check if the task is done.** You told Standin what "done" looks like, for example the words "Appointment confirmed" on the page.
2. **Observe.** A script runs inside the page (`src/browser/page-script.ts`) and lists every interactive element with its accessible name, size, font size, contrast ratio, and whether it is a real control (`<button>`, `<a>`, has a role) or only looks clickable.
3. **Filter.** `persona.canPerceive()` removes what this persona could not perceive. This is the key idea of the project.
4. **Decide.** Either the scripted engine or an AI model picks one action (click, type, scroll, go back, give up) and a one-line thought.
5. **Act and record.** Playwright performs the action. Standin saves a screenshot, the thought, where the target was on screen, and any friction.

## Why filter in code instead of asking the AI to pretend

If you give a model the whole page and say "you are blind", it still knows the clickable div is there and tends to use it. By removing the div from what the model receives, the persona *cannot* cheat. The model's reply is also validated: if it names an element that was not in its list, the reply is rejected and it is asked again (once), then the persona gives up.

## The scripted engine (`src/agent/scripted.ts`)

It follows "information scent": people click the words that best match their goal.

- It turns the task into keywords and adds synonyms ("book" also matches "schedule", "appointment").
- It scores each visible control: task words score highest, generic progress words like "Continue" score a little, "Cancel" scores negative.
- If nothing matches, it tries the first untried control in the page content.
- It fills in empty form fields with made-up details.
- If nothing is left, it scrolls, goes back, or gives up.

It knows nothing about the demo site. It is free and gives the same result every time, which is why the end-to-end test can rely on it.

## Friction and findings (`src/analysis/findings.ts`)

While a persona acts, Standin notes friction:

- **unlabeled control**: no text and no accessible name
- **ambiguous label**: link text like "here"
- **small target**: under 24 by 24 pixels (WCAG 2.5.8)
- **low contrast**: under 4.5:1 (WCAG 1.4.3)
- **detour**: went to a page, found nothing, came back
- **not announced / unreadable**: controls that exist but this persona could not perceive at the moment it was stuck

The same problem seen by several personas becomes one finding with more evidence. A finding is a **blocker** if it is what stopped a persona that failed.

## The demo site (`fixtures/clinic/`)

A fictional clinic with five planted problems: a nav link that promises the task but leads to a policy page, a tiny grey "here" link, service cards built as `<div>`s, an icon-only "next" button with no label, and a Submit button that looks disabled. Each HTML file holds both versions, marked with `<!--v1-->` and `<!--v2-->` comments, and the local server serves one or the other.

## Questions you may get, and honest answers

**"Is this real AI?"** There are two engines. The demo was recorded with the rule-based one so it is free and repeatable. The AI engine uses Gemini or Claude and is constrained by the same perception filter.

**"How do you know it's accurate?"** Three ways: the demo site has known planted problems and the test suite checks they are found; axe-core runs on the same pages as a cross-check; and the fixed site produces zero findings.

**"Does this replace user research?"** No, and the product says so on its home page. It is a linter for usability, used before real sessions.

**"What would you do next?"** Record AI-engine runs and compare them with the scripted baseline, add a keyboard-only persona, and validate against sessions with real participants.

**"How did you build it?"** With AI pair programming. Be ready to explain the loop above and the perception-filter decision in your own words.
