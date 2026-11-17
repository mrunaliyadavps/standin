import type { Outcome, Study } from "@/src/types";

export const BASE = process.env.NEXT_PUBLIC_BASE_PATH ?? "";
export const REPO_URL = process.env.NEXT_PUBLIC_REPO_URL ?? "";

export const OUTCOME_LABEL: Record<Outcome, string> = {
  success: "Finished",
  struggled: "Finished, with friction",
  failed: "Gave up",
};

export function finished(study: Study): number {
  return study.runs.filter((r) => r.outcome !== "failed").length;
}

export function engineLabel(study: Study): string {
  return study.engine.kind === "llm" ? `AI model: ${study.engine.model}` : "Scripted personas (no AI model)";
}
