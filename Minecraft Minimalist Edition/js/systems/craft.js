import { B } from "../world/blocks.js";

export const RECIPES = [
  { out: B.PLANKS, n: 4, in: { [B.LOG_OAK]: 1 } },
  { out: B.PLANKS, n: 4, in: { [B.LOG_BIRCH]: 1 } },
  { out: B.STICK, n: 4, in: { [B.PLANKS]: 2 } },
  { out: B.CRAFTING_TABLE, n: 1, in: { [B.PLANKS]: 4 } },
  { out: B.TORCH, n: 4, in: { [B.COAL]: 1, [B.STICK]: 1 } },
  { out: B.FURNACE, n: 1, in: { [B.COBBLE]: 8 } },
  { out: B.WOOD_PICK, n: 1, in: { [B.PLANKS]: 3, [B.STICK]: 2 } },
  { out: B.STONE_PICK, n: 1, in: { [B.COBBLE]: 3, [B.STICK]: 2 } },
  { out: B.IRON_PICK, n: 1, in: { [B.IRON_INGOT]: 3, [B.STICK]: 2 } },
  { out: B.WOOD_SWORD, n: 1, in: { [B.PLANKS]: 2, [B.STICK]: 1 } },
  { out: B.GLASS, n: 1, in: { [B.SAND]: 1 }, needsFurnace: true },
  { out: B.STONE, n: 1, in: { [B.COBBLE]: 1 }, needsFurnace: true },
  { out: B.BRICKS, n: 1, in: { [B.COBBLE]: 4 }, needsFurnace: true },
];

export const SMELTS = [
  { out: B.IRON_INGOT, n: 1, in: B.IRON_ORE },
  { out: B.GOLD_INGOT, n: 1, in: B.GOLD_ORE },
  { out: B.GLASS, n: 1, in: B.SAND },
  { out: B.STONE, n: 1, in: B.COBBLE },
];

export function canCraft(player, recipe) {
  if (recipe.needsFurnace) return false;
  for (const [id, n] of Object.entries(recipe.in)) {
    if (player.countItem(Number(id)) < n) return false;
  }
  return true;
}

export function doCraft(player, recipe) {
  if (!canCraft(player, recipe)) return false;
  for (const [id, n] of Object.entries(recipe.in)) {
    player.removeItem(Number(id), n);
  }
  player.addItem(recipe.out, recipe.n);
  return true;
}

export function nearBlock(world, player, blockId, range = 4) {
  const px = Math.floor(player.pos.x);
  const py = Math.floor(player.pos.y);
  const pz = Math.floor(player.pos.z);
  const r = Math.ceil(range);
  for (let y = py - r; y <= py + r; y++) {
    for (let z = pz - r; z <= pz + r; z++) {
      for (let x = px - r; x <= px + r; x++) {
        if (world.getBlock(x, y, z) === blockId) {
          const dx = x + 0.5 - player.pos.x;
          const dy = y + 0.5 - player.pos.y;
          const dz = z + 0.5 - player.pos.z;
          if (dx * dx + dy * dy + dz * dz <= range * range) return true;
        }
      }
    }
  }
  return false;
}
