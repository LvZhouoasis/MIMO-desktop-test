/** Procedural 16x16 pixel texture atlas. No external images. */

const TILE = 16;

const PALETTES = {
  grass_top: ["#5d9c3e", "#6aab48", "#4f8c34", "#78b852"],
  grass_side: ["#8b6a3d", "#7a5c34", "#6a9c40", "#5d9c3e", "#8b6a3d"],
  dirt: ["#8b6a3d", "#7a5c34", "#9a7648", "#6e5230"],
  stone: ["#7a7a7a", "#8a8a8a", "#6a6a6a", "#909090"],
  cobble: ["#6e6e6e", "#888888", "#5a5a5a", "#7a7a7a", "#999999"],
  sand: ["#e8dca8", "#f0e8b8", "#d8d090", "#f8f0c0"],
  gravel: ["#8a8070", "#6a6050", "#a09080", "#7a7060"],
  snow: ["#f0f4f8", "#e4eaf2", "#d8e0ea", "#ffffff"],
  ice: ["#a8d8f0", "#88c8e8", "#c0e8ff", "#90d0f0"],
  water: ["#3a6ec8", "#2a5eb8", "#4a7ed8", "#3060b0"],
  log_oak: ["#6b4a2a", "#5a3c22", "#7a5634", "#4e3420"],
  log_top: ["#b0895a", "#9a7548", "#c49a68", "#8a683c"],
  log_birch: ["#d8d0c0", "#c8c0b0", "#e8e0d0", "#b8b0a0"],
  log_top_birch: ["#c8c0a8", "#b0a888", "#d8d0b8", "#a09878"],
  leaves_oak: ["#3d7a28", "#4a8c30", "#2f6820", "#559a38"],
  leaves_birch: ["#6a9a40", "#78a848", "#5a8a38", "#88b850"],
  planks: ["#b8945a", "#a8844c", "#c8a468", "#9a7840"],
  craft_top: ["#a87848", "#987040", "#b88850", "#886838"],
  craft_side: ["#8a6838", "#7a5830", "#9a7840", "#6a4828"],
  furnace_top: ["#6a6a6a", "#7a7a7a", "#5a5a5a", "#888888"],
  furnace_side: ["#707070", "#606060", "#808080", "#555555"],
  furnace_front: ["#404040", "#505050", "#303030", "#606060"],
  torch: ["#c8a040", "#e8c060", "#a88030", "#6a4a20"],
  glass: ["#c8e8f8", "#d8f0ff", "#b8d8e8", "#e8f8ff"],
  bricks: ["#a85848", "#985040", "#b86050", "#884838"],
  coal_ore: ["#7a7a7a", "#2a2a2a", "#8a8a8a", "#1a1a1a"],
  iron_ore: ["#7a7a7a", "#c8a888", "#8a8a8a", "#b89878"],
  gold_ore: ["#7a7a7a", "#e8c848", "#8a8a8a", "#d0b038"],
  diamond_ore: ["#7a7a7a", "#48e8e0", "#8a8a8a", "#38d0c8"],
  bedrock: ["#2a2a2a", "#3a3a3a", "#1a1a1a", "#4a4a4a"],
  cactus: ["#3a7a30", "#2a6a20", "#4a8a40", "#509048"],
  stick: ["#8a6838", "#7a5830", "#a07840"],
  coal: ["#1a1a1a", "#2a2a2a", "#333333"],
  iron_ingot: ["#d0d0d0", "#b8b8b8", "#e8e8e8"],
  gold_ingot: ["#e8c848", "#d0b038", "#f0d860"],
  diamond: ["#48e8e0", "#30d0c8", "#70f0f0"],
  wood_pick: ["#8a6838", "#b8945a", "#6a4a20"],
  stone_pick: ["#7a7a7a", "#8a6838", "#6a6a6a"],
  iron_pick: ["#d0d0d0", "#8a6838", "#b8b8b8"],
  wood_sword: ["#b8945a", "#8a6838", "#6a4a20"],
};

