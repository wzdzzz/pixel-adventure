/**
 * 材料数据
 *
 * Tier 1: 强化 +1~+5
 * Tier 2: 强化 +6~+10
 * Tier 3: 强化 +11~+15
 *
 * Phase 1 仅启用 enhance 用途的材料；其他 Phase 2/3 用途占位。
 */
export const MATERIALS = {
  iron_shard:     { id:'iron_shard',    name:'铁矿碎片', tier:1, color:'#999999', icon:'⛓️', desc:'低级强化材料' },
  enhance_stone:  { id:'enhance_stone', name:'强化石',   tier:2, color:'#4488ff', icon:'💠', desc:'中级强化材料' },
  ancient_core:   { id:'ancient_core',  name:'远古核心', tier:3, color:'#bb44ff', icon:'🔮', desc:'高级强化材料' }
};

/** 装备品质 → 分解产物（材料 ID + 数量） */
export const DECOMPOSE_TABLE = {
  common:    [{ matId:'iron_shard', count: 1 }],
  uncommon:  [{ matId:'iron_shard', count: 2 }],
  rare:      [{ matId:'enhance_stone', count: 1 }],
  epic:      [{ matId:'enhance_stone', count: 2 }],
  legendary: [{ matId:'ancient_core', count: 1 }],
  mythic:    [{ matId:'ancient_core', count: 2 }]
};

/** 强化等级 → 所需材料 + 金币（每次尝试） */
export function getEnhanceCost(currentLevel) {
  const next = currentLevel + 1;
  if (next <= 5)  return { matId:'iron_shard',    count: next * 2,        gold: next * 50 };
  if (next <= 10) return { matId:'enhance_stone', count: next - 5,        gold: next * 200 };
  if (next <= 15) return { matId:'ancient_core',  count: next - 10,       gold: next * 800 };
  return null;
}

/** 强化等级 → 成功率 */
export function getEnhanceSuccessRate(currentLevel) {
  const next = currentLevel + 1;
  if (next <= 5)  return 1.0;
  if (next <= 10) return 0.7;
  if (next <= 15) return 0.4;
  return 0;
}

/** 强化失败行为：维持 / 降级 */
export function getEnhanceFailureBehavior(currentLevel) {
  const next = currentLevel + 1;
  if (next <= 10) return 'stay';
  return 'downgrade';
}
