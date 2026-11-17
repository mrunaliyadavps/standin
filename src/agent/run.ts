import type { BrowserContext, Page } from "playwright";
import path from "node:path";
import { OBSERVE_SCRIPT } from "../browser/page-script";
import type { Persona } from "../personas";
import type { Decision, ElementInfo, Friction, MissedElement, Observation, Outcome, PersonaRun, Step, SuccessCheck } from "../types";
import { decideWithModel, type ModelCaller } from "./llm";
import { groupKey, newMemory, pathOf, triedKey } from "./memory";
import { decideScripted, isVagueName } from "./scripted";

export interface RunOptions {
  context: BrowserContext;
  startUrl: string;
  task: string;
  success: SuccessCheck;
  persona: Persona;
  /** Folder for screenshots. */
  outDir: string;
  /** If set, an AI model decides each step. Otherwise the scripted engine does. */
  call?: ModelCaller;
  /** Called once per page visited, for accessibility scanning. */
  onPage?: (page: Page, pagePath: string) => Promise<void>;
}

// WCAG 2.2, 2.5.8 Target Size (Minimum). Inline text links are exempt, so links are not flagged.
const MIN_TARGET = 24;
// WCAG 1.4.3 Contrast (Minimum)
const MIN_CONTRAST = 4.5;

async function observe(page: Page): Promise<Observation> {
  return (await page.evaluate(OBSERVE_SCRIPT)) as Observation;
}

async function settle(page: Page) {
  await page.waitForLoadState("load").catch(() => {});
  await page.waitForTimeout(150);
}

async function succeeded(page: Page, check: SuccessCheck): Promise<boolean> {
  if (check.urlIncludes && page.url().includes(check.urlIncludes)) return true;
  if (check.textIncludes) {
    const text = await page.evaluate(() => document.body?.innerText ?? "").catch(() => "");
    if (text.toLowerCase().includes(check.textIncludes.toLowerCase())) return true;
  }
  return false;
}

/** Friction caused by the control the persona is about to use. */
export function frictionFor(el: ElementInfo): Friction[] {
  const out: Friction[] = [];
  const label = el.name || "(no label)";
  if (!el.name) out.push({ type: "unlabeled-control", detail: "This control has no text or accessible name", element: label, box: el.box });
  else if (isVagueName(el.name)) out.push({ type: "ambiguous-label", detail: `"${el.name}" doesn't say where it leads`, element: label, box: el.box });
  if (el.kind !== "link" && Math.min(el.box.w, el.box.h) < MIN_TARGET)
    out.push({ type: "small-target", detail: `Target is ${el.box.w}×${el.box.h}px. The minimum is ${MIN_TARGET}×${MIN_TARGET}px`, element: label, box: el.box });
  if (!el.iconOnly && el.contrast !== null && el.contrast < MIN_CONTRAST)
    out.push({ type: "low-contrast", detail: `Contrast is ${el.contrast.toFixed(1)}:1. The minimum is ${MIN_CONTRAST}:1`, element: label, box: el.box });
  return out;
}

/** Page-content controls that exist but that this persona cannot perceive. */
export function missedBy(persona: Persona, obs: Observation): MissedElement[] {
  const out: MissedElement[] = [];
  for (const el of obs.elements) {
    if (el.region !== "main" || el.disabled) continue;
    const p = persona.canPerceive(el);
    if (p.ok) continue;
    const name = el.name || "(no label)";
    if (out.some((m) => m.name === name)) continue;
    out.push({ name, reason: p.reason, frictionType: p.frictionType, box: el.box });
    if (out.length >= 6) break;
  }
  return out;
}

