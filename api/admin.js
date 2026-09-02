import crypto from "node:crypto";
import ts from "typescript";

const COOKIE = "takiyu_admin_v2";
const SESSION_AGE = 60 * 60 * 12;
const ALLOWED = ["src/config/", "src/content/", "src/data/", "src/components/widgets/music-player/", "public/images/", "public/assets/"];
let installationCache = null;

function json(res, status, data) {
  res.statusCode = status;
  res.setHeader("Content-Type", "application/json; charset=utf-8");
  res.setHeader("Cache-Control", "no-store");
  res.end(JSON.stringify(data));
}

async function readBody(req) {
  if (req.body && typeof req.body === "object") return req.body;
  let raw = "";
  for await (const chunk of req) {
    raw += chunk;
    if (raw.length > 6_000_000) throw new Error("请求内容超过 6 MB，请压缩图片后重试。");
  }
  return raw ? JSON.parse(raw) : {};
}

function safeEqual(a, b) {
  const left = Buffer.from(String(a));
  const right = Buffer.from(String(b));
  return left.length === right.length && crypto.timingSafeEqual(left, right);
}

function secret() {
  return process.env.SESSION_SECRET || process.env.ADMIN_PASSWORD || "";
}

function sign(value) {
  return crypto.createHmac("sha256", secret()).update(value).digest("base64url");
}

function cookieMap(req) {
  return Object.fromEntries(String(req.headers.cookie || "").split(";").map(v => v.trim()).filter(Boolean).map(v => {
    const at = v.indexOf("=");
    return [v.slice(0, at), decodeURIComponent(v.slice(at + 1))];
  }));
}

function localNoAuth(req) {
  if (process.env.LOCAL_NO_AUTH !== "1") return false;
  const host = String(req.headers.host || "").toLowerCase().split(":")[0];
  return host === "127.0.0.1" || host === "localhost" || host === "[::1]";
}

function authenticated(req) {
  if (localNoAuth(req)) return true;
  if (!secret()) return false;
  const token = cookieMap(req)[COOKIE];
  if (!token) return false;
  const [issued, nonce, signature] = token.split(".");
  if (!issued || !nonce || !signature || !safeEqual(signature, sign(`${issued}.${nonce}`))) return false;
  return Date.now() - Number(issued) < SESSION_AGE * 1000;
}

function setSession(req, res) {
  const issued = String(Date.now());
  const nonce = crypto.randomBytes(18).toString("base64url");
  const value = `${issued}.${nonce}.${sign(`${issued}.${nonce}`)}`;
  const forwarded = String(req.headers["x-forwarded-proto"] || "").split(",")[0].trim();
  const secure = forwarded === "https" || String(req.headers.host || "").includes("vercel.app");
  res.setHeader("Set-Cookie", `${COOKIE}=${encodeURIComponent(value)}; Path=/; HttpOnly; ${secure ? "Secure; " : ""}SameSite=Lax; Max-Age=${SESSION_AGE}`);
}

function clearSession(res) {
  res.setHeader("Set-Cookie", `${COOKIE}=; Path=/; HttpOnly; Secure; SameSite=Lax; Max-Age=0`);
}

function repoInfo() {
  return {
    owner: process.env.GITHUB_OWNER || "Takiyu0928",
    repo: process.env.GITHUB_REPO || "Takiyu-blog",
    branch: process.env.GITHUB_BRANCH || "main",
  };
}

function b64url(value) {
  return Buffer.from(value).toString("base64url");
}

async function githubToken() {
  if (process.env.GITHUB_TOKEN) return process.env.GITHUB_TOKEN;
  const appId = process.env.GITHUB_APP_ID;
  const installationId = process.env.GITHUB_INSTALLATION_ID;
  const privateKey = process.env.GITHUB_PRIVATE_KEY?.replace(/\\n/g, "\n");
  if (!appId || !installationId || !privateKey) {
    if (process.env.LOCAL_PUBLIC_READ === "1") return null;
    throw new Error("未配置 GitHub Token 或 GitHub App 凭证。");
  }
  if (installationCache && installationCache.expires > Date.now() + 60_000) return installationCache.token;
  const now = Math.floor(Date.now() / 1000);
  const header = b64url(JSON.stringify({ alg: "RS256", typ: "JWT" }));
  const payload = b64url(JSON.stringify({ iat: now - 30, exp: now + 540, iss: appId }));
  const input = `${header}.${payload}`;
  const signature = crypto.sign("RSA-SHA256", Buffer.from(input), privateKey).toString("base64url");
  const response = await fetch(`https://api.github.com/app/installations/${installationId}/access_tokens`, {
    method: "POST",
    headers: { Authorization: `Bearer ${input}.${signature}`, Accept: "application/vnd.github+json", "X-GitHub-Api-Version": "2022-11-28" },
  });
  const data = await response.json();
  if (!response.ok) throw new Error(data.message || "GitHub App 获取访问令牌失败。");
  installationCache = { token: data.token, expires: new Date(data.expires_at).getTime() };
  return data.token;
}

