/**
 * nape-js Examples Page — grid of interactive physics demos with play overlay,
 * per-card stats, search/tag filtering, size toggle, outline toggle, and View Code.
 */
import { VERSION } from "./nape-js.esm.js?v=3.15.5";
import { installErrorOverlay } from "./renderer.js?v=3.15.5";
import { DemoRunner } from "./demo-runner.js?v=3.15.5";
import { Canvas2DAdapter } from "./renderers/canvas2d-adapter.js?v=3.15.5";
import { ThreeJSAdapter, loadThree } from "./renderers/threejs-adapter.js?v=3.15.5";
import { PixiJSAdapter, loadPixi } from "./renderers/pixijs-adapter.js?v=3.15.5";
import { openInCodePen as _openInCodePen, getPreviewCode } from "./codepen-templates.js?v=3.15.5";

// All demos
import falling     from "./demos/falling.js?v=3.15.5";
import pyramid     from "./demos/pyramid.js?v=3.15.5";
import chain       from "./demos/chain.js?v=3.15.5";
import explosion   from "./demos/explosion.js?v=3.15.5";
import constraints from "./demos/constraints.js?v=3.15.5";
import gravity     from "./demos/gravity.js?v=3.15.5";
import stacking    from "./demos/stacking.js?v=3.15.5";
import ragdoll     from "./demos/ragdoll.js?v=3.15.5";
import strandbeast from "./demos/strandbeast.js?v=3.15.5";
import carSideview    from "./demos/car-sideview.js?v=3.15.5";
import carTopdown     from "./demos/car-topdown.js?v=3.15.5";
import platformer     from "./demos/platformer.js?v=3.15.5";
import ropeBridge     from "./demos/rope-bridge.js?v=3.15.5";
import wreckingBall   from "./demos/wrecking-ball.js?v=3.15.5";
import newtonsCradle  from "./demos/newtons-cradle.js?v=3.15.5";
import dominos        from "./demos/dominos.js?v=3.15.5";
import conveyorBelts  from "./demos/conveyor-belts.js?v=3.15.5";
import trebuchet      from "./demos/trebuchet.js?v=3.15.5";
import seesaw         from "./demos/seesaw.js?v=3.15.5";
import pinball        from "./demos/pinball.js?v=3.15.5";
import cloth          from "./demos/cloth.js?v=3.15.5";
import funnel         from "./demos/funnel.js?v=3.15.5";
import softBody       from "./demos/soft-body.js?v=3.15.5";
import oneWayPlatforms from "./demos/one-way-platforms.js?v=3.15.5";
import collisionFiltering from "./demos/collision-filtering.js?v=3.15.5";
import bodyFromGraphic    from "./demos/body-from-graphic.js?v=3.15.5";
import dropImageBody     from "./demos/drop-image-body.js?v=3.15.5";
import capsule           from "./demos/capsule.js?v=3.15.5";
import destructibleTerrain from "./demos/destructible-terrain.js?v=3.15.5";
import webWorker           from "./demos/web-worker.js?v=3.15.5";
import asteroidField       from "./demos/asteroid-field.js?v=3.15.5";
import fluidBuoyancy       from "./demos/fluid-buoyancy.js?v=3.15.5";

const ALL_DEMOS = [
  falling, pyramid, chain, explosion, constraints, gravity, stacking, ragdoll, strandbeast,
  carSideview, carTopdown, platformer, ropeBridge, wreckingBall, newtonsCradle,
  dominos, conveyorBelts, trebuchet, seesaw, pinball, cloth, funnel,
  softBody, oneWayPlatforms, collisionFiltering, bodyFromGraphic, dropImageBody, capsule,
  destructibleTerrain,
  webWorker,
  asteroidField,
  fluidBuoyancy,
];

const CW = 900;
const CH = 500;

// =========================================================================
// CodePen helper — uses shared codepen-templates.js
// =========================================================================

function openInCodePen(demo) {
  _openInCodePen(demo, "canvas2d");
}

// =========================================================================
// Card factory
// =========================================================================

let activeCardEntry = null;

function stopActiveDemo() {
  if (!activeCardEntry) return;
  const { runner, overlay, statsBar, card } = activeCardEntry;
  runner.stop();
  overlay.hidden = false;
  statsBar.hidden = true;
  card.classList.remove("running");
  activeCardEntry._started = false;
  activeCardEntry = null;
}

