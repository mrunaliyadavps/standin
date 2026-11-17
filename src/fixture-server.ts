import { readFile } from "node:fs/promises";
import http from "node:http";
import path from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = path.join(path.dirname(fileURLToPath(import.meta.url)), "..", "fixtures");
const TYPES: Record<string, string> = { ".html": "text/html; charset=utf-8", ".css": "text/css; charset=utf-8" };

/**
 * Keep one version of a page. Fixture pages hold both versions side by side:
 *   <!--v1-->flawed markup<!--/v1-->  <!--v2-->fixed markup<!--/v2-->
 */
export function pickVersion(html: string, version: "v1" | "v2"): string {
  const drop = version === "v1" ? "v2" : "v1";
  return html
    .replace(new RegExp(`<!--${drop}-->[\\s\\S]*?<!--/${drop}-->`, "g"), "")
    .replace(new RegExp(`<!--/?${version}-->`, "g"), "");
}

/** Serve fixtures/<site>/ at /<site>/v1/... and /<site>/v2/... on a free local port. */
export async function startFixtureServer(): Promise<{ origin: string; close: () => Promise<void> }> {
  const server = http.createServer(async (req, res) => {
    try {
      const url = new URL(req.url ?? "/", "http://localhost");
      const [, site, version, ...rest] = url.pathname.split("/");
      if (!/^[a-z-]+$/.test(site ?? "") || (version !== "v1" && version !== "v2")) throw new Error("not found");
      const file = rest.join("/") || "index.html";
      if (!/^[a-z-]+\.(html|css)$/.test(file)) throw new Error("not found");
      const body = await readFile(path.join(ROOT, site, file), "utf8");
      const ext = path.extname(file);
      res.writeHead(200, { "content-type": TYPES[ext] });
      res.end(ext === ".html" ? pickVersion(body, version) : body);
    } catch {
      res.writeHead(404).end("Not found");
    }
  });
  await new Promise<void>((resolve) => server.listen(0, "127.0.0.1", resolve));
  const { port } = server.address() as { port: number };
  return { origin: `http://127.0.0.1:${port}`, close: () => new Promise((r) => server.close(() => r())) };
}
