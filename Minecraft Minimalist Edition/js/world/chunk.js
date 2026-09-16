import { B } from "./blocks.js";

export const CHUNK_SIZE = 16;
export const WORLD_HEIGHT = 96;

export class Chunk {
  constructor(cx, cz) {
    this.cx = cx;
    this.cz = cz;
    this.blocks = new Uint8Array(CHUNK_SIZE * WORLD_HEIGHT * CHUNK_SIZE);
    this.generated = false;
    this.dirty = true;
    this.mesh = null;
    this.waterMesh = null;
  }

  index(x, y, z) {
    return x + z * CHUNK_SIZE + y * CHUNK_SIZE * CHUNK_SIZE;
  }

  get(x, y, z) {
    if (y < 0 || y >= WORLD_HEIGHT) return B.AIR;
    if (x < 0 || x >= CHUNK_SIZE || z < 0 || z >= CHUNK_SIZE) return B.AIR;
    return this.blocks[this.index(x, y, z)];
  }

  set(x, y, z, id) {
    if (y < 0 || y >= WORLD_HEIGHT) return;
    if (x < 0 || x >= CHUNK_SIZE || z < 0 || z >= CHUNK_SIZE) return;
    this.blocks[this.index(x, y, z)] = id;
    this.dirty = true;
  }

  key() {
    return `${this.cx},${this.cz}`;
  }
}
