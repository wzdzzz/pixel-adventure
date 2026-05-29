/**
 * 任务数据（开放世界）
 *
 * 状态流转：locked → available（任务板可接）→ active（追踪中）→ completed（已结算）。
 * autoAvailable: true 的任务进游戏即 available；否则 locked，由触发器（NPC/事件）开启。
 *
 * 目标类型（QuestSystem 已支持的事件追踪）：
 *   kill    — target = 敌人 config id（如 'slime'），enemyDeath 事件 +1
 *   collect — target = 物品 id（如 'potion'），inventoryUpdated 统计背包数量
 *
 * 奖励达成后由 QuestSystem.checkQuestCompletion 自动发放（xp + gold）。
 */

/** 敌人中文名（赏金/任务文本用；enemyConfig 无内置中文名） */
export const ENEMY_NAMES = {
  slime: '史莱姆',
  goblin: '哥布林',
  spider: '巨蛛',
  skeleton: '骷髅',
  bat: '蝙蝠',
  orc_warrior: '兽人战士',
  fire_mage: '火法师',
  giant_skeleton: '巨型骷髅',
  skeleton_king: '骷髅王',
};

/** 可作为赏金目标的敌人（排除 Boss）+ 每个赏金的默认击杀数（按 tier） */
export const BOUNTY_TARGETS = [
  { id: 'slime', count: 8 },
  { id: 'bat', count: 8 },
  { id: 'goblin', count: 5 },
  { id: 'spider', count: 5 },
  { id: 'skeleton', count: 5 },
  { id: 'orc_warrior', count: 3 },
  { id: 'fire_mage', count: 3 },
];

export const questData = [
  // ── 主线引导：开局即可接 ──
  {
    id: 'ow_first_hunt',
    title: '初出茅庐',
    type: 'main',
    description: '城外的史莱姆是新手最好的磨刀石。清理一些，证明你的实力。',
    autoAvailable: true,
    objectives: [
      { id: 'kill_slimes_intro', text: '击败史莱姆', type: 'kill', target: 'slime', required: 5 },
    ],
    rewards: { xp: 80, gold: 60 },
  },
  {
    id: 'ow_goblin_threat',
    title: '哥布林的威胁',
    type: 'main',
    description: '哥布林正在城镇周边聚集，趁它们成势之前削减其数量。',
    autoAvailable: true,
    objectives: [
      { id: 'kill_goblins', text: '击败哥布林', type: 'kill', target: 'goblin', required: 6 },
    ],
    rewards: { xp: 140, gold: 100 },
  },
  {
    id: 'ow_bone_legion',
    title: '白骨军团',
    type: 'main',
    description: '废墟中游荡的骷髅越来越多，把它们送回安息。',
    autoAvailable: true,
    objectives: [
      { id: 'kill_skeletons', text: '击败骷髅', type: 'kill', target: 'skeleton', required: 6 },
      { id: 'kill_giant', text: '击败巨型骷髅', type: 'kill', target: 'giant_skeleton', required: 1 },
    ],
    rewards: { xp: 260, gold: 180 },
  },
  {
    id: 'ow_slay_king',
    title: '讨伐骷髅王',
    type: 'main',
    description: '骷髅王盘踞于 Boss 区域。击败它，终结这片土地的不死之患。',
    autoAvailable: true,
    objectives: [
      { id: 'kill_king', text: '击败骷髅王', type: 'kill', target: 'skeleton_king', required: 1 },
    ],
    rewards: { xp: 600, gold: 500 },
  },

  // ── 支线：收集 ──
  {
    id: 'ow_stock_potions',
    title: '补给储备',
    type: 'side',
    description: '冒险离不开药水。备齐一些以应对险境。',
    autoAvailable: true,
    objectives: [
      { id: 'collect_potions', text: '持有治疗药水', type: 'collect', target: 'potion', required: 3 },
    ],
    rewards: { xp: 50, gold: 40 },
  },
];
