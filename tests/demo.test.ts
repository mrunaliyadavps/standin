import { mkdtemp, rm } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { startFixtureServer } from "@/src/fixture-server";
import { ALL_PERSONAS } from "@/src/personas";
import { runStudy } from "@/src/study";
import type { Study } from "@/src/types";

/**
 * End-to-end: real browser, real pages, scripted personas.
 * The fixture's problems are planted on purpose, so we know what a correct
 * run must find. This is the regression test for the whole pipeline.
 */
describe("demo clinic study", () => {
  let server: Awaited<ReturnType<typeof startFixtureServer>>;
  let dir: string;
  const studies: Record<string, Study> = {};

  beforeAll(async () => {
    server = await startFixtureServer();
    dir = await mkdtemp(path.join(os.tmpdir(), "standin-"));
    for (const v of ["v1", "v2"]) {
      studies[v] = await runStudy({
        id: v, title: v, site: "fixture", startUrl: `${server.origin}/clinic/${v}/index.html`,
        task: "Book an appointment", success: { textIncludes: "Appointment confirmed" },
        personas: ALL_PERSONAS, llm: null, runsDir: dir,
      });
    }
  }, 120_000);

  afterAll(async () => {
    await server.close();
    await rm(dir, { recursive: true, force: true });
  });

  const outcome = (v: string, p: string) => studies[v].runs.find((r) => r.persona === p)?.outcome;

  it("the flawed site blocks the screen reader and low-vision personas", () => {
    expect(outcome("v1", "screen-reader")).toBe("failed");
    expect(outcome("v1", "low-vision")).toBe("failed");
    expect(outcome("v1", "first-timer")).toBe("struggled");
    expect(outcome("v1", "in-a-hurry")).toBe("struggled");
  });

  it("reports the planted blockers", () => {
    const blockers = studies.v1.findings.filter((f) => f.severity === "blocker").map((f) => f.title);
    expect(blockers.some((t) => t.includes("screen reader"))).toBe(true);
    expect(blockers.some((t) => t.includes("Submit"))).toBe(true);
  });

  it("axe-core independently confirms the unlabeled button", () => {
    expect(studies.v1.a11y.some((a) => a.rule === "button-name")).toBe(true);
  });

  it("every persona finishes cleanly on the fixed site", () => {
    expect(studies.v2.runs.every((r) => r.outcome === "success")).toBe(true);
    expect(studies.v2.findings).toEqual([]);
  });
});
