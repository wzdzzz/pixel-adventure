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
  }
};
