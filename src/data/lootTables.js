/**
 * Loot Tables — per-enemy weighted random drop pools
 *
 * Structure:
 *   LOOT_TABLES[enemyId] = {
 *     minDrops: number,           // minimum items generated per kill
 *     maxDrops: number,           // maximum items generated per kill
 *     pools: Pool[]               // list of loot pools to roll against
 *   }
 *
 *   Pool = {
 *     name:   string,             // human-readable pool label (e.g. "currency")
 *     weight: number,             // chance to activate this pool (100 = guaranteed)
 *     items:  PoolItem[]          // weighted selection list within the pool
 *   }
 *
 *   PoolItem (equipment / consumable):
 *     { id: string, weight: number }          // picked via weighted random
 *
 *   PoolItem (currency):
 *     { id: string, range: [min, max] }       // random amount in range
 *
 * RARITY_MULTIPLIERS scales an item's effective stat value by its rarity
 * tier when the item is generated.
 */

// ---------------------------------------------------------------------------
// Rarity scaling
// ---------------------------------------------------------------------------

export const RARITY_MULTIPLIERS = {
  common:    1.0,
  uncommon:  1.1,
  rare:      1.25,
  epic:      1.5,
  legendary: 2.0
};

// ---------------------------------------------------------------------------
// Loot tables keyed by enemy / object id
// ---------------------------------------------------------------------------

