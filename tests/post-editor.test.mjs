import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import vm from "node:vm";
import { test } from "node:test";

const script = readFileSync(new URL("../public/app.js", import.meta.url), "utf8");
const article = `---
title: "Example"
published: "2026-09-05"
updated: "2026-09-03"
tags: ["Notes"]
# Keep this comment and advanced metadata.
custom:
  nested: true
---

Original body
`;

function editor(source = article, isAbout = false) {
  const controls = new Map();
  const events = {};
  const formFields = [];
  const writes = [];
  const makeElement = (id = "") => ({
    id, value: "", checked: false, dataset: {}, innerHTML: "", textContent: "",
    classList: { add() {}, remove() {}, toggle() {} },
    addEventListener(name, callback) { events[`${id}:${name}`] = callback; },
    querySelector(selector) { return element(selector); },
    querySelectorAll(selector) { return selector === "[data-path]" ? formFields : []; },
  });
  function element(selector) {
    if (!controls.has(selector)) controls.set(selector, makeElement(selector.slice(1)));
    return controls.get(selector);
  }
  const context = vm.createContext({
    document: { querySelector: element, querySelectorAll: () => [], documentElement: { dataset: {} } },
    console, setTimeout, clearTimeout, URL, Date,
  });
  vm.runInContext(script.replace(/\ninit\(\);\s*$/, ""), context);
  const parsed = vm.runInContext(`parseFrontmatter(${JSON.stringify(source)})`, context);
  context.fixture = { source, parsed, isAbout };
  vm.runInContext(`state.model = { kind: "post", path: "src/content/posts/example.md", sha: "original-sha", data: fixture.parsed.data, body: fixture.parsed.body, original: fixture.source, isAbout: fixture.isAbout, sourceDirty: false };`, context);
  for (const key of ["title", "published", "updated", "tags"]) {
    if (isAbout) break;
    const control = makeElement(key);
    control.dataset = { path: key, kind: key === "tags" ? "list" : key === "title" ? "text" : "date" };
    control.type = key === "published" || key === "updated" ? "date" : "text";
    const value = parsed.data[key];
    control.value = Array.isArray(value) ? value.join(", ") : value || "";
    formFields.push(control);
  }
  element("#post-body").value = parsed.body;
  element("#post-source").value = source;
  context.captureWrite = async (action, payload) => { writes.push({ action, payload }); return {}; };
  vm.runInContext("api = captureWrite; loadTree = async () => {}; renderPostSidebar = async () => {}; openPost = async () => {}; toast = () => {};", context);
  return {
    context, writes,
    field: key => formFields.find(control => control.dataset.path === key),
    source: element("#post-source"), body: element("#post-body"),
    input(control) { events["editor:input"]({ target: control }); },
    save() { return vm.runInContext("savePost()", context); },
    apply() { return vm.runInContext("applyPostSource()", context); },
  };
}

test("direct source edits are submitted without applying to the form", async () => {
  const ui = editor();
  const edited = article.replace('updated: "2026-09-03"', 'updated: "2026-10-04"').replace("Original body", "Changed body");
  ui.source.value = edited;
  ui.input(ui.source);
  await ui.save();
  assert.equal(ui.writes[0].action, "file.write");
  assert.equal(ui.writes[0].payload.content, edited);
  assert.equal(ui.writes[0].payload.sha, "original-sha");
});

test("date form changes preserve the body, comments and multiline metadata", async () => {
  const ui = editor();
  ui.field("updated").value = "2026-10-04";
  ui.input(ui.field("updated"));
  await ui.save();
  assert.equal(ui.writes[0].payload.content, article.replace('updated: "2026-09-03"', 'updated: "2026-10-04"'));
});

test("clearing the optional updated date removes it from Frontmatter", async () => {
  const ui = editor();
  ui.field("updated").value = "";
  await ui.save();
  assert.equal(ui.writes[0].payload.content, article.replace('updated: "2026-09-03"\n', ""));
});

test("form edits after source edits retain changes from both editors", async () => {
  const ui = editor();
  ui.source.value = article.replace('updated: "2026-09-03"', 'updated: "2026-10-04"').replace("Original body", "Source body");
  ui.input(ui.source);
  ui.field("title").value = "New title";
  ui.input(ui.field("title"));
  await ui.save();
  assert.equal(ui.writes[0].payload.content, ui.source.value);
  assert.match(ui.writes[0].payload.content, /title: "New title"/);
  assert.match(ui.writes[0].payload.content, /updated: "2026-10-04"/);
  assert.match(ui.writes[0].payload.content, /custom:\n  nested: true/);
  assert.match(ui.writes[0].payload.content, /Source body/);
});

test("apply source populates the update date without rewriting raw metadata", async () => {
  const ui = editor();
  ui.source.value = article.replace('updated: "2026-09-03"', 'updated: "2026-10-04"');
  ui.input(ui.source);
  ui.apply();
  assert.equal(ui.field("updated").value, "2026-10-04");
  await ui.save();
  assert.equal(ui.writes[0].payload.content, ui.source.value);
});

test("invalid source dates are rejected before a GitHub write", async () => {
  const ui = editor();
  ui.source.value = article.replace('updated: "2026-09-03"', 'updated: "2026-02-30"');
  ui.input(ui.source);
  await assert.rejects(ui.save(), /更新日期/);
  assert.equal(ui.writes.length, 0);
});

test("about source edits save as raw Markdown", async () => {
  const ui = editor("# About\n\nIntroduction\n", true);
  ui.source.value = "# About\n\nChanged introduction\n";
  ui.input(ui.source);
  await ui.save();
  assert.equal(ui.writes[0].payload.content, ui.source.value);
});
