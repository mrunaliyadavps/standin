export type PersonaId = "first-timer" | "in-a-hurry" | "screen-reader" | "low-vision";

export interface Box {
  x: number;
  y: number;
  w: number;
  h: number;
}

/** One interactive thing on the page, as measured in the real browser. */
export interface ElementInfo {
  id: number;
  /** Stable signature so we can remember "already tried this" across observations. */
  sig: string;
  tag: string;
  kind: "link" | "button" | "input" | "select" | "clickable";
  inputType?: string;
  value?: string;
  /** Accessible name: what a screen reader would announce, and what sighted users read. */
  name: string;
  /** True for native controls and elements with an ARIA role. False for e.g. a <div> with a click handler. */
  semantic: boolean;
  /** No text at all, only an icon. */
  iconOnly: boolean;
  box: Box;
  fontSize: number;
  /** Text contrast ratio against its background (WCAG formula), or null if not measurable. */
  contrast: number | null;
  inViewport: boolean;
  region: "nav" | "main" | "footer";
  /** Id shared by sibling options (e.g. a set of time slots), or null. */
  group: number | null;
  disabled: boolean;
}

export interface Observation {
  url: string;
  title: string;
  elements: ElementInfo[];
  scrollY: number;
  maxScrollY: number;
}

export type Action =
  | { type: "click"; id: number }
  | { type: "type"; id: number; text: string }
  | { type: "scroll"; toId?: number }
  | { type: "back" }
  | { type: "give_up" };

export interface Decision {
  thought: string;
  action: Action;
}

export type FrictionType =
  | "detour"
  | "unlabeled-control"
  | "ambiguous-label"
  | "small-target"
  | "low-contrast"
  | "not-announced"
  | "unreadable"
  | "gave-up";

export interface Friction {
  type: FrictionType;
  detail: string;
  element?: string;
  box?: Box;
}

export interface MissedElement {
  name: string;
  reason: string;
  frictionType: FrictionType;
  box: Box;
}

export interface Step {
  index: number;
  path: string;
  screenshot: string;
  thought: string;
  action: { type: Action["type"] | "done"; target?: string; text?: string; box?: Box };
  friction: Friction[];
  /** Controls this persona could not perceive at a moment when it was stuck. */
  missed: MissedElement[];
}

export type Outcome = "success" | "struggled" | "failed";

export interface PersonaRun {
  persona: PersonaId;
  outcome: Outcome;
  steps: Step[];
}

export interface Finding {
  id: string;
  severity: "blocker" | "major" | "minor";
  title: string;
  detail: string;
  recommendation: string;
  wcag?: string;
  path: string;
  personas: PersonaId[];
  evidence: { persona: PersonaId; step: number }[];
}

export interface AxeIssue {
  rule: string;
  impact: string;
  help: string;
  helpUrl: string;
  path: string;
  nodes: number;
}

export interface Study {
  id: string;
  title: string;
  site: string;
  task: string;
  engine: { kind: "scripted" | "llm"; model?: string };
  createdAt: string;
  runs: PersonaRun[];
  findings: Finding[];
  a11y: AxeIssue[];
}

export interface SuccessCheck {
  urlIncludes?: string;
  textIncludes?: string;
}
