import http from "node:http";
import { readFile } from "node:fs/promises";
import { extname, join, normalize } from "node:path";
import handler from "../api/admin.js";

try {
  const envText = await readFile(new URL("../.env", import.meta.url), "utf8");
  for (const line of envText.split(/\r?\n/)) {
    const match = line.match(/^\s*([A-Za-z_][A-Za-z0-9_]*)\s*=\s*(.*)\s*$/);
    if (!match || match[1].startsWith("#") || process.env[match[1]] !== undefined) continue;
    process.env[match[1]] = match[2].replace(/^['"]|['"]$/g, "");
  }
} catch {
  // .env is optional; .env.example documents the available settings.
}

// Local preview is intentionally passwordless. The API still checks that the
// request host is loopback, so this cannot disable authentication on Vercel.
if (process.env.LOCAL_NO_AUTH === undefined) process.env.LOCAL_NO_AUTH = "1";
if (process.env.LOCAL_PUBLIC_READ === undefined) process.env.LOCAL_PUBLIC_READ = "1";

const root = join(process.cwd(), "public");
const mime = { ".html": "text/html; charset=utf-8", ".css": "text/css; charset=utf-8", ".js": "text/javascript; charset=utf-8", ".svg": "image/svg+xml" };

const server = http.createServer(async (req, res) => {
  if (req.url?.startsWith("/api/admin")) return handler(req, res);
  const pathname = new URL(req.url || "/", "http://localhost").pathname;
  const relative = pathname === "/" ? "index.html" : pathname.slice(1);
  const file = normalize(join(root, relative));
  if (!file.startsWith(root)) { res.writeHead(403); return res.end("Forbidden"); }
  try {
    const data = await readFile(file);
    res.writeHead(200, { "Content-Type": mime[extname(file)] || "application/octet-stream" });
    res.end(data);
  } catch {
    try {
      const data = await readFile(join(root, "index.html"));
      res.writeHead(200, { "Content-Type": mime[".html"] });
      res.end(data);
    } catch { res.writeHead(404); res.end("Not found"); }
  }
});

const port = Number(process.env.PORT || 3000);
server.listen(port, "127.0.0.1", () => console.log(`Takiyu Admin v2: http://127.0.0.1:${port}`));
