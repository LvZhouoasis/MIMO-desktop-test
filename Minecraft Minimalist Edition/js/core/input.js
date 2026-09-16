/** Keyboard / mouse input with pointer lock. MC-style helpers. */

export class Input {
  constructor(canvas) {
    this.canvas = canvas;
    this.keys = new Set();
    this.mouseDX = 0;
    this.mouseDY = 0;
    this.leftDown = false;
    this.rightDown = false;
    this.leftPressed = false;
    this.rightPressed = false;
    this.wheel = 0;
    this.locked = false;
    this.sensitivity = 1;
    this.enabled = true;
    this.spaceTaps = [];
    this.spacePressed = false;

    document.addEventListener("keydown", (e) => {
      if (!this.enabled) return;
      if (!e.repeat && e.code === "Space") {
        this.spacePressed = true;
        const now = performance.now();
        this.spaceTaps.push(now);
        this.spaceTaps = this.spaceTaps.filter((t) => now - t < 300);
      }
      this.keys.add(e.code);
      if (
        e.code === "Space" ||
        e.code === "Tab" ||
        e.code === "KeyE" ||
        e.code === "KeyQ" ||
        e.code === "ArrowUp" ||
        e.code === "ArrowDown" ||
        e.code === "ArrowLeft" ||
        e.code === "ArrowRight" ||
        e.code === "ControlLeft" ||
        e.code === "ControlRight"
      ) {
        e.preventDefault();
      }
    });
    document.addEventListener("keyup", (e) => {
      this.keys.delete(e.code);
    });
    window.addEventListener("blur", () => this.keys.clear());

    canvas.addEventListener("mousedown", (e) => {
      if (!this.locked) return;
      if (e.button === 0) {
        this.leftDown = true;
        this.leftPressed = true;
      }
      if (e.button === 2) {
        this.rightDown = true;
        this.rightPressed = true;
      }
    });
    window.addEventListener("mouseup", (e) => {
      if (e.button === 0) this.leftDown = false;
      if (e.button === 2) this.rightDown = false;
    });
    canvas.addEventListener("contextmenu", (e) => e.preventDefault());

    document.addEventListener("mousemove", (e) => {
      if (!this.locked) return;
      this.mouseDX += e.movementX || 0;
      this.mouseDY += e.movementY || 0;
    });

    canvas.addEventListener(
      "wheel",
      (e) => {
        if (!this.locked) return;
        this.wheel += Math.sign(e.deltaY);
        e.preventDefault();
      },
      { passive: false }
    );

    document.addEventListener("pointerlockchange", () => {
      this.locked = document.pointerLockElement === canvas;
    });
  }

  requestLock() {
    if (!this.locked) this.canvas.requestPointerLock?.();
  }

  exitLock() {
    if (this.locked) document.exitPointerLock?.();
  }

  consumeLook() {
    const dx = this.mouseDX * 0.0022 * this.sensitivity;
    const dy = this.mouseDY * 0.0022 * this.sensitivity;
    this.mouseDX = 0;
    this.mouseDY = 0;
    return { dx, dy };
  }

  consumeWheel() {
    const w = this.wheel;
    this.wheel = 0;
    return w;
  }

  consumePressed() {
    const l = this.leftPressed;
    const r = this.rightPressed;
    this.leftPressed = false;
    this.rightPressed = false;
    return { left: l, right: r };
  }

  consumeSpacePressed() {
    const s = this.spacePressed;
    this.spacePressed = false;
    return s;
  }

  /** True if Space was tapped twice quickly (MC creative fly toggle). */
  consumeDoubleSpace() {
    // require two clean taps, ignore if user is holding space (jump hold)
    if (this.isDown("Space")) return false;
    if (this.spaceTaps.length >= 2) {
      this.spaceTaps.length = 0;
      return true;
    }
    // expire old taps
    const now = performance.now();
    this.spaceTaps = this.spaceTaps.filter((t) => now - t < 350);
    return false;
  }

  isDown(code) {
    return this.keys.has(code);
  }

  isSprint() {
    return this.isDown("ControlLeft") || this.isDown("ControlRight");
  }
}
