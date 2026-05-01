# Equipment & Loot System Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Implement a complete equipment system with 8 slots, 5 rarity tiers, level-scaled stats, loot tables, and drop engine — turning the existing stub into a fully functional gear loop.

**Architecture:** Data-driven equipment definitions in JSON, a `LootEngine` for weighted-random drops, and integration with the existing `Stats` engine via `EquipmentSystem.getStatBonuses()`. The `PanelScene` character/inventory tabs get equip/unequip interactions. Enemy `dropLoot()` replaced by `LootEngine.roll()`.

**Tech Stack:** Phaser 3.80.1, vanilla JS ES Modules, Vite 5.4.0

---

## Context for Implementers

### Existing Systems You Must Know

1. **Stats Engine** (`src/systems/Stats.js`): 6 base stats (CON/STR/INT/AGI/PER/LCK) → derived stats. Has `bonuses` (for base stat additions) and `flatBonuses` (for derived stat additions like attack, defense, maxHp). Call `invalidate()` then `refreshStats()` after changes.

2. **EquipmentSystem** (`src/systems/EquipmentSystem.js`): Stub with 8 slots (`helmet, armor, weapon, offhand, necklace, ring1, ring2, boots`). Has `equip(slot, item)`, `unequip(slot)`, emits `'equipmentChanged'`. `getStatBonuses()` returns zeros — needs real implementation.

3. **InventorySystem** (`src/systems/InventorySystem.js`): 32-slot grid. `addItem(itemData, qty)` stores items. Equipment items will be `type: 'equipment'`, non-stackable.

4. **PanelScene** (`src/scenes/PanelScene.js`): 4-tab overlay. Character tab has 8 gray equipment slot rectangles (lines 208-232) — visual only. Inventory tab has 8x4 grid with context menu. Detail panel shows item info.

5. **Enemy.dropLoot()** (`src/entities/Enemy.js:276-283`): Hardcoded coin/potion drops. Will be replaced.

6. **Item class** (`src/entities/Item.js`): World item with sprite, pickup animation, `collect()` returns item data.

7. **MainGameScene** (`src/scenes/MainGameScene.js`): Orchestrates all systems. `spawnItem` event (line 698) creates Item on ground. `handleItemPickup` (line 938) calls `inventory.addItem()`.

### Key Constants

- Rarity tiers: `common` (gray, ×1.0), `uncommon` (green, ×1.1), `rare` (blue, ×1.25), `epic` (purple, ×1.5), `legendary` (gold, ×2.0)
- Rarity colors already defined in PanelScene: `{ common: {bg: 0x3a3a3a, border: 0x888888}, uncommon: {bg: 0x2a3a2a, border: 0x44aa44}, rare: {bg: 0x2a2a3a, border: 0x4444ff}, epic: {bg: 0x3a2a3a, border: 0xaa44aa}, legendary: {bg: 0x3a3a2a, border: 0xffaa00} }`
- Scaling formula: `Value = BaseValue × RarityMultiplier × (1 + 0.1 × ItemLevel)`

---

## Task 1: Equipment Item Definitions

**Files:**
- Modify: `src/data/items.json`

Add equipment items to the `items` object. Each has `type: "equipment"`, a `slot` field, and a `baseStats` object with the raw base values (before rarity/level scaling). Also add a `weaponType` for weapons.

**Implementation:**

Add these equipment entries inside `items.items`:

