const $ = (selector, root = document) => root.querySelector(selector);
const $$ = (selector, root = document) => [...root.querySelectorAll(selector)];

const modules = [
  { id: "home", label: "概览", title: "写作工作室", eyebrow: "PERSONAL PUBLISHING", description: "文章、草稿与最近更新。" },
  { id: "posts", label: "文章", title: "文章", eyebrow: "01 / WRITING", description: "查找文章，继续编辑或新建草稿。", catalog: "文章目录" },
  { id: "albums", label: "相册", title: "相册", eyebrow: "02 / PHOTOGRAPHS", description: "管理相册信息与上传的照片。", catalog: "相册目录" },
  { id: "diary", label: "日记", title: "日记", eyebrow: "03 / JOURNAL", description: "管理日记正文、日期与图片。", catalog: "日记目录" },
  { id: "other", label: "站点", title: "站点设置", eyebrow: "04 / SITE SETTINGS", description: "网站信息、导航与各类展示内容。", catalog: "设置分类" },
];

const otherSections = [
  { id: "site", label: "网站信息", icon: "♙", count: 2, note: "修改站点标题、网址、功能页面、站长头像、名称、介绍和社交链接。" },
  { id: "announcement", label: "首页公告", icon: "!", count: 1, note: "编辑初次打开博客时显示的公告标题、正文、样式和跳转链接。" },
  { id: "music", label: "网站音乐", icon: "≋", count: 2, note: "配置网易云歌单、播放器显示方式和本地歌曲列表。" },
  { id: "friends", label: "友链", icon: "♣", count: "array", path: "src/data/friends.ts", variable: "friendsData" },
  { id: "projects", label: "项目展示", icon: "▣", count: "array", path: "src/data/projects.ts", variable: "projectsData" },
  { id: "skills", label: "技能展示", icon: "♙", count: "array", path: "src/data/skills.ts", variable: "skillsData" },
  { id: "timeline", label: "时间线", icon: "⌁", count: "array", path: "src/data/timeline.ts", variable: "timelineData" },
  { id: "devices", label: "设备展示", icon: "▥", count: "object", path: "src/data/devices.ts", variable: "devicesData" },
  { id: "banner", label: "首页图", icon: "▧", count: 2, note: "上传桌面端和移动端横幅，并调整轮播、水波、位置和首页标题。" },
  { id: "navbar", label: "顶栏与菜单", icon: "☷", count: "array", path: "src/config/navBarConfig.ts", variable: "navBarConfig" },
  { id: "sidebar", label: "侧栏布局", icon: "▤", count: 3, path: "src/config/sidebarConfig.ts", variable: "sidebarLayoutConfig" },
];

const arraySchemas = {
  friends: [
    ["title", "网站名称", "text"], ["siteurl", "网站链接", "url"], ["imgurl", "网站图标/头像", "text"],
    ["desc", "网站简介", "textarea"], ["tags", "标签（用逗号分隔）", "list"],
  ],
  projects: [
    ["title", "项目名称", "text"], ["id", "项目 ID", "text"], ["description", "项目简介", "textarea"],
    ["image", "项目封面", "text"], ["category", "项目类别", "select", ["web", "mobile", "desktop", "other"]],
    ["status", "项目状态", "select", ["completed", "in-progress", "planned"]], ["techStack", "技术栈", "list"],
    ["visitUrl", "访问地址", "url"], ["sourceCode", "源码地址", "url"], ["startDate", "开始日期", "date"],
    ["endDate", "结束日期", "date"], ["featured", "首页推荐", "boolean"], ["showImage", "显示图片", "boolean"],
  ],
  skills: [
    ["name", "技能名称", "text"], ["id", "技能 ID", "text"], ["description", "技能说明", "textarea"],
    ["icon", "图标名称", "text"], ["category", "技能类别", "text"],
    ["level", "熟练度", "select", ["beginner", "intermediate", "advanced", "expert"]],
    ["color", "主题色", "color"], ["projects", "相关项目", "list"],
  ],
  timeline: [
    ["title", "标题", "text"], ["date", "日期", "date"], ["description", "说明", "textarea"],
    ["icon", "图标", "text"], ["type", "类型", "text"], ["tags", "标签", "list"],
  ],
  playlist: [
    ["title", "歌曲名称", "text"], ["artist", "歌手", "text"], ["cover", "封面变量或路径", "text"],
    ["url", "音频变量或路径", "text"], ["duration", "时长（秒）", "number"],
  ],
};

const state = {
  module: "home",
  selected: null,
  otherSection: "site",
  files: [],
  repo: null,
  cache: new Map(),
  model: null,
  pendingUpload: null,
  busy: false,
  demo: false,
  assetBase: "",
  dirty: false,
};

const els = {
  login: $("#login"), app: $("#app"), loginForm: $("#login-form"), password: $("#password"),
  moduleNav: $("#module-nav"), pageTitle: $("#page-title"), repoBadge: $("#repo-badge"),
  newButton: $("#new-button"), refreshButton: $("#refresh-button"), search: $("#search"),
  sidebarNote: $("#sidebar-note"), sideList: $("#side-list"), editor: $("#editor"),
  empty: $("#empty-state"), theme: $("#theme-button"), logout: $("#logout-button"),
  picker: $("#file-picker"), toast: $("#toast"),
  dashboard: $("#dashboard"), workspace: $("#workspace"),
  pageEyebrow: $("#page-eyebrow"), pageDescription: $("#page-description"),
  currentSection: $("#current-section"), catalogTitle: $("#catalog-title"),
  connection: $("#connection-state"), previewNotice: $("#preview-notice"),
  navToggle: $("#navigation-toggle"), navClose: $("#close-navigation"),
  navBackdrop: $("#nav-backdrop"), homeButton: $("#home-button"),
  listToggle: $("#list-toggle"), catalogBody: $("#catalog-body"),
};

