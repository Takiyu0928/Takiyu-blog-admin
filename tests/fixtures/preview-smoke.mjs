import assert from "node:assert/strict";
import { spawn } from "node:child_process";
import { createHash } from "node:crypto";
import { readFile } from "node:fs/promises";
import http from "node:http";
import { test } from "node:test";
import { fileURLToPath } from "node:url";
import { inflateSync } from "node:zlib";

// Run directly or with node --test. No npm packages, real credentials or browser.
const script = fileURLToPath(new URL("../../scripts/preview.mjs", import.meta.url));

async function start(args = ["--port=0"], env = {}) {
  // Empty environment and a different cwd verify that preview is standalone.
  const child = spawn(process.execPath, [script, ...args], {
    cwd: fileURLToPath(new URL("./", import.meta.url)), env,
    stdio: ["ignore", "pipe", "pipe"], windowsHide: true,
  });
  let output = "", errors = "";
  const base = await new Promise((resolve, reject) => {
    const timer = setTimeout(() => { child.kill(); reject(new Error(`Preview startup timed out: ${errors}`)); }, 8000);
    child.stderr.on("data", chunk => { errors += chunk; });
    child.stdout.on("data", chunk => {
      output += chunk;
      const match = output.match(/http:\/\/127\.0\.0\.1:\d+/);
      if (match) { clearTimeout(timer); resolve(match[0]); }
    });
    child.once("error", error => { clearTimeout(timer); reject(error); });
    child.once("exit", code => { clearTimeout(timer); reject(new Error(`Preview exited (${code}): ${errors}`)); });
  });
  return {
    base,
    async stop() {
      if (child.exitCode !== null || child.signalCode !== null) return;
      await new Promise((resolve, reject) => {
        const timer = setTimeout(() => reject(new Error("Preview did not stop")), 5000);
        child.once("exit", () => { clearTimeout(timer); resolve(); });
        child.kill();
      });
    },
    async api(action, payload = {}, headers = {}) {
      const response = await fetch(`${base}/api/admin`, {
        method: "POST", headers: { "Content-Type": "application/json", ...headers },
        body: JSON.stringify({ action, ...payload }), signal: AbortSignal.timeout(5000),
      });
      return { status: response.status, headers: response.headers, body: await response.json() };
    },
    raw(path, { method = "GET", headers = {}, body } = {}) {
      return new Promise((resolve, reject) => {
        const request = http.request(base, { path, method, headers }, response => {
          const chunks = [];
          response.on("data", chunk => chunks.push(chunk));
          response.on("end", () => resolve({ status: response.statusCode, headers: response.headers, data: Buffer.concat(chunks) }));
          response.on("error", reject);
        });
        request.setTimeout(5000, () => request.destroy(new Error("HTTP request timed out")));
        request.on("error", reject);
        request.end(body);
      });
    },
  };
}

function blobSha(data) {
  return createHash("sha1").update(`blob ${Buffer.byteLength(data)}\0`).update(data).digest("hex");
}

