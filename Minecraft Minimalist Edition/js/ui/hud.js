import { BlockDefs, ALL_ITEMS, CREATIVE_BLOCKS, B, blockName } from "../world/blocks.js";
import { drawBlockIcon } from "../world/textures.js";
import { RECIPES, SMELTS, canCraft, doCraft } from "../systems/craft.js";

export class HUD {
  constructor(atlas) {
    this.atlas = atlas;
    this.hotbarEl = document.getElementById("hotbar");
    this.blockNameEl = document.getElementById("block-name");
    this.debugEl = document.getElementById("debug-panel");
    this.invPanel = document.getElementById("inventory-panel");
    this.craftPanel = document.getElementById("craft-panel");
    this.furnacePanel = document.getElementById("furnace-panel");
    this.settingsPanel = document.getElementById("settings-panel");
    this.helpPanel = document.getElementById("help-panel");
    this.nameTimer = 0;
    this.uiOpen = false;
    this.buildHotbarShell();
  }

  isAnyPanelOpen() {
    return (
      !this.invPanel.classList.contains("hidden") ||
      !this.craftPanel.classList.contains("hidden") ||
      !this.furnacePanel.classList.contains("hidden") ||
      !this.settingsPanel.classList.contains("hidden") ||
      !this.helpPanel.classList.contains("hidden")
    );
  }

  closeAllPanels() {
    this.invPanel.classList.add("hidden");
    this.craftPanel.classList.add("hidden");
    this.furnacePanel.classList.add("hidden");
    this.settingsPanel.classList.add("hidden");
    this.helpPanel.classList.add("hidden");
  }

  togglePanel(el) {
    const open = el.classList.contains("hidden");
    this.closeAllPanels();
    if (open) el.classList.remove("hidden");
    this.uiOpen = this.isAnyPanelOpen();
    return this.uiOpen;
  }

  buildHotbarShell() {
    this.hotbarEl.innerHTML = "";
    this.slots = [];
    for (let i = 0; i < 9; i++) {
      const s = document.createElement("div");
      s.className = "slot";
      s.dataset.index = String(i);
      const key = document.createElement("span");
      key.className = "key";
      key.textContent = String(i + 1);
      const cv = document.createElement("canvas");
      cv.width = 32;
      cv.height = 32;
      const count = document.createElement("span");
      count.className = "count";
      s.append(key, cv, count);
      this.hotbarEl.appendChild(s);
      this.slots.push({ el: s, cv, count });
    }
  }

  renderHotbar(player) {
    player.hotbar.forEach((slot, i) => {
      const s = this.slots[i];
      s.el.classList.toggle("active", i === player.selected);
      if (!slot || slot.id == null || slot.count <= 0) {
        const ctx = s.cv.getContext("2d");
        ctx.clearRect(0, 0, 32, 32);
        s.count.textContent = "";
        return;
      }
      const def = BlockDefs[slot.id];
      const tex = def?.tex?.all || def?.tex?.side || def?.tex?.top || "stone";
      drawBlockIcon(s.cv, tex, this.atlas);
      s.count.textContent = slot.count > 1 ? String(slot.count) : "";
    });
  }

  showBlockName(name) {
    this.blockNameEl.textContent = name;
    this.blockNameEl.classList.add("show");
    this.nameTimer = 1.2;
  }

  updateNameFade(dt) {
    if (this.nameTimer > 0) {
      this.nameTimer -= dt;
      if (this.nameTimer <= 0) this.blockNameEl.classList.remove("show");
    }
  }

  setDebug(text) {
    this.debugEl.textContent = text;
  }

  renderInventory(player, onPick) {
    const grid = document.getElementById("inv-grid");
    grid.innerHTML = "";
    const ids = new Set([...CREATIVE_BLOCKS, ...player.inventory.keys(), B.STICK, B.COAL, B.IRON_INGOT, B.GOLD_INGOT, B.DIAMOND, B.WOOD_PICK, B.STONE_PICK, B.IRON_PICK]);
    for (const id of ids) {
      const def = BlockDefs[id];
      if (!def) continue;
      const item = document.createElement("div");
      item.className = "inv-item";
      const cv = document.createElement("canvas");
      cv.width = 32;
      cv.height = 32;
      const tex = def.tex?.all || def.tex?.side || def.tex?.top || "stone";
      drawBlockIcon(cv, tex, this.atlas);
      const meta = document.createElement("div");
      meta.className = "meta";
      const n = player.inventory.get(id) || (def.item ? 0 : 64);
      meta.textContent = `${def.name}${n ? ` ×${n}` : ""}`;
      item.append(cv, meta);
      item.addEventListener("click", () => onPick(id));
      grid.appendChild(item);
    }
  }

  renderCraft(player, onCraft) {
    const list = document.getElementById("craft-list");
    list.innerHTML = "";
    for (const recipe of RECIPES) {
      if (recipe.needsFurnace) continue;
      const ok = canCraft(player, recipe);
      const item = document.createElement("div");
      item.className = "craft-item" + (ok ? "" : " disabled");
      const def = BlockDefs[recipe.out];
      const cv = document.createElement("canvas");
      cv.width = 32;
      cv.height = 32;
      const tex = def?.tex?.all || def?.tex?.side || def?.tex?.top || "stone";
      drawBlockIcon(cv, tex, this.atlas);
      const meta = document.createElement("div");
      meta.className = "meta";
      const parts = Object.entries(recipe.in)
        .map(([id, n]) => `${BlockDefs[id]?.name || id}×${n}`)
        .join(" + ");
      meta.textContent = `${def?.name || ""}×${recipe.n}\n${parts}`;
      meta.style.whiteSpace = "pre-line";
      item.append(cv, meta);
      if (ok) item.addEventListener("click", () => onCraft(recipe));
      list.appendChild(item);
    }
  }

  renderFurnace(player, onSmelt) {
    const list = document.getElementById("furnace-list");
    list.innerHTML = "";
    document.getElementById("furnace-status").textContent =
      "熔炉就绪 · 点击配方烧炼（自动消耗材料）";
    for (const s of SMELTS) {
      const has = player.countItem(s.in) >= 1;
      const item = document.createElement("div");
      item.className = "furnace-item" + (has ? "" : " disabled");
      const def = BlockDefs[s.out];
      const cv = document.createElement("canvas");
      cv.width = 32;
      cv.height = 32;
      const tex = def?.tex?.all || def?.tex?.side || "stone";
      drawBlockIcon(cv, tex, this.atlas);
      const meta = document.createElement("div");
      meta.className = "meta";
      meta.textContent = `${BlockDefs[s.in]?.name} → ${def?.name}`;
      item.append(cv, meta);
      if (has) {
        item.addEventListener("click", () => {
          if (player.removeItem(s.in, 1)) player.addItem(s.out, s.n);
          onSmelt();
        });
      }
      list.appendChild(item);
    }
  }
}
