/**
 * 装备制作配方
 *
 * 每个 recipe 描述一份装备的制作所需材料、金币、玩家等级。
 * CraftingSystem 通过 RECIPES 查表，消耗材料后调用 EquipmentGenerator 生成实例。
 */
export const RECIPES = {
  steel_blade_recipe: {
    id: 'steel_blade_recipe',
    name: '钢剑配方',
    resultId: 'steel_blade',
    resultRarity: 'rare',
    resultLevel: 5,
    materials: [
      { matId: 'enhance_stone', count: 5 },
      { matId: 'iron_shard', count: 20 }
    ],
    gold: 500,
    requiredLevel: 5
  },
  guardian_plate_recipe: {
    id: 'guardian_plate_recipe',
    name: '守护板甲配方',
    resultId: 'guardian_plate',
    resultRarity: 'rare',
    resultLevel: 8,
    materials: [
      { matId: 'enhance_stone', count: 8 },
      { matId: 'iron_shard', count: 30 },
      { matId: 'refining_stone', count: 2 }
    ],
    gold: 1200,
    requiredLevel: 8
  },
  shadow_dagger_recipe: {
    id: 'shadow_dagger_recipe',
    name: '影刃配方',
    resultId: 'shadow_dagger',
    resultRarity: 'rare',
    resultLevel: 5,
    materials: [
      { matId: 'enhance_stone', count: 5 },
      { matId: 'iron_shard', count: 15 }
    ],
    gold: 500,
    requiredLevel: 5
  },
  flame_staff_recipe: {
    id: 'flame_staff_recipe',
    name: '火焰法杖配方',
    resultId: 'flame_staff',
    resultRarity: 'epic',
    resultLevel: 10,
    materials: [
      { matId: 'ancient_core', count: 1 },
      { matId: 'enhance_stone', count: 10 },
      { matId: 'chaos_essence', count: 2 }
    ],
    gold: 2500,
    requiredLevel: 10
  },
  copper_ring_recipe: {
    id: 'copper_ring_recipe',
    name: '铜戒配方',
    resultId: 'copper_ring',
    resultRarity: 'rare',
    resultLevel: 6,
    materials: [
      { matId: 'enhance_stone', count: 4 },
      { matId: 'iron_shard', count: 10 }
    ],
    gold: 600,
    requiredLevel: 6
  },
  bone_necklace_recipe: {
    id: 'bone_necklace_recipe',
    name: '骨项链配方',
    resultId: 'bone_necklace',
    resultRarity: 'epic',
    resultLevel: 12,
    materials: [
      { matId: 'ancient_core', count: 2 },
      { matId: 'soul_crystal', count: 1 }
    ],
    gold: 3000,
    requiredLevel: 12
  },

  // ── 神器配方（Mythic Tier）────────────────
  divine_blade_recipe: {
    id: 'divine_blade_recipe',
    name: '神圣巨剑配方',
    resultId: 'lava_blade',
    resultRarity: 'mythic',
    resultLevel: 15,
    materials: [
      { matId: 'world_core',   count: 1 },
      { matId: 'divine_heart', count: 3 },
      { matId: 'soul_crystal', count: 5 },
      { matId: 'ancient_core', count: 10 }
    ],
    gold: 20000,
    requiredLevel: 15
  },
  world_guardian_recipe: {
    id: 'world_guardian_recipe',
    name: '世界守护者配方',
    resultId: 'guardian_plate',
    resultRarity: 'mythic',
    resultLevel: 15,
    materials: [
      { matId: 'world_core',   count: 1 },
      { matId: 'divine_heart', count: 4 },
      { matId: 'ancient_core', count: 12 }
    ],
    gold: 25000,
    requiredLevel: 15
  },
  abyss_ring_recipe: {
    id: 'abyss_ring_recipe',
    name: '深渊之戒配方',
    resultId: 'copper_ring',
    resultRarity: 'mythic',
    resultLevel: 15,
    materials: [
      { matId: 'divine_heart', count: 5 },
      { matId: 'soul_crystal', count: 8 },
      { matId: 'star_fragment', count: 6 }
    ],
    gold: 18000,
    requiredLevel: 15
  },
  void_robe_recipe: {
    id: 'void_robe_recipe',
    name: '虚空法袍配方',
    resultId: 'flame_staff',
    resultRarity: 'mythic',
    resultLevel: 15,
    materials: [
      { matId: 'world_core',   count: 1 },
      { matId: 'divine_heart', count: 3 },
      { matId: 'chaos_essence', count: 15 }
    ],
    gold: 22000,
    requiredLevel: 15
  }
};