test("isolated preview HTTP contract", { timeout: 30_000 }, async t => {
  const app = await start();
  t.after(() => app.stop());
  let initialTree;

  await t.test("session and tree identify demo mode and representative fixtures", async () => {
    const session = await app.api("session");
    assert.equal(session.status, 200);
    assert.equal(session.body.authenticated, true);
    assert.equal(session.body.demo, true);
    assert.equal(session.body.assetBase, "/__preview/");
    assert.deepEqual(session.body.repo, { owner: "Takiyu0928", repo: "Takiyu-blog", branch: "main" });
    const tree = await app.api("tree");
    assert.equal(tree.status, 200);
    assert.equal(tree.body.demo, true);
    assert.deepEqual(tree.body.repo, session.body.repo);
    initialTree = tree.body.files;
    const posts = initialTree.filter(file => /^src\/content\/posts\/.+\.mdx?$/.test(file.path));
    assert.equal(posts.length, 5);
    const contents = await Promise.all(posts.map(file => app.api("file.read", { path: file.path })));
    assert.equal(contents.filter(result => /draft: true/.test(result.body.content)).length, 1);
    assert.ok(contents.every(result => result.status === 200 && /title: ".*[\u4e00-\u9fff]/.test(result.body.content)));
    assert.ok(initialTree.some(file => file.path === "src/content/spec/about.md"));
    const albums = initialTree.filter(file => /\/albums\/[^/]+\/info\.json$/.test(file.path));
    assert.equal(albums.length, 2);
    for (const album of albums) {
      const result = await app.api("file.read", { path: album.path });
      const value = JSON.parse(result.body.content);
      assert.ok(value.title && value.date && Array.isArray(value.tags));
    }
    console.log(`SAMPLE session: authenticated=${session.body.authenticated}, demo=${session.body.demo}, repo=Takiyu0928/Takiyu-blog@main`);
    console.log(`SAMPLE tree: ${initialTree.length} files, ${posts.length} posts (1 draft), ${albums.length} albums`);
  });

  await t.test("every file has consistent UTF-8 byte sizes and blob SHAs", async () => {
    for (const file of initialTree.filter(file => !file.path.endsWith(".png"))) {
      const result = await app.api("file.read", { path: file.path });
      assert.equal(result.status, 200, file.path);
      assert.equal(result.body.sha, blobSha(result.body.content));
      assert.equal(result.body.size, Buffer.byteLength(result.body.content));
      assert.equal(result.body.sha, file.sha);
    }
  });

  await t.test("all 13 UI models support read/write and stay synchronized with file.read", async () => {
    const models = initialTree.filter(file => file.path.endsWith(".ts"));
    assert.equal(models.length, 13);
    for (const file of models) {
      const raw = await app.api("file.read", { path: file.path });
      const variable = raw.body.content.match(/export const (\w+) =/)[1];
      const model = await app.api("model.read", { path: file.path, variable });
      assert.equal(model.status, 200, variable);
      if (["diaryData", "LOCAL_PLAYLIST", "friendsData", "projectsData", "skillsData", "timelineData"].includes(variable)) assert.ok(Array.isArray(model.body.value), variable);
      const value = structuredClone(model.body.value);
      if (Array.isArray(value)) value[0].previewSmoke = true;
      else value.previewSmoke = true;
      const saved = await app.api("model.write", { path: file.path, variable, value, sha: model.body.sha });
      assert.equal(saved.status, 200, variable);
      assert.equal(saved.body.demo, true);
      const reloaded = await app.api("model.read", { path: file.path, variable });
      assert.deepEqual(reloaded.body.value, value, variable);
      assert.notEqual(reloaded.body.sha, model.body.sha);
      assert.equal(reloaded.body.sha, saved.body.result.content.sha);
      const fileAfter = await app.api("file.read", { path: file.path });
      assert.equal(fileAfter.body.content, reloaded.body.content);
      assert.match(fileAfter.body.content, /"previewSmoke": true/);
      assert.equal((await app.api("model.write", { path: file.path, variable, value, sha: model.body.sha })).status, 409);
    }
    console.log("SAMPLE models: 13/13 read/write round trips; stale SHA -> 409");
  });

  await t.test("raw model edits are parsed as JSON and never executed", async () => {
    const path = "src/config/siteConfig.ts", variable = "siteConfig";
    const before = await app.api("file.read", { path });
    const content = before.body.content.replace("Takiyu 的手帖", "已在内存更新的网站标题");
    const saved = await app.api("file.write", { path, content, sha: before.body.sha });
    assert.equal(saved.status, 200);
    assert.equal((await app.api("model.read", { path, variable })).body.value.title, "已在内存更新的网站标题");
    const expression = 'export const siteConfig = (() => { throw new Error("must not execute"); })();\n';
    const unsafe = await app.api("file.write", { path, content: expression, sha: saved.body.result.content.sha });
    assert.equal(unsafe.status, 200);
    const rejected = await app.api("model.read", { path, variable });
    assert.equal(rejected.status, 400);
    assert.match(rejected.body.error, /不解析或执行 TypeScript/);
    assert.equal((await app.api("file.write", { path, content, sha: unsafe.body.result.content.sha })).status, 200);
    assert.equal((await app.api("model.read", { path, variable: "unknown" })).status, 404);
  });

  await t.test("file create/update/concurrent conflict/delete persists only in memory", async () => {
    const path = "src/content/posts/preview-smoke.md", content = "# 只存在于内存\n\n中文与 emoji 🌿\n";
    const created = await app.api("file.write", { path, content });
    assert.equal(created.status, 200);
    assert.equal(created.body.ok, true);
    assert.equal(created.body.result.content.sha, blobSha(content));
    assert.equal((await app.api("file.read", { path })).body.content, content);
    assert.ok((await app.api("tree")).body.files.some(file => file.path === path));
    assert.equal((await app.api("file.write", { path, content: "missing sha" })).status, 409);
    const writes = await Promise.all(["first", "second"].map(text => app.api("file.write", { path, content: text, sha: created.body.result.content.sha })));
    assert.deepEqual(writes.map(result => result.status).sort(), [200, 409]);
    assert.equal((await app.api("file.delete", { path, sha: created.body.result.content.sha })).status, 409);
    const current = await app.api("file.read", { path });
    assert.equal((await app.api("file.delete", { path, sha: current.body.sha })).status, 200);
    assert.equal((await app.api("file.read", { path })).status, 404);
    assert.ok(!(await app.api("tree")).body.files.some(file => file.path === path));
    console.log("SAMPLE file: create 200 -> read 200 -> concurrent update 200/409 -> delete 200 -> read 404");
  });

  await t.test("mock public assets and base64 uploads have correct bytes and MIME", async () => {
    const seededPath = "public/images/albums/autumn-walk/01-riverside.png";
    const image = await app.raw(`/__preview/${seededPath}`);
    assert.equal(image.status, 200);
    assert.equal(image.headers["content-type"], "image/png");
    assert.equal(image.data.subarray(0, 8).toString("hex"), "89504e470d0a1a0a");
    assert.equal(image.data.readUInt32BE(16), 240);
    assert.equal(image.data.readUInt32BE(20), 160);
    let offset = 8;
    const compressed = [];
    while (offset < image.data.length) {
      const size = image.data.readUInt32BE(offset);
      if (image.data.subarray(offset + 4, offset + 8).toString() === "IDAT") compressed.push(image.data.subarray(offset + 8, offset + 8 + size));
      offset += size + 12;
    }
    assert.equal(inflateSync(Buffer.concat(compressed)).length, (240 * 3 + 1) * 160);
    const path = "public/assets/images/smoke-upload.png";
    const upload = await app.api("file.upload", { path, base64: image.data.toString("base64") });
    assert.equal(upload.status, 200);
    assert.equal(upload.body.result.content.sha, blobSha(image.data));
    assert.deepEqual((await app.raw(`/__preview/${path}`)).data, image.data);
    assert.equal((await app.api("file.upload", { path: "public/assets/bad.png", base64: "not base64!" })).status, 400);
    assert.equal((await app.api("file.delete", { path, sha: upload.body.result.content.sha })).status, 200);
    assert.equal((await app.raw(`/__preview/${path}`)).status, 404);
  });

  await t.test("public files are served live, with MIME/no-cache/HEAD and no SPA fallback", async () => {
    const page = await app.raw("/?preview=1");
    assert.equal(page.status, 200);
    assert.match(page.headers["content-type"], /^text\/html/);
    assert.match(page.data.toString(), /<!doctype html>/i);
    for (const [file, type] of [["app.js", /^text\/javascript/], ["styles.css", /^text\/css/]]) {
      const result = await app.raw(`/${file}`);
      assert.equal(result.status, 200);
      assert.match(result.headers["content-type"], type);
      assert.equal(result.headers["cache-control"], "no-store");
      assert.equal(result.headers["x-content-type-options"], "nosniff");
      assert.deepEqual(result.data, await readFile(new URL(`../../public/${file}`, import.meta.url)));
      const head = await app.raw(`/${file}`, { method: "HEAD" });
      assert.equal(head.status, 200);
      assert.equal(head.data.length, 0);
      assert.equal(Number(head.headers["content-length"]), result.data.length);
    }
    assert.equal((await app.raw("/does-not-exist.js")).status, 404);
    assert.equal((await app.raw("/api/admin-other")).status, 404);
    assert.equal((await app.raw("/", { method: "POST" })).status, 405);
  });

  await t.test("traversal, hidden files, non-public assets and foreign origins are blocked", async () => {
    for (const path of ["/../package.json", "/%2e%2e/api/admin.js", "/..%2fapi%2fadmin.js", "/..%5capi%5cadmin.js", "/.env", "/C:/Windows/win.ini", "/%00", "/__preview/src/config/siteConfig.ts"]) {
      assert.equal((await app.raw(path)).status, 403, path);
    }
    assert.equal((await app.raw("/%ZZ")).status, 400);
    assert.equal((await app.raw("//api/admin")).status, 400);
    assert.equal((await app.raw("/", { headers: { Host: "attacker.invalid" } })).status, 421);
    assert.equal((await app.api("tree", {}, { Origin: "https://attacker.invalid" })).status, 403);
    assert.equal((await app.api("tree", {}, { "Sec-Fetch-Site": "cross-site" })).status, 403);
    assert.equal((await app.api("tree", {}, { Origin: app.base })).status, 200);
    for (const path of ["api/admin.js", "src/data/../config/siteConfig.ts", "src/data\\diary.ts", "/src/data/diary.ts", "public/images/.env"]) assert.equal((await app.api("file.read", { path })).status, 403, path);
  });

  await t.test("malformed bodies, methods, oversized requests and missing resources fail clearly", async () => {
    const get = await app.raw("/api/admin");
    assert.equal(get.status, 405);
    assert.equal(get.headers.allow, "POST, OPTIONS");
    assert.equal((await app.raw("/api/admin", { method: "OPTIONS" })).status, 204);
    assert.equal((await app.raw("/api/admin", { method: "POST", headers: { "Content-Type": "application/json" }, body: "{" })).status, 400);
    assert.equal((await app.raw("/api/admin", { method: "POST", headers: { "Content-Type": "text/plain" }, body: "{}" })).status, 415);
    assert.equal((await app.raw("/api/admin", { method: "POST", headers: { "Content-Type": "application/json" }, body: "null" })).status, 400);
    assert.equal((await app.api("unknown")).status, 400);
    assert.equal((await app.api("file.read", { path: "src/content/posts/missing.md" })).status, 404);
    assert.equal((await app.api("file.write", { path: "src/content/posts/too-large.md", content: "x".repeat(6_000_000) })).status, 413);
    assert.equal((await app.api("session")).status, 200);
  });

  await t.test("automatic preview can log out and back in with a separate demo cookie", async () => {
    const logout = await app.api("logout");
    const cookie = logout.headers.get("set-cookie").split(";")[0];
    assert.match(cookie, /^takiyu_preview_\d+=logged-out$/);
    assert.equal((await app.api("session", {}, { Cookie: cookie })).status, 401);
    assert.equal((await app.api("tree", {}, { Cookie: cookie })).status, 401);
    assert.equal((await app.api("login", { password: "incorrect" })).status, 401);
    const login = await app.api("login", { password: "demo" });
    assert.equal(login.status, 200);
    assert.match(login.headers.get("set-cookie"), /HttpOnly; SameSite=Strict/);
    assert.equal((await app.api("session", {}, { Cookie: login.headers.get("set-cookie").split(";")[0] })).status, 200);
  });
});

test("--login starts unauthenticated without changing the production API", { timeout: 15_000 }, async t => {
  const app = await start(["--port=0", "--login"]);
  t.after(() => app.stop());
  const session = await app.api("session");
  assert.equal(session.status, 401);
  assert.equal(session.body.demo, true);
  assert.equal(session.body.localNoAuth, false);
  assert.equal((await app.api("tree")).status, 401);
  const login = await app.api("login", { password: "demo" });
  assert.equal(login.status, 200);
  const cookie = login.headers.get("set-cookie").split(";")[0];
  assert.equal((await app.api("tree", {}, { Cookie: cookie })).status, 200);
  assert.equal((await app.raw("/")).status, 200);
});

test("restart resets writes; PORT works independently of npm or the current directory", { timeout: 20_000 }, async t => {
  const first = await start([], { PORT: "0" });
  t.after(() => first.stop());
  const path = "src/content/posts/restart-proof.md";
  assert.equal((await first.api("file.write", { path, content: "temporary" })).status, 200);
  await first.stop();
  const next = await start([], { PORT: "0" });
  t.after(() => next.stop());
  assert.equal((await next.api("file.read", { path })).status, 404);
  const model = await next.api("model.read", { path: "src/config/siteConfig.ts", variable: "siteConfig" });
  assert.equal(model.body.value.title, "Takiyu 的手帖");
  assert.equal(model.body.value.previewSmoke, undefined);
});
