import type { ElementInfo, FrictionType, PersonaId } from "./types";

/**
 * Personas describe constraints and context, not demographics.
 *
 * The important design decision: a persona's limits are enforced by code,
 * not by asking a model to "pretend". `canPerceive` filters what the agent is
 * allowed to see before any decision is made. A screen reader persona never
 * receives a control that assistive technology would not announce, so it
 * cannot accidentally "cheat" by clicking it.
 */
export interface Persona {
  id: PersonaId;
  name: string;
  blurb: string;
  /** Plain-language constraint, used in the AI prompt. */
  constraint: string;
  maxSteps: number;
  /** Only considers what is on screen right now. */
  onlyViewport: boolean;
  maxScrollsPerPage: number;
  canPerceive(el: ElementInfo): { ok: true } | { ok: false; reason: string; frictionType: FrictionType };
}

const seesEverything = () => ({ ok: true }) as const;

export const PERSONAS: Record<PersonaId, Persona> = {
  "first-timer": {
    id: "first-timer",
    name: "First-time visitor",
    blurb: "Has never seen this site. Reads the whole page before acting.",
    constraint: "You have never used this site. You read everything carefully and scroll to explore before you act.",
    maxSteps: 30,
    onlyViewport: false,
    maxScrollsPerPage: 6,
    canPerceive: seesEverything,
  },
  "in-a-hurry": {
    id: "in-a-hurry",
    name: "In a hurry",
    blurb: "Skims. Acts on the first thing on screen that looks right. Scrolls once at most.",
    constraint: "You are rushed. You only look at what is on screen right now, pick the first plausible option, and scroll at most once per page.",
    maxSteps: 18,
    onlyViewport: true,
    maxScrollsPerPage: 1,
    canPerceive: seesEverything,
  },
  "screen-reader": {
    id: "screen-reader",
    name: "Screen reader user",
    blurb: "Hears the page instead of seeing it. Only reaches controls that are exposed to assistive technology.",
    constraint: "You use a screen reader. You only know about controls by their announced role and name. You cannot see layout, colour or icons.",
    maxSteps: 24,
    onlyViewport: false,
    maxScrollsPerPage: 0,
    canPerceive: (el) =>
      el.semantic
        ? { ok: true }
        : { ok: false, reason: "Not announced by a screen reader: it is not a real button or link and has no role", frictionType: "not-announced" },
  },
  "low-vision": {
    id: "low-vision",
    name: "Low-vision user",
    blurb: "Cannot read small or low-contrast text. Needs clear, legible controls.",
    constraint: "You have low vision. Text under 12px or with weak contrast is unreadable to you, so those controls do not exist for you.",
    maxSteps: 24,
    onlyViewport: false,
    maxScrollsPerPage: 6,
    canPerceive: (el) => {
      if (!el.iconOnly && el.fontSize < 12)
        return { ok: false, reason: `Text is ${Math.round(el.fontSize)}px, too small to read`, frictionType: "unreadable" };
      if (el.contrast !== null && el.contrast < 3)
        return { ok: false, reason: `Contrast is ${el.contrast.toFixed(1)}:1, too faint to read`, frictionType: "unreadable" };
      return { ok: true };
    },
  },
};

export const ALL_PERSONAS = Object.keys(PERSONAS) as PersonaId[];
