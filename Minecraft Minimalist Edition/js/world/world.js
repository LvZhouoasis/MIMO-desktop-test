import * as THREE from "three";
import { B } from "./blocks.js";
import { Chunk, CHUNK_SIZE, WORLD_HEIGHT } from "./chunk.js";
import { fbm2, noise2, noise3, mulberry32 } from "./noise.js";
import { buildChunkMesh, disposeChunkMeshes } from "./mesher.js";

export const BIOME = {
  PLAINS: 0,
  FOREST: 1,
  HILLS: 2,
  DESERT: 3,
  SNOW: 4,
  MOUNTAIN: 5,
};

export const BIOME_NAME = {
  [BIOME.PLAINS]: "平原",
  [BIOME.FOREST]: "森林",
  [BIOME.HILLS]: "丘陵",
  [BIOME.DESERT]: "沙漠",
  [BIOME.SNOW]: "雪原",
  [BIOME.MOUNTAIN]: "山地",
};

const SEA_LEVEL = 32;

export class World {
  constructor(scene, atlas, materials, seed = 1337) {
    this.scene = scene;
    this.atlas = atlas;
    this.materials = materials;
    this.seed = seed | 0;
    this.chunks = new Map();
    this.mods = new Map(); // "x,y,z" -> id
    this.renderDistance = 8;
    this.meshQueue = [];
    this.genQueue = [];
    this.mobSpawns = [];
  }

  chunkKey(cx, cz) {
    return `${cx},${cz}`;
  }

  getChunk(cx, cz) {
    return this.chunks.get(this.chunkKey(cx, cz)) || null;
  }

  getBlock(x, y, z) {
    if (y < 0) return B.BEDROCK;
    if (y >= WORLD_HEIGHT) return B.AIR;
    const cx = Math.floor(x / CHUNK_SIZE);
    const cz = Math.floor(z / CHUNK_SIZE);
    const chunk = this.getChunk(cx, cz);
    if (!chunk || !chunk.generated) return B.AIR;
    const lx = x - cx * CHUNK_SIZE;
    const lz = z - cz * CHUNK_SIZE;
    return chunk.get(lx, y, lz);
  }

  setBlock(x, y, z, id, recordMod = true) {
    if (y < 0 || y >= WORLD_HEIGHT) return false;
    const cx = Math.floor(x / CHUNK_SIZE);
    const cz = Math.floor(z / CHUNK_SIZE);
    let chunk = this.getChunk(cx, cz);
    if (!chunk) return false;
    const lx = x - cx * CHUNK_SIZE;
    const lz = z - cz * CHUNK_SIZE;
    chunk.set(lx, y, lz, id);
    if (recordMod) this.mods.set(`${x},${y},${z}`, id);

    // neighbor remesh if on border
    const dirty = [chunk];
    if (lx === 0) dirty.push(this.getChunk(cx - 1, cz));
    if (lx === CHUNK_SIZE - 1) dirty.push(this.getChunk(cx + 1, cz));
    if (lz === 0) dirty.push(this.getChunk(cx, cz - 1));
    if (lz === CHUNK_SIZE - 1) dirty.push(this.getChunk(cx, cz + 1));
    for (const c of dirty) {
      if (c) {
        c.dirty = true;
        this.rebuildChunk(c);
      }
    }
    return true;
  }

  biomeAt(wx, wz, knownHeight = null) {
    const t = fbm2(wx * 0.0035, wz * 0.0035, this.seed + 9, 2);
    const h = knownHeight != null ? knownHeight : this.heightAt(wx, wz);
    if (h > 58) return BIOME.MOUNTAIN;
    if (t < 0.32) return BIOME.DESERT;
    if (t < 0.45) return BIOME.PLAINS;
    if (t < 0.62) return BIOME.FOREST;
    if (t < 0.78) return BIOME.HILLS;
    return BIOME.SNOW;
  }

  heightAt(wx, wz) {
    const base = fbm2(wx * 0.01, wz * 0.01, this.seed, 3);
    const mountain = Math.pow(fbm2(wx * 0.004, wz * 0.004, this.seed + 77, 2), 2.2);
    const river = Math.abs(fbm2(wx * 0.006, wz * 0.006, this.seed + 5, 2) - 0.5);
    let h = 28 + base * 28 + mountain * 36;
    if (river < 0.04) h -= (0.04 - river) * 80;
    return Math.floor(h);
  }

  treeChance(biome) {
    switch (biome) {
      case BIOME.FOREST: return 0.035;
      case BIOME.PLAINS: return 0.008;
      case BIOME.HILLS: return 0.012;
      case BIOME.SNOW: return 0.006;
      default: return 0;
    }
  }

