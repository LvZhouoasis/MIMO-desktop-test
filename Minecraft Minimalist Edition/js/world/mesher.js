import * as THREE from "three";
import { B, BlockDefs, isOpaque, isLiquid } from "./blocks.js";
import { CHUNK_SIZE, WORLD_HEIGHT } from "./chunk.js";

/**
 * Voxel faces — winding is CCW when viewed from outside (Three.js FrontSide).
 * Same layout as the three.js fundamentals voxel example.
 */
const FACES = [
  {
    dir: [-1, 0, 0],
    side: "side",
    shade: 0.8,
    corners: [
      [0, 1, 0], [0, 0, 0], [0, 1, 1], [0, 0, 1],
    ],
    uvs: [[0, 1], [0, 0], [1, 1], [1, 0]],
  },
  {
    dir: [1, 0, 0],
    side: "side",
    shade: 0.8,
    corners: [
      [1, 1, 1], [1, 0, 1], [1, 1, 0], [1, 0, 0],
    ],
    uvs: [[0, 1], [0, 0], [1, 1], [1, 0]],
  },
  {
    dir: [0, -1, 0],
    side: "bottom",
    shade: 0.55,
    corners: [
      [1, 0, 1], [0, 0, 1], [1, 0, 0], [0, 0, 0],
    ],
    uvs: [[1, 0], [0, 0], [1, 1], [0, 1]],
  },
  {
    dir: [0, 1, 0],
    side: "top",
    shade: 1.0,
    corners: [
      [0, 1, 1], [1, 1, 1], [0, 1, 0], [1, 1, 0],
    ],
    uvs: [[1, 1], [0, 1], [1, 0], [0, 0]],
  },
  {
    dir: [0, 0, -1],
    side: "side",
    shade: 0.7,
    corners: [
      [1, 0, 0], [0, 0, 0], [1, 1, 0], [0, 1, 0],
    ],
    uvs: [[0, 0], [1, 0], [0, 1], [1, 1]],
  },
  {
    dir: [0, 0, 1],
    side: "side",
    shade: 0.9,
    corners: [
      [0, 0, 1], [1, 0, 1], [0, 1, 1], [1, 1, 1],
    ],
    uvs: [[0, 0], [1, 0], [0, 1], [1, 1]],
  },
];

function faceTextureName(def, side) {
  const t = def.tex || {};
  if (side === "top" && t.top) return t.top;
  if (side === "bottom" && t.bottom) return t.bottom;
  return t.all || t.side || "stone";
}

function isCutout(id) {
  return (
    id === B.LEAVES_OAK ||
    id === B.LEAVES_BIRCH ||
    id === B.GLASS ||
    id === B.TORCH ||
    id === B.ICE
  );
}

function shouldDrawFace(id, neighbor) {
  if (isLiquid(id)) {
    return neighbor === B.AIR;
  }
  if (isOpaque(neighbor)) return false;
  if (neighbor === id && id !== B.TORCH) return false;
  return true;
}

export function buildChunkMesh(chunk, world, atlas, materials) {
  const ox = chunk.cx * CHUNK_SIZE;
  const oz = chunk.cz * CHUNK_SIZE;

  const solid = { positions: [], normals: [], uvs: [], colors: [], indices: [] };
  const cutout = { positions: [], normals: [], uvs: [], colors: [], indices: [] };
  const water = { positions: [], normals: [], uvs: [], colors: [], indices: [] };

  for (let y = 0; y < WORLD_HEIGHT; y++) {
    for (let z = 0; z < CHUNK_SIZE; z++) {
      for (let x = 0; x < CHUNK_SIZE; x++) {
        const id = chunk.get(x, y, z);
        if (id === B.AIR) continue;
        const def = BlockDefs[id];
        if (!def || def.item) continue;

        const liquid = isLiquid(id);
        const target = liquid ? water : isCutout(id) ? cutout : solid;

        for (const face of FACES) {
          const nx = x + face.dir[0];
          const ny = y + face.dir[1];
          const nz = z + face.dir[2];
          const neighbor =
            nx >= 0 && nx < CHUNK_SIZE && nz >= 0 && nz < CHUNK_SIZE
              ? chunk.get(nx, ny, nz)
              : world.getBlock(ox + nx, ny, oz + nz);

          if (!shouldDrawFace(id, neighbor)) continue;

          const uv = atlas.index[faceTextureName(def, face.side)] || atlas.index.stone;
          const base = target.positions.length / 3;
          const inset = 0.002;
          const topY = liquid && face.dir[1] === 1 ? 0.88 : 1;

          for (let i = 0; i < 4; i++) {
            const c = face.corners[i];
            const yOff = c[1] === 1 ? topY : c[1];
            target.positions.push(ox + x + c[0], y + yOff, oz + z + c[2]);
            target.normals.push(face.dir[0], face.dir[1], face.dir[2]);
            const [tu, tv] = face.uvs[i];
            target.uvs.push(
              uv.u0 + inset + (uv.u1 - uv.u0 - inset * 2) * tu,
              uv.v0 + inset + (uv.v1 - uv.v0 - inset * 2) * tv
            );
            const s = face.shade;
            target.colors.push(s, s, s);
          }
          // 0,1,2, 2,1,3 — matches fundamentals (CCW from outside)
          target.indices.push(base, base + 1, base + 2, base + 2, base + 1, base + 3);
        }
      }
    }
  }

  function toMesh(data, mat) {
    if (data.indices.length === 0) return null;
    const g = new THREE.BufferGeometry();
    g.setAttribute("position", new THREE.Float32BufferAttribute(data.positions, 3));
    g.setAttribute("normal", new THREE.Float32BufferAttribute(data.normals, 3));
    g.setAttribute("uv", new THREE.Float32BufferAttribute(data.uvs, 2));
    g.setAttribute("color", new THREE.Float32BufferAttribute(data.colors, 3));
    g.setIndex(data.indices);
    g.computeBoundingSphere();
    const mesh = new THREE.Mesh(g, mat);
    mesh.matrixAutoUpdate = false;
    mesh.frustumCulled = true;
    return mesh;
  }

  return {
    solidMesh: toMesh(solid, materials.solid),
    cutoutMesh: toMesh(cutout, materials.cutout),
    waterMesh: toMesh(water, materials.water),
  };
}

export function disposeChunkMeshes(chunk) {
  if (chunk.mesh) {
    chunk.mesh.geometry.dispose();
    chunk.mesh.parent?.remove(chunk.mesh);
    chunk.mesh = null;
  }
  if (chunk.cutoutMesh) {
    chunk.cutoutMesh.geometry.dispose();
    chunk.cutoutMesh.parent?.remove(chunk.cutoutMesh);
    chunk.cutoutMesh = null;
  }
  if (chunk.waterMesh) {
    chunk.waterMesh.geometry.dispose();
    chunk.waterMesh.parent?.remove(chunk.waterMesh);
    chunk.waterMesh = null;
  }
}
