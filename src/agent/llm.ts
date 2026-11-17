import { z } from "zod";
import type { Persona } from "../personas";
import type { Decision, ElementInfo, Observation } from "../types";
import type { Memory } from "./memory";

/**
 * The AI engine: a language model decides each step.
 *
 * The model only ever receives the elements the persona can perceive (the
 * filtering happens in code before this is called), and its answer must be
 * valid JSON that names one of those elements. Anything else is rejected.
 */

export interface LlmConfig {
  provider: "gemini" | "claude";
  apiKey: string;
  model: string;
}

export function llmConfigFromEnv(env: NodeJS.ProcessEnv = process.env): LlmConfig | null {
  if (env.GEMINI_API_KEY) return { provider: "gemini", apiKey: env.GEMINI_API_KEY, model: env.STANDIN_MODEL || "gemini-2.5-flash" };
  if (env.ANTHROPIC_API_KEY) return { provider: "claude", apiKey: env.ANTHROPIC_API_KEY, model: env.STANDIN_MODEL || "claude-haiku-4-5" };
  return null;
}

const DecisionSchema = z.object({
  thought: z.string().min(1).max(400),
  action: z.discriminatedUnion("type", [
    z.object({ type: z.literal("click"), id: z.number().int() }),
    z.object({ type: z.literal("type"), id: z.number().int(), text: z.string().max(200) }),
    z.object({ type: z.literal("scroll") }),
    z.object({ type: z.literal("back") }),
    z.object({ type: z.literal("give_up") }),
  ]),
});

function line(el: ElementInfo, hideVisuals: boolean): string {
  const name = el.name || (el.iconOnly ? "(no label, icon only)" : "(no label)");
  const extra = hideVisuals ? "" : `${el.inViewport ? "" : " [below the fold]"}${el.value ? ` [filled: ${el.value}]` : ""}`;
  return `${el.id}: ${el.kind} ${JSON.stringify(name)}${extra}`;
}

export function buildPrompt(obs: Observation, perceivable: ElementInfo[], persona: Persona, task: string, mem: Memory): string {
  const hideVisuals = persona.id === "screen-reader";
  return `You are role-playing a website visitor in a usability test.

Persona: ${persona.name}. ${persona.constraint}
Task: ${task}
Use made-up details if a form asks for them (name Sam Rivera, sam.rivera@example.com, 555 0100).

Page title: ${obs.title}
What you have done so far:
${mem.history.slice(-8).map((h) => `- ${h}`).join("\n") || "- nothing yet"}

Controls you can perceive (id: kind "name"):
${perceivable.map((e) => line(e, hideVisuals)).join("\n") || "(none)"}

Choose ONE next action. Think out loud in first person, one or two short sentences, in character.
Reply with JSON only:
{"thought": "...", "action": {"type": "click", "id": 3}}
Other actions: {"type":"type","id":3,"text":"..."}, {"type":"scroll"}, {"type":"back"}, {"type":"give_up"}.
Give up if you honestly cannot find a way forward.`;
}

/** Parse and validate a model reply. Throws if it is not a legal action on a perceivable element. */
export function parseDecision(raw: string, perceivable: ElementInfo[]): Decision {
  const json = raw.slice(raw.indexOf("{"), raw.lastIndexOf("}") + 1);
  const d = DecisionSchema.parse(JSON.parse(json));
  if ((d.action.type === "click" || d.action.type === "type") && !perceivable.some((e) => e.id === (d.action as { id: number }).id)) {
    throw new Error(`Model chose element ${d.action.id}, which this persona cannot perceive.`);
  }
  return d;
}

async function callModel(cfg: LlmConfig, prompt: string): Promise<string> {
  if (cfg.provider === "gemini") {
    const res = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/${cfg.model}:generateContent`, {
      method: "POST",
      headers: { "content-type": "application/json", "x-goog-api-key": cfg.apiKey },
      body: JSON.stringify({
        contents: [{ role: "user", parts: [{ text: prompt }] }],
        generationConfig: { responseMimeType: "application/json", temperature: 0.4 },
      }),
    });
    if (!res.ok) throw new Error(`Gemini API ${res.status}: ${(await res.text()).slice(0, 200)}`);
    const data = (await res.json()) as { candidates?: { content?: { parts?: { text?: string }[] } }[] };
    return data.candidates?.[0]?.content?.parts?.map((p) => p.text ?? "").join("") ?? "";
  }
  const res = await fetch("https://api.anthropic.com/v1/messages", {
    method: "POST",
    headers: { "content-type": "application/json", "x-api-key": cfg.apiKey, "anthropic-version": "2023-06-01" },
    body: JSON.stringify({ model: cfg.model, max_tokens: 400, messages: [{ role: "user", content: prompt }] }),
  });
  if (!res.ok) throw new Error(`Claude API ${res.status}: ${(await res.text()).slice(0, 200)}`);
  const data = (await res.json()) as { content?: { type: string; text?: string }[] };
  return data.content?.map((c) => c.text ?? "").join("") ?? "";
}

export type ModelCaller = (prompt: string) => Promise<string>;

/** Ask the model for the next step, retrying once if the reply is invalid. */
export async function decideWithModel(
  call: ModelCaller,
  obs: Observation,
  perceivable: ElementInfo[],
  persona: Persona,
  task: string,
  mem: Memory,
): Promise<Decision> {
  const prompt = buildPrompt(obs, perceivable, persona, task, mem);
  let lastError = "";
  for (let attempt = 0; attempt < 2; attempt++) {
    const raw = await call(attempt === 0 ? prompt : `${prompt}\n\nYour last reply was rejected: ${lastError}\nReply with valid JSON only.`);
    try {
      return parseDecision(raw, perceivable);
    } catch (err) {
      lastError = err instanceof Error ? err.message : String(err);
    }
  }
  return { thought: "I can't work out what to do next.", action: { type: "give_up" } };
}

export function modelCaller(cfg: LlmConfig): ModelCaller {
  return (prompt) => callModel(cfg, prompt);
}