function createCard(demo, { onTagClick } = {}) {
  const card = document.createElement("div");
  card.className = "example-card";

  const renderWrap = document.createElement("div");
  renderWrap.className = "example-card-canvas";
  renderWrap.style.position = "relative";
  card.appendChild(renderWrap);

  // --- DemoRunner with adapters ---
  const runner = new DemoRunner(renderWrap, { W: CW, H: CH });
  runner.registerAdapter(new Canvas2DAdapter());
  // ThreeJS/PixiJS adapters are registered lazily on first use
  let threeRegistered = false;
  let pixiRegistered = false;

  const overlay = document.createElement("div");
  overlay.className = "play-overlay";
  overlay.innerHTML = `<div class="play-btn" aria-label="Play"></div>`;
  renderWrap.appendChild(overlay);

  const statsBar = document.createElement("div");
  statsBar.className = "card-stats";
  statsBar.hidden = true;
  const fpsEl    = document.createElement("span");
  const bodiesEl = document.createElement("span");
  const stepEl   = document.createElement("span");
  fpsEl.textContent    = "FPS: —";
  bodiesEl.textContent = "Bodies: —";
  stepEl.className = "card-stats-step";
  stepEl.textContent = "Step: —";
  statsBar.append(fpsEl, " · ", bodiesEl, " · ", stepEl);
  card.appendChild(statsBar);

  // --- Canvas overlay controls ---
  const canvasControls = document.createElement("div");
  canvasControls.className = "canvas-controls";

  // 2D/3D render mode toggle
  const renderToggle = document.createElement("div");
  renderToggle.className = "card-render-toggle";
  const btn2d = document.createElement("button");
  btn2d.className = "card-render-btn active";
  btn2d.dataset.mode = "2d";
  btn2d.textContent = "2D";
  const btn3d = document.createElement("button");
  btn3d.className = "card-render-btn";
  btn3d.dataset.mode = "3d";
  btn3d.textContent = "3D";
  const btnPixi = document.createElement("button");
  btnPixi.className = "card-render-btn";
  btnPixi.dataset.mode = "pixi";
  btnPixi.textContent = "PixiJS";
  renderToggle.append(btn2d, btn3d, btnPixi);

  let cardMode = "2d";
  const modeMap = { "2d": "canvas2d", "3d": "threejs", "pixi": "pixijs" };

  renderToggle.addEventListener("click", async (e) => {
    e.stopPropagation();
    const btn = e.target.closest(".card-render-btn");
    if (!btn || btn.dataset.mode === cardMode) return;
    const mode = btn.dataset.mode;
    const adapterId = modeMap[mode] ?? mode;

    if (adapterId === "threejs" && !threeRegistered) {
      await loadThree();
      runner.registerAdapter(new ThreeJSAdapter());
      threeRegistered = true;
    }
    if (adapterId === "pixijs" && !pixiRegistered) {
      await loadPixi();
      runner.registerAdapter(new PixiJSAdapter());
      pixiRegistered = true;
    }

    cardMode = mode;
    btn2d.classList.toggle("active", mode === "2d");
    btn3d.classList.toggle("active", mode === "3d");
    btnPixi.classList.toggle("active", mode === "pixi");
    await runner.setMode(adapterId);
    updateUrlForCard(demo.id, { mode: cardMode, outline: runner.debugDraw });
  });

  // Outline toggle
  const outlineToggleBtn = document.createElement("button");
  outlineToggleBtn.className = "canvas-outline-btn active";
  outlineToggleBtn.title = "Toggle outlines";
  outlineToggleBtn.innerHTML = `<svg width="13" height="13" viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round">
    <rect x="2" y="2" width="12" height="12" rx="2"/>
    <circle cx="8" cy="8" r="3"/>
  </svg>`;
  outlineToggleBtn.addEventListener("click", (e) => {
    e.stopPropagation();
    runner.debugDraw = !runner.debugDraw;
    outlineToggleBtn.classList.toggle("active", runner.debugDraw);
    updateUrlForCard(demo.id, { mode: cardMode, outline: runner.debugDraw });
  });

  // Reset button
  const resetBtn = document.createElement("button");
  resetBtn.className = "canvas-fs-btn canvas-reset-btn";
  resetBtn.title = "Reset demo";
  resetBtn.innerHTML = `<svg width="13" height="13" viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round">
    <path d="M2.5 8a5.5 5.5 0 1 1 1.1 3.3"/>
    <polyline points="2.5,3.5 2.5,8 7,8"/>
  </svg>`;
  resetBtn.addEventListener("click", async (e) => {
    e.stopPropagation();
    runner.stop();
    started = false;
    cardRef._started = false;
    await runner.renderPreviewAsync(demo);
    previewReady = true;
    await startDemo();
  });

  // Fullscreen button
  const fsBtn = document.createElement("button");
  fsBtn.className = "canvas-fs-btn";
  fsBtn.title = "Fullscreen";
  fsBtn.innerHTML = `<svg width="13" height="13" viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round">
    <polyline points="1,5 1,1 5,1"/><polyline points="15,5 15,1 11,1"/>
    <polyline points="1,11 1,15 5,15"/><polyline points="15,11 15,15 11,15"/>
  </svg>`;
  const ICON_EXPAND   = `<svg width="13" height="13" viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><polyline points="1,5 1,1 5,1"/><polyline points="15,5 15,1 11,1"/><polyline points="1,11 1,15 5,15"/><polyline points="15,11 15,15 11,15"/></svg>`;
  const ICON_COLLAPSE = `<svg width="13" height="13" viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><polyline points="5,1 1,1 1,5"/><polyline points="11,1 15,1 15,5"/><polyline points="1,11 1,15 5,15"/><polyline points="15,11 15,15 11,15"/></svg>`;

  let isExpanded = false;

  function setExpanded(expand) {
    isExpanded = expand;
    card.classList.toggle("expanded", expand);
    document.body.classList.toggle("has-expanded-demo", expand);
    fsBtn.title = expand ? "Exit fullscreen" : "Fullscreen";
    fsBtn.innerHTML = expand ? ICON_COLLAPSE : ICON_EXPAND;
    document.body.style.overflow = expand ? "hidden" : "";
  }

  fsBtn.addEventListener("click", (e) => {
    e.stopPropagation();
    setExpanded(!isExpanded);
  });

  document.addEventListener("keydown", (e) => {
    if (e.key === "Escape" && isExpanded) setExpanded(false);
  });

  // Worker toggle button (only for workerCompatible demos)
  const workerBtn = document.createElement("button");
  workerBtn.className = "canvas-fs-btn canvas-worker-btn";
  workerBtn.title = "Toggle Web Worker physics";
  workerBtn.innerHTML = `<svg width="13" height="13" viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round">
    <circle cx="8" cy="8" r="6"/>
    <path d="M8 4v4l3 2"/>
  </svg>`;
  workerBtn.style.display = demo.workerCompatible ? "" : "none";
  workerBtn.addEventListener("click", async (e) => {
    e.stopPropagation();
    const enable = !runner.workerMode;
    await runner.toggleWorker(enable);
    workerBtn.classList.toggle("active", runner.workerMode);
    workerBtn.title = runner.workerMode ? "Worker ON — click to disable" : "Toggle Web Worker physics";
  });

  canvasControls.append(renderToggle, outlineToggleBtn, workerBtn, resetBtn, fsBtn);
  renderWrap.appendChild(canvasControls);

  runner.wireStats({ fps: fpsEl, step: stepEl, bodies: bodiesEl });
  runner.wireInteraction(renderWrap);

  // --- Info section ---
  const info = document.createElement("div");
  info.className = "example-card-info";

  const titleRow = document.createElement("div");
  titleRow.className = "card-title-row";
  const h3 = document.createElement("h3");
  h3.textContent = demo.label;

  const btnGroup = document.createElement("div");
  btnGroup.className = "card-btn-group";

  const codeToggle = document.createElement("button");
  codeToggle.className = "btn btn-small code-toggle-btn";
  codeToggle.textContent = "{ } Code";

  const codePanel = document.createElement("pre");
  codePanel.className = "card-code-panel";
  codePanel.hidden = true;

  let rendered = false;
  codeToggle.addEventListener("click", async (e) => {
    e.stopPropagation();
    codePanel.hidden = !codePanel.hidden;
    if (!codePanel.hidden && !rendered) {
      rendered = true;
      const source = getPreviewCode(demo, "canvas2d") ?? await fetch(`./demos/${demo.id}.js`).then(r => r.text());
      const escaped = source.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
      codePanel.innerHTML = `<pre class="line-numbers"><code class="language-javascript">${escaped}</code></pre>`;
      Prism.highlightAllUnder(codePanel);
    }
  });

  btnGroup.appendChild(codeToggle);

  const codepenBtn = document.createElement("button");
  codepenBtn.className = "btn btn-small btn-codepen";
  codepenBtn.textContent = "CodePen";
  codepenBtn.addEventListener("click", (e) => {
    e.stopPropagation();
    openInCodePen(demo);
  });
  btnGroup.appendChild(codepenBtn);

  const shareBtn = document.createElement("button");
  shareBtn.className = "btn btn-small btn-share";
  shareBtn.title = "Copy link to this demo";
  shareBtn.innerHTML = `<svg width="13" height="13" viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round">
    <circle cx="13" cy="2.5" r="1.5"/><circle cx="13" cy="13.5" r="1.5"/><circle cx="3" cy="8" r="1.5"/>
    <line x1="11.5" y1="3.3" x2="4.4" y2="7.2"/><line x1="4.4" y1="8.8" x2="11.5" y2="12.7"/>
  </svg>`;
  shareBtn.addEventListener("click", (e) => {
    e.stopPropagation();
    const params = new URLSearchParams();
    params.set("open", demo.id);
    if (cardMode === "3d") params.set("mode", "3d");
    if (!runner.debugDraw) params.set("outline", "0");
    const url = window.location.origin + window.location.pathname + "?" + params.toString();
    navigator.clipboard.writeText(url).then(() => {
      const prev = shareBtn.innerHTML;
      shareBtn.textContent = "Copied!";
      shareBtn.classList.add("btn-share-copied");
      setTimeout(() => {
        shareBtn.innerHTML = prev;
        shareBtn.classList.remove("btn-share-copied");
      }, 1800);
    });
  });
  btnGroup.appendChild(shareBtn);

  titleRow.append(h3, btnGroup);
  info.appendChild(titleRow);

  const p = document.createElement("p");
  p.innerHTML = demo.desc ?? "";
  info.appendChild(p);

  if (demo.tags?.length) {
    const tagWrap = document.createElement("div");
    for (const t of demo.tags) {
      const span = document.createElement("span");
      span.className = "example-tag";
      span.textContent = t;
      span.addEventListener("click", (e) => {
        e.stopPropagation();
        onTagClick?.(t);
      });
      tagWrap.appendChild(span);
    }
    info.appendChild(tagWrap);
  }

  card.appendChild(info);
  card.appendChild(codePanel);

  // --- Preview ---
  let previewReady = false;
  runner.renderPreviewAsync(demo).then(() => { previewReady = true; });

  // --- Play ---
  let started = false;
  let loading = false;

  const cardRef = { runner, overlay, statsBar, card, _started: false };

  async function startDemo() {
    if (loading) return;
    if (activeCardEntry && activeCardEntry !== cardRef) stopActiveDemo();
    loading = true;
    if (!previewReady) {
      await runner.renderPreviewAsync(demo);
    } else {
      await runner.loadAsync(demo);
    }
    started = true;
    cardRef._started = true;
    loading = false;
    runner.start();
    overlay.hidden = true;
    statsBar.hidden = false;
    card.classList.add("running");
    activeCardEntry = cardRef;
  }

  overlay.addEventListener("pointerdown", (e) => e.stopPropagation());
  overlay.addEventListener("click", startDemo);

  return {
    card, runner, overlay, statsBar, cardRef,
    isStarted: () => started,
    startDemo,
    setExpanded,
    setMode: async (mode) => {
      const adapterId = modeMap[mode] ?? mode;
      if (adapterId === "threejs" && !threeRegistered) {
        await loadThree();
        runner.registerAdapter(new ThreeJSAdapter());
        threeRegistered = true;
      }
      if (adapterId === "pixijs" && !pixiRegistered) {
        await loadPixi();
        runner.registerAdapter(new PixiJSAdapter());
        pixiRegistered = true;
      }
      cardMode = mode;
      btn2d.classList.toggle("active", mode === "2d");
      btn3d.classList.toggle("active", mode === "3d");
      btnPixi.classList.toggle("active", mode === "pixi");
      await runner.setMode(adapterId);
      outlineToggleBtn.classList.toggle("active", runner.debugDraw);
    },
    setOutline: (val) => {
      runner.debugDraw = val;
      outlineToggleBtn.classList.toggle("active", val);
    },
  };
}