```json
"iron_sword": {
  "id": "iron_sword",
  "name": "铁剑",
  "type": "equipment",
  "slot": "weapon",
  "weaponType": "heavy",
  "texture": "weapon_icon",
  "rarity": "common",
  "stackable": false,
  "maxStack": 1,
  "level": 1,
  "sellPrice": 15,
  "description": "一把普通的铁剑",
  "baseStats": { "attack": 5 },
  "statBonuses": { "str": 1 }
},
"rusty_dagger": {
  "id": "rusty_dagger",
  "name": "锈蚀匕首",
  "type": "equipment",
  "slot": "weapon",
  "weaponType": "light",
  "texture": "weapon_icon",
  "rarity": "common",
  "stackable": false,
  "maxStack": 1,
  "level": 1,
  "sellPrice": 10,
  "description": "轻巧但有些锈蚀的匕首",
  "baseStats": { "attack": 3, "attackSpeed": 0.05 },
  "statBonuses": { "agi": 1 }
},
"apprentice_staff": {
  "id": "apprentice_staff",
  "name": "学徒法杖",
  "type": "equipment",
  "slot": "weapon",
  "weaponType": "magic",
  "texture": "weapon_icon",
  "rarity": "common",
  "stackable": false,
  "maxStack": 1,
  "level": 1,
  "sellPrice": 12,
  "description": "散发微弱魔力的法杖",
  "baseStats": { "spellPower": 4, "attack": 2 },
  "statBonuses": { "int": 1 }
},
"wooden_shield": {
  "id": "wooden_shield",
  "name": "木盾",
  "type": "equipment",
  "slot": "offhand",
  "texture": "shield_icon",
  "rarity": "common",
  "stackable": false,
  "maxStack": 1,
  "level": 1,
  "sellPrice": 10,
  "description": "简陋但能挡住一些伤害",
  "baseStats": { "defense": 3 },
  "statBonuses": { "con": 1 }
},
"leather_cap": {
  "id": "leather_cap",
  "name": "皮帽",
  "type": "equipment",
  "slot": "helmet",
  "texture": "helmet_icon",
  "rarity": "common",
  "stackable": false,
  "maxStack": 1,
  "level": 1,
  "sellPrice": 8,
  "description": "简单的皮革头帽",
  "baseStats": { "defense": 1 },
  "statBonuses": { "per": 1 }
},
"cloth_robe": {
  "id": "cloth_robe",
  "name": "布甲",
  "type": "equipment",
  "slot": "armor",
  "texture": "armor_icon",
  "rarity": "common",
  "stackable": false,
  "maxStack": 1,
  "level": 1,
  "sellPrice": 12,
  "description": "基础的布制衣甲",
  "baseStats": { "defense": 2, "maxHp": 10 },
  "statBonuses": { "con": 1 }
},
"worn_boots": {
  "id": "worn_boots",
  "name": "旧靴",
  "type": "equipment",
  "slot": "boots",
  "texture": "boots_icon",
  "rarity": "common",
  "stackable": false,
  "maxStack": 1,
  "level": 1,
  "sellPrice": 6,
  "description": "磨损的靴子，仍能提供些许灵活",
  "baseStats": { "moveSpeed": 5 },
  "statBonuses": { "agi": 1 }
},
"copper_ring": {
  "id": "copper_ring",
  "name": "铜戒指",
  "type": "equipment",
  "slot": "ring1",
  "texture": "ring_icon",
  "rarity": "common",
  "stackable": false,
  "maxStack": 1,
  "level": 1,
  "sellPrice": 5,
  "description": "普通的铜制戒指",
  "baseStats": { "critRate": 0.5 },
  "statBonuses": {}
},
"bone_necklace": {
  "id": "bone_necklace",
  "name": "骨项链",
  "type": "equipment",
  "slot": "necklace",
  "texture": "necklace_icon",
  "rarity": "uncommon",
  "stackable": false,
  "maxStack": 1,
  "level": 2,
  "sellPrice": 20,
  "description": "由怪物骨头制成，散发诡异气息",
  "baseStats": { "attack": 2, "maxHp": 5 },
  "statBonuses": { "str": 1, "con": 1 }
},
"steel_blade": {
  "id": "steel_blade",
  "name": "钢刃",
  "type": "equipment",
  "slot": "weapon",
  "weaponType": "heavy",
  "texture": "weapon_icon",
  "rarity": "uncommon",
  "stackable": false,
  "maxStack": 1,
  "level": 3,
  "sellPrice": 35,
  "description": "锋利的钢制长剑",
  "baseStats": { "attack": 8 },
  "statBonuses": { "str": 2 }
},
"chain_mail": {
  "id": "chain_mail",
  "name": "锁子甲",
  "type": "equipment",
  "slot": "armor",
  "weaponType": null,
  "texture": "armor_icon",
  "rarity": "uncommon",
  "stackable": false,
  "maxStack": 1,
  "level": 3,
  "sellPrice": 40,
  "description": "由铁环编制的护甲",
  "baseStats": { "defense": 5, "maxHp": 15 },
  "statBonuses": { "con": 2 }
},
"iron_helm": {
  "id": "iron_helm",
  "name": "铁盔",
  "type": "equipment",
  "slot": "helmet",
  "texture": "helmet_icon",
  "rarity": "uncommon",
  "stackable": false,
  "maxStack": 1,
  "level": 3,
  "sellPrice": 25,
  "description": "坚固的铁制头盔",
  "baseStats": { "defense": 3 },
  "statBonuses": { "con": 1, "per": 1 }
},
"shadow_dagger": {
  "id": "shadow_dagger",
  "name": "暗影匕首",
  "type": "equipment",
  "slot": "weapon",
  "weaponType": "light",
  "texture": "weapon_icon",
  "rarity": "rare",
  "stackable": false,
  "maxStack": 1,
  "level": 5,
  "sellPrice": 80,
  "description": "被暗影浸染的匕首，攻速极快",
  "baseStats": { "attack": 6, "attackSpeed": 0.1, "critRate": 1.5 },
  "statBonuses": { "agi": 3, "per": 1 }
},
"flame_staff": {
  "id": "flame_staff",
  "name": "烈焰法杖",
  "type": "equipment",
  "slot": "weapon",
  "weaponType": "magic",
  "texture": "weapon_icon",
  "rarity": "rare",
  "stackable": false,
  "maxStack": 1,
  "level": 5,
  "sellPrice": 85,
  "description": "蕴含火焰之力的法杖",
  "baseStats": { "spellPower": 10, "attack": 4 },
  "statBonuses": { "int": 3 }
},
"guardian_plate": {
  "id": "guardian_plate",
  "name": "守护者板甲",
  "type": "equipment",
  "slot": "armor",
  "texture": "armor_icon",
  "rarity": "rare",
  "stackable": false,
  "maxStack": 1,
  "level": 5,
  "sellPrice": 90,
  "description": "沉重但防御极高的板甲",
  "baseStats": { "defense": 10, "maxHp": 30 },
  "statBonuses": { "con": 3, "str": 1 }
},
"swift_boots": {
  "id": "swift_boots",
  "name": "疾风之靴",
  "type": "equipment",
  "slot": "boots",
  "texture": "boots_icon",
  "rarity": "rare",
  "stackable": false,
  "maxStack": 1,
  "level": 4,
  "sellPrice": 60,
  "description": "穿上后如风般迅速",
  "baseStats": { "moveSpeed": 15, "attackSpeed": 0.03 },
  "statBonuses": { "agi": 3 }
},
"skull_king_crown": {
  "id": "skull_king_crown",
  "name": "骷髅王冠",
  "type": "equipment",
  "slot": "helmet",
  "texture": "helmet_icon",
  "rarity": "epic",
  "stackable": false,
  "maxStack": 1,
  "level": 7,
  "sellPrice": 200,
  "description": "骷髅王的王冠，散发死亡气息",
  "baseStats": { "defense": 6, "attack": 4, "maxHp": 20 },
  "statBonuses": { "str": 2, "con": 2, "per": 2 }
},
"lava_blade": {
  "id": "lava_blade",
  "name": "熔岩之刃",
  "type": "equipment",
  "slot": "weapon",
  "weaponType": "heavy",
  "texture": "weapon_icon",
  "rarity": "legendary",
  "stackable": false,
  "maxStack": 1,
  "level": 7,
  "sellPrice": 500,
  "description": "传说中的熔岩之刃，灼烧一切",
  "baseStats": { "attack": 18, "critDmg": 0.3 },
  "statBonuses": { "str": 4, "agi": 2 }
}
```

