import type { Persona } from "../personas";
import type { Decision, ElementInfo, Observation } from "../types";
import { groupKey, pathOf, triedKey, type Memory } from "./memory";

/**
 * The scripted engine: a rule-based stand-in for the AI model.
 *
 * It follows "information scent", the classic usability idea that people
 * click whatever wording best matches their goal. It needs no API key, costs
 * nothing, and gives the same result every run, which makes it a good
 * baseline and lets the test suite check the whole pipeline.
 *
 * It knows nothing about any particular website.
 */

const STOPWORDS = new Set("a an and the to for of on in at with my your this that is be it i me you as from".split(" "));

const SYNONYMS: Record<string, string[]> = {
  book: ["schedule", "appointment", "appointments", "booking", "reserve", "reservation"],
  appointment: ["appointments", "book", "booking", "schedule", "visit"],
  buy: ["cart", "checkout", "purchase", "order", "shop"],
  sign: ["register", "join", "signup"],
  contact: ["support", "help", "message"],
  price: ["pricing", "plans", "cost"],
};

const PROGRESS = ["get started", "continue", "next", "submit", "confirm", "proceed", "start", "finish", "send"];
const AVOID = ["cancel", "back", "log in", "login", "sign in", "delete", "remove"];
const VAGUE = new Set(["here", "click here", "more", "read more", "learn more", "link", "this"]);

export function isVagueName(name: string): boolean {
  return VAGUE.has(name.trim().toLowerCase());
}

export function taskTokens(task: string): Set<string> {
  const words = task.toLowerCase().match(/[a-z]+/g) ?? [];
  const out = new Set<string>();
  for (const w of words) {
    if (STOPWORDS.has(w) || w.length < 3) continue;
    out.add(w);
    (SYNONYMS[w] ?? []).forEach((s) => out.add(s));
  }
  return out;
}

/** How strongly a control's wording matches the task. */
export function scentScore(name: string, tokens: Set<string>): number {
  const lower = name.toLowerCase();
  const words = new Set(lower.match(/[a-z]+/g) ?? []);
  let score = 0;
  for (const t of tokens) if (words.has(t)) score += 2;
  if (PROGRESS.some((p) => lower.includes(p))) score += 1;
  if (AVOID.some((p) => new RegExp(`\\b${p}\\b`).test(lower)) && score < 2) score -= 3;
  return score;
}

export function fakeValueFor(el: ElementInfo): string {
  const n = el.name.toLowerCase();
  if (el.inputType === "email" || n.includes("email")) return "sam.rivera@example.com";
  if (el.inputType === "tel" || /phone|mobile|tel/.test(n)) return "555 0100";
  if (el.inputType === "date") return new Date(Date.now() + 7 * 864e5).toISOString().slice(0, 10);
  if (el.inputType === "number") return "1";
  if (/name/.test(n)) return "Sam Rivera";
  return "Test";
}

function describe(el: ElementInfo): string {
  if (el.name) return `"${el.name}"`;
  return el.iconOnly ? "an icon with no label" : `an unlabeled ${el.kind}`;
}

export function decideScripted(obs: Observation, persona: Persona, task: string, mem: Memory): Decision {
  const path = pathOf(obs.url);
  const tokens = taskTokens(task);
  const sr = persona.id === "screen-reader";

  const perceivable = obs.elements.filter((e) => !e.disabled && persona.canPerceive(e).ok);
  const inReach = persona.onlyViewport ? perceivable.filter((e) => e.inViewport) : perceivable;

  // 1. Fill in any empty form field we can perceive.
  const field = inReach.find((e) => e.kind === "input" && !e.value);
  if (field) {
    const label = field.name ? `the "${field.name}" field` : "a field with no label";
    return {
      thought: sr ? `I hear an edit field, ${field.name || "unlabeled"}. I'll fill it in.` : `There's ${label}. I'll fill it in.`,
      action: { type: "type", id: field.id, text: fakeValueFor(field) },
    };
  }

  // 2. Rank the things we could click.
  const candidates = inReach.filter((e) => {
    if (e.kind === "input" || e.kind === "select") return false;
    if (mem.tried.has(triedKey(path, e))) return false;
    const g = groupKey(path, e);
    return !(g && mem.chosenGroups.has(g));
  });

  // Once you're inside a flow you stay in it: the site menu is only an option
  // on the first page, or when the page content offers nothing new.
  const allowNav = mem.history.length === 0 || !candidates.some((c) => c.region === "main");

  let best: ElementInfo | undefined;
  let bestScore = 0;
  for (const c of candidates) {
    if (c.region !== "main" && !allowNav) continue;
    const s = scentScore(c.name, tokens);
    if (s > bestScore) {
      best = c;
      bestScore = s;
    }
  }
  // Nothing matches the task wording: try the first untried thing in the page content.
  const explore = best ? undefined : candidates.find((c) => c.region === "main");
  const target = best ?? explore;

  if (target) {
    // People who read the whole page scroll to a control before using it.
    if (!sr && !target.inViewport && !persona.onlyViewport) {
      const used = mem.scrolls.get(path) ?? 0;
      if (used < persona.maxScrollsPerPage) {
        return {
          thought: `Nothing up here gets me further, so I read down the page and find ${describe(target)}.`,
          action: { type: "scroll", toId: target.id },
        };
      }
    }
    const thought = best
      ? sr
        ? `I hear a ${target.kind}, ${describe(target)}. That sounds like what I need.`
        : persona.id === "in-a-hurry"
          ? `${describe(target)} looks right. Clicking it.`
          : `${describe(target)} matches what I'm trying to do.`
      : target.group !== null
        ? `I need to pick one of these options. I'll take ${describe(target)}.`
        : sr
        ? `Nothing announces my task directly. I'll try the next control, ${describe(target)}.`
        : `Nothing here says exactly what I want. I'll try ${describe(target)}.`;
    return { thought, action: { type: "click", id: target.id } };
  }

  // 3. Stuck. Scroll, go back, or give up.
  const used = mem.scrolls.get(path) ?? 0;
  if (persona.onlyViewport && used < persona.maxScrollsPerPage && obs.scrollY < obs.maxScrollY) {
    return { thought: "I don't see it on screen. One quick scroll.", action: { type: "scroll" } };
  }
  if (mem.typedOn.has(path)) {
    return { thought: "I filled in the form, but I can't find any way to send it. I give up.", action: { type: "give_up" } };
  }
  const stuckBefore = mem.stuckOn.has(path);
  mem.stuckOn.add(path);
  if (stuckBefore || mem.backs >= 3 || mem.history.length === 0) {
    return {
      thought: sr ? "I'm back on a page where nothing I can reach moves me forward. I give up." : "I've been here already and still can't find a way forward. I give up.",
      action: { type: "give_up" },
    };
  }
  return {
    thought: sr ? "No control on this page announces anything I can use. Going back." : "This page doesn't seem to have what I need. Going back.",
    action: { type: "back" },
  };
}