  generateChunk(cx, cz) {
    const chunk = new Chunk(cx, cz);
    const ox = cx * CHUNK_SIZE;
    const oz = cz * CHUNK_SIZE;
    const rand = mulberry32((cx * 341873128 + cz * 132897987 + this.seed) | 0);

    for (let lz = 0; lz < CHUNK_SIZE; lz++) {
      for (let lx = 0; lx < CHUNK_SIZE; lx++) {
        const wx = ox + lx;
        const wz = oz + lz;
        const h = this.heightAt(wx, wz);
        const biome = this.biomeAt(wx, wz, h);
        const stoneTop = h - 4;

        for (let y = 0; y <= Math.max(h, SEA_LEVEL); y++) {
          let id = B.AIR;
          if (y === 0) id = B.BEDROCK;
          else if (y < stoneTop) {
            id = B.STONE;
            // cheap caves: single noise, every other level
            if (y > 5 && y < h - 2 && (y & 1) === 0) {
              const cave = noise3(wx * 0.1, y * 0.12, wz * 0.1, this.seed + 3);
              if (cave > 0.72) id = B.AIR;
            }
            if (id === B.STONE) {
              const ore = noise2(wx * 0.3 + y * 0.17, wz * 0.3 - y * 0.11, this.seed + 99);
              if (y < 16 && ore > 0.88) id = B.DIAMOND_ORE;
              else if (y < 28 && ore > 0.85) id = B.GOLD_ORE;
              else if (y < 48 && ore > 0.78) id = B.IRON_ORE;
              else if (ore > 0.72) id = B.COAL_ORE;
            }
          } else if (y < h) {
            id = biome === BIOME.DESERT ? B.SAND : B.DIRT;
          } else if (y === h) {
            if (h < SEA_LEVEL) id = biome === BIOME.DESERT ? B.SAND : B.DIRT;
            else if (biome === BIOME.DESERT) id = B.SAND;
            else if (biome === BIOME.SNOW || h > 55) id = B.SNOW;
            else id = B.GRASS;
          } else if (y <= SEA_LEVEL && h < y) {
            id = B.WATER;
          }

          if (id !== B.AIR) chunk.set(lx, y, lz, id);
        }

        if (h > SEA_LEVEL && h < WORLD_HEIGHT - 8) {
          const surface = chunk.get(lx, h, lz);
          if (surface === B.GRASS || surface === B.SNOW) {
            if (rand() < this.treeChance(biome)) {
              const birch = biome === BIOME.SNOW || rand() < 0.3;
              this.placeTree(chunk, lx, h + 1, lz, birch, rand);
            }
          }
        }

        if (biome === BIOME.DESERT && h > SEA_LEVEL && rand() < 0.01) {
          const ch = 1 + Math.floor(rand() * 3);
          for (let i = 0; i < ch; i++) {
            if (h + 1 + i < WORLD_HEIGHT) chunk.set(lx, h + 1 + i, lz, B.CACTUS);
          }
        }
      }
    }

    // apply saved modifications
    for (const [key, id] of this.mods) {
      const [x, y, z] = key.split(",").map(Number);
      if (Math.floor(x / CHUNK_SIZE) === cx && Math.floor(z / CHUNK_SIZE) === cz) {
        chunk.set(x - ox, y, z - oz, id);
      }
    }

    chunk.generated = true;
    chunk.dirty = true;
    this.chunks.set(chunk.key(), chunk);
    return chunk;
  }

  placeTree(chunk, x, y, z, birch, rand) {
    const log = birch ? B.LOG_BIRCH : B.LOG_OAK;
    const leaf = birch ? B.LEAVES_BIRCH : B.LEAVES_OAK;
    const th = 4 + Math.floor(rand() * 3);
    for (let i = 0; i < th; i++) {
      if (y + i < WORLD_HEIGHT) chunk.set(x, y + i, z, log);
    }
    const top = y + th;
    for (let dy = -2; dy <= 1; dy++) {
      const r = dy <= -1 ? 2 : 1;
      for (let dx = -r; dx <= r; dx++) {
        for (let dz = -r; dz <= r; dz++) {
          if (Math.abs(dx) === r && Math.abs(dz) === r && rand() > 0.5) continue;
          const yy = top + dy;
          const xx = x + dx;
          const zz = z + dz;
          if (xx < 0 || xx >= CHUNK_SIZE || zz < 0 || zz >= CHUNK_SIZE || yy >= WORLD_HEIGHT) continue;
          if (chunk.get(xx, yy, zz) === B.AIR) chunk.set(xx, yy, zz, leaf);
        }
      }
    }
  }