function escapeHtml(value = "") {
  return String(value).replace(/[&<>"']/g, char => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[char]);
}

function clone(value) { return value == null ? value : JSON.parse(JSON.stringify(value)); }
function slugify(value) {
  return String(value || "new-post").trim().toLowerCase().replace(/[^\p{L}\p{N}]+/gu, "-").replace(/^-|-$/g, "") || `entry-${Date.now()}`;
}
function fileName(path) { return String(path).split("/").pop() || path; }
function dirname(path) { return String(path).split("/").slice(0, -1).join("/"); }
function imageUrl(path) {
  if (!path) return "";
  if (/^https?:\/\//.test(path)) return path;
  const stripped = String(path).replace(/^\.\//, "").replace(/^\//, "");
  const candidates = [String(path).replace(/^\//, ""), `public/${stripped}`, `src/${stripped}`];
  const clean = candidates.find(candidate => state.files.some(file => file.path === candidate)) || (String(path).startsWith("/") ? `public/${stripped}` : stripped);
  if (state.demo && state.assetBase) return `${state.assetBase}${clean}`;
  return `https://raw.githubusercontent.com/${state.repo?.owner || "Takiyu0928"}/${state.repo?.repo || "Takiyu-blog"}/${state.repo?.branch || "main"}/${clean}`;
}

function getPath(object, path, fallback = "") {
  const value = String(path).split(".").reduce((current, key) => current?.[key], object);
  return value === undefined || value === null ? fallback : value;
}
function setPath(object, path, value) {
  const keys = String(path).split(".");
  let target = object;
  keys.slice(0, -1).forEach(key => { if (!target[key] || typeof target[key] !== "object") target[key] = {}; target = target[key]; });
  target[keys.at(-1)] = value;
}

function toast(message, error = false) {
  const demoMessage = state.demo && !error ? String(message)
    .replace(/已提交到 GitHub(?:，博客将自动重新部署。)?/g, "已保存在本地演示中")
    .replace(/已从 GitHub 刷新最新内容/g, "已刷新演示内容") : message;
  els.toast.textContent = error ? `操作未完成：${demoMessage}` : demoMessage;
  els.toast.className = `toast show${error ? " error" : ""}`;
  clearTimeout(toast.timer);
  toast.timer = setTimeout(() => { els.toast.className = "toast"; }, 3200);
}

function setBusy(value) {
  state.busy = value;
  document.body.classList.toggle("loading", value);
  els.editor.inert = value;
}

async function api(action, payload = {}) {
  const response = await fetch("/api/admin", {
    method: "POST", credentials: "same-origin", headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ action, ...payload }),
  });
  const data = await response.json().catch(() => ({}));
  if (!response.ok) {
    if (response.status === 401 && action !== "login" && action !== "session") showLogin();
    throw new Error(data.error || `请求失败（${response.status}）`);
  }
  return data;
}

function showLogin() { setNavigation(false); els.login.classList.remove("hidden"); els.app.classList.add("hidden"); }
function showApp() { els.login.classList.add("hidden"); els.app.classList.remove("hidden"); }

function section(title, subtitle, content, icon = "✦") {
  return `<section class="section-card"><div class="section-title"><span class="section-icon">${icon}</span><div><h3>${escapeHtml(title)}</h3><p>${escapeHtml(subtitle)}</p></div></div>${content}</section>`;
}

function inputField(label, path, value, type = "text", options = {}) {
  const full = options.full ? " full" : "";
  const source = options.source || path;
  const required = options.required ? " required" : "";
  const min = options.min === undefined ? "" : ` min="${options.min}"`;
  const max = options.max === undefined ? "" : ` max="${options.max}"`;
  if (type === "textarea") return `<label class="field${full}"><span>${escapeHtml(label)} <small>${escapeHtml(source)}</small></span><textarea data-path="${escapeHtml(path)}"${required}>${escapeHtml(value)}</textarea></label>`;
  if (type === "select") return `<label class="field${full}"><span>${escapeHtml(label)} <small>${escapeHtml(source)}</small></span><select data-path="${escapeHtml(path)}">${(options.choices || []).map(choice => `<option value="${escapeHtml(choice)}"${String(value) === String(choice) ? " selected" : ""}>${escapeHtml(choice)}</option>`).join("")}</select></label>`;
  if (type === "boolean") return `<label class="toggle${full}"><span>${escapeHtml(label)} <small>${escapeHtml(source)}</small></span><input data-path="${escapeHtml(path)}" type="checkbox"${value ? " checked" : ""}></label>`;
  if (type === "list") value = Array.isArray(value) ? value.join(", ") : value;
  return `<label class="field${full}"><span>${escapeHtml(label)} <small>${escapeHtml(source)}</small></span><input data-path="${escapeHtml(path)}" data-kind="${type}" type="${["date", "number", "url", "color"].includes(type) ? type : "text"}" value="${escapeHtml(value)}"${required}${min}${max}></label>`;
}

function editorHead(title, subtitle, { save = true, remove = false, extra = "" } = {}) {
  return `<div class="editor-head"><div><button type="button" class="text-button back-to-catalog" data-action="back-catalog">← 返回目录</button><h2>${escapeHtml(title)}</h2><small class="muted editor-path">${escapeHtml(subtitle || "")}</small><small data-edit-status aria-live="polite">更改后请保存</small></div><div class="editor-actions">${extra}${remove ? '<button type="button" class="danger" data-action="delete">删除</button>' : ""}${save ? `<button type="submit" class="primary">${state.demo ? "保存演示" : "保存并提交"} <span aria-hidden="true">→</span></button>` : ""}</div></div>`;
}

function showEditor(html) {
  state.dirty = false;
  els.editor.noValidate = false;
  els.empty.classList.add("hidden");
  els.editor.classList.remove("hidden");
  els.editor.innerHTML = html;
  els.workspace.classList.add("editor-open");
  $(".page-heading").classList.add("hidden");
  globalThis.scrollTo?.({ top: 0, left: 0, behavior: "instant" });
}
function hideEditor() {
  state.dirty = false;
  state.model = null;
  els.editor.classList.add("hidden");
  els.editor.innerHTML = "";
  els.empty.classList.remove("hidden");
  els.workspace.classList.remove("editor-open");
  $(".page-heading").classList.remove("hidden");
}

async function backToCatalog() {
  if (!await confirmLeave()) return;
  const selected = state.selected;
  state.selected = null;
  hideEditor();
  await renderSidebar();
  els.catalogBody.classList.remove("hidden");
  els.listToggle.setAttribute("aria-expanded", "true");
  els.listToggle.textContent = "收起目录";
  const previous = $$(".side-item", els.sideList).find(item => item.dataset.id === String(selected));
  (previous || els.search).focus();
}

function markDirty() {
  state.dirty = true;
  const status = $("[data-edit-status]", els.editor);
  if (status) status.textContent = "有未保存的更改";
}
async function confirmLeave() {
  if (!state.dirty) return true;
  const dialog = $("#leave-dialog");
  dialog.returnValue = "cancel";
  return new Promise(resolve => {
    dialog.addEventListener("close", () => resolve(dialog.returnValue === "discard"), { once: true });
    dialog.showModal();
  });
}

function setNavigation(open) {
  els.app.classList.toggle("nav-open", open);
  els.navBackdrop.hidden = !open;
  els.navToggle.setAttribute("aria-expanded", String(open));
  $(".main-shell").inert = open;
  if (open) els.navClose.focus();
}

function setTheme(theme) {
  document.documentElement.dataset.theme = theme;
  els.theme.textContent = theme === "dark" ? "☼" : "☾";
  els.theme.setAttribute("aria-label", theme === "dark" ? "切换到日间模式" : "切换到夜间模式");
  els.theme.title = theme === "dark" ? "切换到日间模式" : "切换到夜间模式";
}

function readForm(root, target) {
  $$('[data-path]', root).forEach(control => {
    let value = control.type === "checkbox" ? control.checked : control.value;
    const kind = control.dataset.kind;
    if (kind === "number") value = value === "" ? 0 : Number(value);
    if (kind === "list") value = value.split(",").map(item => item.trim()).filter(Boolean);
    setPath(target, control.dataset.path, value);
  });
  return target;
}

function parseFrontmatter(source) {
  const match = String(source).match(/^---\s*\r?\n([\s\S]*?)\r?\n---\s*\r?\n?/);
  if (!match) return { data: {}, body: source, raw: "" };
  const data = {};
  match[1].split(/\r?\n/).forEach(line => {
    const hit = line.match(/^([A-Za-z][\w-]*):\s*(.*)$/);
    if (!hit) return;
    let value = hit[2].trim();
    if (/^\[.*\]$/.test(value)) value = value.slice(1, -1).split(",").map(item => item.trim().replace(/^['"]|['"]$/g, "")).filter(Boolean);
    else if (/^(true|false)$/.test(value)) value = value === "true";
    else value = value.replace(/^['"]|['"]$/g, "");
    data[hit[1]] = value;
  });
  return { data, body: source.slice(match[0].length), raw: match[1] };
}

function yamlValue(value) {
  if (Array.isArray(value)) return `[${value.map(item => JSON.stringify(item)).join(", ")}]`;
  if (typeof value === "boolean" || typeof value === "number") return String(value);
  return JSON.stringify(value ?? "");
}
function stringifyPost(data, body) {
  const order = ["title", "published", "updated", "description", "image", "tags", "category", "pinned", "priority", "draft", "author", "licenseName", "sourceLink"];
  const keys = [...order.filter(key => data[key] !== undefined && data[key] !== ""), ...Object.keys(data).filter(key => !order.includes(key) && data[key] !== "")];
  return `---\n${keys.map(key => `${key}: ${yamlValue(data[key])}`).join("\n")}\n---\n\n${String(body || "").replace(/^\s+/, "")}`;
}

function postSourceFromForm() {
  const model = state.model;
  const data = readForm(els.editor, clone(model.data));
  const body = $("#post-body", els.editor)?.value || "";
  if (model.isAbout) return body;
  const original = model.original || "";
  const match = original.match(/^---[^\S\r\n]*\r?\n([\s\S]*?)\r?\n---[^\S\r\n]*(?:\r?\n|$)/);
  if (!match) return stringifyPost(data, body);
  const eol = original.includes("\r\n") ? "\r\n" : "\n";
  const lines = match[1].split(/\r?\n/);
  for (const [key, value] of Object.entries(data)) {
    if (JSON.stringify(value) === JSON.stringify(model.data[key])) continue;
    const index = lines.findIndex(line => line.startsWith(`${key}:`));
    if (index < 0) {
      if (value !== "") lines.push(`${key}: ${yamlValue(value)}`);
      continue;
    }
    let end = index + 1;
    while (end < lines.length && /^\s+\S/.test(lines[end])) end += 1;
    lines.splice(index, end - index, ...(key === "updated" && value === "" ? [] : [`${key}: ${yamlValue(value)}`]));
  }
  const originalBody = original.slice(match[0].length);
  const nextBody = body === model.body ? originalBody : `${eol}${body}`;
  return `---${eol}${lines.join(eol)}${eol}---${eol}${nextBody}`;
}

function applyPostSource() {
  const source = $("#post-source").value;
  const parsed = parseFrontmatter(source);
  state.model.data = parsed.data;
  state.model.body = parsed.body;
  state.model.original = source;
  state.model.sourceDirty = false;
  els.editor.noValidate = false;
  $$('[data-path]', els.editor).forEach(control => {
    const value = getPath(parsed.data, control.dataset.path);
    if (control.type === "checkbox") control.checked = Boolean(value);
    else control.value = Array.isArray(value) ? value.join(", ") : value ?? "";
  });
  $("#post-body").value = parsed.body;
  $("#post-preview").innerHTML = markdown(parsed.body);
}

function markdown(source) {
  const safe = escapeHtml(source || "");
  return safe
    .replace(/^### (.+)$/gm, "<h3>$1</h3>").replace(/^## (.+)$/gm, "<h2>$1</h2>").replace(/^# (.+)$/gm, "<h1>$1</h1>")
    .replace(/\*\*(.+?)\*\*/g, "<strong>$1</strong>").replace(/`([^`]+)`/g, "<code>$1</code>")
    .replace(/!\[([^\]]*)\]\(([^)]+)\)/g, '<img alt="$1" src="$2">')
    .replace(/\[([^\]]+)\]\((https?:\/\/[^)]+)\)/g, '<a href="$2" target="_blank" rel="noreferrer">$1</a>')
    .split(/\n{2,}/).map(block => /^<h\d|^<img|^<pre/.test(block) ? block : `<p>${block.replace(/\n/g, "<br>")}</p>`).join("");
}

function renderModuleNav() {
  els.moduleNav.innerHTML = modules.map(item => `<button type="button" data-module="${item.id}" class="${state.module === item.id ? "active" : ""}"${state.module === item.id ? ' aria-current="page"' : ""}>${item.label}</button>`).join("");
  const current = modules.find(item => item.id === state.module);
  els.pageTitle.textContent = current.title;
  els.pageEyebrow.textContent = current.eyebrow;
  els.pageDescription.textContent = current.description;
  els.currentSection.textContent = current.label;
  els.catalogTitle.textContent = current.catalog || "内容目录";
  els.dashboard.classList.toggle("hidden", state.module !== "home");
  els.workspace.classList.toggle("hidden", state.module === "home");
  els.app.dataset.module = state.module;
}

async function loadTree(force = false) {
  if (state.files.length && !force) return state.files;
  const result = await api("tree");
  state.files = result.files || [];
  state.repo = result.repo;
  state.demo = result.demo === true;
  state.assetBase = state.demo ? result.assetBase || "" : "";
  els.previewNotice.classList.toggle("hidden", !state.demo);
  els.connection.textContent = state.demo ? "本地演示 / 不连接 GitHub" : `已连接 GitHub / ${state.repo.branch}`;
  els.repoBadge.textContent = `${state.repo.owner}/${state.repo.repo} · ${state.repo.branch}`;
  return state.files;
}

async function refreshAll() {
  if (state.busy || !await confirmLeave()) return;
  setBusy(true);
  try {
    state.cache.clear();
    await loadTree(true);
    await renderSidebar();
    if (state.selected) await openSelected(state.selected, true);
    toast("已从 GitHub 刷新最新内容");
  } catch (error) { toast(error.message, true); }
  finally { setBusy(false); }
}

async function readFile(path, force = false) {
  const key = `file:${path}`;
  if (!force && state.cache.has(key)) return clone(state.cache.get(key));
  const data = await api("file.read", { path });
  state.cache.set(key, data);
  return clone(data);
}

async function readModel(path, variable, force = false) {
  const key = `model:${path}:${variable}`;
  if (!force && state.cache.has(key)) return clone(state.cache.get(key));
  const data = await api("model.read", { path, variable });
  state.cache.set(key, data);
  return clone(data);
}

async function saveModel(model, message) {
  const result = await api("model.write", { path: model.path, variable: model.variable, value: model.value, sha: model.sha, message });
  state.cache.delete(`model:${model.path}:${model.variable}`);
  state.cache.delete(`file:${model.path}`);
  await loadTree(true);
  return result;
}

function currentSearch(items) {
  const query = els.search.value.trim().toLowerCase();
  return query ? items.filter(item => JSON.stringify(item).toLowerCase().includes(query)) : items;
}

async function switchModule(module) {
  if (!modules.some(item => item.id === module) || !await confirmLeave()) return false;
  state.module = module;
  state.selected = null;
  els.search.value = "";
  renderModuleNav();
  hideEditor();
  els.catalogBody.classList.remove("hidden");
  els.listToggle.setAttribute("aria-expanded", "true");
  els.listToggle.textContent = "收起目录";
  setNavigation(false);
  await renderSidebar();
  globalThis.scrollTo?.({ top: 0, left: 0, behavior: "instant" });
  $("#main-content").focus?.({ preventScroll: true });
  return true;
}

async function renderSidebar() {
  if (state.module === "home") return renderDashboard();
  if (state.module === "posts") return renderPostSidebar();
  if (state.module === "albums") return renderAlbumSidebar();
  if (state.module === "diary") return renderDiarySidebar();
  return renderOtherSidebar();
}

function sideItem({ id, title, subtitle = "", count = "" }) {
  return `<button type="button" class="side-item${String(state.selected) === String(id) ? " active" : ""}" data-id="${escapeHtml(id)}">
    <span class="side-title">${escapeHtml(title)}<small class="side-subtitle">${escapeHtml(subtitle)}</small></span>
    <span class="side-count">${escapeHtml(count)}</span><span class="edit-arrow" aria-hidden="true">→</span>
  </button>`;
}

function postPaths() {
  return state.files.filter(file => /^src\/content\/posts\/.+\.mdx?$/.test(file.path)).map(file => file.path);
}

async function postEntries() {
  return Promise.all(postPaths().map(async path => {
    try {
      const { content } = await readFile(path);
      const { data } = parseFrontmatter(content);
      const tags = Array.isArray(data.tags) ? data.tags : [];
      return { path, title: data.title || fileName(path), date: data.updated || data.published || "", subtitle: `${data.published || "未设置日期"}${tags.length ? ` · ${tags.join(" / ")}` : ""}`, draft: data.draft === true };
    } catch { return { path, title: fileName(path), date: "", subtitle: "读取失败，请刷新后重试", unreadable: true }; }
  }));
}

async function renderDashboard() {
  els.newButton.classList.add("hidden");
  const entries = await postEntries();
  const unreadable = entries.some(item => item.unreadable);
  const recent = [...entries].sort((a, b) => b.date.localeCompare(a.date));
  const drafts = recent.filter(item => item.draft);
  const draft = drafts[0];
  els.dashboard.innerHTML = `<section class="overview-intro"><div class="overview-copy"><p class="eyebrow">${draft ? "DRAFT / CONTINUE WRITING" : "NEW / START WRITING"}</p><h2>${draft ? "继续写完这篇草稿。" : "新建一篇文章。"}</h2><p class="muted">${draft ? escapeHtml(draft.title) : "填写标题和正文，随时保存为草稿。"}</p>${draft ? `<p class="draft-date">最近编辑日期 · ${escapeHtml(draft.date || "未设置日期")}</p><button type="button" class="primary" data-open-post="${escapeHtml(draft.path)}">继续编辑 <span aria-hidden="true">→</span></button><button type="button" class="text-button" data-new-post>新建文章 ＋</button>` : '<button type="button" class="primary" data-new-post>新建文章 <span aria-hidden="true">→</span></button>'}</div><figure class="studio-print"><img src="/assets/ukiyo-stijl-v4.png" width="1024" height="1536" alt="米白纸面上以普鲁士蓝、朱红与赭黄套色的竖幅浮世绘海岸木版画" /></figure></section>
    <dl class="overview-strip"><div><dt>文章</dt><dd>${entries.length.toString().padStart(2, "0")}</dd></div><div><dt>草稿</dt><dd>${unreadable ? "—" : drafts.length.toString().padStart(2, "0")}</dd></div><div><dt>相册</dt><dd>${albumIds().length.toString().padStart(2, "0")}</dd></div></dl>
    <section class="dashboard-section"><div class="section-heading"><h2>最近文章</h2><button class="text-button" type="button" data-module="posts">全部文章 →</button></div><div class="list-columns" aria-hidden="true"><span>标题</span><span>类型 / 状态</span><span>更新日期</span><span></span></div>
    ${recent.length ? recent.slice(0, 5).map(item => `<button type="button" class="recent-post" data-open-post="${escapeHtml(item.path)}"><span>${escapeHtml(item.title)}</span><span class="post-status">文章 / ${item.unreadable ? "读取失败" : item.draft ? "草稿" : "已发布"}</span><time>${escapeHtml(item.date || "未设置日期")}</time><span class="edit-arrow" aria-hidden="true">→</span></button>`).join("") : '<p class="dashboard-empty">暂无文章。点击“新建文章”开始。</p>'}</section>
    <section class="dashboard-section quick-links"><span class="eyebrow">站点管理</span><button type="button" class="text-button" data-section="site">网站与资料 →</button><button type="button" class="text-button" data-section="banner">首页横幅 →</button><button type="button" class="text-button" data-section="announcement">公告 →</button><button type="button" class="text-button" data-section="music">音乐 →</button></section>`;
}

async function renderPostSidebar() {
  els.newButton.innerHTML = "＋ <span>新建文章</span>";
  els.newButton.classList.remove("hidden");
  els.sidebarNote.textContent = "标题 / 更新日期 · 状态";
  const entries = await postEntries();
  const about = state.files.some(file => file.path === "src/content/spec/about.md") ? [{ path: "src/content/spec/about.md", title: "关于页面", subtitle: "网站 /about 页面", about: true }] : [];
  const visible = currentSearch([...entries, ...about]);
  els.sideList.innerHTML = visible.length ? visible.sort((a, b) => (b.date || "").localeCompare(a.date || "")).map(item => sideItem({ id: item.path, title: item.title, subtitle: item.about ? "独立页面" : item.date || "未设置日期", count: item.about ? "关于" : item.unreadable ? "读取失败" : item.draft ? "草稿" : "已发布" })).join("") : '<p class="dashboard-empty">没有找到文章。试试其他关键词。</p>';
}

function postEditorMarkup(model) {
  const { data, body, isAbout, isNew } = model;
  return `${editorHead(isAbout ? "编辑关于页面" : isNew ? "新建文章" : "编辑文章", isNew ? "新文章默认保存为草稿。" : model.path, { remove: !isAbout && !isNew })}
    <div class="editor-views" role="group" aria-label="文章编辑视图">${[["write", "写作"], ["preview", "预览"], ...(!isAbout ? [["settings", "发布设置"]] : [])].map(([id, label]) => `<button type="button" class="text-button${id === "write" ? " active" : ""}" data-post-view="${id}" aria-pressed="${id === "write"}" aria-controls="post-pane-${id}">${label}</button>`).join("")}</div>
    <section id="post-pane-write" data-post-pane="write" class="writing-pane">
      ${!isAbout ? inputField("文章标题", "title", data.title || "", "text", { required: true }) : ""}
      <label class="field"><span>正文 <small>Markdown</small></span><textarea id="post-body" class="code" placeholder="从这里开始写正文…">${escapeHtml(body)}</textarea></label>
      <details class="advanced"><summary>高级功能：完整 Markdown 源码</summary><div><textarea id="post-source" class="code" aria-label="完整 Markdown 源码">${escapeHtml(model.original || "")}</textarea><p class="source-note">可直接保存完整源码；载入表单后可继续图形化编辑。未知元数据与注释会保留。</p><button type="button" class="secondary" data-action="apply-source">将源码载入图形化编辑器</button></div></details>
    </section>
    <section id="post-pane-preview" data-post-pane="preview" hidden><p class="preview-label">阅读预览 · 简化 Markdown 排版，不等同于博客最终效果</p><div id="post-preview" class="markdown-preview">${markdown(body)}</div></section>
    ${!isAbout ? `<section id="post-pane-settings" data-post-pane="settings" hidden>${section("发布信息", "保存为草稿时，文章不会在博客文章列表显示。", `<div class="field-grid">${inputField("发布日期", "published", data.published, "date", { required: true })}${inputField("更新日期（可选）", "updated", data.updated || "", "date")}${inputField("文章分类", "category", data.category || "")}${inputField("文章标签", "tags", data.tags || [], "list")}${inputField("文章摘要", "description", data.description || "", "textarea")}${inputField("封面图片路径", "image", data.image || "")}${inputField("保存为草稿", "draft", Boolean(data.draft), "boolean")}${inputField("置顶文章", "pinned", Boolean(data.pinned), "boolean")}${inputField("置顶优先级", "priority", data.priority || 0, "number", { min: 0 })}${inputField("作者", "author", data.author || "")}</div>`)}</section>` : ""}`;
}

function bindPostSource() {
  $("details.advanced", els.editor).addEventListener("toggle", event => {
    if (event.target.open && !state.model.sourceDirty) $("#post-source").value = postSourceFromForm();
  });
}

function setPostView(view) {
  if (!["write", "preview", "settings"].includes(view)) return;
  $$('[data-post-pane]', els.editor).forEach(pane => { pane.hidden = pane.dataset.postPane !== view; });
  $$('[data-post-view]', els.editor).forEach(button => {
    const active = button.dataset.postView === view;
    button.classList.toggle("active", active);
    button.setAttribute("aria-pressed", String(active));
  });
  if (view === "preview") {
    const source = state.model.sourceDirty ? $("#post-source").value : postSourceFromForm();
    $("#post-preview").innerHTML = markdown(state.model.isAbout ? source : parseFrontmatter(source).body);
  }
}

async function openPost(path, force = false) {
  setBusy(true);
  try {
    const isAbout = path === "src/content/spec/about.md";
    const file = await readFile(path, force);
    const parsed = parseFrontmatter(file.content);
    state.model = { kind: "post", path, sha: file.sha, data: parsed.data, body: parsed.body, original: file.content, isAbout, sourceDirty: false };
    showEditor(postEditorMarkup(state.model));
    bindPostSource();
  } catch (error) { toast(error.message, true); }
  finally { setBusy(false); }
}

function newPost() {
  const today = new Date().toISOString().slice(0, 10);
  state.selected = `src/content/posts/new-${Date.now()}.md`;
  state.model = { kind: "post", path: state.selected, sha: null, data: { title: "", published: today, description: "", image: "", tags: [], category: "", draft: true }, body: "", original: "", isAbout: false, isNew: true };
  showEditor(postEditorMarkup(state.model));
  bindPostSource();
}

async function savePost() {
  const model = state.model;
  const content = model.sourceDirty ? $("#post-source").value : postSourceFromForm();
  const data = model.isAbout ? {} : parseFrontmatter(content).data;
  if (!model.isAbout && !data.title?.trim()) throw new Error("请填写文章标题，并保留源码顶部的 Frontmatter。");
  if (!model.isAbout) {
    for (const key of ["published", "updated"]) {
      const value = data[key];
      if (key === "updated" && !value) continue;
      const date = new Date(`${value}T00:00:00Z`);
      if (!/^\d{4}-\d{2}-\d{2}$/.test(value || "") || Number.isNaN(date.getTime()) || date.toISOString().slice(0, 10) !== value) {
        throw new Error(`${key === "published" ? "发布日期" : "更新日期"}请使用有效的 YYYY-MM-DD 日期。`);
      }
    }
  }
  let path = model.path;
  if (model.isNew) path = `src/content/posts/${slugify(data.title)}.md`;
  await api("file.write", { path, content, sha: model.sha, message: `${model.isNew ? "新增" : "更新"}文章：${data.title || "关于页面"}` });
  state.cache.clear();
  await loadTree(true);
  state.selected = path;
  await renderPostSidebar();
  await openPost(path, true);
  toast("文章已提交到 GitHub，博客将自动重新部署。");
}

async function deletePost() {
  const model = state.model;
  if (!confirm(`确定删除“${model.data.title || fileName(model.path)}”吗？${state.demo ? "仅删除本地演示数据，重启预览服务后重置。" : "此操作会创建 GitHub 删除提交。"}`)) return;
  await api("file.delete", { path: model.path, sha: model.sha, message: `删除文章：${model.data.title || model.path}` });
  state.cache.clear();
  await loadTree(true);
  state.selected = null;
  hideEditor();
  await renderPostSidebar();
  toast("文章已删除。");
}

function albumIds() {
  return [...new Set(state.files.map(file => file.path.match(/^public\/images\/albums\/([^/]+)\/info\.json$/)?.[1]).filter(Boolean))];
}

function albumImages(id) {
  return state.files.filter(file => file.path.startsWith(`public/images/albums/${id}/`) && !file.path.endsWith("/info.json") && /\.(avif|webp|png|jpe?g|gif)$/i.test(file.path));
}

async function renderAlbumSidebar() {
  els.newButton.innerHTML = "＋ <span>新相册</span>";
  els.newButton.classList.remove("hidden");
  els.sidebarNote.textContent = "按主题收集照片。支持从电脑批量上传，为每段回忆留一个位置。";
  const entries = await Promise.all(albumIds().map(async id => {
    try {
      const file = await readFile(`public/images/albums/${id}/info.json`);
      const info = JSON.parse(file.content);
      const images = albumImages(id);
      return { id, title: info.title || id, subtitle: `${info.date || "未设置日期"} · ${(info.tags || []).join(" / ")}`, count: `${images.length} 张`, image: images[0] ? imageUrl(images[0].path) : "" };
    } catch { return { id, title: id, subtitle: "相册信息读取失败", count: "" }; }
  }));
  const visible = currentSearch(entries);
  els.sideList.innerHTML = visible.length ? visible.map(item => sideItem(item)).join("") : '<p class="muted">暂无相册。点击“新相册”开始创建。</p>';
}

function albumForm(info) {
  return `<div class="field-grid">
    ${inputField("相册标题", "title", info.title, "text", { required: true })}
    ${inputField("相册日期", "date", info.date, "date", { required: true })}
    ${inputField("拍摄地点", "location", info.location)}
    ${inputField("相册标签", "tags", info.tags || [], "list")}
    ${inputField("相册描述", "description", info.description, "textarea", { full: true })}
    ${inputField("隐藏相册", "hidden", Boolean(info.hidden), "boolean")}
    ${inputField("相册密码（可留空）", "password", info.password || "", "text")}
    ${inputField("图片布局", "layout", info.layout || "grid", "select", { choices: ["grid", "masonry"] })}
    ${inputField("每行列数", "columns", info.columns || 3, "number", { min: 1, max: 6 })}
  </div>`;
}

function albumImageGrid(id) {
  const images = albumImages(id);
  if (!images.length) return '<p class="muted">尚未上传图片。</p>';
  return `<div class="image-grid">${images.map(file => `<figure class="image-card"><img src="${escapeHtml(imageUrl(file.path))}" alt="${escapeHtml(fileName(file.path))}" loading="lazy"><figcaption class="image-path">${escapeHtml(file.path)}</figcaption><button type="button" class="remove-row" aria-label="删除这张图片" data-action="delete-image" data-path="${escapeHtml(file.path)}" data-sha="${escapeHtml(file.sha)}">⌫</button></figure>`).join("")}</div>`;
}

async function openAlbum(id, force = false) {
  setBusy(true);
  try {
    const path = `public/images/albums/${id}/info.json`;
    const file = await readFile(path, force);
    const info = JSON.parse(file.content);
    state.model = { kind: "album", id, path, sha: file.sha, value: info, original: file.content };
    showEditor(`${editorHead(info.title || id, path, { remove: true })}
      ${section("相册信息", "相册 ID 是目录名称，已创建的相册不建议随意修改 ID。", `<label class="field"><span>相册 ID <small>public/images/albums/&lt;id&gt;</small></span><input value="${escapeHtml(id)}" disabled></label>${albumForm(info)}`, "▧")}
      ${section("相册图片", "从电脑选择图片后会直接上传到当前相册目录。单张图片建议小于 4 MB。", `<div class="image-manager"><div class="image-group-head"><strong>${albumImages(id).length} 张图片</strong><button type="button" class="upload-button" data-action="upload-album">⇧ 上传图片</button></div>${albumImageGrid(id)}</div>`, "图")}
      <details class="advanced"><summary>高级功能：相册 info.json</summary><div><textarea id="album-source" class="code">${escapeHtml(file.content)}</textarea><p class="muted">一般不需要修改这里。错误的 JSON 会导致相册页面构建失败。</p></div></details>`);
  } catch (error) { toast(error.message, true); }
  finally { setBusy(false); }
}

function newAlbum() {
  const today = new Date().toLocaleDateString("en-CA");
  state.selected = `new-album-${Date.now()}`;
  state.model = { kind: "album", id: "", path: "", sha: null, value: { title: "", date: today, description: "", location: "", tags: [], hidden: false, layout: "grid", columns: 3 }, isNew: true };
  showEditor(`${editorHead("新建相册", "先填写相册 ID 和基本信息，保存后再上传图片。")}
    ${section("相册信息", "相册 ID 只使用英文、数字和短横线，例如：summer-trip。", `<div class="field-grid">${inputField("相册 ID", "$albumId", "", "text", { required: true, source: "目录名称" })}${albumForm(state.model.value)}</div>`, "▧")}`);
}

async function saveAlbum() {
  const model = state.model;
  readForm(els.editor, model.value);
  const requestedId = $('[data-path="$albumId"]', els.editor)?.value;
  const id = model.isNew ? slugify(requestedId) : model.id;
  if (!model.value.title?.trim()) throw new Error("请填写相册标题。");
  if (model.isNew && !requestedId?.trim()) throw new Error("请填写相册 ID。");
  delete model.value.$albumId;
  const path = `public/images/albums/${id}/info.json`;
  await api("file.write", { path, content: `${JSON.stringify(model.value, null, 2)}\n`, sha: model.sha, message: `${model.isNew ? "新增" : "更新"}相册：${model.value.title}` });
  state.cache.clear();
  await loadTree(true);
  state.selected = id;
  await renderAlbumSidebar();
  await openAlbum(id, true);
  toast("相册信息已提交到 GitHub。");
}

async function deleteAlbum() {
  const model = state.model;
  const files = state.files.filter(file => file.path.startsWith(`public/images/albums/${model.id}/`));
  if (!confirm(`确定删除相册“${model.value.title || model.id}”及其中 ${Math.max(0, files.length - 1)} 张图片吗？`)) return;
  setBusy(true);
  try {
    for (const file of files) await api("file.delete", { path: file.path, sha: file.sha, message: `删除相册文件：${file.path}` });
    state.cache.clear(); await loadTree(true); state.selected = null; hideEditor(); await renderAlbumSidebar(); toast("相册及图片已删除。");
  } finally { setBusy(false); }
}

function chooseFiles({ accept = "image/*", multiple = false, onFiles }) {
  state.pendingUpload = onFiles;
  els.picker.accept = accept;
  els.picker.multiple = multiple;
  els.picker.value = "";
  els.picker.click();
}

function fileBase64(file) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result).split(",")[1]);
    reader.onerror = () => reject(new Error(`无法读取文件 ${file.name}`));
    reader.readAsDataURL(file);
  });
}

async function uploadFiles(files, makePath, message) {
  for (const file of files) {
    if (file.size > 4 * 1024 * 1024) throw new Error(`${file.name} 超过 4 MB，请压缩后上传。`);
    const path = makePath(file);
    const existing = state.files.find(item => item.path === path);
    await api("file.upload", { path, base64: await fileBase64(file), sha: existing?.sha, message: `${message}：${file.name}` });
  }
  state.cache.clear();
  await loadTree(true);
}

async function deleteSingleImage(button) {
  if (!confirm(`确定删除图片 ${fileName(button.dataset.path)} 吗？`)) return;
  await api("file.delete", { path: button.dataset.path, sha: button.dataset.sha, message: `删除图片：${button.dataset.path}` });
  state.cache.clear(); await loadTree(true);
  if (state.model.kind === "album") await openAlbum(state.model.id, true);
  else await openOther(state.otherSection, true);
  await renderSidebar();
  toast("图片已删除。");
}

async function getDiaryModel(force = false) { return readModel("src/data/diary.ts", "diaryData", force); }

async function renderDiarySidebar() {
  els.newButton.innerHTML = "＋ <span>新日记</span>";
  els.newButton.classList.remove("hidden");
  els.sidebarNote.textContent = "日记直接写入 src/data/diary.ts，可添加文字、心情、地点、标签和图片路径。";
  try {
    const model = await getDiaryModel();
    const entries = (model.value || []).map((item, index) => ({ ...item, _index: index }));
    const visible = currentSearch(entries);
    els.sideList.innerHTML = visible.length ? visible.map(item => sideItem({ id: item._index, icon: item.mood || "记", title: String(item.content || "无内容").slice(0, 28), subtitle: `${item.date || "未设置日期"}${item.location ? ` · ${item.location}` : ""}`, count: item.tags?.length || "" })).join("") : '<p class="muted">暂无日记。</p>';
  } catch (error) { els.sideList.innerHTML = `<p class="muted">${escapeHtml(error.message)}</p>`; }
}

function diaryFields(item) {
  return `<div class="field-grid">
    ${inputField("发布日期和时间", "date", item.date || new Date().toISOString(), "text", { required: true })}
    ${inputField("心情", "mood", item.mood || "")}
    ${inputField("地点", "location", item.location || "")}
    ${inputField("标签", "tags", item.tags || [], "list")}
    ${inputField("日记内容", "content", item.content || "", "textarea", { full: true, required: true })}
    ${inputField("图片路径", "images", item.images || [], "list", { full: true, source: "多张图片用逗号分隔" })}
  </div>`;
}

async function openDiary(index, force = false) {
  setBusy(true);
  try {
    const model = await getDiaryModel(force);
    const item = clone(model.value[Number(index)]);
    if (!item) throw new Error("找不到这条日记，请刷新后重试。");
    state.model = { kind: "diary", ...model, index: Number(index), item };
    showEditor(`${editorHead("编辑日记", `日记 ID：${item.id}`, { remove: true })}${section("日记内容", "修改后会写回日记数据文件。", diaryFields(item), "记")}<details class="advanced"><summary>高级功能：当前日记 JSON</summary><div><textarea id="diary-source" class="code">${escapeHtml(JSON.stringify(item, null, 2))}</textarea></div></details>`);
  } catch (error) { toast(error.message, true); }
  finally { setBusy(false); }
}

async function newDiary() {
  const model = await getDiaryModel();
  const ids = (model.value || []).map(item => Number(item.id) || 0);
  const item = { id: Math.max(0, ...ids) + 1, content: "", date: new Date().toISOString(), images: [], location: "", mood: "", tags: [] };
  state.model = { kind: "diary", ...model, index: -1, item, isNew: true };
  state.selected = "new";
  showEditor(`${editorHead("新建日记", `自动分配 ID：${item.id}`)}${section("日记内容", "填写文字后保存即可发布。", diaryFields(item), "记")}`);
}

async function saveDiary() {
  const model = state.model;
  readForm(els.editor, model.item);
  if (!model.item.content?.trim()) throw new Error("请填写日记内容。");
  const values = clone(model.value || []);
  if (model.isNew) values.unshift(model.item); else values[model.index] = model.item;
  model.value = values;
  await saveModel(model, `${model.isNew ? "新增" : "更新"}日记：${model.item.id}`);
  state.selected = model.isNew ? 0 : model.index;
  await renderDiarySidebar();
  await openDiary(state.selected, true);
  toast("日记已提交到 GitHub。");
}

async function deleteDiary() {
  const model = state.model;
  if (!confirm(`确定删除日记 ${model.item.id} 吗？`)) return;
  model.value.splice(model.index, 1);
  await saveModel(model, `删除日记：${model.item.id}`);
  state.selected = null; hideEditor(); await renderDiarySidebar(); toast("日记已删除。");
}

async function renderOtherSidebar() {
  els.newButton.innerHTML = "＋ <span>新增条目</span>";
  els.newButton.classList.toggle("hidden", ["site", "announcement", "music", "banner", "sidebar"].includes(state.otherSection));
  const entries = await Promise.all(otherSections.map(async item => {
    let count = item.count;
    if (item.count === "array" || item.count === "object") {
      try {
        const model = await readModel(item.path, item.variable);
        count = Array.isArray(model.value) ? model.value.length : Object.keys(model.value || {}).length;
      } catch { count = "!"; }
    }
    return { id: item.id, icon: item.icon, title: item.label, subtitle: item.note || "图形化编辑博客对应页面", count };
  }));
  const visible = currentSearch(entries);
  els.sidebarNote.textContent = "选择分类后编辑；各分类的高级源码功能保持可用。";
  els.sideList.innerHTML = visible.map(item => sideItem(item)).join("");
}

async function openOther(id, force = false) {
  state.otherSection = id;
  state.selected = id;
  await renderOtherSidebar();
  if (id === "site") return openSite(force);
  if (id === "announcement") return openAnnouncement(force);
  if (id === "music") return openMusic(force);
  if (id === "banner") return openBanner(force);
  if (id === "navbar") return openNavbar(force);
  if (id === "sidebar") return openSidebar(force);
  if (id === "devices") return openDevices(force);
  return openArraySection(id, force);
}

function socialLinksEditor(links = []) {
  return `<div id="social-links" class="array-list">${links.map((item, index) => `<div class="array-row" data-index="${index}"><div class="array-fields"><label>显示名称<input data-key="name" value="${escapeHtml(item.name || "")}"></label><label>链接地址<input data-key="url" value="${escapeHtml(item.url || "")}"></label><label class="wide">图标名称<input data-key="icon" value="${escapeHtml(item.icon || "")}" placeholder="例如 fa7-brands:github"></label></div><button type="button" class="remove-row" aria-label="移除此条目" data-action="remove-row">⌫</button></div>`).join("")}</div><button type="button" class="add-row" data-action="add-social">＋ 添加社交链接</button>`;
}

async function openSite(force = false) {
  setBusy(true);
  try {
    const [site, profile] = await Promise.all([readModel("src/config/siteConfig.ts", "siteConfig", force), readModel("src/config/profileConfig.ts", "profileConfig", force)]);
    state.model = { kind: "site", site, profile };
    const s = site.value, p = profile.value;
    const avatar = p.avatar ? imageUrl(p.avatar.startsWith("/") ? `public${p.avatar}` : `public/${p.avatar}`) : "";
    showEditor(`${editorHead("网站信息设置", "站点基本信息与站长资料")}
      ${section("站点资料", "控制浏览器标题、网站地址、语言、导航标题和外部账号。", `<div class="field-grid">
        ${inputField("网站标题", "site.title", s.title, "text", { required: true, source: "siteConfig.title" })}
        ${inputField("网站副标题", "site.subtitle", s.subtitle, "text", { source: "siteConfig.subtitle" })}
        ${inputField("网站地址", "site.siteURL", s.siteURL, "url", { required: true, source: "siteConfig.siteURL" })}
        ${inputField("建站日期", "site.siteStartDate", s.siteStartDate, "date", { source: "siteConfig.siteStartDate" })}
        ${inputField("网站语言", "site.lang", typeof s.lang === "string" ? s.lang : "zh_CN", "select", { choices: ["zh_CN", "en", "ja"] })}
        ${inputField("主题色 Hue", "site.themeColor.hue", getPath(s, "themeColor.hue", 240), "number", { min: 0, max: 360 })}
        ${inputField("固定主题色", "site.themeColor.fixed", getPath(s, "themeColor.fixed", false), "boolean")}
        ${inputField("顶栏名称", "site.navbarTitle.text", getPath(s, "navbarTitle.text"), "text", { source: "navbarTitle.text" })}
        ${inputField("顶栏图标", "site.navbarTitle.icon", getPath(s, "navbarTitle.icon"), "text", { source: "navbarTitle.icon" })}
        ${inputField("Bilibili UID", "site.bilibili.vmid", getPath(s, "bilibili.vmid"), "text", { source: "bilibili.vmid" })}
        ${inputField("Bangumi 用户 ID", "site.bangumi.userId", getPath(s, "bangumi.userId"), "text", { source: "bangumi.userId" })}
      </div>`, "站")}
      ${section("站长资料", "头像可直接从电脑上传；名称、简介与打字机效果会显示在侧栏个人卡片。", `<div class="preview-card"><div><img id="avatar-preview" src="${escapeHtml(avatar)}" alt="站长头像"><div class="editor-actions" style="margin-top:12px"><button type="button" class="upload-button" data-action="upload-avatar">⇧ 上传头像</button></div></div><div class="field-grid">
        ${inputField("头像路径", "profile.avatar", p.avatar, "text", { full: true, source: "profileConfig.avatar" })}
        ${inputField("站长名称", "profile.name", p.name, "text", { required: true, source: "profileConfig.name" })}
        ${inputField("启用介绍打字机", "profile.typewriter.enable", getPath(p, "typewriter.enable", true), "boolean")}
        ${inputField("打字速度", "profile.typewriter.speed", getPath(p, "typewriter.speed", 80), "number", { min: 10 })}
        ${inputField("站长介绍", "profile.bio", p.bio, "textarea", { full: true, source: "profileConfig.bio" })}
      </div></div>`, "人")}
      ${section("社交链接", "不需要某个平台时直接删除对应条目；添加链接只需填写名称、网址和图标。", socialLinksEditor(p.links || []), "链")}
      ${section("特色页面开关", "关闭后页面会被禁用；对应顶栏链接也会自动隐藏。", `<div class="field-grid">${Object.entries(s.featurePages || {}).map(([key, value]) => inputField({ anime: "番剧", diary: "日记", friends: "友链", projects: "项目", skills: "技能", timeline: "时间线", albums: "相册", devices: "设备", aiTools: "AI 工具" }[key] || key, `site.featurePages.${key}`, value, "boolean", { source: `featurePages.${key}` })).join("")}</div>`, "开")}`);
  } catch (error) { toast(error.message, true); }
  finally { setBusy(false); }
}

function readSocialLinks() {
  return $$("#social-links .array-row").map(row => Object.fromEntries($$("[data-key]", row).map(input => [input.dataset.key, input.value.trim()]))).filter(item => item.name || item.url);
}

async function saveSite() {
  const model = state.model;
  const composite = { site: model.site.value, profile: model.profile.value };
  readForm(els.editor, composite);
  model.site.value = composite.site;
  model.profile.value = composite.profile;
  model.profile.value.links = readSocialLinks();
  if (!String(model.site.value.siteURL || "").endsWith("/")) model.site.value.siteURL += "/";
  await saveModel(model.site, "更新网站基本信息");
  await saveModel(model.profile, "更新站长资料与社交链接");
  await openSite(true); toast("网站信息已保存并提交。");
}

async function openAnnouncement(force = false) {
  setBusy(true);
  try {
    const model = await readModel("src/config/announcementConfig.ts", "announcementConfig", force);
    state.model = { kind: "announcement", ...model };

    const announcement = model.value || {};
    const link = announcement.link || {};
    showEditor(`${editorHead("首页公告设置", "编辑访客初次打开博客时看到的 Announcement 公告")}
      ${section("公告内容", "标题留空时，会使用博客当前语言中的默认“公告”标题。", `<div class="field-grid">
        ${inputField("公告标题", "title", announcement.title || "", "text", { source: "announcementConfig.title" })}
        ${inputField("公告类型", "type", announcement.type || "info", "select", { choices: ["info", "success", "warning", "error"], source: "announcementConfig.type" })}
        ${inputField("公告图标", "icon", announcement.icon || "", "text", { source: "announcementConfig.icon" })}
        ${inputField("允许访客关闭", "closable", announcement.closable !== false, "boolean", { source: "announcementConfig.closable" })}
        ${inputField("公告正文", "content", announcement.content || "", "textarea", { full: true, required: true, source: "announcementConfig.content" })}
      </div>`, "告")}
      ${section("公告链接", "可以在公告末尾显示一个跳转按钮；博客内部页面可填写 /about/ 这类路径。", `<div class="field-grid">
        ${inputField("显示跳转链接", "link.enable", Boolean(link.enable), "boolean", { source: "announcementConfig.link.enable" })}
        ${inputField("链接文字", "link.text", link.text || "", "text", { source: "announcementConfig.link.text" })}
        ${inputField("链接地址", "link.url", link.url || "", "text", { full: true, source: "announcementConfig.link.url" })}
        ${inputField("在新窗口打开", "link.external", Boolean(link.external), "boolean", { source: "announcementConfig.link.external" })}
      </div>`, "链")}
      ${section("显示位置", "公告是否显示、显示在左侧栏、右侧栏或手机抽屉，由“其他管理 → 侧栏布局”中的“公告”开关控制。", `<p class="muted">这里负责公告内容；如需隐藏公告，请进入“侧栏布局”，关闭公告对应的显示位置。</p>`, "栏")}`);
  } catch (error) { toast(error.message, true); }
  finally { setBusy(false); }
}

async function saveAnnouncement() {
  const model = state.model;
  if (!model.value || typeof model.value !== "object") model.value = {};
  if (!model.value.link || typeof model.value.link !== "object") {
    model.value.link = { enable: false, text: "", url: "", external: false };
  }

  readForm(els.editor, model.value);

  if (!String(model.value.content || "").trim()) {
    throw new Error("请填写公告正文。");
  }
  if (model.value.link.enable && (!String(model.value.link.text || "").trim() || !String(model.value.link.url || "").trim())) {
    throw new Error("启用公告链接后，请同时填写链接文字和链接地址。");
  }

  await saveModel(model, "更新首页公告内容");
  await openAnnouncement(true);
  toast("首页公告已保存并提交。");
}

async function openMusic(force = false) {
  setBusy(true);
  try {
    const [config, playlist] = await Promise.all([readModel("src/config/musicConfig.ts", "musicPlayerConfig", force), readModel("src/components/widgets/music-player/constants.ts", "LOCAL_PLAYLIST", force)]);
    state.model = { kind: "music", config, playlist };
    const m = config.value;
    showEditor(`${editorHead("网站音乐设置", "播放器开关、在线歌单和本地歌曲")}
      ${section("播放器设置", "选择网易云歌单模式或仓库内的本地歌曲模式。", `<div class="field-grid">
        ${inputField("启用音乐播放器", "config.enable", m.enable, "boolean")}${inputField("显示悬浮播放器", "config.showFloatingPlayer", m.showFloatingPlayer, "boolean")}
        ${inputField("播放器模式", "config.mode", m.mode, "select", { choices: ["local", "meting"] })}${inputField("悬浮入口模式", "config.floatingEntryMode", m.floatingEntryMode, "select", { choices: ["default", "fab"] })}
        ${inputField("网易云歌单 ID", "config.id", m.id, "text", { source: "musicPlayerConfig.id" })}${inputField("音乐平台", "config.server", m.server, "select", { choices: ["netease", "tencent", "kugou"] })}
        ${inputField("歌单类型", "config.type", m.type, "select", { choices: ["playlist", "album", "artist", "song"] })}${inputField("Meting API", "config.meting_api", m.meting_api, "url", { full: true })}
      </div>`, "♫")}
      ${section("本地歌曲", "歌曲文件与封面仍需放入博客仓库；这里负责图形化管理歌名、歌手、引用和时长。", `${arrayEditor("playlist", playlist.value || [], arraySchemas.playlist)}<p class="muted">如果 cover 或 url 使用 import 变量，请保留变量名，例如 sousakuCover。高级源码仍可用于新增 import。</p>`, "曲")}
      <details class="advanced"><summary>高级说明：本地歌曲 import</summary><div><p>本地歌曲配置顶部的 import 语句不属于歌单数组。若新增了新的音频文件或封面变量，仍需在 constants.ts 顶部添加一次 import；已有歌曲的名称、歌手、时长和顺序可直接在这里修改。</p></div></details>`);
  } catch (error) { toast(error.message, true); }
  finally { setBusy(false); }
}

async function saveMusic() {
  const model = state.model;
  const composite = { config: model.config.value };
  readForm(els.editor, composite);
  model.config.value = composite.config;
  model.playlist.value = readArrayEditor("playlist", arraySchemas.playlist, model.playlist.value);
  model.playlist.value.forEach((item, index) => { item.id = Number(item.id) || index + 1; });
  await saveModel(model.config, "更新音乐播放器设置");
  await saveModel(model.playlist, "更新本地歌曲列表");
  await openMusic(true); toast("音乐配置已保存。");
}

function arrayEditor(id, items, schema) {
  return `<div id="array-${id}" class="array-list">${(items || []).map((item, index) => arrayRow(id, item, index, schema)).join("")}</div><button type="button" class="add-row" data-action="add-array" data-array="${id}">＋ 添加条目</button>`;
}

function rawText(value) { return value && typeof value === "object" && typeof value.__raw === "string" ? value.__raw : value ?? ""; }
function arrayRow(id, item, index, schema) {
  if (item?.__raw) return `<div class="array-row" data-index="${index}" data-raw="${escapeHtml(item.__raw)}"><div><strong>预设条目</strong><p class="muted">${escapeHtml(item.__raw)}（保留源码引用）</p></div><button type="button" class="remove-row" aria-label="移除此条目" data-action="remove-row">⌫</button></div>`;
  const fields = schema.map(([key, label, type, choices]) => {
    const value = rawText(item?.[key]);
    if (type === "boolean") return `<label class="toggle"><span>${escapeHtml(label)}</span><input data-key="${key}" data-kind="boolean" type="checkbox"${value ? " checked" : ""}></label>`;
    if (type === "textarea") return `<label class="wide">${escapeHtml(label)}<textarea data-key="${key}">${escapeHtml(value)}</textarea></label>`;
    if (type === "select") return `<label>${escapeHtml(label)}<select data-key="${key}">${choices.map(choice => `<option${String(value) === choice ? " selected" : ""}>${choice}</option>`).join("")}</select></label>`;
    const display = type === "list" && Array.isArray(value) ? value.join(", ") : value;
    return `<label>${escapeHtml(label)}<input data-key="${key}" data-kind="${type}" type="${["number", "date", "url", "color"].includes(type) ? type : "text"}" value="${escapeHtml(display)}"></label>`;
  }).join("");
  return `<div class="array-row" data-index="${index}"><div class="array-fields">${fields}</div><button type="button" class="remove-row" aria-label="移除此条目" data-action="remove-row">⌫</button></div>`;
}

function readArrayEditor(id, schema, previous = []) {
  return $$(`#array-${id} .array-row`).map(row => {
    if (row.dataset.raw) return { __raw: row.dataset.raw };
    const old = clone(previous[Number(row.dataset.index)] || {});
    schema.forEach(([key, , type]) => {
      const control = $(`[data-key="${key}"]`, row);
      if (!control) return;
      let value = type === "boolean" ? control.checked : control.value;
      if (type === "number") value = Number(value) || 0;
      if (type === "list") value = value.split(",").map(item => item.trim()).filter(Boolean);
      if (old[key]?.__raw && typeof value === "string" && /^[A-Za-z_$][\w$]*$/.test(value)) value = { __raw: value };
      old[key] = value;
    });
    return old;
  });
}

function bannerGrid(paths, mode) {
  if (!paths?.length) return '<p class="muted">尚未添加图片。</p>';
  return `<div class="image-grid">${paths.map((path, index) => `<figure class="image-card${mode === "mobile" ? " mobile" : ""}"><img src="${escapeHtml(imageUrl(path))}" alt="${escapeHtml(mode)} banner" loading="lazy"><figcaption class="image-path">${escapeHtml(path)}</figcaption><button type="button" class="remove-row" aria-label="移除此横幅" data-action="remove-banner" data-mode="${mode}" data-index="${index}">⌫</button></figure>`).join("")}</div>`;
}

async function openBanner(force = false) {
  setBusy(true);
  try {
    const site = await readModel("src/config/siteConfig.ts", "siteConfig", force);
    state.model = { kind: "banner", site };
    const s = site.value, banner = s.banner || {};
    const desktop = Array.isArray(banner.src?.desktop) ? banner.src.desktop : [banner.src?.desktop].filter(Boolean);
    const mobile = Array.isArray(banner.src?.mobile) ? banner.src.mobile : [banner.src?.mobile].filter(Boolean);
    showEditor(`${editorHead("首页图设置", "桌面端与移动端横幅图片")}
      ${section("首页横幅图片", "Desktop 是电脑横幅，Mobile 是手机竖屏横幅。可直接从电脑上传或删除。", `<div class="image-manager">
        <div class="image-group-head"><div><strong>桌面端横幅（Desktop）</strong><p class="muted">推荐宽图，例如 1920×1080。</p></div><button type="button" class="upload-button" data-action="upload-banner" data-mode="desktop">⇧ 上传</button></div>${bannerGrid(desktop, "desktop")}
        <div class="image-group-head"><div><strong>移动端横幅（Mobile）</strong><p class="muted">推荐竖图，例如 1080×1920。</p></div><button type="button" class="upload-button" data-action="upload-banner" data-mode="mobile">⇧ 上传</button></div>${bannerGrid(mobile, "mobile")}
      </div>`, "图")}
      ${section("横幅行为", "调整裁切位置、轮播、水波、图片 API 和导航透明度。", `<div class="field-grid">
        ${inputField("图片位置", "site.banner.position", banner.position || "center", "select", { choices: ["top", "center", "bottom"], source: "banner.position" })}
        ${inputField("轮播间隔（秒）", "site.banner.carousel.interval", getPath(banner, "carousel.interval", 5), "number", { min: 1, source: "carousel.interval" })}
        ${inputField("启用轮播", "site.banner.carousel.enable", getPath(banner, "carousel.enable", true), "boolean", { source: "carousel.enable" })}
        ${inputField("允许访客切换轮播", "site.banner.carousel.switchable", getPath(banner, "carousel.switchable", true), "boolean", { source: "carousel.switchable" })}
        ${inputField("启用水波", "site.banner.waves.enable", getPath(banner, "waves.enable", true), "boolean", { source: "waves.enable" })}
        ${inputField("水波性能模式", "site.banner.waves.performanceMode", getPath(banner, "waves.performanceMode", false), "boolean", { source: "waves.performanceMode" })}
        ${inputField("移动端禁用水波", "site.banner.waves.mobileDisable", getPath(banner, "waves.mobileDisable", false), "boolean", { source: "waves.mobileDisable" })}
        ${inputField("允许访客切换水波", "site.banner.waves.switchable", getPath(banner, "waves.switchable", true), "boolean", { source: "waves.switchable" })}
        ${inputField("启用图片 API", "site.banner.imageApi.enable", getPath(banner, "imageApi.enable", false), "boolean", { source: "imageApi.enable" })}
        ${inputField("图片 API 地址", "site.banner.imageApi.url", getPath(banner, "imageApi.url"), "url", { full: true, source: "imageApi.url" })}
        ${inputField("导航透明模式", "site.banner.navbar.transparentMode", getPath(banner, "navbar.transparentMode", "semifull"), "select", { choices: ["semi", "full", "semifull"] })}
      </div>`, "调")}
      ${section("首页标题", "设置横幅中央标题、副标题轮播和打字机速度。", `<div class="field-grid">
        ${inputField("显示首页标题", "site.banner.homeText.enable", getPath(banner, "homeText.enable", true), "boolean")}
        ${inputField("允许访客切换", "site.banner.homeText.switchable", getPath(banner, "homeText.switchable", true), "boolean")}
        ${inputField("首页主标题", "site.banner.homeText.title", getPath(banner, "homeText.title"), "text", { full: true })}
        ${inputField("副标题（每行或逗号一条）", "site.banner.homeText.subtitle", getPath(banner, "homeText.subtitle", []), "list", { full: true })}
        ${inputField("启用副标题打字机", "site.banner.homeText.typewriter.enable", getPath(banner, "homeText.typewriter.enable", true), "boolean")}
        ${inputField("打字速度 ms", "site.banner.homeText.typewriter.speed", getPath(banner, "homeText.typewriter.speed", 100), "number")}
        ${inputField("删除速度 ms", "site.banner.homeText.typewriter.deleteSpeed", getPath(banner, "homeText.typewriter.deleteSpeed", 50), "number")}
        ${inputField("暂停时间 ms", "site.banner.homeText.typewriter.pauseTime", getPath(banner, "homeText.typewriter.pauseTime", 2000), "number")}
      </div>`, "T")}`);
  } catch (error) { toast(error.message, true); }
  finally { setBusy(false); }
}

async function saveBanner() {
  const model = state.model;
  const composite = { site: model.site.value };
  readForm(els.editor, composite);
  model.site.value = composite.site;
  await saveModel(model.site, "更新首页横幅与标题设置");
  await openBanner(true); toast("首页图设置已保存。");
}

async function uploadBanner(mode) {
  chooseFiles({ multiple: true, accept: "image/*", onFiles: async files => {
    setBusy(true);
    try {
      const dir = mode === "desktop" ? "desktop-banner" : "mobile-banner";
      const added = [];
      await uploadFiles(files, file => {
        const safe = `${Date.now()}-${slugify(file.name.replace(/\.[^.]+$/, ""))}.${file.name.split(".").pop().toLowerCase()}`;
        added.push(`/assets/${dir}/${safe}`);
        return `public/assets/${dir}/${safe}`;
      }, `上传${mode === "desktop" ? "桌面端" : "移动端"}横幅`);
      const list = getPath(state.model.site.value, `banner.src.${mode}`, []);
      setPath(state.model.site.value, `banner.src.${mode}`, [...(Array.isArray(list) ? list : [list].filter(Boolean)), ...added]);
      await saveModel(state.model.site, `添加${mode === "desktop" ? "桌面端" : "移动端"}横幅图片`);
      await openBanner(true); await renderOtherSidebar(); toast("横幅图片已上传并写入配置。");
    } catch (error) { toast(error.message, true); }
    finally { setBusy(false); }
  }});
}

async function removeBanner(mode, index) {
  if (!confirm("确定从首页横幅中移除这张图片吗？文件本身会保留在仓库，避免误删。")) return;
  const list = getPath(state.model.site.value, `banner.src.${mode}`, []);
  const values = Array.isArray(list) ? [...list] : [list].filter(Boolean);
  values.splice(Number(index), 1);
  setPath(state.model.site.value, `banner.src.${mode}`, values);
  await saveModel(state.model.site, `移除${mode === "desktop" ? "桌面端" : "移动端"}横幅引用`);
  await openBanner(true); toast("横幅引用已移除。");
}

async function openArraySection(id, force = false) {
  const sectionInfo = otherSections.find(item => item.id === id);
  const schema = arraySchemas[id];
  if (!sectionInfo || !schema) return;
  setBusy(true);
  try {
    const model = await readModel(sectionInfo.path, sectionInfo.variable, force);
    state.model = { kind: "array", id, ...model };
    showEditor(`${editorHead(`${sectionInfo.label}管理`, `${sectionInfo.path} · ${model.value.length} 个条目`)}${section(sectionInfo.label, "每个卡片代表博客页面上的一个条目；可新增、修改或删除。", arrayEditor(id, model.value, schema), sectionInfo.icon)}<details class="advanced"><summary>高级功能：查看完整 JSON 数据</summary><div><textarea class="code" readonly>${escapeHtml(JSON.stringify(model.value, null, 2))}</textarea></div></details>`);
  } catch (error) { toast(error.message, true); }
  finally { setBusy(false); }
}

async function saveArraySection() {
  const model = state.model;
  model.value = readArrayEditor(model.id, arraySchemas[model.id], model.value);
  model.value.forEach((item, index) => { if ("id" in item && !item.id) item.id = index + 1; });
  await saveModel(model, `更新${otherSections.find(item => item.id === model.id)?.label || "页面数据"}`);
  await openArraySection(model.id, true); await renderOtherSidebar(); toast("内容已保存并提交。");
}

function deviceRows(value) {
  const rows = [];
  Object.entries(value || {}).forEach(([category, items]) => (items || []).forEach(item => rows.push({ category, ...item })));
  const schema = [["category", "设备分类", "text"], ["name", "设备名称", "text"], ["image", "设备图片", "text"], ["specs", "规格", "text"], ["description", "说明", "textarea"], ["link", "详情链接", "url"]];
  return { rows, schema };
}

async function openDevices(force = false) {
  setBusy(true);
  try {
    const info = otherSections.find(item => item.id === "devices");
    const model = await readModel(info.path, info.variable, force);
    const { rows, schema } = deviceRows(model.value);
    state.model = { kind: "devices", ...model, rows, schema };
    showEditor(`${editorHead("设备展示管理", `${rows.length} 台设备`)}${section("设备列表", "分类名称会成为设备页面的分组标题；图片支持 public 目录路径或网络 URL。", arrayEditor("devices", rows, schema), "设")}`);
  } catch (error) { toast(error.message, true); }
  finally { setBusy(false); }
}

async function saveDevices() {
  const model = state.model;
  const rows = readArrayEditor("devices", model.schema, model.rows);
  const grouped = {};
  rows.forEach(row => { const category = row.category?.trim() || "自定义"; delete row.category; (grouped[category] ||= []).push(row); });
  model.value = grouped;
  await saveModel(model, "更新设备展示");
  await openDevices(true); await renderOtherSidebar(); toast("设备展示已保存。");
}

function navbarItem(item, index) {
  if (item?.__raw) return `<div class="array-row nav-item" data-index="${index}" data-raw="${escapeHtml(item.__raw)}"><div><strong>预设菜单</strong><p class="muted">${escapeHtml(item.__raw)}。预设项由主题源码定义，可删除但不建议直接改名。</p></div><button type="button" class="remove-row" aria-label="移除此条目" data-action="remove-row">⌫</button></div>`;
  const children = (item.children || []).map((child, childIndex) => navbarChild(child, childIndex)).join("");
  return `<div class="array-row nav-item" data-index="${index}"><div class="array-fields">
    <label>一级菜单名称<input data-key="name" value="${escapeHtml(item.name || "")}"></label>
    <label>一级菜单链接<input data-key="url" value="${escapeHtml(item.url || "")}"></label>
    <label class="wide">一级菜单图标<input data-key="icon" value="${escapeHtml(rawText(item.icon))}"></label>
    <label class="toggle"><span>外部链接</span><input data-key="external" data-kind="boolean" type="checkbox"${item.external ? " checked" : ""}></label>
    <div class="wide"><strong>二级菜单</strong><div class="array-list nav-children">${children}</div><button type="button" class="add-row" data-action="add-nav-child">＋ 添加二级菜单</button></div>
  </div><button type="button" class="remove-row" aria-label="移除此条目" data-action="remove-row">⌫</button></div>`;
}

function navbarChild(child, index) {
  if (child?.__raw) return `<div class="array-row nav-child" data-child-index="${index}" data-raw="${escapeHtml(child.__raw)}"><div><span class="muted">预设：</span>${escapeHtml(child.__raw)}</div><button type="button" class="remove-row" aria-label="移除此条目" data-action="remove-row">⌫</button></div>`;
  return `<div class="array-row nav-child" data-child-index="${index}"><div class="array-fields"><label>名称<input data-key="name" value="${escapeHtml(child.name || "")}"></label><label>链接<input data-key="url" value="${escapeHtml(child.url || "")}"></label><label class="wide">图标<input data-key="icon" value="${escapeHtml(rawText(child.icon))}"></label><label class="toggle"><span>外部链接</span><input data-key="external" data-kind="boolean" type="checkbox"${child.external ? " checked" : ""}></label></div><button type="button" class="remove-row" aria-label="移除此条目" data-action="remove-row">⌫</button></div>`;
}

async function openNavbar(force = false) {
  setBusy(true);
  try {
    const model = await readModel("src/config/navBarConfig.ts", "navBarConfig", force);
    state.model = { kind: "navbar", ...model };
    showEditor(`${editorHead("顶栏与菜单", "一级菜单及点击后出现的二级菜单")}${section("菜单结构", "按卡片顺序显示。预设项会保留为源码引用，自定义项可直接编辑。", `<div id="navbar-items" class="array-list">${(model.value.links || []).map(navbarItem).join("")}</div><button type="button" class="add-row" data-action="add-navbar">＋ 添加一级菜单</button>`, "☷")}<details class="advanced"><summary>高级功能：菜单 JSON 预览</summary><div><textarea class="code" readonly>${escapeHtml(JSON.stringify(model.value, null, 2))}</textarea></div></details>`);
  } catch (error) { toast(error.message, true); }
  finally { setBusy(false); }
}

function readNavFields(row) {
  if (row.dataset.raw) return { __raw: row.dataset.raw };
  const result = {};
  $$(':scope > .array-fields > label [data-key]', row).forEach(control => { result[control.dataset.key] = control.dataset.kind === "boolean" ? control.checked : control.value.trim(); });
  const children = $$('.nav-children > .nav-child', row).map(child => {
    if (child.dataset.raw) return { __raw: child.dataset.raw };
    const value = {};
    $$('[data-key]', child).forEach(control => { value[control.dataset.key] = control.dataset.kind === "boolean" ? control.checked : control.value.trim(); });
    return value;
  });
  if (children.length) result.children = children;
  return result;
}

async function saveNavbar() {
  const model = state.model;
  model.value.links = $$("#navbar-items > .nav-item").map(readNavFields);
  await saveModel(model, "更新顶栏与二级菜单");
  await openNavbar(true); toast("顶栏菜单已保存。");
}

const sidebarNames = { profile: "个人资料", announcement: "公告", "music-sidebar": "侧栏音乐", categories: "文章分类", tags: "文章标签", "card-toc": "文章目录", "site-stats": "站点统计", calendar: "日历" };
function sidebarRows(value) {
  const components = value.components || { left: [], right: [], drawer: [] };
  return (value.properties || []).map((item, index) => `<div class="array-row sidebar-component" data-index="${index}" data-type="${escapeHtml(item.type)}"><div class="array-fields">
    <div><strong>${escapeHtml(sidebarNames[item.type] || item.type)}</strong><small class="side-subtitle">${escapeHtml(item.type)}</small></div>
    <label>定位方式<select data-key="position"><option${item.position === "top" ? " selected" : ""}>top</option><option${item.position === "sticky" ? " selected" : ""}>sticky</option></select></label>
    <label>动画延迟 ms<input data-key="animationDelay" data-kind="number" type="number" value="${escapeHtml(item.animationDelay || 0)}"></label>
    <label>CSS 类名<input data-key="class" value="${escapeHtml(item.class || "onload-animation")}"></label>
    <label class="toggle"><span>显示在左侧栏</span><input data-location="left" type="checkbox"${components.left?.includes(item.type) ? " checked" : ""}></label>
    <label class="toggle"><span>显示在右侧栏</span><input data-location="right" type="checkbox"${components.right?.includes(item.type) ? " checked" : ""}></label>
    <label class="toggle"><span>显示在移动抽屉</span><input data-location="drawer" type="checkbox"${components.drawer?.includes(item.type) ? " checked" : ""}></label>
    ${item.responsive ? `<label>折叠阈值<input data-key="responsive.collapseThreshold" data-kind="number" type="number" value="${escapeHtml(getPath(item, "responsive.collapseThreshold", 0))}"></label>` : ""}
  </div><div class="editor-actions"><button type="button" class="secondary" aria-label="上移组件" data-action="move-sidebar" data-direction="up">↑</button><button type="button" class="secondary" aria-label="下移组件" data-action="move-sidebar" data-direction="down">↓</button></div></div>`).join("");
}

async function openSidebar(force = false) {
  setBusy(true);
  try {
    const model = await readModel("src/config/sidebarConfig.ts", "sidebarLayoutConfig", force);
    state.model = { kind: "sidebar", ...model };
    showEditor(`${editorHead("侧栏布局", "每个组件均可独立控制桌面左栏、右栏和移动端抽屉")}
      ${section("侧栏组件", "勾选显示位置，使用上下箭头调整组件顺序。右侧栏内容在部分移动布局中不会显示。", `<div id="sidebar-components" class="array-list">${sidebarRows(model.value)}</div>`, "栏")}
      ${section("默认动画", "控制侧栏卡片进入页面时的动画节奏。", `<div class="field-grid">${inputField("启用默认动画", "defaultAnimation.enable", getPath(model.value, "defaultAnimation.enable", true), "boolean")}${inputField("基础延迟 ms", "defaultAnimation.baseDelay", getPath(model.value, "defaultAnimation.baseDelay", 0), "number")}${inputField("递增延迟 ms", "defaultAnimation.increment", getPath(model.value, "defaultAnimation.increment", 50), "number")}</div>`, "动")}`);
  } catch (error) { toast(error.message, true); }
  finally { setBusy(false); }
}

async function saveSidebar() {
  const model = state.model;
  const value = model.value;
  const properties = $$("#sidebar-components > .sidebar-component").map(row => {
    const old = clone(value.properties.find(item => item.type === row.dataset.type) || { type: row.dataset.type });
    $$('[data-key]', row).forEach(control => { let fieldValue = control.value; if (control.dataset.kind === "number") fieldValue = Number(fieldValue) || 0; setPath(old, control.dataset.key, fieldValue); });
    return old;
  });
  value.properties = properties;
  value.components = { left: [], right: [], drawer: [] };
  $$("#sidebar-components > .sidebar-component").forEach(row => $$('[data-location]', row).forEach(control => { if (control.checked) value.components[control.dataset.location].push(row.dataset.type); }));
  readForm(els.editor, value);
  await saveModel(model, "更新侧栏布局与功能开关");
  await openSidebar(true); toast("侧栏布局已保存。");
}

async function uploadAvatar() {
  chooseFiles({ accept: "image/*", onFiles: async ([file]) => {
    if (!file) return;
    setBusy(true);
    try {
      const ext = file.name.split(".").pop().toLowerCase();
      const name = `admin-avatar-${Date.now()}.${ext}`;
      await uploadFiles([file], () => `public/assets/images/${name}`, "上传站长头像");
      state.model.profile.value.avatar = `/assets/images/${name}`;
      await saveModel(state.model.profile, "更新站长头像");
      await openSite(true); toast("头像已上传并写入个人资料。");
    } catch (error) { toast(error.message, true); }
    finally { setBusy(false); }
  }});
}

async function openSelected(id, force = false) {
  state.selected = id;
  await renderSidebar();
  if (state.module === "posts") return openPost(id, force);
  if (state.module === "albums") return openAlbum(id, force);
  if (state.module === "diary") return openDiary(id, force);
  return openOther(id, force);
}

function addArrayRow(id) {
  const container = $(`#array-${id}`);
  if (!container) return;
  const schema = id === "devices" ? state.model.schema : arraySchemas[id];
  const index = container.children.length;
  const defaults = {};
  schema.forEach(([key, , type, choices]) => {
    defaults[key] = type === "boolean" ? false : type === "list" ? [] : type === "number" ? 0 : type === "select" ? choices?.[0] || "" : "";
  });
  container.insertAdjacentHTML("beforeend", arrayRow(id, defaults, index, schema));
  markDirty();
  container.lastElementChild?.scrollIntoView({ behavior: "instant", block: "center" });
}

async function handleNew() {
  if (state.busy || !await confirmLeave()) return;
  if (state.module === "home") {
    await switchModule("posts");
    return newPost();
  }
  if (state.module === "posts") return newPost();
  if (state.module === "albums") return newAlbum();
  if (state.module === "diary") return newDiary();
  if (!state.selected) return openOther(state.otherSection);
  if (state.model?.kind === "array") addArrayRow(state.model.id);
  else if (state.model?.kind === "devices") addArrayRow("devices");
  else if (state.model?.kind === "navbar") $("[data-action='add-navbar']", els.editor)?.click();
}

async function handleSubmit(event) {
  event.preventDefault();
  if (state.busy || !state.model) return;
  setBusy(true);
  try {
    if (state.model.kind === "post") await savePost();
    else if (state.model.kind === "album") await saveAlbum();
    else if (state.model.kind === "diary") await saveDiary();
    else if (state.model.kind === "site") await saveSite();
    else if (state.model.kind === "announcement") await saveAnnouncement();
    else if (state.model.kind === "music") await saveMusic();
    else if (state.model.kind === "banner") await saveBanner();
    else if (state.model.kind === "array") await saveArraySection();
    else if (state.model.kind === "devices") await saveDevices();
    else if (state.model.kind === "navbar") await saveNavbar();
    else if (state.model.kind === "sidebar") await saveSidebar();
  } catch (error) { toast(error.message, true); }
  finally { setBusy(false); }
}

async function handleEditorClick(event) {
  const viewButton = event.target.closest("button[data-post-view]");
  if (viewButton && !state.busy) { setPostView(viewButton.dataset.postView); return; }
  const button = event.target.closest("button[data-action]");
  if (!button || state.busy) return;
  const action = button.dataset.action;
  try {
    if (action === "back-catalog") {
      await backToCatalog();
    } else if (action === "delete") {
      if (state.model.kind === "post") await deletePost();
      else if (state.model.kind === "album") await deleteAlbum();
      else if (state.model.kind === "diary") await deleteDiary();
    } else if (action === "remove-row") {
      button.closest(".array-row")?.remove();
    } else if (action === "add-social") {
      const list = $("#social-links");
      const index = list.children.length;
      list.insertAdjacentHTML("beforeend", `<div class="array-row" data-index="${index}"><div class="array-fields"><label>显示名称<input data-key="name"></label><label>链接地址<input data-key="url"></label><label class="wide">图标名称<input data-key="icon" placeholder="例如 fa7-brands:github"></label></div><button type="button" class="remove-row" aria-label="移除此条目" data-action="remove-row">⌫</button></div>`);
    } else if (action === "add-array") {
      addArrayRow(button.dataset.array);
    } else if (action === "delete-image") {
      await deleteSingleImage(button);
    } else if (action === "upload-album") {
      chooseFiles({ accept: "image/*", multiple: true, onFiles: async files => {
        setBusy(true);
        try {
          await uploadFiles(files, file => `public/images/albums/${state.model.id}/${Date.now()}-${slugify(file.name.replace(/\.[^.]+$/, ""))}.${file.name.split(".").pop().toLowerCase()}`, "上传相册图片");
          await openAlbum(state.model.id, true); await renderAlbumSidebar(); toast("相册图片已上传。");
        } catch (error) { toast(error.message, true); }
        finally { setBusy(false); }
      }});
    } else if (action === "upload-avatar") {
      await uploadAvatar();
    } else if (action === "upload-banner") {
      await uploadBanner(button.dataset.mode);
    } else if (action === "remove-banner") {
      await removeBanner(button.dataset.mode, button.dataset.index);
    } else if (action === "apply-source") {
      applyPostSource();
      toast("完整源码已载入图形化编辑器，尚未保存。");
    } else if (action === "add-navbar") {
      const list = $("#navbar-items");
      list.insertAdjacentHTML("beforeend", navbarItem({ name: "新菜单", url: "/", icon: "material-symbols:link", children: [] }, list.children.length));
    } else if (action === "add-nav-child") {
      const list = $(".nav-children", button.closest(".nav-item"));
      list.insertAdjacentHTML("beforeend", navbarChild({ name: "新子菜单", url: "/", icon: "material-symbols:link" }, list.children.length));
    } else if (action === "move-sidebar") {
      const row = button.closest(".sidebar-component");
      if (button.dataset.direction === "up" && row.previousElementSibling) row.parentElement.insertBefore(row, row.previousElementSibling);
      if (button.dataset.direction === "down" && row.nextElementSibling) row.parentElement.insertBefore(row.nextElementSibling, row);
    }
    if (["remove-row", "add-social", "add-array", "apply-source", "add-navbar", "add-nav-child", "move-sidebar"].includes(action)) markDirty();
  } catch (error) { toast(error.message, true); }
}

els.loginForm.addEventListener("submit", async event => {
  event.preventDefault(); setBusy(true);
  try {
    const result = await api("login", { password: els.password.value });
    state.repo = result.repo; els.password.value = ""; showApp(); await loadTree(true); renderModuleNav(); await renderSidebar(); toast("登录成功");
  } catch (error) { toast(error.message, true); }
  finally { setBusy(false); }
});

els.moduleNav.addEventListener("click", async event => {
  const button = event.target.closest("button[data-module]");
  if (!button || state.busy) return;
  setBusy(true); try { await switchModule(button.dataset.module); } catch (error) { toast(error.message, true); } finally { setBusy(false); }
});

els.sideList.addEventListener("click", async event => {
  const button = event.target.closest(".side-item[data-id]");
  if (!button || state.busy || !await confirmLeave()) return;
  setBusy(true); try { await openSelected(button.dataset.id); } catch (error) { toast(error.message, true); } finally { setBusy(false); }
});

els.editor.addEventListener("submit", handleSubmit);
els.editor.addEventListener("click", handleEditorClick);
els.editor.addEventListener("invalid", event => {
  const pane = event.target.closest("[data-post-pane]");
  if (pane?.hidden) setPostView(pane.dataset.postPane);
}, true);
els.editor.addEventListener("input", event => {
  markDirty();
  if (state.model?.kind === "post") {
    if (event.target.id === "post-source") {
      state.model.sourceDirty = true;
      // Raw Markdown is validated by savePost, not stale or hidden GUI fields.
      els.editor.noValidate = true;
      return;
    }
    if (event.target.id === "post-body" || event.target.dataset.path) {
      if (state.model.sourceDirty) {
        const value = event.target.value;
        const checked = event.target.checked;
        applyPostSource();
        event.target.value = value;
        event.target.checked = checked;
      }
      const source = $("#post-source");
      if (source) source.value = postSourceFromForm();
    }
  }
  if (event.target.id === "post-body") $("#post-preview").innerHTML = markdown(event.target.value);
});
els.newButton.addEventListener("click", () => handleNew().catch(error => toast(error.message, true)));
els.refreshButton.addEventListener("click", refreshAll);
els.search.addEventListener("input", () => renderSidebar().catch(error => toast(error.message, true)));
els.picker.addEventListener("change", async () => { const callback = state.pendingUpload; state.pendingUpload = null; if (callback && els.picker.files?.length) await callback([...els.picker.files]); });

els.theme.addEventListener("click", () => {
  const dark = document.documentElement.dataset.theme !== "dark";
  setTheme(dark ? "dark" : "light");
  localStorage.setItem("takiyu-admin-theme", dark ? "dark" : "light");
});

els.logout.addEventListener("click", async () => {
  if (state.busy || !await confirmLeave()) return;
  try { await api("logout"); } catch {}
  state.files = []; state.cache.clear(); state.selected = null; state.module = "home"; hideEditor(); showLogin();
});

els.homeButton.addEventListener("click", async () => {
  if (state.busy) return;
  setBusy(true);
  try { await switchModule("home"); } catch (error) { toast(error.message, true); }
  finally { setBusy(false); }
});
els.navToggle.addEventListener("click", () => setNavigation(true));
els.navClose.addEventListener("click", () => { setNavigation(false); els.navToggle.focus(); });
els.navBackdrop.addEventListener("click", () => { setNavigation(false); els.navToggle.focus(); });
els.listToggle.addEventListener("click", () => {
  const expanded = els.listToggle.getAttribute("aria-expanded") !== "true";
  els.listToggle.setAttribute("aria-expanded", String(expanded));
  els.listToggle.textContent = expanded ? "收起目录" : "展开目录";
  els.catalogBody.classList.toggle("hidden", !expanded);
});
els.dashboard.addEventListener("click", async event => {
  const button = event.target.closest("button");
  if (!button || state.busy) return;
  setBusy(true);
  try {
    if (button.hasAttribute("data-new-post")) {
      if (await switchModule("posts")) newPost();
    } else if (button.dataset.openPost) {
      await switchModule("posts");
      await openSelected(button.dataset.openPost);
    } else if (button.dataset.section) {
      await switchModule("other");
      await openSelected(button.dataset.section);
    } else if (button.dataset.module) await switchModule(button.dataset.module);
  } catch (error) { toast(error.message, true); }
  finally { setBusy(false); }
});

async function init() {
  const theme = localStorage.getItem("takiyu-admin-theme") || "light";
  setTheme(theme);
  window.addEventListener("beforeunload", event => { if (state.dirty) { event.preventDefault(); event.returnValue = ""; } });
  document.addEventListener("keydown", event => {
    if (els.navBackdrop.hidden) return;
    if (event.key === "Escape") { setNavigation(false); els.navToggle.focus(); }
    if (event.key === "Tab") {
      const buttons = $$("button", $("#navigation")).filter(button => button.getClientRects().length && !button.disabled);
      if (event.shiftKey && document.activeElement === buttons[0]) { event.preventDefault(); buttons.at(-1).focus(); }
      else if (!event.shiftKey && document.activeElement === buttons.at(-1)) { event.preventDefault(); buttons[0].focus(); }
    }
  });
  matchMedia("(max-width: 700px)").addEventListener("change", () => {
    setNavigation(false);
    els.catalogBody.classList.remove("hidden");
    els.listToggle.setAttribute("aria-expanded", "true");
    els.listToggle.textContent = "收起目录";
  });
  renderModuleNav();

  let session;
  try {
    session = await api("session");
  } catch {
    showLogin();
    return;
  }

  state.repo = session.repo;
  showApp();
  try {
    await loadTree(true);
    await renderSidebar();
  } catch (error) {
    toast(`已进入后台，但读取 GitHub 仓库失败：${error.message}`, true);
  }
}

init();