**Commit:** `feat: add 18 equipment item definitions across all slots and rarities`

---

## Task 2: Loot Tables Data

**Files:**
- Create: `src/data/lootTables.js`

Define per-enemy loot tables with weighted pools. Export a `LOOT_TABLES` object keyed by enemy id.

**Implementation:**

```javascript
/**
 * Loot Tables — weighted random drop configuration per enemy.
 *
 * Structure:
 *   minDrops / maxDrops: how many pool rolls on death
 *   pools[]: each pool has a weight (chance to activate) and items[]
 *     - item weight: relative chance within pool
 *     - item range: [min, max] for currency amounts
 *     - item id: references items.json key
 */

export const RARITY_MULTIPLIERS = {
  common: 1.0,
  uncommon: 1.1,
  rare: 1.25,
  epic: 1.5,
  legendary: 2.0
};

export const LOOT_TABLES = {
  slime: {
    minDrops: 1, maxDrops: 2,
    pools: [
      { name: 'currency', weight: 100, items: [{ id: 'coin', range: [5, 15] }] },
      { name: 'consumable', weight: 40, items: [{ id: 'potion', weight: 100 }] },
      { name: 'equipment', weight: 8, items: [
        { id: 'copper_ring', weight: 40 },
        { id: 'worn_boots', weight: 40 },
        { id: 'rusty_dagger', weight: 20 }
      ]}
    ]
  },
  skeleton: {
    minDrops: 1, maxDrops: 2,
    pools: [
      { name: 'currency', weight: 100, items: [{ id: 'coin', range: [10, 25] }] },
      { name: 'consumable', weight: 35, items: [{ id: 'potion', weight: 80 }, { id: 'heart', weight: 20 }] },
      { name: 'equipment', weight: 12, items: [
        { id: 'iron_sword', weight: 30 },
        { id: 'leather_cap', weight: 30 },
        { id: 'cloth_robe', weight: 25 },
        { id: 'wooden_shield', weight: 15 }
      ]}
    ]
  },
  goblin: {
    minDrops: 1, maxDrops: 3,
    pools: [
      { name: 'currency', weight: 100, items: [{ id: 'coin', range: [8, 20] }] },
      { name: 'consumable', weight: 30, items: [{ id: 'potion', weight: 100 }] },
      { name: 'equipment', weight: 15, items: [
        { id: 'rusty_dagger', weight: 35 },
        { id: 'worn_boots', weight: 30 },
        { id: 'copper_ring', weight: 25 },
        { id: 'bone_necklace', weight: 10 }
      ]}
    ]
  },
  spider: {
    minDrops: 1, maxDrops: 2,
    pools: [
      { name: 'currency', weight: 100, items: [{ id: 'coin', range: [5, 12] }] },
      { name: 'consumable', weight: 25, items: [{ id: 'potion', weight: 100 }] },
      { name: 'equipment', weight: 10, items: [
        { id: 'copper_ring', weight: 50 },
        { id: 'worn_boots', weight: 50 }
      ]}
    ]
  },
  bat: {
    minDrops: 1, maxDrops: 1,
    pools: [
      { name: 'currency', weight: 100, items: [{ id: 'coin', range: [3, 8] }] },
      { name: 'consumable', weight: 20, items: [{ id: 'potion', weight: 100 }] }
    ]
  },
  orc_warrior: {
    minDrops: 2, maxDrops: 3,
    pools: [
      { name: 'currency', weight: 100, items: [{ id: 'coin', range: [20, 50] }] },
      { name: 'consumable', weight: 40, items: [{ id: 'potion', weight: 60 }, { id: 'heart', weight: 40 }] },
      { name: 'equipment', weight: 20, items: [
        { id: 'iron_sword', weight: 20 },
        { id: 'steel_blade', weight: 15 },
        { id: 'chain_mail', weight: 15 },
        { id: 'iron_helm', weight: 15 },
        { id: 'wooden_shield', weight: 20 },
        { id: 'bone_necklace', weight: 15 }
      ]}
    ]
  },
  fire_mage: {
    minDrops: 2, maxDrops: 3,
    pools: [
      { name: 'currency', weight: 100, items: [{ id: 'coin', range: [25, 60] }] },
      { name: 'consumable', weight: 35, items: [{ id: 'heart', weight: 60 }, { id: 'potion', weight: 40 }] },
      { name: 'equipment', weight: 22, items: [
        { id: 'apprentice_staff', weight: 20 },
        { id: 'flame_staff', weight: 10 },
        { id: 'cloth_robe', weight: 20 },
        { id: 'bone_necklace', weight: 20 },
        { id: 'copper_ring', weight: 30 }
      ]}
    ]
  },
  giant_skeleton: {
    minDrops: 2, maxDrops: 4,
    pools: [
      { name: 'currency', weight: 100, items: [{ id: 'coin', range: [40, 80] }] },
      { name: 'consumable', weight: 50, items: [{ id: 'heart', weight: 70 }, { id: 'potion', weight: 30 }] },
      { name: 'equipment', weight: 30, items: [
        { id: 'steel_blade', weight: 20 },
        { id: 'chain_mail', weight: 20 },
        { id: 'iron_helm', weight: 20 },
        { id: 'guardian_plate', weight: 8 },
        { id: 'shadow_dagger', weight: 8 },
        { id: 'swift_boots', weight: 12 },
        { id: 'skull_king_crown', weight: 5 },
        { id: 'bone_necklace', weight: 7 }
      ]}
    ]
  },
  skeleton_king: {
    minDrops: 3, maxDrops: 5,
    pools: [
      { name: 'currency', weight: 100, items: [{ id: 'coin', range: [80, 150] }] },
      { name: 'consumable', weight: 60, items: [{ id: 'heart', weight: 100 }] },
      { name: 'equipment', weight: 50, items: [
        { id: 'skull_king_crown', weight: 20 },
        { id: 'guardian_plate', weight: 15 },
        { id: 'shadow_dagger', weight: 15 },
        { id: 'flame_staff', weight: 15 },
        { id: 'swift_boots', weight: 15 },
        { id: 'lava_blade', weight: 5 },
        { id: 'steel_blade', weight: 15 }
      ]}
    ]
  }
};
```