// =========================================================================
// URL deep-link helpers
// =========================================================================

function updateUrlForCard(demoId, { mode, outline } = {}) {
  const params = new URLSearchParams(window.location.search);
  if (demoId) {
    params.set("open", demoId);
    if (mode && mode !== "2d") params.set("mode", mode);
    else params.delete("mode");
    if (outline === false) params.set("outline", "0");
    else params.delete("outline");
  } else {
    params.delete("open");
    params.delete("mode");
    params.delete("outline");
  }
  const newUrl = window.location.pathname + (params.toString() ? "?" + params.toString() : "");
  history.replaceState(null, "", newUrl);
}

// =========================================================================
// Build grid + filtering
// =========================================================================

installErrorOverlay(VERSION);

const grid      = document.getElementById("examplesGrid");
const searchEl  = document.getElementById("searchInput");
const tagBar    = document.getElementById("tagFilterBar");
const tagToggle = document.getElementById("tagToggleBtn");
let tagsExpanded = false;

tagToggle.addEventListener("click", () => {
  tagsExpanded = !tagsExpanded;
  tagBar.classList.toggle("collapsed", !tagsExpanded);
  tagBar.classList.toggle("expanded", tagsExpanded);
  tagToggle.textContent = tagsExpanded ? "Tags ▴" : "Tags ▾";
});