function seededRand(seed) {
  let a = seed >>> 0;
  return () => {
    a |= 0;
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function paintTile(ctx, ox, oy, colors, seed, opts = {}) {
  const rand = seededRand(seed);
  const { holes = 0, checker = false, horizontalBands = false } = opts;
  for (let y = 0; y < TILE; y++) {
    for (let x = 0; x < TILE; x++) {
      if (holes > 0 && rand() < holes) {
        ctx.clearRect(ox + x, oy + y, 1, 1);
        continue;
      }
      let idx;
      if (checker) idx = ((x >> 2) + (y >> 2) + (rand() > 0.7 ? 1 : 0)) % colors.length;
      else if (horizontalBands) idx = Math.floor((y / TILE) * colors.length + rand() * 0.9) % colors.length;
      else idx = Math.floor(rand() * colors.length);
      ctx.fillStyle = colors[idx];
      ctx.fillRect(ox + x, oy + y, 1, 1);
    }
  }
}

function paintGrassSide(ctx, ox, oy) {
  const rand = seededRand(99);
  for (let y = 0; y < TILE; y++) {
    for (let x = 0; x < TILE; x++) {
      const dirt = ["#8b6a3d", "#7a5c34", "#9a7648"][(x + y * 3 + Math.floor(rand() * 3)) % 3];
      const grassDepth = 3 + Math.floor(rand() * 3);
      ctx.fillStyle = y < grassDepth ? ["#5d9c3e", "#6aab48", "#4f8c34"][(x + y) % 3] : dirt;
      ctx.fillRect(ox + x, oy + y, 1, 1);
    }
  }
}

function paintGlass(ctx, ox, oy) {
  ctx.clearRect(ox, oy, TILE, TILE);
  ctx.fillStyle = "rgba(200, 232, 248, 0.25)";
  ctx.fillRect(ox, oy, TILE, TILE);
  ctx.strokeStyle = "rgba(220, 240, 255, 0.85)";
  ctx.lineWidth = 1;
  ctx.strokeRect(ox + 0.5, oy + 0.5, TILE - 1, TILE - 1);
  ctx.fillStyle = "rgba(255,255,255,0.35)";
  ctx.fillRect(ox + 3, oy + 3, 2, 8);
}

function paintTorch(ctx, ox, oy) {
  ctx.clearRect(ox, oy, TILE, TILE);
  ctx.fillStyle = "#6a4a20";
  ctx.fillRect(ox + 7, oy + 6, 2, 8);
  ctx.fillStyle = "#e8c060";
  ctx.fillRect(ox + 6, oy + 3, 4, 4);
  ctx.fillStyle = "#fff0a0";
  ctx.fillRect(ox + 7, oy + 4, 2, 2);
}

function paintOre(ctx, ox, oy, base, ore, seed) {
  const rand = seededRand(seed);
  for (let y = 0; y < TILE; y++) {
    for (let x = 0; x < TILE; x++) {
      const r = rand();
      ctx.fillStyle = r > 0.78 ? ore : base[Math.floor(rand() * base.length)];
      ctx.fillRect(ox + x, oy + y, 1, 1);
    }
  }
}

function paintItem(ctx, ox, oy, colors, seed) {
  const rand = seededRand(seed);
  ctx.clearRect(ox, oy, TILE, TILE);
  // simple diamond/tool silhouette
  const c0 = colors[0];
  const c1 = colors[1] || colors[0];
  for (let y = 3; y < 13; y++) {
    for (let x = 3; x < 13; x++) {
      if (rand() > 0.35) {
        ctx.fillStyle = (x + y) % 3 === 0 ? c1 : c0;
        if (x === 3 || x === 12 || y === 3 || y === 12) ctx.fillStyle = c1;
        ctx.fillRect(ox + x, oy + y, 1, 1);
      }
    }
  }
}

export const TILE_NAMES = Object.keys(PALETTES);

export function createTextureAtlas() {
  const count = TILE_NAMES.length;
  const cols = 8;
  const rows = Math.ceil(count / cols);
  const canvas = document.createElement("canvas");
  canvas.width = cols * TILE;
  canvas.height = rows * TILE;
  const ctx = canvas.getContext("2d");
  ctx.imageSmoothingEnabled = false;

  const index = {};
  TILE_NAMES.forEach((name, i) => {
    const cx = i % cols;
    const cy = Math.floor(i / cols);
    const ox = cx * TILE;
    const oy = cy * TILE;
    index[name] = {
      i,
      u0: cx / cols,
      v0: 1 - (cy + 1) / rows,
      u1: (cx + 1) / cols,
      v1: 1 - cy / rows,
      ox,
      oy,
    };

    if (name === "grass_side") paintGrassSide(ctx, ox, oy);
    else if (name === "glass") paintGlass(ctx, ox, oy);
    else if (name === "torch") paintTorch(ctx, ox, oy);
    else if (name.endsWith("_ore")) {
      const base = ["#7a7a7a", "#8a8a8a", "#6a6a6a"];
      const ore = {
        coal_ore: "#1a1a1a",
        iron_ore: "#c8a888",
        gold_ore: "#e8c848",
        diamond_ore: "#48e8e0",
      }[name];
      paintOre(ctx, ox, oy, base, ore, name.length * 17);
    } else if (["stick", "coal", "iron_ingot", "gold_ingot", "diamond", "wood_pick", "stone_pick", "iron_pick", "wood_sword"].includes(name)) {
      paintItem(ctx, ox, oy, PALETTES[name], name.length * 31);
    } else {
      const opts = {};
      if (name.startsWith("leaves")) opts.holes = 0.12;
      if (name === "bricks" || name === "planks") opts.checker = true;
      if (name.startsWith("log") && !name.includes("top")) opts.horizontalBands = true;
      paintTile(ctx, ox, oy, PALETTES[name], name.length * 13 + 7, opts);
    }
  });

  return { canvas, index, cols, rows, tile: TILE };
}

/** Draw a single block icon into a small canvas for HUD. */
export function drawBlockIcon(canvas, tileName, atlas) {
  const t = atlas.index[tileName] || atlas.index.stone;
  const size = canvas.width;
  const ctx = canvas.getContext("2d");
  ctx.imageSmoothingEnabled = false;
  ctx.clearRect(0, 0, size, size);
  ctx.drawImage(
    atlas.canvas,
    t.ox,
    t.oy,
    atlas.tile,
    atlas.tile,
    0,
    0,
    size,
    size
  );
}
