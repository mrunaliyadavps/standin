import path from "node:path";
import { parseArgs } from "node:util";
import { llmConfigFromEnv } from "./agent/llm";
import { startFixtureServer } from "./fixture-server";
import { ALL_PERSONAS, PERSONAS } from "./personas";
import { runStudy } from "./study";
import type { PersonaId, Study } from "./types";

const HELP = `Standin: AI personas that usability-test a website.

  npm run study -- --demo
      Run the two bundled demo studies (a flawed clinic site and its fixed version).

  npm run study -- --url https://example.com --task "Sign up for the newsletter" --success-text "Thanks for subscribing"
      Test any site. Give --success-text and/or --success-url so Standin knows when the task is done.

Options
  --id <name>          Folder name for the study (default: derived from the URL)
  --personas <list>    Comma-separated: ${ALL_PERSONAS.join(", ")} (default: all)
  --engine <name>      scripted | ai  (default: ai if GEMINI_API_KEY or ANTHROPIC_API_KEY is set)

Only test sites you own or have permission to test. Standin fills forms with made-up details.`;

const RUNS_DIR = path.join(process.cwd(), "public", "runs");

function summarize(study: Study) {
  console.log(`\n${study.title}  (${study.engine.kind === "llm" ? study.engine.model : "scripted personas"})`);
  for (const run of study.runs) console.log(`  ${PERSONAS[run.persona].name.padEnd(20)} ${run.outcome.padEnd(10)} ${run.steps.length} steps`);
  console.log(`  ${study.findings.length} findings, ${study.a11y.length} automated accessibility issues`);
}

async function main() {
  const { values } = parseArgs({
    options: {
      demo: { type: "boolean" },
      url: { type: "string" },
      task: { type: "string" },
      "success-text": { type: "string" },
      "success-url": { type: "string" },
      id: { type: "string" },
      personas: { type: "string" },
      engine: { type: "string" },
      help: { type: "boolean" },
    },
  });
  if (values.help || (!values.demo && !values.url)) return console.log(HELP);

  const llm = values.engine === "scripted" ? null : llmConfigFromEnv();
  if (values.engine === "ai" && !llm) throw new Error("--engine ai needs GEMINI_API_KEY or ANTHROPIC_API_KEY in your environment.");
  const personas = (values.personas?.split(",").map((p) => p.trim()) ?? ALL_PERSONAS) as PersonaId[];
  for (const p of personas) if (!PERSONAS[p]) throw new Error(`Unknown persona "${p}".`);

  if (values.demo) {
    const server = await startFixtureServer();
    try {
      for (const v of ["v1", "v2"] as const) {
        summarize(
          await runStudy({
            id: `clinic-${v === "v1" ? "before" : "after"}`,
            title: v === "v1" ? "Clinic booking, before fixes" : "Clinic booking, after fixes",
            site: `Larkspur Family Clinic (bundled demo site, ${v === "v1" ? "original" : "fixed"} version)`,
            startUrl: `${server.origin}/clinic/${v}/index.html`,
            task: "Book an appointment",
            success: { textIncludes: "Appointment confirmed" },
            personas,
            llm,
            runsDir: RUNS_DIR,
          }),
        );
      }
    } finally {
      await server.close();
    }
    return;
  }

  if (!values.task) throw new Error("--task is required with --url.");
  if (!values["success-text"] && !values["success-url"]) throw new Error("Give --success-text and/or --success-url so Standin knows when the task is done.");
  const url = new URL(values.url!);
  summarize(
    await runStudy({
      id: values.id ?? url.hostname.replace(/[^a-z0-9]+/gi, "-"),
      title: `${url.hostname}: ${values.task}`,
      site: url.origin,
      startUrl: url.href,
      task: values.task,
      success: { textIncludes: values["success-text"], urlIncludes: values["success-url"] },
      personas,
      llm,
      runsDir: RUNS_DIR,
    }),
  );
}

main().catch((err) => {
  console.error(err instanceof Error ? err.message : err);
  process.exit(1);
});
