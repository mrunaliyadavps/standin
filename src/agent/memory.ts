import type { ElementInfo } from "../types";

/** What a persona remembers during one attempt at the task. */
export interface Memory {
  tried: Set<string>;
  chosenGroups: Set<string>;
  scrolls: Map<string, number>;
  typedOn: Set<string>;
  visits: Map<string, number>;
  backs: number;
  stuckOn: Set<string>;
  history: string[];
}

export function newMemory(): Memory {
  return { tried: new Set(), chosenGroups: new Set(), scrolls: new Map(), typedOn: new Set(), visits: new Map(), backs: 0, stuckOn: new Set(), history: [] };
}

export function pathOf(url: string): string {
  try {
    const u = new URL(url);
    return u.pathname;
  } catch {
    return url;
  }
}

/** Navigation links repeat on every page, so remember them site-wide. Page content is remembered per page. */
export function triedKey(path: string, el: ElementInfo): string {
  return el.region === "main" ? `${path}|${el.sig}` : el.sig;
}

export function groupKey(path: string, el: ElementInfo): string | null {
  return el.group === null ? null : `${path}|g${el.group}`;
}
