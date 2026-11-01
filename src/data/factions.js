/**
 * 阵营定义 + 5 级关系阈值
 *
 * 关系等级（reputation 数值 → 关系名称）：
 *   60~100  亲密 intimate    商店满折扣 / 解锁专属对话
 *   20~59   友好 friendly    商店折扣 / 额外对话选项
 *   -19~19  中立 neutral     默认对话 / 正常售价
 *   -59~-20 敌对 hostile     拒绝服务 / 在领地内攻击
 *   -100~-60 仇恨 vengeful   主动追击玩家
 */

export const FACTIONS = {
  player:     { id: 'player',     hostileTo: [] },
  ally:       { id: 'ally',       hostileTo: ['monster', 'bandit'] },
  townfolk:   { id: 'townfolk',   hostileTo: ['monster', 'bandit'] },
  town_guard: { id: 'town_guard', hostileTo: ['monster', 'bandit'] },
  monster:    { id: 'monster',    hostileTo: ['player', 'ally', 'townfolk', 'town_guard'] },
  bandit:     { id: 'bandit',     hostileTo: ['player', 'ally', 'townfolk', 'town_guard'] },
  neutral:    { id: 'neutral',    hostileTo: [] }
};

export const INITIAL_REPUTATION = {
  player: 0,
  townfolk: 0,
  town_guard: 0,
  ally: 50,
  monster: -100,
  bandit: -50,
  neutral: 0
};

export const RELATION_THRESHOLDS = [
  { min: 60,   name: 'intimate',  label: '亲密', emoji: '💚', discount: 0.7 },
  { min: 20,   name: 'friendly',  label: '友好', emoji: '💛', discount: 0.85 },
  { min: -19,  name: 'neutral',   label: '中立', emoji: '⚪', discount: 1.0 },
  { min: -59,  name: 'hostile',   label: '敌对', emoji: '💢', discount: null },
  { min: -100, name: 'vengeful',  label: '仇恨', emoji: '🗡', discount: null }
];

export const REPUTATION_DELTAS = {
  quest_completed: +10,
  quest_failed: -5,
  shop_purchase: +1,
  shop_sell: +1,
  accidental_hit: -3,
  accidental_kill: -20,
  faction_member_killed: -10,
  faction_boss_killed: -30,
  gift_loved: +10,
  gift_liked: +5,
  gift_neutral: +1,
  gift_hated: -10,
  reputation_quest_completed: +20
};

/** 误伤累计转敌对阈值 */
export const ACCIDENTAL_HIT_AGGRO_THRESHOLD = 3;

/** 根据 reputation 值返回所属关系等级对象 */
export function getRelationByValue(value) {
  for (const t of RELATION_THRESHOLDS) {
    if (value >= t.min) return t;
  }
  return RELATION_THRESHOLDS[RELATION_THRESHOLDS.length - 1];
}

/** 比较两个关系等级：returns -1/0/1 (越亲密越大) */
export function compareRelations(nameA, nameB) {
  const idx = (name) => RELATION_THRESHOLDS.findIndex(t => t.name === name);
  const a = idx(nameA);
  const b = idx(nameB);
  if (a === b) return 0;
  return a < b ? 1 : -1;  // 数组前面 = 更亲密
}
