import { readFileSync } from "node:fs";
import path from "node:path";
import type { Study } from "@/src/types";

const RUNS = path.join(process.cwd(), "public", "runs");

export function listStudyIds(): string[] {
  try {
    return JSON.parse(readFileSync(path.join(RUNS, "index.json"), "utf8")) as string[];
  } catch {
    return [];
  }
}

export function loadStudy(id: string): Study {
  return JSON.parse(readFileSync(path.join(RUNS, id, "study.json"), "utf8")) as Study;
}

export function loadStudies(): Study[] {
  return listStudyIds().map(loadStudy);
}
