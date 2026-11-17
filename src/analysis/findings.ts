import { PERSONAS } from "../personas";
import type { Finding, FrictionType, PersonaId, PersonaRun } from "../types";

interface Bucket {
  type: FrictionType;
  path: string;
  elements: Set<string>;
  detail: string;
  personas: Set<PersonaId>;
  evidence: { persona: PersonaId; step: number }[];
  blocking: boolean;
}

type Reportable = Exclude<FrictionType, "gave-up">;

const quote = (els: string[]) => (els.length === 1 ? `"${els[0]}"` : `${els.length} controls`);

const COPY: Record<Reportable, { title: (els: string[], path: string) => string; recommendation: string; wcag?: string }> = {
  "not-announced": {
    title: (els) => `${quote(els)} can't be reached with a screen reader`,
    recommendation: "Build these as real <button> or <a> elements. If one must stay a <div>, add a role, a name and keyboard support.",
    wcag: "4.1.2 Name, Role, Value",
  },
  unreadable: {
    title: (els) => `${quote(els)} ${els.length === 1 ? "is" : "are"} too faint or too small to read`,
    recommendation: "Give controls at least 4.5:1 text contrast and a comfortable text size (16px is a safe default).",
    wcag: "1.4.3 Contrast (Minimum)",
  },
  "unlabeled-control": {
    title: () => "An icon-only control has no label",
    recommendation: "Add visible text, or at least an aria-label, so everyone knows what it does.",
    wcag: "4.1.2 Name, Role, Value",
  },
  "ambiguous-label": {
    title: (els) => `Link text ${quote(els)} doesn't say where it goes`,
    recommendation: 'Name the destination in the link itself, for example "Book an appointment online".',
    wcag: "2.4.4 Link Purpose (In Context)",
  },
  "small-target": {
    title: (els) => (els[0] === "(no label)" ? "An unlabeled control is a small click target" : `${quote(els)} is a small click target`),
    recommendation: "Make interactive targets at least 24×24px. 44×44px is better for touch.",
    wcag: "2.5.8 Target Size (Minimum)",
  },
  "low-contrast": {
    title: (els) => `${quote(els)} has weak text contrast`,
    recommendation: "Raise text contrast to at least 4.5:1.",
    wcag: "1.4.3 Contrast (Minimum)",
  },
  detour: {
    title: (_els, path) => `People took a wrong turn to ${path}`,
    recommendation: "Put a clear call to action for the task on this page, or rename the link that leads here so it doesn't promise the task.",
  },
};

/**
 * Turn raw step-by-step friction into a ranked list of findings.
 * The same problem seen by several personas becomes one finding with more evidence.
 */
export function buildFindings(runs: PersonaRun[]): Finding[] {
  const buckets = new Map<string, Bucket>();
  const add = (key: string, type: FrictionType, path: string, element: string, detail: string, persona: PersonaId, step: number, blocking: boolean) => {
    const b = buckets.get(key) ?? { type, path, elements: new Set<string>(), detail, personas: new Set<PersonaId>(), evidence: [], blocking: false };
    if (element) b.elements.add(element);
    b.personas.add(persona);
    if (!b.evidence.some((e) => e.persona === persona)) b.evidence.push({ persona, step });
    b.blocking ||= blocking;
    buckets.set(key, b);
  };

  for (const run of runs) {
    // For a failed run, the last moment it was stuck on something it couldn't perceive is what stopped it.
    const lastStuck = run.outcome === "failed" ? [...run.steps].reverse().find((s) => s.missed.length > 0)?.index : undefined;
    for (const step of run.steps) {
      for (const f of step.friction) {
        if (f.type === "gave-up") continue;
        if (f.type === "detour") {
          // Not a wrong turn if the page had the right controls and this persona just couldn't reach them.
          if (step.missed.length === 0) add(`detour|${step.path}`, "detour", step.path, "", f.detail, run.persona, step.index, false);
          continue;
        }
        add(`${f.type}|${step.path}|${f.element}`, f.type, step.path, f.element ?? "", f.detail, run.persona, step.index, false);
      }
      // Several unreachable controls on one page are one problem, not several.
      for (const m of step.missed) add(`${m.frictionType}|${step.path}`, m.frictionType, step.path, m.name, m.reason, run.persona, step.index, step.index === lastStuck);
    }
  }

  const total = runs.length;
  const rank = { blocker: 0, major: 1, minor: 2 };
  const findings: Finding[] = [...buckets.values()].map((b) => {
    const copy = COPY[b.type as Reportable];
    const els = [...b.elements];
    const who = [...b.personas].map((p) => PERSONAS[p].name).join(", ");
    const severity: Finding["severity"] = b.blocking
      ? "blocker"
      : b.type === "detour" || b.type === "not-announced" || b.type === "unreadable" || b.personas.size >= 2
        ? "major"
        : "minor";
    const parts = [
      b.blocking ? "This stopped the task." : "",
      b.type === "detour" ? `${b.personas.size} of ${total} personas opened this page, found nothing they could use, and went back.` : `${b.detail}.`.replace(/\.\.$/, "."),
      els.length > 1 ? `Controls: ${els.map((e) => `"${e}"`).join(", ")}.` : "",
      `Affected: ${who}.`,
    ];
    return {
      id: "",
      severity,
      title: copy.title(els, b.path),
      detail: parts.filter(Boolean).join(" "),
      recommendation: copy.recommendation,
      wcag: copy.wcag,
      path: b.path,
      personas: [...b.personas],
      evidence: b.evidence,
    };
  });

  findings.sort((a, b) => rank[a.severity] - rank[b.severity] || b.personas.length - a.personas.length);
  findings.forEach((f, i) => (f.id = `F${i + 1}`));
  return findings;
}
