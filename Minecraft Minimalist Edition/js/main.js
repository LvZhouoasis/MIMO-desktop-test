import * as THREE from "three";
import { Input } from "./core/input.js";
import { createTextureAtlas } from "./world/textures.js";
import { B, BlockDefs, isPlaceable, blockName } from "./world/blocks.js";
import { World } from "./world/world.js";
import { Player } from "./player/player.js";
import { raycastVoxel } from "./player/raycast.js";
import { HUD } from "./ui/hud.js";
import { DayNight } from "./systems/sky.js";
import { Mobs } from "./systems/mobs.js";
import { nearBlock, doCraft, RECIPES } from "./systems/craft.js";
import {
  saveGame,
  loadGame,
  clearSave,
  exportSave,
  importSave,
} from "./systems/save.js";

// ---------- audio (tiny synth) ----------
const AudioFX = {
  ctx: null,
  volume: 0.4,
  ensure() {
    if (!this.ctx) this.ctx = new (window.AudioContext || window.webkitAudioContext)();
    if (this.ctx.state === "suspended") this.ctx.resume();
    return this.ctx;
  },
  blip(freq, dur, type = "square") {
    try {
      const ctx = this.ensure();
      const o = ctx.createOscillator();
      const g = ctx.createGain();
      o.type = type;
      o.frequency.value = freq;
      g.gain.value = this.volume * 0.15;
      g.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + dur);
      o.connect(g).connect(ctx.destination);
      o.start();
      o.stop(ctx.currentTime + dur);
    } catch {
      /* ignore */
    }
  },
  break() { this.blip(180, 0.08, "triangle"); },
  place() { this.blip(320, 0.06, "square"); },
  craft() { this.blip(520, 0.1, "sine"); },
};

// ---------- app ----------
const canvas = document.getElementById("game-canvas");
const startScreen = document.getElementById("start-screen");
const deathScreen = document.getElementById("death-screen");
const hudRoot = document.getElementById("hud");

const renderer = new THREE.WebGLRenderer({
  canvas,
  antialias: false,
  powerPreference: "high-performance",
});
renderer.setPixelRatio(Math.min(window.devicePixelRatio, 1.5));
renderer.setSize(window.innerWidth, window.innerHeight);
renderer.outputColorSpace = THREE.SRGBColorSpace;

const scene = new THREE.Scene();
scene.fog = new THREE.Fog(0x87b7e8, 40, 140);
const camera = new THREE.PerspectiveCamera(75, window.innerWidth / window.innerHeight, 0.12, 400);

const atlas = createTextureAtlas();
const atlasTex = new THREE.CanvasTexture(atlas.canvas);
atlasTex.magFilter = THREE.NearestFilter;
atlasTex.minFilter = THREE.NearestFilter;
atlasTex.generateMipmaps = false;
atlasTex.colorSpace = THREE.SRGBColorSpace;

const materials = {
  solid: new THREE.MeshLambertMaterial({
    map: atlasTex,
    vertexColors: true,
    side: THREE.FrontSide,
    transparent: false,
    depthWrite: true,
    depthTest: true,
  }),
  cutout: new THREE.MeshLambertMaterial({
    map: atlasTex,
    vertexColors: true,
    side: THREE.FrontSide,
    alphaTest: 0.5,
    transparent: false,
    depthWrite: true,
    depthTest: true,
  }),
  water: new THREE.MeshLambertMaterial({
    map: atlasTex,
    vertexColors: true,
    side: THREE.DoubleSide,
    transparent: true,
    opacity: 0.72,
    depthWrite: false,
    depthTest: true,
  }),
};

const input = new Input(canvas);
const hud = new HUD(atlas);
const dayNight = new DayNight(scene);

let world = null;
let player = null;
let mobs = null;
let seed = 1;
let running = false;
let paused = true;
let saveTimer = 0;
let fps = 60;
let frames = 0;
let fpsTimer = 0;
let highlight = null;

function makeHighlight() {
  // Edge-only outline — no filled wireframe quads that flood the view
  const edges = new THREE.EdgesGeometry(new THREE.BoxGeometry(1.01, 1.01, 1.01));
  const mat = new THREE.LineBasicMaterial({
    color: 0x000000,
    transparent: true,
    opacity: 0.85,
    depthTest: true,
  });
  const m = new THREE.LineSegments(edges, mat);
  m.visible = false;
  m.renderOrder = 2;
  scene.add(m);
  return m;
}

