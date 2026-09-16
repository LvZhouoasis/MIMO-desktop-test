import { chromium } from "playwright-core";

const url = "http://127.0.0.1:5188/";
const browser = await chromium.launch({
  headless: true,
  executablePath: "C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe",
  args: ["--use-gl=angle", "--use-angle=swiftshader", "--ignore-gpu-blocklist", "--enable-webgl"],
});
const page = await browser.newPage({ viewport: { width: 1280, height: 720 } });
const errors = [];
const logs = [];
page.on("pageerror", (e) => errors.push(String(e)));
page.on("console", (msg) => {
  logs.push(`[${msg.type()}] ${msg.text()}`);
  if (msg.type() === "error") errors.push(msg.text());
});

await page.goto(url, { waitUntil: "domcontentloaded", timeout: 30000 });
await page.waitForFunction(() => typeof window.__BLOCK_WORLD__ !== "undefined", null, { timeout: 15000 });

const started = await page.evaluate(() => {
  const t0 = performance.now();
  document.getElementById("btn-start").click();
  return performance.now() - t0;
});

await page.waitForFunction(() => window.__BLOCK_WORLD__ && window.__BLOCK_WORLD__.player, null, {
  timeout: 60000,
});
await page.waitForTimeout(2000);

const info = await page.evaluate(() => {
  const api = window.__BLOCK_WORLD__;
  const p = api.player;
  const w = api.world;
  const bx = Math.floor(p.pos.x);
  const by = Math.floor(p.pos.y) - 1;
  const bz = Math.floor(p.pos.z);
  const under = w.getBlock(bx, by, bz);
  const before = w.getBlock(bx + 2, by, bz);
  w.setBlock(bx + 2, by, bz, 0);
  const after = w.getBlock(bx + 2, by, bz);
  w.setBlock(bx + 2, by, bz, 3);
  const placed = w.getBlock(bx + 2, by, bz);
  return {
    pos: { x: +p.pos.x.toFixed(2), y: +p.pos.y.toFixed(2), z: +p.pos.z.toFixed(2) },
    chunks: w.chunks.size,
    under,
    dig: { before, after, placed },
    seed: api.seed(),
    startHidden: document.getElementById("start-screen").classList.contains("hidden"),
    canvas: {
      w: document.getElementById("game-canvas").width,
      h: document.getElementById("game-canvas").height,
    },
  };
});

// let streaming fill more
await page.waitForTimeout(3000);
const later = await page.evaluate(() => ({
  chunks: window.__BLOCK_WORLD__.world.chunks.size,
  pos: window.__BLOCK_WORLD__.player.pos,
}));

await page.screenshot({ path: "artifacts/game-smoke.png" });
console.log(JSON.stringify({ startedMs: Math.round(started), info, later, errors, logs: logs.slice(-15) }, null, 2));
await browser.close();
