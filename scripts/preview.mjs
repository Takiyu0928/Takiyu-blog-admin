import http from "node:http";
import { createHash, randomBytes } from "node:crypto";
import { open, realpath } from "node:fs/promises";
import { extname, isAbsolute, relative, resolve, sep } from "node:path";
import { fileURLToPath } from "node:url";
import { parseArgs } from "node:util";
import { deflateSync } from "node:zlib";

// Deliberately independent of dev.mjs, api/admin.js, .env and the blog checkout.
// Only PORT is consulted; repository credentials are never read or used.
const { values: options } = parseArgs({
  options: { port: { type: "string" }, login: { type: "boolean" }, help: { type: "boolean" } },
});
if (options.help) {
  console.log("Usage: node scripts/preview.mjs [--port=3104] [--login]\nPORT defaults to 3104; --port=0 selects a free port.\n--login starts at the login screen; the demo password is demo.\nAll mutations are in memory and reset on restart. Never enter real credentials.");
  process.exit(0);
}
const requestedPort = options.port ?? process.env.PORT ?? "3104";
if (!/^\d+$/.test(requestedPort) || Number(requestedPort) > 65535) {
  throw new Error("PORT / --port must be an integer between 0 and 65535.");
}

const publicRoot = await realpath(fileURLToPath(new URL("../public/", import.meta.url)));
const repo = { owner: "Takiyu0928", repo: "Takiyu-blog", branch: "main" };
const demo = { demo: true, repo, assetBase: "/__preview/" };
const allowedPaths = ["src/config/", "src/content/", "src/data/", "src/components/widgets/music-player/", "public/images/", "public/assets/"];
const files = new Map();
const modelNames = new Map();
const sessionToken = randomBytes(24).toString("hex");
const maxBody = 6_000_000;
const maxStorage = 64 * 1024 * 1024;
let storageBytes = 0;
const mime = {
  ".html": "text/html; charset=utf-8", ".css": "text/css; charset=utf-8",
  ".js": "text/javascript; charset=utf-8", ".mjs": "text/javascript; charset=utf-8",
  ".json": "application/json; charset=utf-8", ".map": "application/json; charset=utf-8",
  ".webmanifest": "application/manifest+json; charset=utf-8",
  ".txt": "text/plain; charset=utf-8", ".md": "text/plain; charset=utf-8",
  ".svg": "image/svg+xml", ".png": "image/png", ".jpg": "image/jpeg", ".jpeg": "image/jpeg",
  ".gif": "image/gif", ".webp": "image/webp", ".avif": "image/avif", ".ico": "image/x-icon",
  ".woff": "font/woff", ".woff2": "font/woff2", ".ttf": "font/ttf", ".otf": "font/otf",
  ".mp3": "audio/mpeg", ".wav": "audio/wav", ".ogg": "audio/ogg", ".flac": "audio/flac",
  ".mp4": "video/mp4", ".webm": "video/webm", ".pdf": "application/pdf", ".wasm": "application/wasm",
};

function fail(status, message) {
  const error = new Error(message);
  error.status = status;
  throw error;
}

function putFile(path, content) {
  const data = Buffer.isBuffer(content) ? content : Buffer.from(content, "utf8");
  const nextSize = storageBytes - (files.get(path)?.data.length || 0) + data.length;
  if (nextSize > maxStorage || (!files.has(path) && files.size >= 2048)) {
    fail(413, "演示数据已达内存上限，请重启预览服务器重置。");
  }
  const sha = createHash("sha1").update(`blob ${data.length}\0`).update(data).digest("hex");
  const file = { path, sha, data };
  files.set(path, file);
  storageBytes = nextSize;
  return file;
}

function seedModel(path, variable, value) {
  modelNames.set(path, variable);
  putFile(path, `// Local preview fixture: JSON data only, never executed.\nexport const ${variable} = ${JSON.stringify(value, null, 2)};\n`);
}

// Tiny deterministic PNG swatches make image grids testable without downloads.
function pngChunk(type, data) {
  const content = Buffer.concat([Buffer.from(type), data]);
  let crc = 0xffffffff;
  for (const byte of content) {
    crc ^= byte;
    for (let bit = 0; bit < 8; bit += 1) crc = (crc >>> 1) ^ (crc & 1 ? 0xedb88320 : 0);
  }
  const size = Buffer.alloc(4), checksum = Buffer.alloc(4);
  size.writeUInt32BE(data.length);
  checksum.writeUInt32BE((crc ^ 0xffffffff) >>> 0);
  return Buffer.concat([size, content, checksum]);
}