function newWorld(newSeed) {
  seed = newSeed;
  // dispose old
  if (world) {
    for (const chunk of world.chunks.values()) {
      if (chunk.mesh) {
        chunk.mesh.geometry.dispose();
        scene.remove(chunk.mesh);
      }
      if (chunk.cutoutMesh) {
        chunk.cutoutMesh.geometry.dispose();
        scene.remove(chunk.cutoutMesh);
      }
      if (chunk.waterMesh) {
        chunk.waterMesh.geometry.dispose();
        scene.remove(chunk.waterMesh);
      }
    }
  }
  if (mobs) {
    scene.remove(mobs.group);
  }
  world = new World(scene, atlas, materials, seed);
  world.renderDistance = Number(document.getElementById("set-distance").value) || 8;
  player = new Player(world, camera);
  // default hotbar
  player.hotbar = [
    { id: B.GRASS, count: 64 },
    { id: B.DIRT, count: 64 },
    { id: B.STONE, count: 64 },
    { id: B.PLANKS, count: 64 },
    { id: B.LOG_OAK, count: 64 },
    { id: B.CRAFTING_TABLE, count: 16 },
    { id: B.FURNACE, count: 16 },
    { id: B.GLASS, count: 64 },
    { id: B.TORCH, count: 64 },
  ];
  player.addItem(B.PLANKS, 16);
  player.addItem(B.STICK, 8);
  const spawn = world.findSpawn();
  player.spawnAt(spawn);
  world.warmup(player.pos);
  mobs = new Mobs(scene, world);
  if (!highlight) highlight = makeHighlight();
  highlight.visible = false;
}

function loadIntoWorld(data) {
  if (!data) return;
  if (typeof data.seed === "number") newWorld(data.seed);
  if (data.mods) world.applyMods(data.mods);
  if (data.pos) player.spawnAt(data.pos);
  if (data.yaw != null) player.yaw = data.yaw;
  if (data.pitch != null) player.pitch = data.pitch;
  if (data.flying != null) player.flying = data.flying;
  if (data.health != null) player.health = data.health;
  if (data.hotbar) {
    player.hotbar = data.hotbar.map((s) => (s && s.id != null ? s : { id: B.GRASS, count: 64 }));
  }
  if (data.selected != null) player.selected = data.selected;
  if (data.inventory) {
    player.inventory = new Map(Object.entries(data.inventory).map(([k, v]) => [Number(k), v]));
  }
  world.warmup(player.pos);
}

function collectSave() {
  return {
    seed,
    pos: { ...player.pos },
    yaw: player.yaw,
    pitch: player.pitch,
    flying: player.flying,
    health: player.health,
    hotbar: player.hotbar,
    selected: player.selected,
    inventory: Object.fromEntries(player.inventory),
    mods: world.exportMods(),
    time: dayNight.time,
  };
}

function doSave() {
  const ok = saveGame(collectSave());
  if (ok) hud.showBlockName("已保存");
  return ok;
}

// ---------- start flow ----------
document.getElementById("btn-start").addEventListener("click", () => {
  const seedInput = document.getElementById("world-seed").value.trim();
  const existing = loadGame();
  if (!seedInput && existing) {
    loadIntoWorld(existing);
    dayNight.time = existing.time ?? 0.3;
  } else {
    const s = seedInput ? hashSeed(seedInput) : (Math.random() * 1e9) | 0;
    if (existing && String(existing.seed) === String(s)) {
      loadIntoWorld(existing);
      dayNight.time = existing.time ?? 0.3;
    } else {
      newWorld(s);
      dayNight.time = 0.3;
    }
  }
  startScreen.classList.add("hidden");
  deathScreen.classList.add("hidden");
  hudRoot.classList.remove("hidden");
  running = true;
  paused = false;
  input.enabled = true;
  hud.renderHotbar(player);
  AudioFX.ensure();
  input.requestLock();
});

document.getElementById("btn-respawn").addEventListener("click", () => {
  player.respawn(world.findSpawn());
  deathScreen.classList.add("hidden");
  paused = false;
  input.enabled = true;
  input.requestLock();
});

