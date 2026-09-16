import * as THREE from "three";

/**
 * Ambient animals with MC-like silhouettes (original geometry, not Mojang assets).
 * Walk cycle: diagonal leg swing. Idle: head bob / chicken peck.
 */

function mat(color) {
  return new THREE.MeshLambertMaterial({ color });
}

function box(w, h, d, material, x = 0, y = 0, z = 0) {
  const m = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), material);
  m.position.set(x, y, z);
  return m;
}

function pivotLeg(legMesh, hipY) {
  // group origin at hip so rotation swings the leg
  const g = new THREE.Group();
  g.position.y = hipY;
  legMesh.position.y = -legMesh.geometry.parameters.height / 2;
  g.add(legMesh);
  return g;
}

function buildQuadruped(opts) {
  const {
    bodyW, bodyH, bodyD, bodyY, bodyColor,
    headW, headH, headD, headY, headZ, headColor,
    legW, legH, legColor,
    legOffsets,
    extras = () => {},
    snout = null,
    ears = null,
  } = opts;

  const root = new THREE.Group();
  const bodyMat = mat(bodyColor);
  const headMat = mat(headColor || bodyColor);
  const legMat = mat(legColor || bodyColor);

  const body = box(bodyW, bodyH, bodyD, bodyMat, 0, bodyY, 0);
  root.add(body);

  const headPivot = new THREE.Group();
  headPivot.position.set(0, headY, headZ);
  const head = box(headW, headH, headD, headMat, 0, 0, headD * 0.35);
  headPivot.add(head);
  if (snout) {
    headPivot.add(box(snout.w, snout.h, snout.d, mat(snout.color), 0, snout.y, headD * 0.35 + snout.z));
  }
  if (ears) {
    for (const s of [-1, 1]) {
      headPivot.add(box(ears.w, ears.h, ears.d, mat(ears.color), s * ears.x, ears.y, ears.z));
    }
  }
  root.add(headPivot);
  extras(root, { body, headPivot, head });

  const legs = [];
  for (const [x, z] of legOffsets) {
    const leg = box(legW, legH, legW, legMat);
    const pivot = pivotLeg(leg, bodyY - bodyH / 2 + 0.02);
    pivot.position.x = x;
    pivot.position.z = z;
    root.add(pivot);
    legs.push(pivot);
  }

  return { root, legs, headPivot, body };
}

export class Mobs {
  constructor(scene, world) {
    this.scene = scene;
    this.world = world;
    this.mobs = [];
    this.max = 14;
    this.group = new THREE.Group();
    scene.add(this.group);
  }

  makeSheep() {
    const built = buildQuadruped({
      bodyW: 0.85,
      bodyH: 0.75,
      bodyD: 1.15,
      bodyY: 0.95,
      bodyColor: 0xf2f2f0,
      headW: 0.45,
      headH: 0.45,
      headD: 0.45,
      headY: 1.15,
      headZ: 0.55,
      headColor: 0xe8d8c8,
      legW: 0.22,
      legH: 0.55,
      legColor: 0xc8c8c8,
      legOffsets: [
        [-0.28, 0.38],
        [0.28, 0.38],
        [-0.28, -0.38],
        [0.28, -0.38],
      ],
      extras: (root) => {
        // wool fluff
        const wool = mat(0xfafaf8);
        root.add(box(0.95, 0.55, 0.95, wool, 0, 1.05, -0.05));
        root.add(box(0.7, 0.4, 0.5, wool, 0, 1.0, -0.55));
      },
    });
    built.kind = "sheep";
    built.animSpeed = 2.2;
    return built;
  }

  makePig() {
    const built = buildQuadruped({
      bodyW: 0.75,
      bodyH: 0.6,
      bodyD: 1.0,
      bodyY: 0.7,
      bodyColor: 0xf0a0b0,
      headW: 0.5,
      headH: 0.45,
      headD: 0.4,
      headY: 0.85,
      headZ: 0.5,
      headColor: 0xf0a0b0,
      legW: 0.2,
      legH: 0.4,
      legColor: 0xd08898,
      legOffsets: [
        [-0.22, 0.3],
        [0.22, 0.3],
        [-0.22, -0.3],
        [0.22, -0.3],
      ],
      snout: { w: 0.28, h: 0.18, d: 0.18, color: 0xe090a0, y: -0.02, z: 0.28 },
      ears: { w: 0.12, h: 0.18, d: 0.08, color: 0xd08898, x: 0.18, y: 0.22, z: 0.1 },
      extras: (root) => {
        // curly tail
        root.add(box(0.08, 0.08, 0.18, mat(0xe090a0), 0, 0.85, -0.55));
      },
    });
    built.kind = "pig";
    built.animSpeed = 2.4;
    return built;
  }

