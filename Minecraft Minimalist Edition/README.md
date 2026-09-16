# "Minecraft" Minimalist Edition（方块世界）

浏览器端体素沙盒游戏。无限程序化地形、挖掘/放置、合成与熔炉、昼夜循环、轻量动物、本地存档。  
美术为**原创 16×16 像素贴图**，风格致敬 Minecraft 品类，**不使用 Mojang/微软官方素材**。

---

## 快速游玩

### 方式一：单文件版（推荐分享）

文件：[`dist/block-world.html`](./dist/block-world.html)

- **双击即可玩**，无需安装 Node、无需服务器
- 可直接发送该 `.html` 给他人
- 也可上传到 GitHub Pages / Netlify Drop / Cloudflare Pages，生成网页链接在线玩

### 方式二：本地开发服务器

```powershell
cd "Minecraft" Minimalist Edition
npm start
# 浏览器打开 http://127.0.0.1:5173
```

进入页面后点 **「进入世界」**，再点击画面锁定鼠标。

### 重新打包单文件

```powershell
npm install
npm run pack
# 生成 dist/game.bundle.js 与 dist/block-world.html
```

---

## 操作说明（对齐 MC 习惯）

| 按键 | 作用 |
|------|------|
| WASD / 方向键 | 移动（跟随镜头方向） |
| 空格 | 跳跃 / 飞行上升 |
| **双击空格** | 创造模式飞行开关 |
| Ctrl | 疾走 |
| Shift | 潜行 / 飞行下降 |
| 鼠标 | 视角 |
| 左键 | 挖掘 |
| 右键 | 放置；对准工作台/熔炉则打开界面 |
| 1–9 / 滚轮 | 切换热键栏 |
| E | 物品栏 |
| Q | 丢弃当前热键格 1 个 |
| F1 | 显示/隐藏 HUD |
| F3 | 调试信息（FPS、坐标、群系等） |
| F5 | 第一/第三人称切换 |
| Esc | 暂停菜单（可继续/退出到标题） |
| C | 附近有工作台/熔炉时打开（快捷方式） |
| H | 帮助 |

---

## 功能特点

### 世界
- 无限程序化地形（16×16×96 区块，按需加载/卸载）
- 6 种生物群系：平原、森林、丘陵、沙漠、雪原、山地
- 树木、矿脉（煤/铁/金/钻石）、水面、3D 噪声洞穴
- 昼夜循环（天空色与光照变化）

### 玩法
- 第一人称移动、AABB 碰撞、跳跃、创造飞行
- 射线选取：挖掘 / 放置
- 约 30 种方块 + 工具材料
- 热键栏 9 格 + 物品栏
- 工作台合成：木板、木棍、火把、镐、熔炉等
- 熔炉烧炼：铁/金矿、沙→玻璃、圆石→石头
- 轻量动物：羊、猪、牛、鸡（走路摆腿、待机啄食、翅膀扇动）
- 本地存档（`localStorage` 自动保存）+ JSON 导出/导入

### 技术
| 模块 | 做法 |
|------|------|
| 渲染 | Three.js（本地 `vendor/`，无 CDN） |
| 网格 | 每区块合并 BufferGeometry（面剔除 + 顶点色） |
| 地形 | 多层 fBm 噪声 + 群系图 + 洞穴/矿脉 |
| 贴图 | Canvas 程序化 16×16 图集，Nearest 过滤 |
| 拾取 | DDA 体素射线 |
| 存档 | 只记玩家改动方块 + 玩家状态，世界由种子确定性生成 |

---

## 目录结构

```
"Minecraft" Minimalist Edition/
├── index.html              # 开发版入口（ES Module）
├── css/style.css
├── js/
│   ├── main.js
│   ├── core/input.js
│   ├── world/              # 噪声、方块、贴图、区块、网格、世界
│   ├── player/             # 玩家、射线
│   ├── ui/hud.js
│   └── systems/            # 合成、存档、动物、昼夜
├── vendor/three.module.js
├── dist/
│   ├── block-world.html    # 单文件版（双击可玩）
│   └── game.bundle.js
├── scripts/                # 静态服务、打包、测试
├── package.json
└── README.md
```

---

## 明确不做（本版范围）

联机、红石、下界/末地维度、复杂怪物战斗 AI、手机触控优先适配。

---

## 许可与声明

- 项目代码可自由学习与修改
- **请勿将本作宣传为 Minecraft 官方产品**
- 贴图与动物模型为原创程序化生成，非 Mojang 资源
