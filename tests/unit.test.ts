import { describe, expect, it } from "vitest";
import { decideWithModel, parseDecision } from "@/src/agent/llm";
import { newMemory } from "@/src/agent/memory";
import { frictionFor } from "@/src/agent/run";
import { scentScore, taskTokens } from "@/src/agent/scripted";
import { buildFindings } from "@/src/analysis/findings";
import { pickVersion } from "@/src/fixture-server";
import { PERSONAS } from "@/src/personas";
import type { ElementInfo, Observation, PersonaRun } from "@/src/types";

const el = (over: Partial<ElementInfo> = {}): ElementInfo => ({
  id: 0, sig: "button:Go:1", tag: "button", kind: "button", name: "Go", semantic: true, iconOnly: false,
  box: { x: 0, y: 0, w: 120, h: 44 }, fontSize: 16, contrast: 9, inViewport: true, region: "main", group: null, disabled: false, ...over,
});

describe("information scent", () => {
  const tokens = taskTokens("Book an appointment");
  it("expands the task with synonyms and drops filler words", () => {
    expect(tokens.has("schedule")).toBe(true);
    expect(tokens.has("an")).toBe(false);
  });
  it("ranks task wording above generic progress wording", () => {
    expect(scentScore("Book an appointment", tokens)).toBeGreaterThan(scentScore("Get started", tokens));
    expect(scentScore("Get started", tokens)).toBeGreaterThan(scentScore("Services", tokens));
  });
  it("avoids destructive or off-task controls", () => {
    expect(scentScore("Cancel", tokens)).toBeLessThan(0);
  });
});

describe("persona perception", () => {
  it("screen reader persona cannot perceive a clickable div", () => {
    expect(PERSONAS["screen-reader"].canPerceive(el({ semantic: false, kind: "clickable" })).ok).toBe(false);
    expect(PERSONAS["first-timer"].canPerceive(el({ semantic: false, kind: "clickable" })).ok).toBe(true);
  });
  it("low-vision persona cannot perceive faint or tiny text", () => {
    expect(PERSONAS["low-vision"].canPerceive(el({ contrast: 1.4 })).ok).toBe(false);
    expect(PERSONAS["low-vision"].canPerceive(el({ fontSize: 11 })).ok).toBe(false);
    expect(PERSONAS["low-vision"].canPerceive(el()).ok).toBe(true);
  });
});

describe("friction detection", () => {
  it("flags unlabeled, small and low-contrast controls", () => {
    const types = frictionFor(el({ name: "", iconOnly: true, box: { x: 0, y: 0, w: 20, h: 20 } })).map((f) => f.type);
    expect(types).toEqual(["unlabeled-control", "small-target"]);
    expect(frictionFor(el({ contrast: 2 })).map((f) => f.type)).toEqual(["low-contrast"]);
  });
  it("does not flag inline links for target size, and flags vague link text", () => {
    expect(frictionFor(el({ kind: "link", name: "here", box: { x: 0, y: 0, w: 23, h: 14 } })).map((f) => f.type)).toEqual(["ambiguous-label"]);
  });
  it("finds nothing wrong with a well-built button", () => {
    expect(frictionFor(el())).toEqual([]);
  });
});

describe("AI reply validation", () => {
  const visible = [el({ id: 3 })];
  const obs: Observation = { url: "http://x/", title: "t", elements: visible, scrollY: 0, maxScrollY: 0 };
  it("accepts a legal action", () => {
    expect(parseDecision('{"thought":"ok","action":{"type":"click","id":3}}', visible).action).toEqual({ type: "click", id: 3 });
  });
  it("rejects an element the persona cannot perceive", () => {
    expect(() => parseDecision('{"thought":"ok","action":{"type":"click","id":9}}', visible)).toThrow();
  });
  it("retries once, then gives up instead of acting on a bad reply", async () => {
    let calls = 0;
    const d = await decideWithModel(async () => (calls++, "not json"), obs, visible, PERSONAS["first-timer"], "task", newMemory());
    expect(calls).toBe(2);
    expect(d.action.type).toBe("give_up");
  });
});

describe("findings", () => {
  it("merges the same problem across personas and marks what stopped a failed run", () => {
    const step = (index: number, over = {}) => ({ index, path: "/p", screenshot: "", thought: "", action: { type: "click" as const }, friction: [], missed: [], ...over });
    const runs: PersonaRun[] = [
      { persona: "first-timer", outcome: "struggled", steps: [step(1, { friction: [{ type: "low-contrast", detail: "d", element: "Submit" }] })] },
      { persona: "in-a-hurry", outcome: "struggled", steps: [step(1, { friction: [{ type: "low-contrast", detail: "d", element: "Submit" }] })] },
      { persona: "low-vision", outcome: "failed", steps: [step(1, { missed: [{ name: "Submit", reason: "too faint", frictionType: "unreadable", box: { x: 0, y: 0, w: 1, h: 1 } }] })] },
    ];
    const f = buildFindings(runs);
    expect(f).toHaveLength(2);
    expect(f[0].severity).toBe("blocker");
    expect(f[1].personas).toEqual(["first-timer", "in-a-hurry"]);
  });
});

describe("fixture versions", () => {
  it("keeps only the requested version", () => {
    const html = "a<!--v1-->OLD<!--/v1--><!--v2-->NEW<!--/v2-->b";
    expect(pickVersion(html, "v1")).toBe("aOLDb");
    expect(pickVersion(html, "v2")).toBe("aNEWb");
  });
});
