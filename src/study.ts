import { mkdir, readdir, readFile, rm, writeFile } from "node:fs/promises";
import path from "node:path";
import { chromium } from "playwright";
import { modelCaller, type LlmConfig } from "./agent/llm";
import { runPersona } from "./agent/run";
import { scanPage } from "./analysis/a11y";
import { buildFindings } from "./analysis/findings";
import { PERSONAS } from "./personas";
import type { AxeIssue, PersonaId, PersonaRun, Study, SuccessCheck } from "./types";

export interface StudyRequest {
  id: string;
  title: string;
  /** Shown in the report. For local fixtures this is a label, not the localhost address. */
  site: string;
  startUrl: string;
  task: string;
  success: SuccessCheck;
  personas: PersonaId[];
  llm?: LlmConfig | null;
  runsDir: string;
}

/** Run every persona through the task and write study.json plus screenshots. */
export async function runStudy(req: StudyRequest): Promise<Study> {
  const outDir = path.join(req.runsDir, req.id);
  await rm(outDir, { recursive: true, force: true });
  await mkdir(outDir, { recursive: true });

  const browser = await chromium.launch();
  const a11y = new Map<string, AxeIssue>();
  const runs: PersonaRun[] = [];
  try {
    for (const id of req.personas) {
      // A fresh browser context per persona: no shared cookies or history.
      const context = await browser.newContext({ viewport: { width: 1280, height: 800 } });
      runs.push(
        await runPersona({
          context,
          startUrl: req.startUrl,
          task: req.task,
          success: req.success,
          persona: PERSONAS[id],
          outDir,
          call: req.llm ? modelCaller(req.llm) : undefined,
          onPage: async (page, pagePath) => {
            for (const issue of await scanPage(page, pagePath)) a11y.set(`${issue.rule}|${pagePath}`, issue);
          },
        }),
      );
      await context.close();
    }
  } finally {
    await browser.close();
  }

  const study: Study = {
    id: req.id,
    title: req.title,
    site: req.site,
    task: req.task,
    engine: req.llm ? { kind: "llm", model: req.llm.model } : { kind: "scripted" },
    createdAt: new Date().toISOString(),
    runs,
    findings: buildFindings(runs),
    a11y: [...a11y.values()],
  };
  await writeFile(path.join(outDir, "study.json"), JSON.stringify(study, null, 2));
  await writeIndex(req.runsDir);
  return study;
}

/** index.json lists every study so the viewer can build its home page. */
export async function writeIndex(runsDir: string): Promise<void> {
  const ids: string[] = [];
  for (const entry of await readdir(runsDir, { withFileTypes: true })) {
    if (!entry.isDirectory()) continue;
    try {
      await readFile(path.join(runsDir, entry.name, "study.json"));
      ids.push(entry.name);
    } catch {
      /* not a study folder */
    }
  }
  await writeFile(path.join(runsDir, "index.json"), JSON.stringify(ids.sort(), null, 2));
}
