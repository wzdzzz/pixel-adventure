export const THEME_CONFIG = Object.freeze({
  id: 'xianxia',
  version: 1,
  title: '云荒问道',
  subtitle: '像素修仙冒险',
  currency: '灵石',
  experience: '修为',
  skillPoint: '悟道点',
});

export const CLASS_LABELS = Object.freeze({
  warrior: '体修',
  archer: '剑修',
  mage: '术修',
});

export const RESOURCE_LABELS = Object.freeze({
  rage: '罡气',
  stamina: '剑意',
  mana: '灵力',
  none: '',
});

export const STAT_LABELS = Object.freeze({
  con: '体魄',
  str: '力道',
  int: '悟性',
  agi: '身法',
  per: '神识',
  lck: '机缘',
});

export const RARITY_LABELS = Object.freeze({
  common: '凡品',
  uncommon: '良品',
  rare: '上品',
  epic: '极品',
  legendary: '灵宝',
  mythic: '仙品',
});

export const EQUIPMENT_SLOT_LABELS = Object.freeze({
  weapon: '主器',
  offhand: '副器',
  helmet: '发冠',
  armor: '护身',
  boots: '云履',
  necklace: '玉佩',
  ring1: '戒指',
  ring2: '戒指',
});

export const WEAPON_TYPE_LABELS = Object.freeze({
  heavy: '重兵',
  light: '飞剑',
  magic: '法器',
});

export const WEAPON_CLASS_LABELS = Object.freeze({
  heavy: CLASS_LABELS.warrior,
  light: CLASS_LABELS.archer,
  magic: CLASS_LABELS.mage,
});

export function getClassLabel(classType) {
  return CLASS_LABELS[classType] || CLASS_LABELS.warrior;
}
