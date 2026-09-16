import * as THREE from "three";

/** Day/night cycle: sky color, sun/moon light. */
export class DayNight {
  constructor(scene) {
    this.scene = scene;
    this.time = 0.3; // 0..1, 0.25 = morning
    this.dayLength = 240; // seconds per full day
    this.sun = new THREE.DirectionalLight(0xfff2d0, 1.1);
    this.sun.position.set(50, 80, 20);
    this.sun.target.position.set(0, 0, 0);
    scene.add(this.sun);
    scene.add(this.sun.target);
    this.ambient = new THREE.AmbientLight(0x8899bb, 0.45);
    scene.add(this.ambient);
    this.hemi = new THREE.HemisphereLight(0xb0d0ff, 0x6a5a40, 0.35);
    scene.add(this.hemi);
    this.fogColor = new THREE.Color(0x87b7e8);
  }

  update(dt) {
    this.time = (this.time + dt / this.dayLength) % 1;
    const t = this.time;
    // sun angle
    const ang = t * Math.PI * 2 - Math.PI / 2;
    const sx = Math.cos(ang) * 80;
    const sy = Math.sin(ang) * 80;
    this.sun.position.set(sx, sy, 30);

    const daylight = THREE.MathUtils.clamp(Math.sin(ang), 0, 1);
    this.sun.intensity = 0.25 + daylight * 1.15;
    this.ambient.intensity = 0.4 + daylight * 0.4;

    // sky colors
    const day = new THREE.Color(0x87b7e8);
    const night = new THREE.Color(0x0a1028);
    const dawn = new THREE.Color(0xe8a070);
    const c = night.clone().lerp(day, daylight);
    if (daylight > 0.05 && daylight < 0.35) {
      c.lerp(dawn, 0.25 * (1 - Math.abs(daylight - 0.2) / 0.15));
    }
    this.scene.background = c;
    this.fogColor.copy(c);
    if (this.scene.fog) this.scene.fog.color.copy(c);

    this.sun.color.setHex(daylight > 0.2 ? 0xfff2d0 : 0xa0b0ff);
  }

  isNight() {
    return this.time > 0.5;
  }

  clockLabel() {
    const h = Math.floor(this.time * 24);
    const m = Math.floor(((this.time * 24) % 1) * 60);
    return `${String(h).padStart(2, "0")}:${String(m).padStart(2, "0")}`;
  }
}
