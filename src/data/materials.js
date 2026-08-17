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
  iron_shard:      { id:'iron_shard',      name:'玄铁屑',     tier:1, color:'#999999', icon:'⛓️', desc:'炼器余下的玄铁碎屑，可用于低阶淬炼' },
  enhance_stone:   { id:'enhance_stone',   name:'淬灵石',     tier:2, color:'#4488ff', icon:'💠', desc:'蕴有精纯灵力的矿石，可用于中阶淬炼' },
  ancient_core:    { id:'ancient_core',    name:'古阵枢',     tier:3, color:'#bb44ff', icon:'🔮', desc:'古老阵法的残存枢核，可用于高阶淬炼' },
  refining_stone:  { id:'refining_stone',  name:'炼器灵砂',   tier:2, color:'#66aacc', icon:'🪨', desc:'炼器时用于调和材质的细密灵砂' },
  chaos_essence:   { id:'chaos_essence',   name:'混元灵髓',   tier:2, color:'#cc44aa', icon:'🌀', desc:'灵机未分的稀有灵髓，可用于洗练器物词条' },
  soul_crystal:    { id:'soul_crystal',    name:'魂晶',       tier:3, color:'#aa66ff', icon:'💎', desc:'凝聚残魂之力的晶石，可在洗练时锁定词条' },
  star_fragment:   { id:'star_fragment',   name:'星髓',       tier:3, color:'#ffdd66', icon:'⭐', desc:'凝聚星辉的矿髓，可用于提升灵玉品阶' },
  divine_heart:    { id:'divine_heart',    name:'天工道心',   tier:4, color:'#ffaa33', icon:'❤️‍🔥', desc:'上古炼器宗师留下的道韵结晶，可炼制灵宝' },
  world_core:      { id:'world_core',      name:'界源灵核',   tier:5, color:'#ff66ff', icon:'🌐', desc:'蕴含一方天地本源的灵核，可炼制仙品器物' }
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

/** 强化等级 → 所需材料 + 灵石（每次尝试，字段名保持 gold 兼容） */
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

/** 强化失败行为：全等级失败只消耗材料，不降级 */
export function getEnhanceFailureBehavior(currentLevel) {
  return 'stay';
}