export async function runPersona(opts: RunOptions): Promise<PersonaRun> {
  const { persona, task, context } = opts;
  const page = await context.newPage();
  const mem = newMemory();
  const steps: Step[] = [];
  const scanned = new Set<string>();
  let lastPath = "";
  let done = false;

  const shot = async (): Promise<string> => {
    const file = `${persona.id}-${String(steps.length + 1).padStart(2, "0")}.jpg`;
    await page.screenshot({ path: path.join(opts.outDir, file), type: "jpeg", quality: 60 });
    return file;
  };

  await page.goto(opts.startUrl, { waitUntil: "load" });
  await settle(page);

  while (steps.length < persona.maxSteps) {
    if (await succeeded(page, opts.success)) {
      done = true;
      break;
    }
    const obs = await observe(page);
    const here = pathOf(obs.url);
    if (here !== lastPath) {
      mem.visits.set(here, (mem.visits.get(here) ?? 0) + 1);
      lastPath = here;
      if (opts.onPage && !scanned.has(here)) {
        scanned.add(here);
        await opts.onPage(page, here);
      }
    }

    // The persona's limits are applied here, before any decision is made.
    let perceivable = obs.elements.filter((e) => !e.disabled && persona.canPerceive(e).ok);
    if (persona.onlyViewport) perceivable = perceivable.filter((e) => e.inViewport);

    const decision: Decision = opts.call
      ? await decideWithModel(opts.call, obs, perceivable, persona, task, mem)
      : decideScripted(obs, persona, task, mem);
    const a = decision.action;

    const targetId = a.type === "click" || a.type === "type" ? a.id : a.type === "scroll" ? a.toId : undefined;
    const target = targetId === undefined ? undefined : obs.elements.find((e) => e.id === targetId);
    const locator = target ? page.locator(`[data-standin-id="${target.id}"]`) : undefined;

    // Bring the target on screen and measure it there, so the replay can highlight it.
    let box = target?.box;
    if (locator) {
      await locator.evaluate((el) => el.scrollIntoView({ block: "center" })).catch(() => {});
      const b = await locator.boundingBox().catch(() => null);
      if (b) box = { x: Math.round(b.x), y: Math.round(b.y), w: Math.round(b.width), h: Math.round(b.height) };
    }

    const friction: Friction[] = [];
    let missed: MissedElement[] = [];
    if (a.type === "click" && target) {
      // Size and contrast are visual problems, so they don't count against a screen reader user.
      const visual = new Set(["small-target", "low-contrast"]);
      friction.push(...frictionFor({ ...target, box: box ?? target.box }).filter((f) => persona.id !== "screen-reader" || !visual.has(f.type)));
    }
    if (a.type === "back" || a.type === "give_up") {
      missed = missedBy(persona, obs);
      if (a.type === "back") friction.push({ type: "detour", detail: "Opened this page looking for the task, then had to go back" });
      else friction.push({ type: "gave-up", detail: "Could not find a way to finish the task" });
    }

    steps.push({
      index: steps.length + 1,
      path: here,
      screenshot: await shot(),
      thought: decision.thought,
      action: { type: a.type, target: target ? target.name || "(no label)" : undefined, text: a.type === "type" ? a.text : undefined, box },
      friction,
      missed,
    });

    if (a.type === "give_up") break;
    if (a.type === "click" && target && locator) {
      mem.tried.add(triedKey(here, target));
      const g = groupKey(here, target);
      if (g) mem.chosenGroups.add(g);
      mem.history.push(`Clicked ${JSON.stringify(target.name || "(no label)")} on ${here}`);
      await locator.click({ timeout: 3000 }).catch(() => locator.evaluate((el) => (el as HTMLElement).click()).catch(() => {}));
    } else if (a.type === "type" && locator && target) {
      mem.typedOn.add(here);
      mem.history.push(`Typed into ${JSON.stringify(target.name || "(no label)")}`);
      await locator.fill(a.text, { timeout: 3000 }).catch(() => {});
    } else if (a.type === "scroll") {
      mem.scrolls.set(here, (mem.scrolls.get(here) ?? 0) + 1);
      mem.history.push(`Scrolled on ${here}`);
      if (!target) await page.evaluate(() => window.scrollBy(0, window.innerHeight * 0.8));
    } else if (a.type === "back") {
      mem.backs += 1;
      mem.history.push(`Went back from ${here}`);
      await page.goBack({ waitUntil: "load" }).catch(() => {});
    }
    await settle(page);
  }

  if (!done) done = await succeeded(page, opts.success);
  if (done) {
    steps.push({
      index: steps.length + 1,
      path: pathOf(page.url()),
      screenshot: await shot(),
      thought: "That's it. The task is done.",
      action: { type: "done" },
      friction: [],
      missed: [],
    });
  }
  await page.close();

  const hadFriction = steps.some((s) => s.friction.length > 0);
  const outcome: Outcome = !done ? "failed" : hadFriction ? "struggled" : "success";
  return { persona: persona.id, outcome, steps };
}