  makeCow() {
    const built = buildQuadruped({
      bodyW: 0.9,
      bodyH: 0.85,
      bodyD: 1.3,
      bodyY: 1.0,
      bodyColor: 0x3a3a3a,
      headW: 0.5,
      headH: 0.5,
      headD: 0.5,
      headY: 1.25,
      headZ: 0.6,
      headColor: 0x3a3a3a,
      legW: 0.24,
      legH: 0.6,
      legColor: 0x2a2a2a,
      legOffsets: [
        [-0.3, 0.42],
        [0.3, 0.42],
        [-0.3, -0.42],
        [0.3, -0.42],
      ],
      snout: { w: 0.35, h: 0.22, d: 0.2, color: 0xc8a090, y: -0.08, z: 0.3 },
      ears: { w: 0.14, h: 0.16, d: 0.1, color: 0x3a3a3a, x: 0.3, y: 0.15, z: 0.05 },
      extras: (root, { body }) => {
        const patch = mat(0xf0f0f0);
        root.add(box(0.35, 0.3, 0.4, patch, 0.35, 1.1, 0.1));
        root.add(box(0.3, 0.25, 0.35, patch, -0.4, 0.95, -0.2));
        root.add(box(0.2, 0.2, 0.2, patch, 0, 1.25, -0.4));
        // horns
        const horn = mat(0xe8dcc8);
        root.add(box(0.08, 0.12, 0.08, horn, -0.28, 1.5, 0.55));
        root.add(box(0.08, 0.12, 0.08, horn, 0.28, 1.5, 0.55));
      },
    });
    built.kind = "cow";
    built.animSpeed = 1.8;
    return built;
  }

  makeChicken() {
    const feather = mat(0xf5f5f0);
    const beakM = mat(0xe8a840);
    const legM = mat(0xd0a040);
    const root = new THREE.Group();
    const body = box(0.42, 0.4, 0.55, feather, 0, 0.55, 0);
    root.add(body);
    // tail
    root.add(box(0.28, 0.35, 0.15, feather, 0, 0.7, -0.32));
    // wings
    const wingL = box(0.08, 0.22, 0.35, mat(0xe8e8e0), -0.24, 0.58, 0);
    const wingR = box(0.08, 0.22, 0.35, mat(0xe8e8e0), 0.24, 0.58, 0);
    root.add(wingL, wingR);

    const headPivot = new THREE.Group();
    headPivot.position.set(0, 0.85, 0.22);
    headPivot.add(box(0.28, 0.28, 0.28, feather, 0, 0, 0.08));
    headPivot.add(box(0.1, 0.08, 0.14, beakM, 0, -0.02, 0.28));
    // comb
    headPivot.add(box(0.08, 0.1, 0.08, mat(0xd04040), 0, 0.18, 0.05));
    root.add(headPivot);

    const legs = [];
    for (const x of [-0.1, 0.1]) {
      const leg = box(0.08, 0.28, 0.08, legM);
      const pivot = pivotLeg(leg, 0.35);
      pivot.position.x = x;
      root.add(pivot);
      legs.push(pivot);
      // foot
      root.add(box(0.12, 0.04, 0.16, legM, x, 0.04, 0.02));
    }

    return {
      root,
      legs,
      headPivot,
      body,
      wings: [wingL, wingR],
      kind: "chicken",
      animSpeed: 3.2,
    };
  }

  createMob(kind) {
    if (kind === "sheep") return this.makeSheep();
    if (kind === "pig") return this.makePig();
    if (kind === "cow") return this.makeCow();
    return this.makeChicken();
  }

  pickKind() {
    const r = Math.random();
    if (r < 0.35) return "sheep";
    if (r < 0.6) return "pig";
    if (r < 0.85) return "chicken";
    return "cow";
  }