const allTags = [...new Set(ALL_DEMOS.flatMap(d => d.tags ?? []))].sort();

let activeTag    = null;
let searchQuery  = "";

function buildTagBar() {
  tagBar.innerHTML = "";
  for (const tag of allTags) {
    const btn = document.createElement("button");
    btn.className = "filter-tag" + (activeTag === tag ? " active" : "");
    btn.textContent = tag;
    btn.addEventListener("click", () => setActiveTag(activeTag === tag ? null : tag));
    tagBar.appendChild(btn);
  }
  if (activeTag) {
    const clear = document.createElement("button");
    clear.className = "filter-tag filter-tag-clear";
    clear.textContent = "✕ Clear";
    clear.addEventListener("click", () => setActiveTag(null));
    tagBar.appendChild(clear);
  }
}

function setActiveTag(tag) {
  activeTag = tag;
  if (tag && !tagsExpanded) {
    tagsExpanded = true;
    tagBar.classList.remove("collapsed");
    tagBar.classList.add("expanded");
    tagToggle.textContent = "Tags ▴";
  }
  buildTagBar();
  applyFilter();
}

function applyFilter() {
  const q = searchQuery.toLowerCase().trim();
  let anyVisible = false;
  for (const { card, demo } of cardEntries) {
    const matchesSearch = !q
      || demo.label?.toLowerCase().includes(q)
      || demo.desc?.toLowerCase().includes(q)
      || demo.tags?.some(t => t.toLowerCase().includes(q));
    const matchesTag = !activeTag || demo.tags?.includes(activeTag);
    const visible = matchesSearch && matchesTag;
    card.style.display = visible ? "" : "none";
    if (visible) anyVisible = true;
  }

  let noResults = grid.querySelector(".no-results");
  if (!anyVisible) {
    if (!noResults) {
      noResults = document.createElement("div");
      noResults.className = "no-results";
      noResults.textContent = "No demos match your search.";
      grid.appendChild(noResults);
    }
    noResults.style.display = "";
  } else if (noResults) {
    noResults.style.display = "none";
  }
}