  rebuildChunk(chunk) {
    if (!chunk || !chunk.generated) return;
    disposeChunkMeshes(chunk);
    const { solidMesh, cutoutMesh, waterMesh } = buildChunkMesh(
      chunk,
      this,
      this.atlas,
      this.materials
    );
    if (solidMesh) {
      this.scene.add(solidMesh);
      chunk.mesh = solidMesh;
    }
    if (cutoutMesh) {
      this.scene.add(cutoutMesh);
      chunk.cutoutMesh = cutoutMesh;
    }
    if (waterMesh) {
      this.scene.add(waterMesh);
      chunk.waterMesh = waterMesh;
    }
    chunk.dirty = false;
  }

  update(playerPos, maxGenPerFrame = 2, maxMeshPerFrame = 3) {
    const pcx = Math.floor(playerPos.x / CHUNK_SIZE);
    const pcz = Math.floor(playerPos.z / CHUNK_SIZE);
    const rd = this.renderDistance;

    // collect needed chunks
    const needed = [];
    for (let dz = -rd; dz <= rd; dz++) {
      for (let dx = -rd; dx <= rd; dx++) {
        const cx = pcx + dx;
        const cz = pcz + dz;
        const dist = Math.hypot(dx, dz);
        if (dist > rd + 0.5) continue;
        needed.push({ cx, cz, dist });
      }
    }
    needed.sort((a, b) => a.dist - b.dist);

    let genBudget = maxGenPerFrame;
    let meshBudget = maxMeshPerFrame;

    for (const { cx, cz } of needed) {
      let chunk = this.getChunk(cx, cz);
      if (!chunk) {
        if (genBudget <= 0) break;
        chunk = this.generateChunk(cx, cz);
        genBudget--;
      }
      if (chunk.dirty) {
        if (meshBudget <= 0) break;
        this.rebuildChunk(chunk);
        meshBudget--;
      }
    }

    // unload far chunks
    const unloadDist = rd + 3;
    for (const [key, chunk] of this.chunks) {
      const dx = chunk.cx - pcx;
      const dz = chunk.cz - pcz;
      if (Math.hypot(dx, dz) > unloadDist) {
        disposeChunkMeshes(chunk);
        this.chunks.delete(key);
      }
    }
  }

  /** Ensure spawn chunks exist. */
  warmup(playerPos) {
    const pcx = Math.floor(playerPos.x / CHUNK_SIZE);
    const pcz = Math.floor(playerPos.z / CHUNK_SIZE);
    const r = 1; // 3x3 only — rest streams in during play (avoids long freeze)
    for (let dz = -r; dz <= r; dz++) {
      for (let dx = -r; dx <= r; dx++) {
        const cx = pcx + dx;
        const cz = pcz + dz;
        if (!this.getChunk(cx, cz)) this.generateChunk(cx, cz);
      }
    }
    for (let dz = -r; dz <= r; dz++) {
      for (let dx = -r; dx <= r; dx++) {
        const chunk = this.getChunk(pcx + dx, pcz + dz);
        if (chunk && chunk.dirty) this.rebuildChunk(chunk);
      }
    }
  }

  findSpawn() {
    let fallback = null;
    for (let i = 0; i < 240; i++) {
      const x = (i % 20) * 24 - 240;
      const z = Math.floor(i / 20) * 24 - 240;
      const h = this.heightAt(x, z);
      if (h < SEA_LEVEL + 3 || h > 68) continue;
      const b = this.biomeAt(x, z, h);
      const p = { x: x + 0.5, y: h + 2.05, z: z + 0.5 };
      if (b === BIOME.PLAINS || b === BIOME.FOREST) return p;
      if (!fallback) fallback = p;
    }
    if (fallback) return fallback;
    const h = Math.max(this.heightAt(0, 0), SEA_LEVEL + 2);
    return { x: 0.5, y: h + 2.05, z: 0.5 };
  }

  applyMods(modsObj) {
    this.mods.clear();
    for (const [k, v] of Object.entries(modsObj || {})) {
      this.mods.set(k, v);
    }
  }

  exportMods() {
    return Object.fromEntries(this.mods);
  }

  /** Solid block test for player collision. */
  isSolidAt(x, y, z) {
    const id = this.getBlock(Math.floor(x), Math.floor(y), Math.floor(z));
    return id !== B.AIR && id !== B.WATER && id !== B.TORCH;
  }

  isWaterAt(x, y, z) {
    return this.getBlock(Math.floor(x), Math.floor(y), Math.floor(z)) === B.WATER;
  }
}