**Commit:** `feat: add loot tables with weighted pools for all 9 enemies`

---

## Task 3: Loot Engine

**Files:**
- Create: `src/systems/LootEngine.js`

The engine takes an enemy id, player luck stat, and returns an array of item drops. Implements weighted random selection with luck bonus on equipment pool weights.

**Implementation:**

```javascript
import { LOOT_TABLES, RARITY_MULTIPLIERS } from '../data/lootTables.js';
import itemData from '../data/items.json';

/**
 * LootEngine — weighted random drop system.
 *
 * roll(enemyId, playerDropBonus) returns an array of { itemData, quantity } objects.
 * playerDropBonus is Stats.getDerived().dropBonus (percentage points, e.g. 1.7 = 1.7%).
 */
export class LootEngine {
  /**
   * Roll loot for a killed enemy.
   * @param {string} enemyId - enemy type id (e.g. 'slime')
   * @param {number} dropBonus - player's dropBonus derived stat (percentage points)
   * @returns {Array<{itemData: object, quantity: number}>}
   */
  static roll(enemyId, dropBonus = 0) {
    const table = LOOT_TABLES[enemyId];
    if (!table) return [];

    const numDrops = Phaser.Math.Between(table.minDrops, table.maxDrops);
    const results = [];

    for (let i = 0; i < numDrops; i++) {
      const poolResult = LootEngine._rollPool(table.pools, dropBonus);
      if (poolResult) results.push(poolResult);
    }

    return results;
  }

  /**
   * Select a pool, then select an item from it.
   */
  static _rollPool(pools, dropBonus) {
    // Apply luck bonus: equipment pool weights get boosted
    const adjustedPools = pools.map(pool => {
      let w = pool.weight;
      if (pool.name === 'equipment') {
        w = w * (1 + dropBonus / 100);
      }
      return { ...pool, adjustedWeight: w };
    });

    // Weighted random pool selection
    const totalWeight = adjustedPools.reduce((sum, p) => sum + p.adjustedWeight, 0);
    let roll = Math.random() * totalWeight;

    for (const pool of adjustedPools) {
      roll -= pool.adjustedWeight;
      if (roll <= 0) {
        return LootEngine._rollItem(pool);
      }
    }

    return null;
  }

  /**
   * Pick one item from a pool using weighted selection.
   */
  static _rollItem(pool) {
    if (!pool.items || pool.items.length === 0) return null;

    // Currency pool with range
    if (pool.items.length === 1 && pool.items[0].range) {
      const entry = pool.items[0];
      const baseData = itemData.items[entry.id];
      if (!baseData) return null;
      const qty = Phaser.Math.Between(entry.range[0], entry.range[1]);
      return { itemData: { ...baseData }, quantity: qty };
    }

    // Weighted item selection
    const totalWeight = pool.items.reduce((sum, it) => sum + (it.weight || 1), 0);
    let roll = Math.random() * totalWeight;

    for (const entry of pool.items) {
      roll -= (entry.weight || 1);
      if (roll <= 0) {
        const baseData = itemData.items[entry.id];
        if (!baseData) return null;
        return { itemData: { ...baseData }, quantity: 1 };
      }
    }

    return null;
  }

  /**
   * Compute the effective stat value of an equipment item.
   * Value = BaseValue × RarityMultiplier × (1 + 0.1 × Level)
   */
  static getScaledStats(equipItem) {
    if (!equipItem || !equipItem.baseStats) return { flatBonuses: {}, statBonuses: {} };

    const rarityMult = RARITY_MULTIPLIERS[equipItem.rarity] || 1.0;
    const levelMult = 1 + 0.1 * (equipItem.level || 1);
    const scale = rarityMult * levelMult;

    const flatBonuses = {};
    for (const [key, val] of Object.entries(equipItem.baseStats)) {
      flatBonuses[key] = Math.round(val * scale * 10) / 10;
    }

    // statBonuses are base stat additions (CON, STR, etc.) — not scaled by level
    const statBonuses = {};
    if (equipItem.statBonuses) {
      for (const [key, val] of Object.entries(equipItem.statBonuses)) {
        statBonuses[key] = val;
      }
    }

    return { flatBonuses, statBonuses };
  }
}
```

**Commit:** `feat: LootEngine with weighted random pools and level-scaled stats`

---

## Task 4: EquipmentSystem — Real Stat Calculation

**Files:**
- Modify: `src/systems/EquipmentSystem.js`

Replace the stub `getStatBonuses()` with real logic that iterates all equipped items, calls `LootEngine.getScaledStats()`, and sums results. Add `requiredLevel` validation in `equip()`. Add `equipFromInventory()` and `unequipToInventory()` integration methods. Wire `equipmentChanged` listener to recalculate player stats.