searchEl.addEventListener("input", () => {
  searchQuery = searchEl.value;
  applyFilter();
});

const cardEntries = [...ALL_DEMOS].reverse().map((demo) => {
  const result = createCard(demo, {
    onTagClick: (tag) => setActiveTag(activeTag === tag ? null : tag),
  });
  grid.appendChild(result.card);
  return { ...result, demo };
});

buildTagBar();

// =========================================================================
// Deep-link auto-start
// =========================================================================

(async () => {
  const urlParams = new URLSearchParams(window.location.search);
  const openId = urlParams.get("open");
  if (!openId) return;

  const entry = cardEntries.find(e => e.demo.id === openId);
  if (!entry) return;

  const urlMode    = urlParams.get("mode");
  const urlOutline = urlParams.get("outline");

  if (urlOutline === "0") entry.setOutline(false);
  if (urlMode === "3d") await entry.setMode("3d");

  entry.card.scrollIntoView({ behavior: "smooth", block: "center" });
  entry.setExpanded(true);
})();

// =========================================================================
// Grid size toggle
// =========================================================================

document.getElementById("gridSizeToggle").addEventListener("click", (e) => {
  const btn = e.target.closest(".grid-size-btn");
  if (!btn) return;
  const size = btn.dataset.size;
  document.querySelectorAll(".grid-size-btn").forEach(b => b.classList.toggle("active", b.dataset.size === size));
  grid.classList.toggle("size-small", size === "small");
  grid.classList.toggle("size-full",  size === "full");
});

// =========================================================================
// IntersectionObserver — pause/resume
// =========================================================================

const observer = new IntersectionObserver((entries) => {
  for (const entry of entries) {
    const match = cardEntries.find(c => c.card === entry.target);
    if (!match || !match.isStarted()) continue;
    if (activeCardEntry && activeCardEntry === match.cardRef) {
      if (entry.isIntersecting) {
        match.runner.start();
        match.overlay.hidden = true;
        match.statsBar.hidden = false;
      } else {
        match.runner.stop();
        match.overlay.hidden = false;
        match.statsBar.hidden = true;
      }
    }
  }
}, { threshold: 0.1 });

for (const { card } of cardEntries) observer.observe(card);