function landscape(variant) {
  const width = 240, height = 160;
  const pixels = Buffer.alloc((width * 3 + 1) * height);
  const palettes = [
    [[242, 231, 207], [183, 80, 57], [142, 160, 155], [46, 79, 88]],
    [[231, 233, 219], [195, 134, 76], [146, 158, 127], [59, 88, 77]],
    [[226, 233, 232], [183, 115, 97], [147, 169, 182], [49, 78, 105]],
  ];
  const [sky, sun, mountain, water] = palettes[variant % palettes.length];
  for (let y = 0; y < height; y += 1) {
    for (let x = 0; x < width; x += 1) {
      let color = sky;
      if ((x - 175) ** 2 + (y - 43) ** 2 < 19 ** 2) color = sun;
      if (y > 64 + Math.abs(x - 85) * 0.4) color = mountain;
      if (y > 119 + Math.sin(x / 35 + variant) * 7) color = water;
      const offset = y * (width * 3 + 1) + 1 + x * 3;
      pixels.set(color, offset);
    }
  }
  const header = Buffer.alloc(13);
  header.writeUInt32BE(width, 0); header.writeUInt32BE(height, 4);
  header[8] = 8; header[9] = 2;
  return Buffer.concat([Buffer.from("89504e470d0a1a0a", "hex"), pngChunk("IHDR", header), pngChunk("IDAT", deflateSync(pixels)), pngChunk("IEND", Buffer.alloc(0))]);
}

const pictures = [0, 1, 2].map(landscape);
for (const [path, picture] of [
  ["public/images/albums/autumn-walk/01-riverside.png", 0],
  ["public/images/albums/autumn-walk/02-trees.png", 1],
  ["public/images/albums/autumn-walk/03-evening.png", 2],
  ["public/images/albums/quiet-coast/01-coast.png", 2],
  ["public/images/albums/quiet-coast/02-morning.png", 0],
  ["public/assets/images/demo-avatar.png", 1],
  ["public/assets/desktop-banner/demo-landscape.png", 0],
  ["public/assets/mobile-banner/demo-coast.png", 2],
]) putFile(path, pictures[picture]);