**Implementation:**

Rewrite `EquipmentSystem.js`:

```javascript
import { EQUIP_SLOTS } from './EquipmentSystem.js'; // keep slot constant
import { LootEngine } from './LootEngine.js';

// Keep EQUIP_SLOTS export, rewrite class:

export { EQUIP_SLOTS };

export class EquipmentSystem {
  constructor(scene) {
    this.scene = scene;
    this.slots = {};
    EQUIP_SLOTS.forEach(s => this.slots[s] = null);

    // Listen to own changes to recalculate stats
    this.scene.events.on('equipmentChanged', () => this._applyBonuses());
  }

  /**
   * Equip an item to its designated slot.
   * Returns the previously equipped item (or null).
   */
  equip(slotName, item) {
    if (!EQUIP_SLOTS.includes(slotName)) return null;

    // Level check
    const levelSystem = this.scene.registry.get('levelSystem');
    if (item.level && levelSystem && levelSystem.level < item.level) {
      console.log(`[Equipment] 等级不足: 需要 Lv.${item.level}`);
      return null;
    }

    const prev = this.slots[slotName];
    this.slots[slotName] = item;
    this.scene.events.emit('equipmentChanged', slotName, item, prev);
    return prev;
  }

  unequip(slotName) {
    const item = this.slots[slotName];
    if (!item) return null;
    this.slots[slotName] = null;
    this.scene.events.emit('equipmentChanged', slotName, null, item);
    return item;
  }

  /**
   * Equip from inventory slot index. Handles swap if slot occupied.
   * Returns true on success.
   */
  equipFromInventory(invSlotIndex) {
    const inv = this.scene.inventory;
    if (!inv) return false;

    const item = inv.getSlot(invSlotIndex);
    if (!item || item.type !== 'equipment' || !item.slot) return false;

    // Determine target slot (rings can go to ring1 or ring2)
    let targetSlot = item.slot;
    if (targetSlot === 'ring1' || targetSlot === 'ring2') {
      // If ring1 empty, use ring1; else use ring2
      targetSlot = this.slots['ring1'] === null ? 'ring1' : 'ring2';
    }

    // Level check
    const levelSystem = this.scene.registry.get('levelSystem');
    if (item.level && levelSystem && levelSystem.level < item.level) {
      this.scene.events.emit('showMessage', `等级不足 (需要 Lv.${item.level})`);
      return false;
    }

    // Remove from inventory
    inv.removeItem(invSlotIndex);

    // Equip (returns previous item)
    const prev = this.slots[targetSlot];
    this.slots[targetSlot] = item;

    // Return previous to inventory
    if (prev) {
      const added = inv.addItem(prev);
      if (!added) {
        // Inventory full — revert
        this.slots[targetSlot] = prev;
        inv.addItem(item); // put back
        this.scene.events.emit('showMessage', '背包已满，无法替换');
        return false;
      }
    }

    this.scene.events.emit('equipmentChanged', targetSlot, item, prev);
    return true;
  }

  /**
   * Unequip to inventory. Returns true on success.
   */
  unequipToInventory(slotName) {
    const inv = this.scene.inventory;
    if (!inv) return false;

    const item = this.slots[slotName];
    if (!item) return false;

    const added = inv.addItem(item);
    if (!added) {
      this.scene.events.emit('showMessage', '背包已满');
      return false;
    }

    this.slots[slotName] = null;
    this.scene.events.emit('equipmentChanged', slotName, null, item);
    return true;
  }

  getSlot(slotName) {
    return this.slots[slotName];
  }

  /**
   * Sum all equipped items' stat contributions.
   */
  getStatBonuses() {
    const bonuses = { con: 0, str: 0, int: 0, agi: 0, per: 0, lck: 0 };
    const flatBonuses = {};

    EQUIP_SLOTS.forEach(slotName => {
      const item = this.slots[slotName];
      if (!item) return;

      const scaled = LootEngine.getScaledStats(item);

      // Sum base stat bonuses
      for (const [stat, val] of Object.entries(scaled.statBonuses)) {
        if (bonuses[stat] !== undefined) bonuses[stat] += val;
      }

      // Sum flat (derived stat) bonuses
      for (const [stat, val] of Object.entries(scaled.flatBonuses)) {
        flatBonuses[stat] = (flatBonuses[stat] || 0) + val;
      }
    });

    return { bonuses, flatBonuses };
  }

  /**
   * Apply equipment bonuses to player stats.
   */
  _applyBonuses() {
    const player = this.scene.player;
    if (!player) return;

    const { bonuses, flatBonuses } = this.getStatBonuses();

    // Set equipment bonuses on stats (these are separate from level bonuses)
    for (const [stat, val] of Object.entries(bonuses)) {
      player.stats.setBonus(stat, val);
    }

    // Merge equipment flat bonuses with level flat bonuses
    const levelSystem = this.scene.registry.get('levelSystem');
    const levelHpBonus = levelSystem ? (levelSystem.level - 1) * 5 : 0;

    // Reset all flatBonuses then re-apply
    const fb = player.stats.flatBonuses;
    // Preserve level HP bonus, set rest from equipment
    for (const key of Object.keys(fb)) {
      if (key === 'maxHp') {
        fb[key] = levelHpBonus + (flatBonuses[key] || 0);
      } else {
        fb[key] = flatBonuses[key] || 0;
      }
    }

    player.stats.invalidate();
    player.refreshStats();
  }

  toJSON() {
    return { slots: { ...this.slots } };
  }

  fromJSON(data) {
    if (data?.slots) {
      EQUIP_SLOTS.forEach(s => {
        this.slots[s] = data.slots[s] || null;
      });
    }
  }
}
```

