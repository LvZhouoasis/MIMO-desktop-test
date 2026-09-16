# Minecraft Minimalist Edition（方块世界）

浏览器体素沙盒：无限地形、挖/放方块、合成熔炉、昼夜、动物、本地存档。原创像素贴图，非 Mojang 素材。

---

## 启动：Netlify Drop（推荐）

1. 下载本目录下的 **`dist/block-world.html`**  
   - 仓库里：`Minecraft Minimalist Edition/dist/block-world.html`
2. 打开 **https://app.netlify.com/drop**
3. 把 `block-world.html` **拖进页面虚线区域**（或点选择文件上传）
4. 等几秒，页面给出站点链接，形如 `https://随机名.netlify.app`
5. 用浏览器打开该链接 → 点「进入世界」→ 点击画面锁定鼠标

**注意**
- 文件名必须是 `index.html` 才能当站点首页；若上传后打不开，把 `block-world.html` **改名为 `index.html`** 再拖一次
- 免费账号可登录后管理站点、自定义子域名
- 改代码后重新拖一次同名文件即可更新

### 本机双击（备用）

直接双击 `dist/block-world.html` 也能玩，无需服务器。

### 本地开发（备用）

```powershell
npm start
# 打开 http://127.0.0.1:5173
```

---

## 键位

| 键 | 功能 |
|----|------|
| WASD / 方向键 | 移动 |
| 空格 | 跳 / 飞行上升 |
| 双击空格 | 飞行开关 |
| Ctrl | 疾走 |
| Shift | 潜行 / 飞行下降 |
| 左键 / 右键 | 挖 / 放（右键工作台·熔炉可打开） |
| 1–9 / 滚轮 | 热键栏 |
| E / Q | 物品栏 / 丢一个 |
| F1 / F3 / F5 | 隐藏UI / 调试 / 第三人称 |
| Esc | 暂停菜单 |

---

## 内容

- 6 群系、矿洞、树木、矿石、水
- ~30 种方块；工作台合成、熔炉烧炼
- 羊/猪/牛/鸡行走动画
- 存档：自动 localStorage，可导出/导入 JSON

## 重新打包

```powershell
npm install
npm run pack
```