export const LOOT_TABLES = {

  // ── Tier 1 — Fodder ──────────────────────────────────────────────────────

  slime: {
    minDrops: 1,
    maxDrops: 2,
    pools: [
      {
        name: 'currency',
        weight: 100,
        items: [{ id: 'coin', range: [5, 15] }]
      },
      {
        name: 'consumable',
        weight: 40,
        items: [{ id: 'potion', weight: 100 }]
      },
      {
        name: 'equipment',
        weight: 8,
        items: [
          { id: 'copper_ring',  weight: 40 },
          { id: 'worn_boots',   weight: 40 },
          { id: 'rusty_dagger', weight: 20 }
        ]
      }
    ]
  },

  bat: {
    minDrops: 1,
    maxDrops: 1,
    pools: [
      {
        name: 'currency',
        weight: 100,
        items: [{ id: 'coin', range: [3, 8] }]
      },
      {
        name: 'consumable',
        weight: 20,
        items: [{ id: 'potion', weight: 100 }]
      }
    ]
  },

  spider: {
    minDrops: 1,
    maxDrops: 2,
    pools: [
      {
        name: 'currency',
        weight: 100,
        items: [{ id: 'coin', range: [5, 12] }]
      },
      {
        name: 'consumable',
        weight: 25,
        items: [{ id: 'potion', weight: 100 }]
      },
      {
        name: 'equipment',
        weight: 10,
        items: [
          { id: 'copper_ring', weight: 50 },
          { id: 'worn_boots',  weight: 50 }
        ]
      }
    ]
  },

  // ── Tier 2 — Regular ─────────────────────────────────────────────────────

  skeleton: {
    minDrops: 1,
    maxDrops: 2,
    pools: [
      {
        name: 'currency',
        weight: 100,
        items: [{ id: 'coin', range: [10, 25] }]
      },
      {
        name: 'consumable',
        weight: 35,
        items: [
          { id: 'potion', weight: 80 },
          { id: 'heart',  weight: 20 }
        ]
      },
      {
        name: 'equipment',
        weight: 12,
        items: [
          { id: 'iron_sword',    weight: 30 },
          { id: 'leather_cap',   weight: 30 },
          { id: 'cloth_robe',    weight: 25 },
          { id: 'wooden_shield', weight: 15 }
        ]
      }
    ]
  },

  goblin: {
    minDrops: 1,
    maxDrops: 3,
    pools: [
      {
        name: 'currency',
        weight: 100,
        items: [{ id: 'coin', range: [8, 20] }]
      },
      {
        name: 'consumable',
        weight: 30,
        items: [{ id: 'potion', weight: 100 }]
      },
      {
        name: 'equipment',
        weight: 15,
        items: [
          { id: 'rusty_dagger',  weight: 35 },
          { id: 'worn_boots',    weight: 30 },
          { id: 'copper_ring',   weight: 25 },
          { id: 'bone_necklace', weight: 10 }
        ]
      }
    ]
  },

  // ── Tier 3 — Elite ───────────────────────────────────────────────────────

  orc_warrior: {
    minDrops: 2,
    maxDrops: 3,
    pools: [
      {
        name: 'currency',
        weight: 100,
        items: [{ id: 'coin', range: [20, 50] }]
      },
      {
        name: 'consumable',
        weight: 40,
        items: [
          { id: 'potion', weight: 60 },
          { id: 'heart',  weight: 40 }
        ]
      },
      {
        name: 'equipment',
        weight: 20,
        items: [
          { id: 'iron_sword',    weight: 20 },
          { id: 'steel_blade',   weight: 15 },
          { id: 'chain_mail',    weight: 15 },
          { id: 'iron_helm',     weight: 15 },
          { id: 'wooden_shield', weight: 20 },
          { id: 'bone_necklace', weight: 15 }
        ]
      }
    ]
  },

  fire_mage: {
    minDrops: 2,
    maxDrops: 3,
    pools: [
      {
        name: 'currency',
        weight: 100,
        items: [{ id: 'coin', range: [25, 60] }]
      },
      {
        name: 'consumable',
        weight: 35,
        items: [
          { id: 'heart',  weight: 60 },
          { id: 'potion', weight: 40 }
        ]
      },
      {
        name: 'equipment',
        weight: 22,
        items: [
          { id: 'apprentice_staff', weight: 20 },
          { id: 'flame_staff',      weight: 10 },
          { id: 'cloth_robe',       weight: 20 },
          { id: 'bone_necklace',    weight: 20 },
          { id: 'copper_ring',      weight: 30 }
        ]
      }
    ]
  },

  // ── Tier 4 — Boss / Mini-boss ────────────────────────────────────────────

  giant_skeleton: {
    minDrops: 2,
    maxDrops: 4,
    pools: [
      {
        name: 'currency',
        weight: 100,
        items: [{ id: 'coin', range: [40, 80] }]
      },
      {
        name: 'consumable',
        weight: 50,
        items: [
          { id: 'heart',  weight: 70 },
          { id: 'potion', weight: 30 }
        ]
      },
      {
        name: 'equipment',
        weight: 30,
        items: [
          { id: 'steel_blade',      weight: 20 },
          { id: 'chain_mail',       weight: 20 },
          { id: 'iron_helm',        weight: 20 },
          { id: 'guardian_plate',    weight: 8 },
          { id: 'shadow_dagger',    weight: 8 },
          { id: 'swift_boots',      weight: 12 },
          { id: 'skull_king_crown', weight: 5 },
          { id: 'bone_necklace',    weight: 7 }
        ]
      }
    ]
  },

  skeleton_king: {
    minDrops: 3,
    maxDrops: 5,
    pools: [
      {
        name: 'currency',
        weight: 100,
        items: [{ id: 'coin', range: [80, 150] }]
      },
      {
        name: 'consumable',
        weight: 60,
        items: [{ id: 'heart', weight: 100 }]
      },
      {
        name: 'equipment',
        weight: 50,
        items: [
          { id: 'skull_king_crown', weight: 20 },
          { id: 'guardian_plate',   weight: 15 },
          { id: 'shadow_dagger',    weight: 15 },
          { id: 'flame_staff',      weight: 15 },
          { id: 'swift_boots',      weight: 15 },
          { id: 'lava_blade',       weight: 5 },
          { id: 'steel_blade',      weight: 15 }
        ]
      }
    ]
  },

  // ── Breakable Objects ────────────────────────────────────────────────────

  barrel: {
    minDrops: 0,
    maxDrops: 2,
    pools: [
      {
        name: 'currency',
        weight: 60,
        items: [{ id: 'coin', range: [1, 8] }]
      },
      {
        name: 'consumable',
        weight: 25,
        items: [{ id: 'potion', weight: 100 }]
      },
      {
        name: 'empty',
        weight: 40,
        items: []
      }
    ]
  }
};