  spawnAround(playerPos) {
    let attempts = 0;
    while (this.mobs.length < this.max && attempts < 40) {
      attempts++;
      const angle = Math.random() * Math.PI * 2;
      const dist = 12 + Math.random() * 22;
      const x = playerPos.x + Math.cos(angle) * dist;
      const z = playerPos.z + Math.sin(angle) * dist;
      const gy = this.world.heightAt(Math.floor(x), Math.floor(z));
      if (gy <= 32 || gy > 72) continue;
      const kind = this.pickKind();
      const built = this.createMob(kind);
      built.root.position.set(x, gy + 1, z);
      this.group.add(built.root);
      this.mobs.push({
        ...built,
        baseBodyY: built.body ? built.body.position.y : 0,
        dir: Math.random() * Math.PI * 2,
        speed: kind === "chicken" ? 1.1 : 0.55 + Math.random() * 0.55,
        timer: 1.2 + Math.random() * 3.5,
        walkPhase: Math.random() * Math.PI * 2,
        moving: true,
        idleTimer: 0,
      });
    }
  }

  animateMob(m, dt) {
    const phase = m.walkPhase;
    const amp = m.moving ? 0.55 : 0.08;
    if (m.legs.length >= 4) {
      m.legs[0].rotation.x = Math.sin(phase) * amp;
      m.legs[3].rotation.x = Math.sin(phase) * amp;
      m.legs[1].rotation.x = Math.sin(phase + Math.PI) * amp;
      m.legs[2].rotation.x = Math.sin(phase + Math.PI) * amp;
    } else if (m.legs.length === 2) {
      m.legs[0].rotation.x = Math.sin(phase) * amp;
      m.legs[1].rotation.x = Math.sin(phase + Math.PI) * amp;
    }

    if (m.body && m.baseBodyY != null) {
      m.body.position.y = m.baseBodyY + (m.moving ? Math.sin(phase * 2) * 0.025 : 0);
    }

    if (m.headPivot) {
      if (m.kind === "chicken" && !m.moving) {
        m.headPivot.rotation.x = Math.sin(phase * 8) * 0.55;
        m.headPivot.rotation.y = 0;
      } else {
        m.headPivot.rotation.x = Math.sin(phase * 0.5) * 0.08;
        m.headPivot.rotation.y = Math.sin(phase * 0.3) * 0.15;
      }
    }

    if (m.wings) {
      const flap = m.moving ? Math.sin(phase * 5) * 0.4 : Math.sin(phase * 2) * 0.05;
      m.wings[0].rotation.z = -0.15 - flap;
      m.wings[1].rotation.z = 0.15 + flap;
    }
  }

  update(dt, playerPos) {
    for (let i = this.mobs.length - 1; i >= 0; i--) {
      const m = this.mobs[i];
      const dx = m.root.position.x - playerPos.x;
      const dz = m.root.position.z - playerPos.z;
      if (dx * dx + dz * dz > 55 * 55) {
        this.group.remove(m.root);
        // dispose geometries
        m.root.traverse((o) => {
          if (o.geometry) o.geometry.dispose();
        });
        this.mobs.splice(i, 1);
      }
    }
    this.spawnAround(playerPos);

    for (const m of this.mobs) {
      m.timer -= dt;
      m.walkPhase += dt * (m.animSpeed || 2) * (m.moving ? 1 : 0.25);

      if (m.timer <= 0) {
        if (m.moving && Math.random() < 0.45) {
          m.moving = false;
          m.idleTimer = 1 + Math.random() * 2.5;
          m.timer = m.idleTimer;
        } else {
          m.moving = true;
          m.dir += (Math.random() - 0.5) * 1.8;
          m.timer = 1.5 + Math.random() * 4;
        }
      }
      if (!m.moving) {
        m.idleTimer -= dt;
      }

      if (m.moving) {
        const nx = m.root.position.x + Math.cos(m.dir) * m.speed * dt;
        const nz = m.root.position.z + Math.sin(m.dir) * m.speed * dt;
        const gy = this.world.heightAt(Math.floor(nx), Math.floor(nz));
        if (gy > 32 && gy < 75) {
          m.root.position.x = nx;
          m.root.position.z = nz;
          m.root.position.y = gy + 1;
          // face movement direction (model faces +Z)
          const targetRot = -m.dir + Math.PI / 2;
          let diff = targetRot - m.root.rotation.y;
          while (diff > Math.PI) diff -= Math.PI * 2;
          while (diff < -Math.PI) diff += Math.PI * 2;
          m.root.rotation.y += diff * Math.min(1, dt * 6);
        } else {
          m.dir += Math.PI;
          m.timer = 0.4;
        }
      }

      this.animateMob(m, dt);
    }
  }
}
