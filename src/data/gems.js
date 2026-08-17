/**
 * 宝石数据：4 色 × 10 级
 *
 * 玩家通过镶嵌到装备孔位获得贡献；3 同色同级合成高 1 级。
 */

const COLORS = ['red', 'blue', 'green', 'yellow'];

const STAT_DEF = {
  red:    { stat: 'attack',     isFlat: true, baseValue: 3 },
  blue:   { stat: 'spellPower', isFlat: true, baseValue: 4 },
  green:  { stat: 'maxHp',      isFlat: true, baseValue: 15 },
  yellow: { stat: 'critRate',   isFlat: true, baseValue: 1.5 }
};

const STAT_LABEL = { attack: '攻击', spellPower: '术法强度', maxHp: '气血', critRate: '暴击率' };

export const GEMS = {};
for (const color of COLORS) {
  const def = STAT_DEF[color];
  GEMS[`${color}_gem`] = {
    id: `${color}_gem`,
    color,
    name: { red:'赤霞灵玉', blue:'沧溟灵玉', green:'青木灵玉', yellow:'金阳灵玉' }[color],
    stat: def.stat,
    isFlat: def.isFlat,
    baseValue: def.baseValue,
    icon: { red:'🔴', blue:'🔵', green:'🟢', yellow:'🟡' }[color]
  };
}

/** 取宝石在某等级的属性值 */
export function getGemValue(gemId, level) {
  const def = GEMS[gemId];
  if (!def) return 0;
  return def.baseValue * level;
}

/** 取宝石实例（用于 inventory 存储） */
export function makeGemInstance(gemId, level = 1) {
  const def = GEMS[gemId];
  if (!def) return null;
  const value = getGemValue(gemId, level);
  const valueText = def.stat === 'critRate'
    ? `${value.toFixed(1)}%`
    : (def.isFlat ? value : `${(value * 100).toFixed(1)}%`);
  return {
    id: gemId,
    type: 'gem',
    color: def.color,
    name: `${def.name} · ${level}阶`,
    icon: def.icon,
    level,
    stat: def.stat,
    value,
    isFlat: def.isFlat,
    rarity: level >= 7 ? 'epic' : level >= 4 ? 'rare' : level >= 2 ? 'uncommon' : 'common',
    stackable: true,
    maxStack: 99,
    description: `镶入装备孔位，${STAT_LABEL[def.stat] || def.stat} +${valueText}`,
    sellPrice: level * level * 5
  };
}

export const MAX_GEM_LEVEL = 10;
