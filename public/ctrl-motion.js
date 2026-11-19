// Presentation only: repository reads, edits and authentication stay in app.js.
const clamp = (value, min, max) => Math.max(min, Math.min(max, value));
const mix = (a, b, t) => a + (b - a) * t;
const ease = (from, to, value) => {
  const t = clamp((value - from) / (to - from), 0, 1);
  return t * t * (3 - 2 * t);
};

const trailGap = 100;
const trailLag = .1;
const pointDistance = (a, b) => Math.hypot(a.x - b.x, a.y - b.y);
const easeOutExpo = t => t === 1 ? 1 : 1 - 2 ** (-10 * t);
const easeInOutQuart = t => t < .5 ? 8 * t ** 4 : 1 - ((2 - 2 * t) ** 4) / 2;

export function trailFrameAt(state, point) {
  const previous = state?.smooth ?? point;
  const last = state?.last ?? { x: 0, y: 0 };
  const smooth = { x: mix(previous.x, point.x, trailLag), y: mix(previous.y, point.y, trailLag) };
  const stamp = pointDistance(last, point) > trailGap ? { from: smooth, to: point } : null;
  return { smooth, last: stamp ? point : last, stamp };
}

function curveTiming(curve, fallback) {
  // Interpolate the reference curves with CSS linear() stops; no animation library is needed.
  const timing = `linear(${Array.from({ length: 41 }, (_, index) => curve(index / 40).toFixed(6)).join(", ")})`;
  return CSS.supports("animation-timing-function", timing) ? timing : fallback;
}

export const reelStops = [.18, .50, .82];

export function heroAt({ scroll, height, anchor }) {
  const travel = Math.max(0, scroll) / Math.max(1, height);
  return {
    alpha: 1 - ease(.19, .91, travel),
    scale: 1 - .20 * ease(0, .76, travel),
    rise: -68 * ease(.08, .82, travel),
    tools: 1 - ease(.025, .15, travel),
    fold: ease(.10, .64, travel),
    label: 1 - ease(.07, .46, travel),
    buttonY: mix(Math.min(anchor, height - 46), height - 49, ease(.02, .56, travel)),
  };
}

export function reelAt(progress) {
  const track = (progress - reelStops[0]) / (reelStops[1] - reelStops[0]);
  const frame = 1 - ease(.94, 1.045, progress);
  const arrive = ease(.028, .16, progress);
  const presence = (distance, inner, outer) => 1 - ease(inner, outer, Math.abs(distance));
  const frames = reelStops.map((_, i) => {
    const relative = track - i;
    return {
      panel: presence(relative, .20, .70) * arrive * frame,
      lead: presence(relative + .18, .16, .73) * arrive * frame,
      echo: presence(relative - .24, .12, .72) * arrive * frame,
      drift: -92 * clamp(relative, -1, 1),
      // Percent of each tile's own height, so adjacent tiles keep a gap at any viewport.
      leadY: -113 * clamp(relative + .09, -1, 1),
      echoY: -107 * clamp(relative - .12, -1, 1),
    };
  });
  const nearest = clamp(Math.round(track), 0, frames.length - 1);
  return { frame, logo: 1 - arrive, active: frames[nearest].panel > .34 ? nearest : -1, frames };
}

export function pointerAt(point, bounds) {
  return {
    x: clamp(2 * (point.x - bounds.left) / Math.max(1, bounds.width) - 1, -1, 1),
    y: clamp(2 * (point.y - bounds.top) / Math.max(1, bounds.height) - 1, -1, 1),
  };
}

export function titleAt(elapsed, lengths) {
  let lineTime = elapsed - 110;
  const lines = lengths.map((length, index) => {
    const duration = length * 62;
    const count = clamp(Math.floor(lineTime / 62), 0, length);
    const active = lineTime >= (index === 0 ? -110 : 0) && lineTime < duration + 105;
    lineTime -= duration + 105;
    return { count, active };
  });
  return { lines, done: lineTime >= 0 };
}

function typeStops(line) {
  const text = line.firstElementChild?.firstChild;
  if (!text?.length) return [0, 100];
  const bounds = line.getBoundingClientRect();
  const range = document.createRange();
  range.setStart(text, 0);
  const stops = [0];
  for (let index = 1; index < text.length; index++) {
    range.setEnd(text, index);
    stops.push(clamp(100 * (range.getBoundingClientRect().right - bounds.left) / Math.max(1, bounds.width), 0, 100));
  }
  return [...stops, 100];
}