**Important:** The `EQUIP_SLOTS` constant stays the same. The class is rewritten in-place.

**Commit:** `feat: equipment stat calculation, level checks, inventory integration`

---

## Task 5: Enemy Drop Integration

**Files:**
- Modify: `src/entities/Enemy.js:276-283`
- Modify: `src/scenes/MainGameScene.js:698-717`

Replace hardcoded `dropLoot()` with `LootEngine.roll()`. Update `MainGameScene` spawnItem handler to support equipment items and multiple drops with physics scatter.

**Implementation for Enemy.js:**

Replace `dropLoot()`:
```javascript
dropLoot() {
  // LootEngine handles everything — emit results for MainGameScene to spawn
  this.scene.events.emit('enemyDropLoot', this.config.id, this.sprite.x, this.sprite.y);
}
```

**Implementation for MainGameScene.js:**

Add import at top:
```javascript
import { LootEngine } from '../systems/LootEngine.js';
```

Add new event listener in `setupEvents()` (after the existing `spawnItem` listener):
```javascript
this.events.on('enemyDropLoot', (enemyId, x, y) => {
  const dropBonus = this.player ? this.player.stats.getDerived().dropBonus : 0;
  const drops = LootEngine.roll(enemyId, dropBonus);

  drops.forEach((drop, i) => {
    // Scatter drops with small random offset
    const angle = (Math.PI * 2 / Math.max(drops.length, 1)) * i + Math.random() * 0.5;
    const dist = 20 + Math.random() * 15;
    const dx = x + Math.cos(angle) * dist;
    const dy = y + Math.sin(angle) * dist;

    if (drop.itemData.type === 'currency') {
      // Spawn gold coins with quantity baked in
      this.events.emit('spawnItem', drop.itemData.id, dx, dy, drop.quantity);
    } else {
      this.events.emit('spawnItem', drop.itemData.id, dx, dy, drop.quantity);
    }
  });
});
```

Update the existing `spawnItem` handler to accept optional quantity and handle equipment items:
```javascript
this.events.on('spawnItem', (type, x, y, quantity = 1) => {
  const config = itemData.items[type];
  if (!config) return;

  const item = new Item(this, x, y, type, {
    id: `${type}_${Date.now()}_${Math.random().toString(36).substr(2, 4)}`,
    ...config,
    spawnQuantity: quantity,
    onCollect: (item) => {
      if (type === 'coin') {
        const g = this.registry.get('gameState');
        g.score += item.value * quantity;
        this.registry.set('gameState', g);
        this.events.emit('scoreChanged', g.score);
      }
    }
  });
  this.items.push(item);
  this.physics.add.overlap(this.player.sprite, item.sprite, () => this.handleItemPickup(item, quantity), null, this);
});
```

Update `handleItemPickup` to pass quantity:
```javascript
handleItemPickup(item, quantity = 1) {
  if (item.isCollected) return;
  const result = item.collect();
  if (result) {
    this.inventory.addItem(result, quantity);
    const gs = this.registry.get('gameState');
    if (item.id) {
      gs.collectedItems.push(item.id);
      this.registry.set('gameState', gs);
    }
    const idx = this.items.indexOf(item);
    if (idx > -1) this.items.splice(idx, 1);

    // Rarity pickup notification for rare+
    const rarityOrder = ['common', 'uncommon', 'rare', 'epic', 'legendary'];
    if (rarityOrder.indexOf(result.rarity) >= 2) {
      this.showQuickMessage(`获得了 ${result.name}！`, result.rarity === 'legendary' ? 0xffaa00 : 0x4444ff);
    }
  }
}
```

**Commit:** `feat: integrate LootEngine into enemy drops with scatter and rarity notifications`

---

## Task 6: Equip/Unequip UI in PanelScene

**Files:**
- Modify: `src/scenes/PanelScene.js`

Make equipment slots in character tab interactive (click to unequip). Add "Equip" button to inventory detail panel for equipment items. Add equipment comparison tooltip.

**Implementation — Character Tab Equipment Slots:**

Replace the equipment slot rendering block (lines 208-232) in `createCharacterTab()`:

```javascript
// 8 equipment slots — interactive
const slotMapping = [
  { slot: 'weapon',   x: 0,   y: -100, label: '武器' },
  { slot: 'helmet',   x: 0,   y: -60,  label: '头盔' },
  { slot: 'necklace', x: -55, y: -30,  label: '项链' },
  { slot: 'ring1',    x: 55,  y: -30,  label: '戒指' },
  { slot: 'offhand',  x: -55, y: 30,   label: '副手' },
  { slot: 'ring2',    x: 55,  y: 30,   label: '戒指' },
  { slot: 'armor',    x: 0,   y: 60,   label: '护甲' },
  { slot: 'boots',    x: 0,   y: 100,  label: '靴子' }
];

this.equipSlotUI = {};
slotMapping.forEach(def => {
  const sx = leftX + def.x;
  const sy = previewY + def.y;

  const cell = this.add.rectangle(sx, sy, 34, 34, 0x2a2a3a, 0.7)
    .setStrokeStyle(1, 0x555555).setInteractive({ useHandCursor: true });
  const icon = this.add.text(sx, sy, '', {
    fontSize: '16px', fontFamily: 'Courier New'
  }).setOrigin(0.5).setVisible(false);
  const label = this.add.text(sx, sy + 20, def.label, {
    fontSize: '8px', fill: '#555566', fontFamily: 'Courier New'
  }).setOrigin(0.5);

  cell.on('pointerdown', () => {
    const equip = this.gameScene?.equipmentSystem;
    if (!equip) return;
    const equipped = equip.getSlot(def.slot);
    if (equipped) {
      equip.unequipToInventory(def.slot);
      this.refreshCharacterTab();
      this.refreshInventoryTab();
    }
  });

  cell.on('pointerover', () => {
    const equip = this.gameScene?.equipmentSystem;
    if (!equip) return;
    const equipped = equip.getSlot(def.slot);
    if (equipped) {
      this.showEquipTooltip(equipped, sx + 25, sy);
    }
  });

  cell.on('pointerout', () => {
    if (this.tooltipContainer) this.tooltipContainer.setVisible(false);
  });

  container.add([cell, icon, label]);
  this.equipSlotUI[def.slot] = { cell, icon, label };
});

// Remove "装备系统开发中..." text — delete the devText creation
```