async function github(path, options = {}) {
  const token = await githubToken();
  const method = String(options.method || "GET").toUpperCase();
  if (!token && method !== "GET") throw new Error("本地预览当前为只读模式；保存、上传或删除前请在 .env 中配置 GITHUB_TOKEN。");
  const response = await fetch(`https://api.github.com${path}`, {
    ...options,
    headers: {
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
      Accept: "application/vnd.github+json",
      "X-GitHub-Api-Version": "2022-11-28",
      "User-Agent": "Takiyu-Blog-Admin-v2",
      ...(options.headers || {}),
    },
  });
  const text = await response.text();
  const data = text ? JSON.parse(text) : {};
  if (!response.ok) {
    const detail = data.errors?.[0]?.message || data.message || `GitHub API ${response.status}`;
    throw new Error(detail);
  }
  return data;
}

function assertPath(path) {
  const clean = String(path || "").replaceAll("\\", "/").replace(/^\/+/, "");
  if (!clean || clean.includes("..") || !ALLOWED.some(prefix => clean.startsWith(prefix))) throw new Error("不允许访问该仓库路径。");
  return clean;
}

async function getFile(path) {
  const { owner, repo, branch } = repoInfo();
  const clean = assertPath(path);
  const data = await github(`/repos/${owner}/${repo}/contents/${encodeURI(clean)}?ref=${encodeURIComponent(branch)}`);
  if (Array.isArray(data)) throw new Error("请求的是目录，不是文件。");
  return { path: clean, sha: data.sha, content: Buffer.from(data.content || "", "base64").toString("utf8"), size: data.size };
}

async function writeFile(path, content, sha, message) {
  const { owner, repo, branch } = repoInfo();
  const clean = assertPath(path);
  const body = { message: message || `admin: update ${clean}`, content: Buffer.from(content).toString("base64"), branch };
  if (sha) body.sha = sha;
  return github(`/repos/${owner}/${repo}/contents/${encodeURI(clean)}`, { method: "PUT", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) });
}

async function writeBase64File(path, base64, sha, message) {
  const { owner, repo, branch } = repoInfo();
  const clean = assertPath(path);
  if (!/^[A-Za-z0-9+/=\r\n]+$/.test(String(base64 || ""))) throw new Error("上传文件编码无效。");
  const body = { message: message || `admin: upload ${clean}`, content: String(base64).replace(/\s/g, ""), branch };
  if (sha) body.sha = sha;
  return github(`/repos/${owner}/${repo}/contents/${encodeURI(clean)}`, { method: "PUT", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) });
}

async function deleteFile(path, sha, message) {
  const { owner, repo, branch } = repoInfo();
  const clean = assertPath(path);
  if (!sha) throw new Error("删除文件缺少 SHA，请刷新后重试。");
  return github(`/repos/${owner}/${repo}/contents/${encodeURI(clean)}`, {
    method: "DELETE", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ message: message || `admin: delete ${clean}`, sha, branch }),
  });
}

async function tree() {
  const { owner, repo, branch } = repoInfo();
  const data = await github(`/repos/${owner}/${repo}/git/trees/${encodeURIComponent(branch)}?recursive=1`);
  return data.tree.filter(item => item.type === "blob").map(item => ({ path: item.path, sha: item.sha, size: item.size || 0 }));
}

function propertyName(node, source) {
  if (ts.isIdentifier(node) || ts.isStringLiteral(node) || ts.isNumericLiteral(node)) return node.text;
  return node.getText(source);
}

function nodeValue(node, source) {
  if (!node) return null;
  if (ts.isStringLiteral(node) || ts.isNoSubstitutionTemplateLiteral(node)) return node.text;
  if (ts.isNumericLiteral(node)) return Number(node.text);
  if (node.kind === ts.SyntaxKind.TrueKeyword) return true;
  if (node.kind === ts.SyntaxKind.FalseKeyword) return false;
  if (node.kind === ts.SyntaxKind.NullKeyword) return null;
  if (ts.isPrefixUnaryExpression(node) && ts.isNumericLiteral(node.operand)) return node.operator === ts.SyntaxKind.MinusToken ? -Number(node.operand.text) : Number(node.operand.text);
  if (ts.isArrayLiteralExpression(node)) return node.elements.map(item => nodeValue(item, source));
  if (ts.isObjectLiteralExpression(node)) {
    const object = {};
    for (const prop of node.properties) {
      if (ts.isPropertyAssignment(prop)) object[propertyName(prop.name, source)] = nodeValue(prop.initializer, source);
      else if (ts.isShorthandPropertyAssignment(prop)) object[prop.name.text] = { __raw: prop.name.text };
    }
    return object;
  }
  return { __raw: node.getText(source) };
}