const posts = [
  {
    slug: "autumn-notes", title: "把秋天收进一页手帖", published: "2026-10-18", updated: "2026-10-20",
    description: "沿着河岸慢慢走，让风、树影与日常的小事留在文字里。", tags: ["生活", "随笔"], category: "日常记录", pinned: true,
    body: "## 留一点空白\n\n周末沿着河岸走了很久。树叶落在水面，像一封没有署名的信。\n\n**不必把每一天都填满。** 有时候，记录一个温柔的瞬间就足够了。\n\n### 今日清单\n\n- 整理十月的照片\n- 给书桌换一束枝叶\n- 写下一件值得记住的小事\n",
  },
  {
    slug: "a-small-digital-garden", title: "搭建自己的数字小花园", published: "2026-10-12", updated: "2026-10-16",
    description: "从一篇 Markdown 开始，整理文章、相册和零散的灵感。", tags: ["博客", "Astro", "开发"], category: "技术笔记",
    body: "## 从写作开始\n\n博客不只是展示页面，也是慢慢生长的笔记本。\n\n把内容放在 `src/content/posts`，让文字与样式各自保持清晰。\n\n### 下一步\n\n先完善阅读体验，再添加真正需要的功能。简单的工具，也可以陪伴很久。\n",
  },
  {
    slug: "coast-after-rain", title: "雨后海边，一段缓慢的散步", published: "2026-10-05",
    description: "阴天的海面有一种安静的蓝，适合散步，也适合什么都不想。", tags: ["旅行", "摄影"], category: "山海之间",
    body: "## 海风与远处的灯\n\n雨停后，路面还留着浅浅的水光。远处的船慢慢驶过，没有人急着说话。\n\n![海边色彩练习](/__preview/public/images/albums/quiet-coast/01-coast.png)\n\n这张图是预览环境的本地示意图片，不会请求外部图床。\n",
  },
  {
    slug: "reading-and-notes", title: "九月读书札记：在文字里停留", published: "2026-09-28", extension: "mdx",
    description: "摘下一些阅读时的念头，等它们慢慢长成自己的句子。", tags: ["阅读", "笔记"], category: "书页之间",
    body: "## 把书读慢一点\n\n这次没有给自己列书单，只挑了一本放在床头。\n\n读到喜欢的段落，就停下来写两句感受。**记住的问题比读完的页数更重要。**\n",
  },
  {
    slug: "winter-plans-draft", title: "冬日计划：尚未寄出的信", published: "2026-10-22", draft: true,
    description: "还在整理中的草稿，留给接下来的自己。", tags: ["草稿", "计划"], category: "日常记录",
    body: "## 还没有想好的开头\n\n想做一本小小的年末相册，也想给老朋友写一封信。\n\n- 补完秋天的日记\n- 挑选十二张照片\n- 留出一个没有安排的周末\n\n这是一篇演示草稿，可以放心编辑或删除。\n",
  },
];
for (const { slug, extension = "md", body, ...post } of posts) {
  const metadata = { ...post, image: "/images/albums/autumn-walk/01-riverside.png", pinned: post.pinned || false, priority: post.pinned ? 10 : 0, draft: post.draft || false, author: "Takiyu" };
  putFile(`src/content/posts/${slug}.${extension}`, `---\n${Object.entries(metadata).map(([key, value]) => `${key}: ${JSON.stringify(value)}`).join("\n")}\n---\n\n${body}`);
}
putFile("src/content/spec/about.md", "# 关于 Takiyu\n\n你好，欢迎来到我的数字手帖。这里记录代码、读书、摄影，以及日常里细小的快乐。\n\n## 最近在做\n\n- 把博客整理得更轻盈\n- 学着观察季节的颜色\n- 认真记录每一次出发\n\n这里的内容都是本地演示数据，保存不会发布到真实博客。\n");

for (const [id, value] of [
  ["autumn-walk", { title: "秋日散步", date: "2026-10-18", location: "杭州 · 河畔", tags: ["秋天", "街拍"], description: "树影、河流与傍晚的暖光。用三张色彩练习记录一个安静的下午。", hidden: false, password: "", layout: "masonry", columns: 3 }],
  ["quiet-coast", { title: "海风来信", date: "2026-10-05", location: "舟山 · 海边", tags: ["旅行", "海岸"], description: "雨后的海边，只有风和潮汐的声音。", hidden: false, password: "", layout: "grid", columns: 2 }],
]) putFile(`public/images/albums/${id}/info.json`, `${JSON.stringify(value, null, 2)}\n`);