Add `refreshCharacterTab()` method to update equipment slot visuals:

```javascript
refreshCharacterTab() {
  const equip = this.gameScene?.equipmentSystem;
  if (!equip || !this.equipSlotUI) return;

  const SLOT_ICONS = {
    weapon: '⚔', offhand: '🛡', helmet: '⛑', armor: '🛡',
    boots: '👢', necklace: '📿', ring1: '💍', ring2: '💍'
  };

  for (const [slotName, ui] of Object.entries(this.equipSlotUI)) {
    const item = equip.getSlot(slotName);
    if (item) {
      const rarity = this.RARITY_COLORS[item.rarity] || this.RARITY_COLORS.common;
      ui.cell.setFillStyle(rarity.bg, 0.9);
      ui.cell.setStrokeStyle(1, rarity.border);
      ui.icon.setText(SLOT_ICONS[slotName] || '?');
      ui.icon.setVisible(true);
    } else {
      ui.cell.setFillStyle(0x2a2a3a, 0.7);
      ui.cell.setStrokeStyle(1, 0x555555);
      ui.icon.setVisible(false);
    }
  }

  // Also refresh derived stats display
  this.updateDerivedStats();
}
```

**Implementation — Inventory Tab "Equip" Button:**

In `selectInventoryItem()`, after the existing `this.invUseBtn.setVisible(...)` line, add:

```javascript
this.invEquipBtn.setVisible(item.type === 'equipment');
```

In `createInventoryTab()`, add the equip button next to use/drop buttons:

```javascript
this.invEquipBtn = this.add.text(detailX, detailY + 110, '[装备]', {
  fontSize: '12px', fill: '#44ff44', fontFamily: 'Courier New', fontStyle: 'bold'
}).setOrigin(0.5).setInteractive({ useHandCursor: true }).setVisible(false);
this.invEquipBtn.on('pointerdown', () => this.equipSelectedItem());
container.add(this.invEquipBtn);
```

Add `equipSelectedItem()` method:
```javascript
equipSelectedItem() {
  const equip = this.gameScene?.equipmentSystem;
  if (!equip || this.invSelectedSlot < 0) return;
  const success = equip.equipFromInventory(this.invSelectedSlot);
  if (success) {
    this.refreshInventoryTab();
    this.refreshCharacterTab();
    this.selectInventoryItem(this.invSelectedSlot);
  }
}
```

Add `showEquipTooltip()` for equipped item hover:
```javascript
showEquipTooltip(item, x, y) {
  if (!this.tooltipContainer) return;
  const { LootEngine } = this.scene.systems?.game || {};
  // Import at module level instead
  const RARITY_NAMES = {
    common: '普通', uncommon: '优秀', rare: '精良', epic: '史诗', legendary: '传说'
  };

  let text = `${item.name}\n[${RARITY_NAMES[item.rarity] || '普通'}] Lv.${item.level || 1}\n`;
  if (item.baseStats) {
    const STAT_NAMES = {
      attack: '攻击', defense: '防御', maxHp: '生命', maxMp: '法力',
      spellPower: '法强', moveSpeed: '移速', attackSpeed: '攻速',
      critRate: '暴击率', critDmg: '暴击伤害', hpRegen: 'HP回复'
    };
    for (const [k, v] of Object.entries(item.baseStats)) {
      text += `  ${STAT_NAMES[k] || k}: +${v}\n`;
    }
  }
  if (item.statBonuses) {
    const BASE_NAMES = { con: '体质', str: '力量', int: '智力', agi: '敏捷', per: '感知', lck: '幸运' };
    for (const [k, v] of Object.entries(item.statBonuses)) {
      if (v > 0) text += `  ${BASE_NAMES[k] || k}: +${v}\n`;
    }
  }
  text += `\n点击卸下装备`;

  this.tooltipText.setText(text);
  const bounds = this.tooltipText.getBounds();
  this.tooltipBg.setSize(bounds.width + 16, bounds.height + 12);
  this.tooltipContainer.setPosition(x, y);
  this.tooltipContainer.setVisible(true);
}
```

**Commit:** `feat: interactive equipment slots, equip/unequip from inventory panel`

---

## Task 7: Inventory Detail — Equipment Stat Comparison

**Files:**
- Modify: `src/scenes/PanelScene.js`

When an equipment item is selected in inventory, show stat comparison (green ↑ / red ↓) vs currently equipped item in the same slot.

**Implementation:**

In `selectInventoryItem()`, add comparison logic when item is equipment:

