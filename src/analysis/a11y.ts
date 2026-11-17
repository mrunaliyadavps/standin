import { readFileSync } from "node:fs";
import { createRequire } from "node:module";
import type { Page } from "playwright";
import type { AxeIssue } from "../types";

const require = createRequire(import.meta.url);
let axeSource: string | undefined;

/** Run axe-core (the industry-standard accessibility engine) on the current page. */
export async function scanPage(page: Page, pagePath: string): Promise<AxeIssue[]> {
  axeSource ??= readFileSync(require.resolve("axe-core/axe.min.js"), "utf8");
  try {
    await page.evaluate(axeSource);
    const result = (await page.evaluate("axe.run(document, { resultTypes: ['violations'] })")) as {
      violations: { id: string; impact?: string; help: string; helpUrl: string; nodes: unknown[] }[];
    };
    return result.violations.map((v) => ({ rule: v.id, impact: v.impact ?? "minor", help: v.help, helpUrl: v.helpUrl, path: pagePath, nodes: v.nodes.length }));
  } catch {
    return [];
  }
}