seedModel("src/data/diary.ts", "diaryData", [
  { id: 3, date: "2026-10-22T09:30:00+08:00", content: "早晨的阳光刚好落在书桌上。泡一杯茶，开始整理新的文章。", mood: "☀", location: "家中", tags: ["日常", "写作"], images: [] },
  { id: 2, date: "2026-10-18T17:40:00+08:00", content: "河边的树开始变黄了，拍到一片很像小船的落叶。", mood: "🍂", location: "河畔", tags: ["散步", "秋天"], images: ["/images/albums/autumn-walk/02-trees.png"] },
  { id: 1, date: "2026-10-05T16:20:00+08:00", content: "听海的时候，时间好像变慢了一点。", mood: "🌊", location: "海边", tags: ["旅行"], images: ["/images/albums/quiet-coast/01-coast.png"] },
]);
seedModel("src/config/siteConfig.ts", "siteConfig", {
  title: "Takiyu 的手帖", subtitle: "记录日常，收藏微光。", siteURL: "https://example.invalid/", siteStartDate: "2024-08-03", lang: "zh_CN",
  themeColor: { hue: 205, fixed: false }, navbarTitle: { text: "Takiyu", icon: "material-symbols:eco-outline" },
  bilibili: { vmid: "" }, bangumi: { userId: "" },
  featurePages: { anime: false, diary: true, friends: true, projects: true, skills: true, timeline: true, albums: true, devices: true, aiTools: false },
  banner: {
    enable: true, src: { desktop: ["/assets/desktop-banner/demo-landscape.png"], mobile: ["/assets/mobile-banner/demo-coast.png"] }, position: "center",
    carousel: { interval: 6, enable: true, switchable: true }, waves: { enable: true, performanceMode: false, mobileDisable: true, switchable: true },
    imageApi: { enable: false, url: "" }, navbar: { transparentMode: "semifull" },
    homeText: { enable: true, switchable: true, title: "把日常写成风景", subtitle: ["山海有时，书写不止", "在平凡的日子里，收藏一点光"], typewriter: { enable: true, speed: 100, deleteSpeed: 50, pauseTime: 2000 } },
  },
});
seedModel("src/config/profileConfig.ts", "profileConfig", {
  avatar: "/assets/images/demo-avatar.png", name: "Takiyu", bio: "写代码，也写生活。喜欢安静的书店、山间的风和慢慢完成的小作品。",
  typewriter: { enable: true, speed: 80 }, links: [
    { name: "GitHub", url: "https://github.com/Takiyu0928", icon: "fa7-brands:github" },
    { name: "我的手帖", url: "https://example.invalid/", icon: "material-symbols:book-outline" },
  ],
});
seedModel("src/config/announcementConfig.ts", "announcementConfig", {
  title: "秋日来信", type: "info", icon: "material-symbols:campaign-outline", closable: true,
  content: "欢迎来坐坐。最近更新了秋日相册，也整理了几篇博客笔记。愿你在这里找到片刻的安静。",
  link: { enable: true, text: "认识一下站长", url: "/about/", external: false },
});
seedModel("src/config/musicConfig.ts", "musicPlayerConfig", {
  enable: true, showFloatingPlayer: true, mode: "local", floatingEntryMode: "fab", id: "0", server: "netease", type: "playlist", meting_api: "https://example.invalid/meting",
});
seedModel("src/components/widgets/music-player/constants.ts", "LOCAL_PLAYLIST", [
  { id: 1, title: "海边的慢时光（演示）", artist: "本地试听占位", cover: "/assets/images/demo-avatar.png", url: "/assets/music/demo-sea.mp3", duration: 215 },
  { id: 2, title: "雨后书店（演示）", artist: "本地试听占位", cover: { __raw: "demoCover" }, url: { __raw: "demoAudio" }, duration: 182 },
]);
seedModel("src/data/friends.ts", "friendsData", [
  { title: "山海来信", siteurl: "https://example.invalid/friends/shanhai/", imgurl: "/assets/images/demo-avatar.png", desc: "记录旅行途中遇见的风景与故事。", tags: ["摄影", "生活"] },
  { title: "青木笔记", siteurl: "https://example.invalid/friends/aoki/", imgurl: "/assets/images/demo-avatar.png", desc: "一个慢慢生长的技术笔记本。", tags: ["技术", "阅读"] },
]);
seedModel("src/data/projects.ts", "projectsData", [
  { title: "个人数字花园", id: "digital-garden", description: "用轻盈的页面整理文章、照片和生活片段。", image: "/assets/desktop-banner/demo-landscape.png", category: "web", status: "completed", techStack: ["Astro", "TypeScript"], visitUrl: "https://example.invalid/", sourceCode: "https://github.com/Takiyu0928/Takiyu-blog", startDate: "2026-08-03", endDate: "2026-09-12", featured: true, showImage: true },
  { title: "日常灵感收集箱", id: "daily-notes", description: "把随手想到的一句话收进自己的灵感库。", image: "", category: "web", status: "in-progress", techStack: ["JavaScript", "CSS"], visitUrl: "", sourceCode: "", startDate: "2026-10-01", endDate: "", featured: false, showImage: false },
]);
seedModel("src/data/skills.ts", "skillsData", [
  { name: "TypeScript", id: "typescript", description: "让小项目也拥有清晰的数据边界。", icon: "simple-icons:typescript", category: "开发", level: "advanced", color: "#315e73", projects: ["digital-garden"] },
  { name: "摄影", id: "photography", description: "练习观察光线，记录日常的细节。", icon: "material-symbols:photo-camera-outline", category: "创作", level: "intermediate", color: "#a9664d", projects: [] },
]);
seedModel("src/data/timeline.ts", "timelineData", [
  { title: "手帖焕新", date: "2026-10-22", description: "整理新的编辑体验，让写作更专注。", icon: "material-symbols:edit-note", type: "milestone", tags: ["博客", "设计"] },
  { title: "第一次写下你好", date: "2024-08-03", description: "为自己的数字花园种下第一颗种子。", icon: "material-symbols:eco-outline", type: "life", tags: ["开始"] },
]);
seedModel("src/data/devices.ts", "devicesData", {
  "创作与工作": [{ name: "日常笔记本", image: "", specs: "16 英寸 · 32 GB 内存 · 1 TB SSD", description: "用来写代码、整理照片，也用来写一些不着急完成的文字。", link: "https://example.invalid/devices/laptop/" }],
  "随身记录": [{ name: "便携相机", image: "", specs: "APS-C · 轻便定焦镜头", description: "出门散步时带在身边，记录路过的光影。", link: "https://example.invalid/devices/camera/" }],
});
seedModel("src/config/navBarConfig.ts", "navBarConfig", { links: [
  { __raw: "LinkPreset.Home" },
  { name: "记录", url: "/archive/", icon: "material-symbols:book-outline", external: false, children: [
    { name: "文章归档", url: "/archive/", icon: "material-symbols:archive-outline", external: false },
    { name: "日记", url: "/diary/", icon: "material-symbols:edit-note", external: false },
  ] },
  { name: "相册", url: "/albums/", icon: "material-symbols:photo-library-outline", external: false },
  { name: "关于", url: "/about/", icon: "material-symbols:person-outline", external: false },
] });
seedModel("src/config/sidebarConfig.ts", "sidebarLayoutConfig", {
  components: { left: ["profile", "announcement", "categories", "tags"], right: ["card-toc", "site-stats"], drawer: ["profile", "announcement", "music-sidebar", "calendar"] },
  properties: ["profile", "announcement", "music-sidebar", "categories", "tags", "card-toc", "site-stats", "calendar"].map((type, index) => ({ type, position: index < 2 ? "top" : "sticky", animationDelay: index * 50, class: "onload-animation", ...(type === "card-toc" ? { responsive: { collapseThreshold: 1200 } } : {}) })),
  defaultAnimation: { enable: true, baseDelay: 0, increment: 50 },
});