function setupCtrlMotion() {
  const nav = document.querySelector("#module-nav");
  const header = document.querySelector("#navigation");
  const dashboard = document.querySelector("#dashboard");
  if (!nav || !header || !dashboard) return;

  const reduce = matchMedia("(prefers-reduced-motion: reduce)");
  const fine = matchMedia("(hover: hover) and (pointer: fine)");
  const wide = matchMedia("(min-width: 820px) and (min-height: 660px)");
  const sideTiles = matchMedia("(min-width: 1280px)");
  let navHover = null;
  let navFrame = 0;
  let lastNav = null;
  let slideAnimation = null;
  let sceneFrame = 0;
  let typingFrame = 0;
  let titleObserver;
  let scene = {};
  let hoverNode = null;
  let hoverFrame = 0;
  let hoverPoint = null;
  let activeTrail = null;
  let trailFrame = 0;
  const sceneResizer = typeof ResizeObserver === "function" ? new ResizeObserver(invalidateScene) : null;
  const trailTravel = curveTiming(easeOutExpo, "cubic-bezier(.16, 1, .3, 1)");
  const trailShrink = curveTiming(easeInOutQuart, "cubic-bezier(.77, 0, .175, 1)");

  const visible = () => !dashboard.hidden && !dashboard.classList.contains("hidden");
  const stickyMode = () => visible() && wide.matches && !reduce.matches && !header.closest(".nav-open");

  function syncNav() {
    navFrame = 0;
    const keyboard = nav.querySelector("button:focus-visible");
    const target = (navHover?.isConnected ? navHover : null) || keyboard || nav.querySelector('[aria-current="page"]');
    if (!target?.offsetWidth) return;
    const x = target.offsetLeft, y = target.offsetTop, w = target.offsetWidth, h = target.offsetHeight;
    if (lastNav && !reduce.matches && lastNav.y === y && lastNav.x !== x) {
      slideAnimation?.cancel();
      const spread = Math.min(1.31, 1 + Math.abs(lastNav.x - x) / Math.max(w, 1) * .18);
      slideAnimation = nav.animate([
        { "--slide-stretch": 1 },
        { "--slide-stretch": spread, offset: .50 },
        { "--slide-stretch": 1 },
      ], { duration: 390, easing: "ease-in-out" });
    }
    lastNav = { x, y };
    nav.style.setProperty("--slide-x", `${x}px`);
    nav.style.setProperty("--slide-y", `${y}px`);
    nav.style.setProperty("--slide-w", `${w}px`);
    nav.style.setProperty("--slide-h", `${h}px`);
    nav.dataset.slider = "ready";
  }
  function scheduleNav() {
    if (!navFrame) navFrame = requestAnimationFrame(syncNav);
  }

  function updateTyping(now) {
    typingFrame = 0;
    for (const item of scene.titles || []) {
      if (item.started == null || item.done) continue;
      const { lines, done } = titleAt(now - item.started, item.stops.map(stops => stops.length - 1));
      lines.forEach(({ count, active }, index) => {
        const line = item.lines[index];
        const typed = `${item.stops[index][count].toFixed(2)}%`;
        if (line.style.getPropertyValue("--typed") !== typed) line.style.setProperty("--typed", typed);
        if (line.hasAttribute("data-caret") !== active) line.toggleAttribute("data-caret", active);
      });
      item.done = done;
      if (done) item.element.dataset.typing = "done";
    }
    if (scene.titles?.some(item => item.started != null && !item.done)) typingFrame = requestAnimationFrame(updateTyping);
  }

  function resetTitle(item, complete) {
    item.started = null;
    item.done = complete;
    item.element.dataset.typing = complete ? "done" : "waiting";
    for (const line of item.lines) {
      line.style.setProperty("--typed", complete ? "100%" : "0%");
      line.removeAttribute("data-caret");
    }
  }

  function setReelMode(on) {
    const mode = on ? "sticky" : "flow";
    if (dashboard.dataset.reelMode === mode) return;
    dashboard.dataset.reelMode = mode;
    scene.bounds = null;
    scene.active = undefined;
    if (on) return;
    if (scene.action) {
      scene.action.hidden = false;
      scene.action.style.removeProperty("--write-text");
      scene.action.removeAttribute("data-folded");
    }
    for (const { node } of scene.stages || []) node.inert = false;
    for (const button of scene.steps || []) button.removeAttribute("aria-current");
    for (const key of ["--hero-alpha", "--hero-rise", "--hero-scale"]) scene.heroCopy?.style.removeProperty(key);
    scene.hero?.style.removeProperty("--hero-tools");
  }

  // Cache document-relative bounds until a render, font, or resize changes layout.
  function measureScene(scroll) {
    const start = scene.slot.getBoundingClientRect();
    const reel = scene.reel.getBoundingClientRect();
    const end = scene.endAction.getBoundingClientRect();
    const headerHeight = header.offsetHeight;
    return {
      top: scroll + reel.top - headerHeight,
      span: Math.max(1, reel.height - scene.sticky.offsetHeight),
      anchor: scroll + start.top + start.height / 2,
      height: innerHeight, headerHeight,
      endTop: scroll + end.top, endBottom: scroll + end.bottom,
    };
  }

  function invalidateScene() {
    scene.bounds = null;
    scheduleScene();
  }

  function writeStyle(node, key, value) {
    if (node.style.getPropertyValue(key) !== value) node.style.setProperty(key, value);
  }

  function paintLayer(node, alpha, drift, unit = "px") {
    const opacity = alpha.toFixed(3);
    writeStyle(node, "--reel-opacity", opacity);
    if (drift != null && opacity !== "0.000") writeStyle(node, "--reel-drift", `${drift.toFixed(1)}${unit}`);
  }

  function activateStage(active) {
    if (scene.active === active) return;
    scene.active = active;
    const focused = document.activeElement;
    scene.stages.forEach(({ node }, i) => {
      const inactive = active !== i;
      if (inactive && !node.inert && node.contains(focused)) {
        scene.steps[active === -1 ? i : active]?.focus({ preventScroll: true });
      }
      if (node.inert !== inactive) node.inert = inactive;
      if (inactive) scene.steps[i]?.removeAttribute("aria-current");
      else scene.steps[i]?.setAttribute("aria-current", "step");
    });
  }

  function updateScene() {
    sceneFrame = 0;
    const scroll = window.scrollY;
    header.classList.toggle("is-travelled", scroll > 24);
    if (!scene.hero || !scene.action || !scene.reel || !visible()) return;
    const enhanced = stickyMode();
    setReelMode(enhanced);
    if (!enhanced) return;

    const { top, span, height, anchor, headerHeight, endTop, endBottom } = scene.bounds ??= measureScene(scroll);
    const frame = reelAt((scroll - top) / span);
    const writing = heroAt({ scroll, height, anchor });
    writeStyle(scene.heroCopy, "--hero-alpha", writing.alpha.toFixed(3));
    writeStyle(scene.heroCopy, "--hero-rise", `${writing.rise.toFixed(1)}px`);
    writeStyle(scene.heroCopy, "--hero-scale", writing.scale.toFixed(3));
    writeStyle(scene.hero, "--hero-tools", writing.tools.toFixed(3));
    writeStyle(scene.action, "--write-y", `${writing.buttonY.toFixed(1)}px`);
    writeStyle(scene.action, "--write-fold", writing.fold.toFixed(3));
    writeStyle(scene.action, "--write-text", writing.label.toFixed(3));
    scene.action.toggleAttribute("data-folded", writing.fold === 1);
    const endVisible = endTop - scroll > headerHeight && endBottom - scroll < height - 13;
    if (scene.action.hidden !== endVisible) {
      const transfer = endVisible && document.activeElement === scene.action;
      scene.action.hidden = endVisible;
      if (transfer) scene.endAction.focus({ preventScroll: true });
    }
    paintLayer(scene.splash, frame.frame * frame.logo);
    scene.stages.forEach(({ panel, lead, echo }, i) => {
      const pose = frame.frames[i];
      paintLayer(panel, pose.panel, pose.drift);
      if (sideTiles.matches) {
        paintLayer(lead, pose.lead, pose.leadY, "%");
        paintLayer(echo, pose.echo, pose.echoY, "%");
      }
    });
    activateStage(frame.active);
  }

  function observeTitles() {
    titleObserver?.disconnect();
    if (reduce.matches || !visible() || !scene.titles?.length || typeof IntersectionObserver !== "function") return;
    const items = new Map(scene.titles.map(item => [item.element, item]));
    titleObserver = new IntersectionObserver(entries => {
      for (const entry of entries) {
        const item = items.get(entry.target);
        if (!item.element.isConnected) continue;
        if (!entry.isIntersecting) {
          if (item.started != null) resetTitle(item, false);
        } else if (entry.intersectionRatio >= .4 && item.started == null && !item.done) {
          item.stops = item.lines.map(typeStops);
          item.started = performance.now();
          item.element.dataset.typing = "running";
          if (!typingFrame) typingFrame = requestAnimationFrame(updateTyping);
        }
      }
    }, { rootMargin: `-${header.offsetHeight}px 0px 0px`, threshold: [0, .4] });
    for (const element of items.keys()) titleObserver.observe(element);
  }

  function scheduleScene() {
    if (!sceneFrame) sceneFrame = requestAnimationFrame(updateScene);
  }

  function watchScene() {
    resetTrail();
    if (typingFrame) cancelAnimationFrame(typingFrame);
    typingFrame = 0;
    scene = {
      hero: dashboard.querySelector(".overview-intro"),
      heroCopy: dashboard.querySelector(".hero-scroll-copy"),
      action: dashboard.querySelector("[data-inline-write]"),
      slot: dashboard.querySelector("[data-write-slot]"),
      endAction: dashboard.querySelector(".finale-cta"),
      reel: dashboard.querySelector("[data-reel]"),
      sticky: dashboard.querySelector("[data-reel-sticky]"),
      splash: dashboard.querySelector(".reel-splash"),
      stages: [...dashboard.querySelectorAll("[data-scroll-stage]")].map(node => ({
        node, panel: node.querySelector(".stage-inner"),
        lead: node.querySelector('[data-reel-side="lead"]'),
        echo: node.querySelector('[data-reel-side="echo"]'),
      })),
      steps: [...dashboard.querySelectorAll("[data-reel-to]")],
      titles: [...dashboard.querySelectorAll("[data-typewriter]")].map(element => ({
        element, lines: [...element.querySelectorAll("[data-type-line]")],
      })),
    };
    scene.titles.forEach(item => resetTitle(item, reduce.matches || typeof IntersectionObserver !== "function"));
    sceneResizer?.disconnect();
    for (const target of [scene.hero, scene.reel, scene.slot, scene.endAction]) if (target) sceneResizer?.observe(target);
    if (!stickyMode()) setReelMode(false);
    observeTitles();
    scheduleScene();
  }

  function pauseTrail() {
    if (trailFrame) cancelAnimationFrame(trailFrame);
    trailFrame = 0;
    if (activeTrail) {
      activeTrail.pending = null;
      activeTrail.point = null;
    }
  }

  function stopSticker(slot) {
    for (const animation of slot.animations || []) animation.cancel();
    slot.animations = null;
  }

  function resetTrail() {
    pauseTrail();
    for (const slot of activeTrail?.pieces || []) stopSticker(slot);
    activeTrail = null;
  }

  function launchSticker(trail, { from, to }) {
    const slot = trail.pieces[trail.index];
    trail.index = (trail.index + 1) % trail.pieces.length;
    stopSticker(slot);
    slot.element.style.zIndex = String(++trail.order);
    const pose = ({ x, y }, angle) => `translate3d(${x}px, ${y}px, 0) translate(-50%, -50%) rotate(${angle}deg)`;
    const travel = slot.element.animate([{ transform: pose(from, 20) }, { transform: pose(to, 0) }],
      { duration: 1000, easing: trailTravel, fill: "both" });
    // Scale the image in place: scaling the positioning wrapper would shift the stamped center.
    const shrink = slot.image.animate([{ transform: "scale(1)" }, { transform: "scale(.2)" }],
      { delay: 400, duration: 500, easing: trailShrink, fill: "both" });
    const fade = slot.element.animate([{ opacity: 1 }, { opacity: 0 }],
      { delay: 500, duration: 300, fill: "both" });
    const animations = slot.animations = [travel, shrink, fade];
    travel.onfinish = () => {
      if (slot.animations !== animations) return;
      stopSticker(slot);
      if (trail.pieces.every(piece => !piece.animations)) trail.order = 0;
    };
  }

  function paintTrail() {
    trailFrame = 0;
    const trail = activeTrail;
    if (!trail || !visible() || !trail.stage.isConnected || reduce.matches || !fine.matches) return;
    if (trail.pending) {
      const bounds = trail.layer.getBoundingClientRect();
      const { x, y } = trail.pending;
      trail.pending = null;
      if (x < bounds.left || x > bounds.right || y < bounds.top || y > bounds.bottom) { pauseTrail(); return; }
      trail.point = { x: x - bounds.left, y: y - bounds.top };
    }
    if (!trail.point) return;
    const { smooth, last, stamp } = trailFrameAt(trail.sample, trail.point);
    trail.sample = { smooth, last };
    if (stamp) launchSticker(trail, stamp);
    if (pointDistance(smooth, trail.point) > .1) trailFrame = requestAnimationFrame(paintTrail);
    else trail.sample.smooth = trail.point;
  }

  function queueTrail(event) {
    const stage = event.target.closest("[data-sticker-stage]");
    if (!stage) { pauseTrail(); return; }
    if (activeTrail?.stage !== stage) {
      resetTrail();
      const layer = stage.querySelector(".sticker-layer");
      const pieces = [...stage.querySelectorAll("[data-trail-sticker]")].map(element => ({
        element, image: element.querySelector("img"),
      })).filter(slot => slot.image);
      if (!layer || !pieces.length) return;
      activeTrail = { stage, layer, pieces, index: 0, order: 0, sample: null };
    }
    // Collapse all pointer events between frames into one latest coordinate. No press state / backfilling.
    activeTrail.pending = { x: event.clientX, y: event.clientY };
    if (!trailFrame) trailFrame = requestAnimationFrame(paintTrail);
  }

  function clearHover() {
    if (!hoverNode) return;
    for (const token of ["--lean-x", "--lean-y"]) hoverNode.style.removeProperty(token);
    hoverNode = null;
    hoverPoint = null;
  }

  function paintHover() {
    hoverFrame = 0;
    if (!hoverNode?.isConnected || !hoverPoint || reduce.matches || !fine.matches) return;
    const bounds = hoverNode.parentElement.getBoundingClientRect();
    const { x, y } = pointerAt(hoverPoint, bounds);
    hoverNode.style.setProperty("--lean-x", `${(-3 * y).toFixed(2)}deg`);
    hoverNode.style.setProperty("--lean-y", `${(4 * x).toFixed(2)}deg`);
  }

  nav.addEventListener("pointerover", event => {
    if (event.pointerType !== "mouse") return;
    navHover = event.target.closest("button[data-module]");
    scheduleNav();
  });
  nav.addEventListener("pointerleave", () => { navHover = null; scheduleNav(); });
  nav.addEventListener("focusin", scheduleNav);
  nav.addEventListener("focusout", scheduleNav);
  new MutationObserver(scheduleNav).observe(nav, { childList: true, subtree: true, attributes: true, attributeFilter: ["aria-current"] });
  if (typeof ResizeObserver === "function") {
    const resizer = new ResizeObserver(entries => {
      scheduleNav();
      invalidateScene();
      if (entries.some(entry => entry.target === header)) observeTitles();
    });
    resizer.observe(nav);
    resizer.observe(header);
  }
  document.fonts?.ready.then(() => { scheduleNav(); invalidateScene(); });

  dashboard.addEventListener("click", event => {
    const step = event.target.closest("[data-reel-to], .hero-cue");
    if (!step || dashboard.dataset.reelMode !== "sticky" || !scene.reel) return;
    const index = Number(step.dataset.reelTo ?? 0);
    const { top, span } = scene.bounds ??= measureScene(scrollY);
    event.preventDefault();
    window.scrollTo({ top: top + span * reelStops[index], behavior: "smooth" });
  });

  dashboard.addEventListener("pointermove", event => {
    if (reduce.matches || !fine.matches || event.pointerType !== "mouse") return;
    queueTrail(event);
    const next = event.target.closest("[data-tilt]");
    if (next !== hoverNode) { clearHover(); hoverNode = next; }
    if (!hoverNode) return;
    hoverPoint = { x: event.clientX, y: event.clientY };
    if (!hoverFrame) hoverFrame = requestAnimationFrame(paintHover);
  }, { passive: true });
  dashboard.addEventListener("pointerout", event => {
    if (hoverNode?.contains(event.target) && !hoverNode.contains(event.relatedTarget)) clearHover();
    if (activeTrail && !activeTrail.stage.contains(event.relatedTarget)) pauseTrail();
  });
  dashboard.addEventListener("pointerleave", () => { clearHover(); pauseTrail(); });
  new MutationObserver(watchScene).observe(dashboard, { childList: true, attributes: true, attributeFilter: ["class"] });

  // Never intercept the wheel or touchpad. Native scroll is the animation clock.
  window.addEventListener("scroll", () => { pauseTrail(); scheduleScene(); }, { passive: true });
  window.addEventListener("resize", () => { pauseTrail(); scheduleNav(); invalidateScene(); }, { passive: true });
  wide.addEventListener("change", invalidateScene);
  reduce.addEventListener("change", () => { slideAnimation?.cancel(); clearHover(); watchScene(); scheduleNav(); });
  fine.addEventListener("change", () => { clearHover(); resetTrail(); });
  scheduleNav();
  watchScene();
}

if (typeof document !== "undefined") setupCtrlMotion();
