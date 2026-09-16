import { B, BlockDefs, isSolid } from "../world/blocks.js";

const WIDTH = 0.6;
const HEIGHT = 1.8;
const EYE = 1.62;

export class Player {
  constructor(world, camera) {
    this.world = world;
    this.camera = camera;
    this.pos = { x: 0.5, y: 40, z: 0.5 };
    this.vel = { x: 0, y: 0, z: 0 };
    this.yaw = 0;
    this.pitch = 0;
    this.onGround = false;
    this.flying = false;
    this.sneaking = false;
    this.sprinting = false;
    this.thirdPerson = false;
    this.health = 20;
    this.maxHealth = 20;
    this.selected = 0;
    this.hotbar = new Array(9).fill(null).map(() => ({ id: B.GRASS, count: 64 }));
    this.inventory = new Map(); // id -> count
    this.breakProgress = 0;
    this.breakTarget = null;
    this.reach = 6;
  }

  spawnAt(p) {
    this.pos.x = p.x;
    this.pos.y = p.y;
    this.pos.z = p.z;
    this.vel.x = this.vel.y = this.vel.z = 0;
  }

  get eyePos() {
    return {
      x: this.pos.x,
      y: this.pos.y + (this.sneaking ? EYE - 0.15 : EYE),
      z: this.pos.z,
    };
  }

  lookDir() {
    const cp = Math.cos(this.pitch);
    const sp = Math.sin(this.pitch);
    const cy = Math.cos(this.yaw);
    const sy = Math.sin(this.yaw);
    return { x: -sy * cp, y: sp, z: -cy * cp };
  }

  applyLook(dx, dy) {
    this.yaw -= dx;
    this.pitch -= dy;
    const lim = Math.PI / 2 - 0.01;
    this.pitch = Math.max(-lim, Math.min(lim, this.pitch));
  }

  collides(px, py, pz) {
    const minX = px - WIDTH / 2;
    const maxX = px + WIDTH / 2;
    const minY = py;
    const maxY = py + HEIGHT;
    const minZ = pz - WIDTH / 2;
    const maxZ = pz + WIDTH / 2;
    const x0 = Math.floor(minX);
    const x1 = Math.floor(maxX);
    const y0 = Math.floor(minY);
    const y1 = Math.floor(maxY - 0.001);
    const z0 = Math.floor(minZ);
    const z1 = Math.floor(maxZ);
    for (let y = y0; y <= y1; y++) {
      for (let z = z0; z <= z1; z++) {
        for (let x = x0; x <= x1; x++) {
          if (this.world.isSolidAt(x + 0.5, y + 0.5, z + 0.5)) return true;
        }
      }
    }
    return false;
  }

  intersectsBlock(bx, by, bz) {
    const minX = this.pos.x - WIDTH / 2;
    const maxX = this.pos.x + WIDTH / 2;
    const minY = this.pos.y;
    const maxY = this.pos.y + HEIGHT;
    const minZ = this.pos.z - WIDTH / 2;
    const maxZ = this.pos.z + WIDTH / 2;
    return (
      bx + 1 > minX && bx < maxX &&
      by + 1 > minY && by < maxY &&
      bz + 1 > minZ && bz < maxZ
    );
  }

  /** Solid block just under the feet (for stable onGround). */
  probeGround() {
    const eps = 0.08;
    const y = this.pos.y - eps;
    const x0 = Math.floor(this.pos.x - WIDTH / 2 + 0.01);
    const x1 = Math.floor(this.pos.x + WIDTH / 2 - 0.01);
    const z0 = Math.floor(this.pos.z - WIDTH / 2 + 0.01);
    const z1 = Math.floor(this.pos.z + WIDTH / 2 - 0.01);
    const by = Math.floor(y);
    for (let z = z0; z <= z1; z++) {
      for (let x = x0; x <= x1; x++) {
        if (this.world.isSolidAt(x + 0.5, by + 0.5, z + 0.5)) return true;
      }
    }
    return false;
  }