function pathSegments(path) {
  if (typeof path !== "string" || !path || path.length > 2048 || /[\\\x00-\x1f\x7f:<>"|?*]/.test(path)) fail(403, "不允许访问该路径。");
  const segments = path.split("/");
  if (segments.some(part => !part || part.startsWith(".") || /[. ]$/.test(part) || /^(con|prn|aux|nul|com[0-9]|lpt[0-9])(?:\.|$)/i.test(part))) fail(403, "不允许访问该路径。");
  return segments;
}

function repoPath(path) {
  pathSegments(path);
  if (!allowedPaths.some(prefix => path.startsWith(prefix))) fail(403, "不允许访问该仓库路径。");
  return path;
}

function getFile(path) {
  const file = files.get(repoPath(path));
  if (!file) fail(404, "演示文件不存在。");
  return file;
}

function describe(file) { return { path: file.path, sha: file.sha, size: file.data.length }; }
function readFile(file) { return { ...describe(file), content: file.data.toString("utf8") }; }

function checkSha(path, sha, required = true) {
  const current = files.get(path);
  if ((current && (required || sha) && sha !== current.sha) || (!current && sha)) {
    fail(409, "演示文件已经更新或 SHA 不匹配，请刷新后再保存。");
  }
}

function parseModel(path, variable) {
  const file = getFile(path);
  if (!modelNames.has(path) || modelNames.get(path) !== variable) fail(404, "演示模型变量不存在。");
  const source = file.data.toString("utf8");
  // Preview models are JSON-backed exports. Never eval/import uploaded TypeScript.
  const match = source.match(new RegExp(`^([\\s\\S]*?\\bexport\\s+const\\s+${variable}\\s*=\\s*)([\\s\\S]+?)(;\\s*)$`));
  if (!match) fail(400, "演示模型仅支持 export const 变量 = JSON; 格式。");
  let value;
  try { value = JSON.parse(match[2]); }
  catch { fail(400, "演示模型仅支持 JSON 数据，不解析或执行 TypeScript 表达式。"); }
  return { file, value, prefix: match[1], suffix: match[3] };
}

function send(res, status, data, contentType = "application/json; charset=utf-8", head = false) {
  const buffer = Buffer.isBuffer(data) ? data : Buffer.from(typeof data === "string" ? data : JSON.stringify(data));
  res.writeHead(status, { "Content-Type": contentType, "Content-Length": buffer.length });
  res.end(head ? undefined : buffer);
}

async function readBody(req) {
  if (String(req.headers["content-type"] || "").split(";")[0].trim().toLowerCase() !== "application/json") fail(415, "请使用 application/json。");
  if (Number(req.headers["content-length"]) > maxBody) { req.resume(); fail(413, "请求内容超过 6 MB。"); }
  let size = 0;
  const chunks = [];
  for await (const chunk of req) {
    size += chunk.length;
    if (size <= maxBody) chunks.push(chunk);
  }
  if (size > maxBody) fail(413, "请求内容超过 6 MB。");
  let body;
  try { body = JSON.parse(Buffer.concat(chunks).toString("utf8")); }
  catch { fail(400, "JSON 请求格式无效。"); }
  if (!body || typeof body !== "object" || Array.isArray(body)) fail(400, "请求体必须是 JSON 对象。");
  return body;
}

function cookieName() { return `takiyu_preview_${server.address().port}`; }
function authenticated(req) {
  const value = String(req.headers.cookie || "").split(";").map(part => part.trim()).find(part => part.startsWith(`${cookieName()}=`))?.slice(cookieName().length + 1);
  return value === undefined ? !options.login : value === sessionToken;
}
function setSession(res, value) {
  res.setHeader("Set-Cookie", `${cookieName()}=${value}; Path=/; HttpOnly; SameSite=Strict`);
}

async function admin(req, res) {
  if (req.method === "OPTIONS") { res.writeHead(204, { Allow: "POST, OPTIONS" }); return res.end(); }
  if (req.method !== "POST") { res.setHeader("Allow", "POST, OPTIONS"); fail(405, "仅支持 POST 请求。"); }
  const body = await readBody(req);
  if (body.action === "session") {
    const active = authenticated(req);
    return send(res, active ? 200 : 401, { ...demo, authenticated: active, localNoAuth: !options.login, ...(active ? {} : { error: "请使用演示密码 demo 登录；不要输入真实密码。" }) });
  }
  if (body.action === "login") {
    if (body.password !== "demo") fail(401, "演示密码是 demo，请勿使用真实后台密码。");
    setSession(res, sessionToken);
    return send(res, 200, { ...demo, ok: true });
  }
  if (body.action === "logout") {
    setSession(res, "logged-out");
    return send(res, 200, { ok: true, demo: true });
  }
  if (!authenticated(req)) fail(401, "演示会话已退出，请使用密码 demo 重新登录。");
  if (body.action === "tree") return send(res, 200, { ...demo, files: [...files.values()].map(describe).sort((a, b) => a.path.localeCompare(b.path, "zh-CN")) });
  if (body.action === "file.read") return send(res, 200, readFile(getFile(body.path)));
  if (body.action === "model.read") {
    const model = parseModel(body.path, body.variable);
    return send(res, 200, { ...readFile(model.file), variable: body.variable, value: model.value });
  }
  if (["file.write", "file.upload", "file.delete", "model.write"].includes(body.action)) {
    const path = repoPath(body.path);
    checkSha(path, body.sha, body.action !== "model.write");
    let result;
    if (body.action === "file.delete") {
      const file = getFile(path);
      if (!body.sha) fail(409, "删除文件缺少 SHA，请刷新后重试。");
      storageBytes -= file.data.length;
      files.delete(path);
      result = { content: null };
    } else {
      let content;
      if (body.action === "model.write") {
        const model = parseModel(path, body.variable);
        if (!Object.hasOwn(body, "value")) fail(400, "缺少模型 value。");
        content = `${model.prefix}${JSON.stringify(body.value, null, 2)}${model.suffix}`;
      } else if (body.action === "file.upload") {
        if (typeof body.base64 !== "string") fail(400, "上传文件编码无效。");
        const encoded = body.base64.replace(/[\r\n]/g, "");
        if (!encoded || !/^(?:[A-Za-z0-9+/]{4})*(?:[A-Za-z0-9+/]{2}==|[A-Za-z0-9+/]{3}=)?$/.test(encoded)) fail(400, "上传文件编码无效。");
        content = Buffer.from(encoded, "base64");
      } else {
        content = body.content ?? "";
        if (typeof content !== "string") fail(400, "文件内容必须是字符串。");
      }
      result = { content: describe(putFile(path, content)) };
    }
    return send(res, 200, { ok: true, demo: true, result });
  }
  fail(400, "未知演示操作。");
}

function insidePublic(path) {
  const local = relative(publicRoot, path);
  return local && local !== ".." && !local.startsWith(`..${sep}`) && !isAbsolute(local);
}

async function servePublic(req, res, pathname) {
  if (!["GET", "HEAD"].includes(req.method)) { res.setHeader("Allow", "GET, HEAD"); fail(405, "静态文件仅支持 GET / HEAD。"); }
  const head = req.method === "HEAD";
  // This route exposes only virtual public assets, never src/ or disk paths.
  if (pathname.startsWith(demo.assetBase)) {
    const path = pathname.slice(demo.assetBase.length);
    pathSegments(path);
    if (!path.startsWith("public/")) fail(403, "只能预览 public 资源。");
    const file = getFile(path);
    return send(res, 200, file.data, mime[extname(path).toLowerCase()] || "application/octet-stream", head);
  }
  const parts = pathSegments(pathname === "/" ? "index.html" : pathname.slice(1));
  let handle;
  try {
    const path = await realpath(resolve(publicRoot, ...parts));
    if (!insidePublic(path)) fail(403, "不允许访问 public 以外的文件。");
    handle = await open(path, "r");
    if (!(await handle.stat()).isFile()) fail(404, "文件不存在。");
    send(res, 200, await handle.readFile(), mime[extname(path).toLowerCase()] || "application/octet-stream", head);
  } catch (error) {
    if (["ENOENT", "ENOTDIR", "EISDIR"].includes(error.code)) fail(404, "文件不存在。");
    if (["EACCES", "EPERM", "ELOOP"].includes(error.code)) fail(403, "不允许访问该文件。");
    throw error;
  } finally { await handle?.close(); }
}

const server = http.createServer({ requestTimeout: 15_000, headersTimeout: 10_000, keepAliveTimeout: 1_000 }, async (req, res) => {
  res.setHeader("Cache-Control", "no-store");
  res.setHeader("X-Content-Type-Options", "nosniff");
  res.setHeader("Cross-Origin-Resource-Policy", "same-origin");
  res.setHeader("Referrer-Policy", "no-referrer");
  try {
    const port = server.address().port;
    const hosts = [`127.0.0.1:${port}`, `localhost:${port}`];
    if (!hosts.includes(req.headers.host)) fail(421, "预览服务器仅接受本机 Host。");
    if ((req.headers.origin && !hosts.some(host => req.headers.origin === `http://${host}`)) || req.headers["sec-fetch-site"] === "cross-site") fail(403, "不允许跨站访问本地预览。");
    const rawPath = (req.url || "/").split("?")[0];
    let pathname;
    try { pathname = decodeURIComponent(rawPath); }
    catch { fail(400, "URL 编码无效。"); }
    if (!pathname.startsWith("/") || pathname.startsWith("//")) fail(400, "URL 路径无效。");
    if (pathname === "/api/admin") await admin(req, res);
    else await servePublic(req, res, pathname);
  } catch (error) {
    if (!res.headersSent && !res.destroyed) send(res, error.status || 500, { error: error.status ? error.message : "本地预览请求失败。", demo: true }, undefined, req.method === "HEAD");
    else if (!res.writableEnded) res.end();
  }
});
server.on("error", error => {
  console.error(`Preview server could not start (${error.code || "unknown error"}). Try --port=3105.`);
  process.exitCode = 1;
});
server.listen(Number(requestedPort), "127.0.0.1", () => {
  console.log(`Takiyu Admin isolated preview: http://127.0.0.1:${server.address().port}`);
  console.log(`DEMO ONLY | ${files.size} in-memory files | no .env, GitHub requests or disk writes`);
  console.log(`Login: ${options.login ? "required" : "automatic"}; demo password: demo. Restart resets all edits.`);
});
for (const signal of ["SIGINT", "SIGTERM"]) process.once(signal, () => { server.close(); server.closeIdleConnections(); });