```javascript
// After setting invDetailDesc, before the buttons:
if (item.type === 'equipment') {
  const equip = this.gameScene?.equipmentSystem;
  const currentEquip = equip ? equip.getSlot(item.slot === 'ring1' || item.slot === 'ring2'
    ? (equip.getSlot('ring1') ? 'ring1' : 'ring2') : item.slot) : null;

  let compareText = '';
  if (item.baseStats) {
    const STAT_NAMES = {
      attack: '攻击', defense: '防御', maxHp: '生命', maxMp: '法力',
      spellPower: '法强', moveSpeed: '移速', attackSpeed: '攻速',
      critRate: '暴击率', critDmg: '暴击伤害'
    };
    for (const [stat, val] of Object.entries(item.baseStats)) {
      const currentVal = currentEquip?.baseStats?.[stat] || 0;
      const diff = val - currentVal;
      const arrow = diff > 0 ? '↑' : diff < 0 ? '↓' : '=';
      const color = diff > 0 ? '#44ff44' : diff < 0 ? '#ff4444' : '#888888';
      compareText += `${STAT_NAMES[stat] || stat}: ${val} ${arrow}${Math.abs(diff) > 0 ? Math.abs(diff) : ''}\n`;
    }
  }
  this.invCompareText.setText(compareText);
  this.invCompareText.setVisible(true);
} else {
  this.invCompareText.setVisible(false);
}
```

Add `this.invCompareText` creation in `createInventoryTab()`:
```javascript
this.invCompareText = this.add.text(detailX - 60, detailY + 50, '', {
  fontSize: '10px', fill: '#aaaaaa', fontFamily: 'Courier New'
}).setVisible(false);
container.add(this.invCompareText);
```

**Commit:** `feat: equipment stat comparison in inventory panel`

---

## Task 8: Drop Visual Effects

**Files:**
- Modify: `src/scenes/MainGameScene.js`

Add visual effects for equipment drops: rarity-colored glow circle beneath items, physics scatter arc on spawn, and a magnetic pickup animation for currency items.

**Implementation in MainGameScene:**

In the `enemyDropLoot` handler, add drop effects:

```javascript
// After creating the Item, add rarity glow for equipment
if (drop.itemData.type === 'equipment') {
  const rarityColors = {
    common: null, uncommon: 0x44aa44, rare: 0x4444ff, epic: 0xaa44aa, legendary: 0xffaa00
  };
  const glowColor = rarityColors[drop.itemData.rarity];
  if (glowColor) {
    const glow = this.add.circle(dx, dy, 12, glowColor, 0.3).setDepth(item.sprite.depth - 1);
    // Pulse glow
    this.tweens.add({
      targets: glow, alpha: 0.1, duration: 800, yoyo: true, repeat: -1
    });
    // Store reference for cleanup
    item._glowEffect = glow;
  }
}

// Legendary drop: screen notification
if (drop.itemData.rarity === 'legendary') {
  const msg = this.add.text(this.cameras.main.width / 2, 60,
    `传说装备掉落: ${drop.itemData.name}`, {
    fontSize: '16px', fill: '#ffaa00', fontFamily: 'Courier New',
    fontStyle: 'bold', stroke: '#000000', strokeThickness: 3
  }).setOrigin(0.5).setScrollFactor(0).setDepth(300);

  this.tweens.add({
    targets: msg, alpha: 0, y: msg.y - 20, duration: 3000, delay: 1500,
    onComplete: () => msg.destroy()
  });
}
```

Add magnetic pickup for currency in `handleItemPickup`:
```javascript
// Before existing pickup logic, add magnetic animation for currency:
if (item.config?.type === 'currency' && !item._magnetStarted) {
  item._magnetStarted = true;
  this.tweens.add({
    targets: item.sprite,
    x: this.player.sprite.x, y: this.player.sprite.y,
    scaleX: 0.5, scaleY: 0.5,
    duration: 200, ease: 'Quad.easeIn',
    onComplete: () => {
      // Proceed with normal pickup
      if (item._glowEffect) item._glowEffect.destroy();
      // ... existing collect logic
    }
  });
  return; // Skip normal pickup — tween handles it
}
```

Clean up glow effects on item collect:
```javascript
// In handleItemPickup, after item.collect():
if (item._glowEffect) {
  item._glowEffect.destroy();
}
```

**Commit:** `feat: drop visual effects - rarity glow, legendary notification, coin magnet`

---

## Task 9: Breakable & Environmental Loot

**Files:**
- Modify: `src/data/lootTables.js` — add breakable loot tables
- Modify: `src/scenes/MainGameScene.js` — wire breakable drops to LootEngine

Add loot tables for barrel/crate breakables:

```javascript
// Add to LOOT_TABLES:
barrel: {
  minDrops: 0, maxDrops: 2,
  pools: [
    { name: 'currency', weight: 60, items: [{ id: 'coin', range: [1, 8] }] },
    { name: 'consumable', weight: 25, items: [{ id: 'potion', weight: 100 }] },
    { name: 'empty', weight: 40, items: [] }
  ]
}
```

Update `handleBreakableHit` in MainGameScene to use LootEngine:
```javascript
// Replace hardcoded drops in breakable handling with:
this.events.emit('enemyDropLoot', 'barrel', b.x, b.y);
```

**Commit:** `feat: breakable objects use LootEngine for drops`

---

## Task 10: Save/Load Equipment Items & Final Integration

**Files:**
- Modify: `src/systems/SaveSystem.js` — ensure equipment items with full data are persisted
- Modify: `src/scenes/MainGameScene.js` — ensure `_applyBonuses()` is called after loading

Verify that `EquipmentSystem.toJSON()` stores full item objects (it already does via `{ ...this.slots }`).

After loading equipment in `SaveSystem.load()`, trigger stat recalculation:

```javascript
// After the existing equipmentSystem.fromJSON block:
if (scene.equipmentSystem && saveData.equipment) {
  scene.equipmentSystem.fromJSON(saveData.equipment);
  // Trigger stat recalculation
  scene.equipmentSystem._applyBonuses();
}
```

Also ensure PanelScene refreshes equipment display on open:

In PanelScene `openPanel()` or `switchTab()`, call:
```javascript
if (this.currentTab === 0) this.refreshCharacterTab();
```

**Commit:** `feat: save/load equipment with stat recalculation on load`