function findVariable(sourceText, variable) {
  const source = ts.createSourceFile("config.ts", sourceText, ts.ScriptTarget.Latest, true, ts.ScriptKind.TS);
  let found = null;
  const visit = node => {
    if (ts.isVariableDeclaration(node) && ts.isIdentifier(node.name) && node.name.text === variable && node.initializer) found = node;
    if (!found) ts.forEachChild(node, visit);
  };
  visit(source);
  if (!found) throw new Error(`未在文件中找到变量 ${variable}。`);
  return { source, declaration: found, value: nodeValue(found.initializer, source) };
}

function serialize(value, depth = 0) {
  const pad = "\t".repeat(depth);
  const child = "\t".repeat(depth + 1);
  if (value && typeof value === "object" && !Array.isArray(value) && Object.keys(value).length === 1 && typeof value.__raw === "string") return value.__raw;
  if (typeof value === "string") return JSON.stringify(value);
  if (typeof value === "number" || typeof value === "boolean") return String(value);
  if (value === null || value === undefined) return "null";
  if (Array.isArray(value)) {
    if (!value.length) return "[]";
    return `[\n${value.map(item => `${child}${serialize(item, depth + 1)},`).join("\n")}\n${pad}]`;
  }
  const entries = Object.entries(value);
  if (!entries.length) return "{}";
  return `{\n${entries.map(([key, item]) => `${child}${/^[A-Za-z_$][A-Za-z0-9_$]*$/.test(key) ? key : JSON.stringify(key)}: ${serialize(item, depth + 1)},`).join("\n")}\n${pad}}`;
}

async function readModel(path, variable) {
  const file = await getFile(path);
  return { ...file, variable, value: findVariable(file.content, variable).value };
}

async function writeModel(path, variable, value, sha, message) {
  const file = await getFile(path);
  if (sha && file.sha !== sha) throw new Error("GitHub 文件已经更新，请刷新后再保存。");
  const parsed = findVariable(file.content, variable);
  const start = parsed.declaration.initializer.getStart(parsed.source);
  const end = parsed.declaration.initializer.getEnd();
  const output = `${file.content.slice(0, start)}${serialize(value)}${file.content.slice(end)}`;
  return writeFile(path, output, file.sha, message);
}

export default async function handler(req, res) {
  if (req.method === "OPTIONS") { res.statusCode = 204; return res.end(); }
  if (req.method !== "POST") return json(res, 405, { error: "仅支持 POST 请求。" });
  try {
    const body = await readBody(req);
    const action = body.action;
    if (action === "login") {
      const expected = process.env.ADMIN_PASSWORD;
      if (!expected) throw new Error("Vercel 未配置 ADMIN_PASSWORD。");
      if (!safeEqual(body.password || "", expected)) return json(res, 401, { error: "后台密码错误。" });
      setSession(req, res);
      return json(res, 200, { ok: true, repo: repoInfo() });
    }
    if (action === "logout") { clearSession(res); return json(res, 200, { ok: true }); }
    if (action === "session") return json(res, authenticated(req) ? 200 : 401, { authenticated: authenticated(req), localNoAuth: localNoAuth(req), repo: repoInfo() });
    if (!authenticated(req)) return json(res, 401, { error: "登录已过期，请重新登录。" });

    if (action === "tree") return json(res, 200, { files: await tree(), repo: repoInfo() });
    if (action === "file.read") return json(res, 200, await getFile(body.path));
    if (action === "file.write") return json(res, 200, { ok: true, result: await writeFile(body.path, body.content || "", body.sha, body.message) });
    if (action === "file.upload") return json(res, 200, { ok: true, result: await writeBase64File(body.path, body.base64, body.sha, body.message) });
    if (action === "file.delete") return json(res, 200, { ok: true, result: await deleteFile(body.path, body.sha, body.message) });
    if (action === "model.read") return json(res, 200, await readModel(body.path, body.variable));
    if (action === "model.write") return json(res, 200, { ok: true, result: await writeModel(body.path, body.variable, body.value, body.sha, body.message) });
    throw new Error("未知操作。");
  } catch (error) {
    console.error(error);
    json(res, /登录|密码/.test(error.message) ? 401 : 400, { error: error.message || "操作失败。" });
  }
}
