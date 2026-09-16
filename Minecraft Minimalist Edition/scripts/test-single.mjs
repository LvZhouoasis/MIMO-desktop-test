import { chromium } from "playwright-core";
import path from "node:path";
import { pathToFileURL } from "node:url";

const projectRoot = process.cwd();
const htmlPath = path.join(projectRoot, "dist", "block-world.html");
const url = pathToFileURL(htmlPath).href;

const browser = await chromium.launch({
  headless: true,
  executablePath: "C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe",
  args: ["--no-sandbox", "--use-angle=swiftshader", "--allow-file-access-from-files"],
});
const page = await browser.newPage({ viewport: { width: 960, height: 600 } });
const errs = [];
page.on("pageerror", (e) => errs.push(String(e)));
page.on("console", (m) => {
  if (m.type() === "error") errs.push(m.text());
});

await page.goto(url, { waitUntil: "load", timeout: 30000 });
await page.waitForTimeout(1000);
const title = await page.title();
const hasBtn = await page.locator("#btn-start").count();
await page.evaluate(() => document.getElementById("btn-start").click());
await page.waitForTimeout(3000);
const info = await page.evaluate(() => {
  const api = window.__BLOCK_WORLD__;
  return {
    ok: !!(api && api.player),
    chunks: api && api.world ? api.world.chunks.size : -1,
    y: api && api.player ? api.player.pos.y : null,
    startHidden: document.getElementById("start-screen").classList.contains("hidden"),
  };
});
await page.screenshot({ path: path.join(projectRoot, "artifacts", "single-file.png") });
console.log(JSON.stringify({ title, hasBtn, info, errs }, null, 2));
await browser.close();