function hashSeed(str) {
  let h = 2166136261;
  for (let i = 0; i < str.length; i++) {
    h ^= str.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return h | 0;
}

// ---------- UI panels ----------
document.getElementById("btn-close-settings").addEventListener("click", () => resumeGame());
document.getElementById("btn-resume").addEventListener("click", () => resumeGame());
document.getElementById("btn-exit").addEventListener("click", () => exitToTitle());
document.getElementById("btn-close-help").addEventListener("click", () => resumeGame());
document.getElementById("btn-save").addEventListener("click", () => doSave());
document.getElementById("btn-export").addEventListener("click", () => exportSave(collectSave()));
document.getElementById("btn-import").addEventListener("click", () => {
  document.getElementById("import-file").click();
});
document.getElementById("import-file").addEventListener("change", async (e) => {
  const f = e.target.files?.[0];
  if (!f) return;
  try {
    const data = await importSave(f);
    loadIntoWorld(data);
    if (data.time != null) dayNight.time = data.time;
    hud.showBlockName("导入成功");
  } catch {
    hud.showBlockName("导入失败");
  }
  e.target.value = "";
  resumeGame();
});
document.getElementById("btn-reset").addEventListener("click", () => {
  if (!confirm("确定删除存档并生成新世界？")) return;
  clearSave();
  const s = (Math.random() * 1e9) | 0;
  newWorld(s);
  dayNight.time = 0.3;
  hud.showBlockName("新世界");
  resumeGame();
});

function openPauseMenu() {
  if (!running) return;
  paused = true;
  input.exitLock();
  hud.closeAllPanels();
  hud.settingsPanel.classList.remove("hidden");
  input.enabled = false;
  if (highlight) highlight.visible = false;
}

function resumeGame() {
  if (!running) return;
  hud.closeAllPanels();
  paused = false;
  input.enabled = true;
  input.requestLock();
}

function exitToTitle() {
  if (running) doSave();
  running = false;
  paused = true;
  input.exitLock();
  input.enabled = false;
  hud.closeAllPanels();
  hudRoot.classList.add("hidden");
  deathScreen.classList.add("hidden");
  startScreen.classList.remove("hidden");
  if (highlight) highlight.visible = false;
}

// Browser always unlocks on Esc — treat unlock as pause menu
document.addEventListener("pointerlockchange", () => {
  if (!running) return;
  const dead = !deathScreen.classList.contains("hidden");
  if (dead) return;
  if (!input.locked && !hud.isAnyPanelOpen()) {
    openPauseMenu();
  }
});

document.getElementById("set-sens").addEventListener("input", (e) => {
  input.sensitivity = Number(e.target.value);
});
document.getElementById("set-distance").addEventListener("input", (e) => {
  if (world) world.renderDistance = Number(e.target.value);
  const far = Number(e.target.value) * 16;
  scene.fog.far = far + 40;
  scene.fog.near = Math.max(20, far * 0.35);
});
document.getElementById("set-volume").addEventListener("input", (e) => {
  AudioFX.volume = Number(e.target.value);
});
document.getElementById("set-fov").addEventListener("input", (e) => {
  camera.fov = Number(e.target.value);
  camera.updateProjectionMatrix();
});

function openCraftPanel() {
  if (hud.togglePanel(hud.craftPanel)) {
    input.exitLock();
    paused = true;
    const refreshC = (recipe) => {
      if (recipe && doCraft(player, recipe)) {
        AudioFX.craft();
        hud.showBlockName(`合成 ${BlockDefs[recipe.out].name}`);
        hud.renderHotbar(player);
      }
      hud.renderCraft(player, refreshC);
    };
    refreshC();
  } else resumeGame();
}

function openFurnacePanel() {
  if (hud.togglePanel(hud.furnacePanel)) {
    input.exitLock();
    paused = true;
    const refreshF = () => hud.renderFurnace(player, refreshF);
    refreshF();
  } else resumeGame();
}

// ---------- gameplay keys (MC-aligned) ----------
window.addEventListener("keydown", (e) => {
  if (
    e.code === "ArrowUp" ||
    e.code === "ArrowDown" ||
    e.code === "ArrowLeft" ||
    e.code === "ArrowRight" ||
    e.code === "ControlLeft" ||
    e.code === "ControlRight"
  ) {
    if (running && !hud.isAnyPanelOpen()) e.preventDefault();
  }
  if (!running) return;

  if (e.code === "Escape") {
    if (hud.isAnyPanelOpen()) {
      e.preventDefault();
      resumeGame();
      return;
    }
    if (!input.locked) openPauseMenu();
    return;
  }

  // F1 hide HUD
  if (e.code === "F1") {
    e.preventDefault();
    hudRoot.classList.toggle("hidden");
    return;
  }
  // F3 debug panel
  if (e.code === "F3") {
    e.preventDefault();
    hud.debugEl.classList.toggle("hidden");
    return;
  }
  // F5 third person (first → third → back)
  if (e.code === "F5") {
    e.preventDefault();
    if (!paused && player) {
      player.thirdPerson = !player.thirdPerson;
      player.syncCamera(player.thirdPerson);
      hud.showBlockName(player.thirdPerson ? "第三人称" : "第一人称");
    }
    return;
  }

  if (e.code === "KeyE") {
    if (paused) return;
    if (hud.togglePanel(hud.invPanel)) {
      input.exitLock();
      paused = true;
      hud.renderInventory(player, (id) => {
        player.hotbar[player.selected] = { id, count: player.inventory.get(id) || (BlockDefs[id]?.item ? 1 : 64) };
        if (!player.inventory.has(id) && !BlockDefs[id]?.item) {
          player.hotbar[player.selected].count = 64;
        }
        hud.renderHotbar(player);
        hud.showBlockName(blockName(id));
      });
    } else {
      resumeGame();
    }
  }
  // Q drop selected stack (MC)
  if (e.code === "KeyQ" && !paused) {
    const slot = player.hotbar[player.selected];
    if (slot && slot.id != null) {
      const name = blockName(slot.id);
      if (player.countItem(slot.id) > 0) player.removeItem(slot.id, 1);
      slot.count = Math.max(0, (slot.count || 0) - 1);
      if (slot.count <= 0) player.hotbar[player.selected] = { id: B.GRASS, count: 0 };
      hud.renderHotbar(player);
      hud.showBlockName(`丢弃 ${name}`);
    }
  }
  if (e.code === "KeyH") {
    if (hud.togglePanel(hud.helpPanel)) {
      input.exitLock();
      paused = true;
    } else resumeGame();
  }
  // C still opens nearby station (bonus); primary is right-click like MC
  if (e.code === "KeyC" && !paused) {
    if (nearBlock(world, player, B.FURNACE, 4.5)) openFurnacePanel();
    else if (nearBlock(world, player, B.CRAFTING_TABLE, 4.5)) openCraftPanel();
    else hud.showBlockName("附近没有工作台/熔炉");
  }
  if (/^Digit[1-9]$/.test(e.code) && !paused) {
    player.selected = Number(e.code.slice(5)) - 1;
    hud.renderHotbar(player);
    const id = player.selectedBlock;
    if (id) hud.showBlockName(blockName(id));
  }
});

// hotbar click
document.getElementById("hotbar").addEventListener("click", (e) => {
  const slot = e.target.closest(".slot");
  if (!slot) return;
  player.selected = Number(slot.dataset.index);
  hud.renderHotbar(player);
});

// ---------- resize ----------
window.addEventListener("resize", () => {
  camera.aspect = window.innerWidth / window.innerHeight;
  camera.updateProjectionMatrix();
  renderer.setSize(window.innerWidth, window.innerHeight);
});

// ---------- interaction ----------
function tryBreak() {
  const eye = player.eyePos;
  const dir = player.lookDir();
  const hit = raycastVoxel(world, eye, dir, player.reach);
  if (!hit) return;
  const def = BlockDefs[hit.id];
  if (!def || def.unbreakable) {
    hud.showBlockName("无法破坏");
    return;
  }
  world.setBlock(hit.x, hit.y, hit.z, B.AIR);
  const drop = def.drop;
  if (drop && drop !== B.AIR) {
    player.addItem(drop, 1);
    // auto-fill matching hotbar count if selected has same id
    const sel = player.hotbar[player.selected];
    if (sel && sel.id === drop) sel.count = player.countItem(drop);
  }
  hud.renderHotbar(player);
  AudioFX.break();
}

function tryPlace() {
  const eye = player.eyePos;
  const dir = player.lookDir();
  const hit = raycastVoxel(world, eye, dir, player.reach);
  if (!hit) return;
  // MC-style: right-click station blocks opens UI instead of placing
  if (hit.id === B.CRAFTING_TABLE) {
    openCraftPanel();
    return;
  }
  if (hit.id === B.FURNACE) {
    openFurnacePanel();
    return;
  }
  const px = hit.x + hit.nx;
  const py = hit.y + hit.ny;
  const pz = hit.z + hit.nz;
  const id = player.selectedBlock;
  if (!isPlaceable(id)) return;
  if (player.intersectsBlock(px, py, pz) && BlockDefs[id]?.solid) return;
  const existing = world.getBlock(px, py, pz);
  if (existing !== B.AIR && existing !== B.WATER) return;
  world.setBlock(px, py, pz, id);
  hud.renderHotbar(player);
  AudioFX.place();
}

// ---------- main loop ----------
const clock = new THREE.Clock();
const FOG_BASE_NEAR = 30;
const FOG_BASE_FAR = 150;
scene.fog.near = FOG_BASE_NEAR;
scene.fog.far = FOG_BASE_FAR;

function animate() {
  requestAnimationFrame(animate);
  const dt = Math.min(clock.getDelta(), 0.05);

  if (running && !paused && player && world) {
    // look
    const { dx, dy } = input.consumeLook();
    player.applyLook(dx, dy);

    // double-tap Space toggles creative fly (MC)
    if (input.consumeDoubleSpace()) {
      player.flying = !player.flying;
      player.vel.y = 0;
      hud.showBlockName(player.flying ? "飞行：开（双击空格切换）" : "飞行：关");
    }

    // hotbar wheel
    const w = input.consumeWheel();
    if (w) {
      player.selected = (player.selected + w + 9) % 9;
      hud.renderHotbar(player);
      hud.showBlockName(blockName(player.selectedBlock));
    }

    // physics
    player.update(dt, input);

    // world streaming (heavier when needed)
    world.update(player.pos, 3, 4);

    // interact
    const { left, right } = input.consumePressed();
    if (left && input.locked && !hud.isAnyPanelOpen()) tryBreak();
    if (right && input.locked && !hud.isAnyPanelOpen()) tryPlace();

    // highlight target (edges only; hide if too close / inside player / paused)
    const eye = player.eyePos;
    const dir = player.lookDir();
    const hit = raycastVoxel(world, eye, dir, player.reach);
    if (hit && highlight) {
      const insidePlayer = player.intersectsBlock(hit.x, hit.y, hit.z);
      if (!insidePlayer && hit.dist > 0.85) {
        highlight.visible = true;
        highlight.position.set(hit.x + 0.5, hit.y + 0.5, hit.z + 0.5);
      } else {
        highlight.visible = false;
      }
    } else if (highlight) {
      highlight.visible = false;
    }

    dayNight.update(dt);
    mobs.update(dt, player.pos);

    // death
    if (player.health <= 0) {
      paused = true;
      input.exitLock();
      hud.closeAllPanels();
      deathScreen.classList.remove("hidden");
    }

    // autosave
    saveTimer += dt;
    if (saveTimer > 15) {
      saveTimer = 0;
      doSave();
    }

    // debug
    frames++;
    fpsTimer += dt;
    if (fpsTimer >= 0.5) {
      fps = Math.round(frames / fpsTimer);
      frames = 0;
      fpsTimer = 0;
      const bi = world.biomeAt(Math.floor(player.pos.x), Math.floor(player.pos.z));
      const biomeNames = ["平原", "森林", "丘陵", "沙漠", "雪原", "山地"];
      const mode = player.flying ? "飞行" : player.sprinting ? "疾走" : player.sneaking ? "潜行" : "步行";
      hud.setDebug(
        `FPS ${fps}\nXYZ ${player.pos.x.toFixed(1)} / ${player.pos.y.toFixed(1)} / ${player.pos.z.toFixed(1)}\n` +
          `群系 ${biomeNames[bi] || bi}  区块 ${world.chunks.size}\n` +
          `时间 ${dayNight.clockLabel()}  ${mode}\n` +
          `视角 ${player.thirdPerson ? "第三人称" : "第一人称"}  种子 ${seed}`
      );
    }
  }

  hud.updateNameFade(dt);
  renderer.render(scene, camera);
}

animate();

// click to re-lock / resume when no modal is up
canvas.addEventListener("click", () => {
  if (!running) return;
  if (deathScreen.classList.contains("hidden") === false) return;
  if (hud.isAnyPanelOpen()) return;
  paused = false;
  input.enabled = true;
  input.requestLock();
});

// expose debug hooks
window.__BLOCK_WORLD__ = {
  get player() { return player; },
  get world() { return world; },
  setPausedForScreenshot(v) { paused = v; },
  seed() { return seed; },
};

console.log("方块世界 ready. Click 开始进入世界.");