  update(dt, input) {
    this.sneaking = !this.flying && (input.isDown("ShiftLeft") || input.isDown("ShiftRight"));
    this.sprinting =
      !this.flying &&
      !this.sneaking &&
      input.isSprint() &&
      (input.isDown("KeyW") || input.isDown("ArrowUp"));

    const walkSpeed = this.sprinting ? 5.8 : 4.317;
    const speed = this.flying ? (input.isSprint() ? 21 : 10.9) : this.sneaking ? 1.3 : walkSpeed;
    const jumpV = 8.4;
    const gravity = 27;

    let forward = 0;
    let strafe = 0;
    if (input.isDown("KeyW") || input.isDown("ArrowUp")) forward += 1;
    if (input.isDown("KeyS") || input.isDown("ArrowDown")) forward -= 1;
    if (input.isDown("KeyD") || input.isDown("ArrowRight")) strafe += 1;
    if (input.isDown("KeyA") || input.isDown("ArrowLeft")) strafe -= 1;
    const len = Math.hypot(forward, strafe);
    if (len > 0) {
      forward /= len;
      strafe /= len;
    }

    const sinY = Math.sin(this.yaw);
    const cosY = Math.cos(this.yaw);
    const forwardX = -sinY;
    const forwardZ = -cosY;
    const rightX = cosY;
    const rightZ = -sinY;
    const wx = forward * forwardX + strafe * rightX;
    const wz = forward * forwardZ + strafe * rightZ;

    // refresh ground before jump so a single Space always works when standing
    if (!this.flying) {
      this.onGround = this.probeGround() || this.onGround;
    }

    const jumpHeld = input.isDown("Space");

    if (this.flying) {
      this.vel.x = wx * speed;
      this.vel.z = wz * speed;
      let vy = 0;
      if (jumpHeld) vy += speed;
      if (this.sneaking) vy -= speed;
      this.vel.y = vy;
    } else {
      this.vel.x = wx * speed;
      this.vel.z = wz * speed;
      this.vel.y -= gravity * dt;
      if (this.vel.y < -40) this.vel.y = -40;

      if (jumpHeld && this.onGround && this.vel.y <= 0.01) {
        this.vel.y = jumpV;
        this.onGround = false;
        this.coyote = 0;
      }

      if (this.world.isWaterAt(this.pos.x, this.pos.y + 0.5, this.pos.z)) {
        this.vel.y = Math.max(this.vel.y, -2);
        if (jumpHeld) this.vel.y = 4.5;
      }
    }

    // axis-separated collision
    const steps = 3;
    const sdt = dt / steps;
    for (let s = 0; s < steps; s++) {
      const ny = this.pos.y + this.vel.y * sdt;
      if (!this.collides(this.pos.x, ny, this.pos.z)) {
        this.pos.y = ny;
        // keep onGround if still standing on a block (don't flicker off)
        if (this.vel.y > 0.01) this.onGround = false;
      } else {
        if (this.vel.y < 0) {
          this.onGround = true;
          this.pos.y = Math.floor(ny) + 1.0001;
          let guard = 0;
          while (this.collides(this.pos.x, this.pos.y, this.pos.z) && guard++ < 8) {
            this.pos.y += 0.1;
          }
        } else {
          this.pos.y = Math.ceil(ny) - HEIGHT - 0.0001;
          let guard = 0;
          while (this.collides(this.pos.x, this.pos.y, this.pos.z) && guard++ < 8) {
            this.pos.y -= 0.05;
          }
        }
        this.vel.y = 0;
      }
      const nx = this.pos.x + this.vel.x * sdt;
      if (!this.collides(nx, this.pos.y, this.pos.z)) this.pos.x = nx;
      else this.vel.x = 0;
      const nz = this.pos.z + this.vel.z * sdt;
      if (!this.collides(this.pos.x, this.pos.y, nz)) this.pos.z = nz;
      else this.vel.z = 0;
    }

    // final ground probe
    if (!this.flying) {
      const grounded = this.probeGround();
      if (grounded) {
        this.onGround = true;
        if (this.vel.y < 0) this.vel.y = 0;
      } else if (this.vel.y > 0.01) {
        this.onGround = false;
      }
    }

    if (this.collides(this.pos.x, this.pos.y, this.pos.z)) {
      let guard = 0;
      while (this.collides(this.pos.x, this.pos.y, this.pos.z) && guard++ < 40) {
        this.pos.y += 0.25;
      }
      this.vel.y = Math.max(this.vel.y, 0);
    }

    if (this.pos.y < -10) {
      this.health = 0;
    }

    this.syncCamera(this.thirdPerson);
  }

  syncCamera(thirdPerson = false) {
    const eye = this.eyePos;
    this.camera.rotation.order = "YXZ";
    this.camera.rotation.y = this.yaw;
    this.camera.rotation.x = this.pitch;
    if (!thirdPerson) {
      this.camera.position.set(eye.x, eye.y, eye.z);
      return;
    }
    const dir = this.lookDir();
    const dist = 4.2;
    this.camera.position.set(
      eye.x - dir.x * dist,
      eye.y - dir.y * dist + 0.2,
      eye.z - dir.z * dist
    );
  }

  addItem(id, count = 1) {
    if (this.inventory.has(id)) {
      this.inventory.set(id, this.inventory.get(id) + count);
    } else {
      this.inventory.set(id, count);
    }
  }

  removeItem(id, count = 1) {
    const cur = this.inventory.get(id) || 0;
    if (cur < count) return false;
    if (cur === count) this.inventory.delete(id);
    else this.inventory.set(id, cur - count);
    return true;
  }

  countItem(id) {
    return this.inventory.get(id) || 0;
  }

  get selectedBlock() {
    return this.hotbar[this.selected]?.id ?? B.GRASS;
  }

  respawn(spawn) {
    this.spawnAt(spawn);
    this.health = this.maxHealth;
    this.flying = false;
  }

  /** Mining speed multiplier from held tool. */
  toolSpeed(blockId) {
    const def = BlockDefs[blockId];
    const held = BlockDefs[this.selectedBlock];
    if (!def || def.unbreakable) return 0;
    let speed = 1;
    if (held?.item && held.tool) {
      if (!def.tool || def.tool === held.tool) speed = held.speed || 1;
      else speed = 1;
      if (def.minTier && held.tool === "pickaxe" && (held.tier || 0) < def.minTier) {
        speed = 0.25;
      }
    }
    return speed;
  }

  canHarvest(blockId) {
    const def = BlockDefs[blockId];
    if (!def || def.unbreakable) return false;
    const held = BlockDefs[this.selectedBlock];
    if (!def.minTier) return true;
    if (held?.item && held.tool === "pickaxe" && (held.tier || 0) >= def.minTier) return true;
    // allow but slow without proper tool - still drop if minTier is 0
    return !def.minTier;
  }
}
