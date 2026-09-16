import fs from "node:fs";
import path from "node:path";

const root = path.resolve(path.dirname(new URL(import.meta.url).pathname.replace(/^\/([A-Za-z]:)/, "$1")), "..");
// Windows-safe root
const projectRoot = path.resolve(process.cwd());
const css = fs.readFileSync(path.join(projectRoot, "css/style.css"), "utf8");
const js = fs.readFileSync(path.join(projectRoot, "dist/game.bundle.js"), "utf8");
const body = fs.readFileSync(path.join(projectRoot, "index.html"), "utf8");

// extract body inner from index.html (between <body> and last script)
const bodyMatch = body.match(/<body>([\s\S]*)<\/body>/i);
let inner = bodyMatch ? bodyMatch[1] : body;
// strip module script tags
inner = inner
  .replace(/<script type="importmap">[\s\S]*?<\/script>/gi, "")
  .replace(/<script type="module"[^>]*><\/script>/gi, "")
  .replace(/<script type="module"[^>]*>[\s\S]*?<\/script>/gi, "");

// escape closing script in js just in case
const jsSafe = js.replace(/<\/script/gi, "<\\/script");

const html = `<!DOCTYPE html>
<html lang="zh-CN">
<head>
<meta charset="UTF-8" />
<meta name="viewport" content="width=device-width, initial-scale=1.0" />
<title>方块世界 · 单文件版</title>
<meta name="description" content="浏览器体素沙盒《方块世界》— 打开即玩" />
<style>
${css}
</style>
</head>
<body>
${inner.trim()}
<script>
${jsSafe}
</script>
</body>
</html>
`;

const out = path.join(projectRoot, "dist", "block-world.html");
fs.writeFileSync(out, html, "utf8");
console.log("wrote", out, fs.statSync(out).size, "bytes");
