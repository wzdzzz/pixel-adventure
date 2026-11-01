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
  slime: '浊水精',
  goblin: '山魈',
  spider: '噬魂蛛',
  skeleton: '阴兵',
  bat: '吸灵蝠',
  orc_warrior: '妖族力士',
  fire_mage: '业火邪修',
  giant_skeleton: '尸傀将军',
  skeleton_king: '白骨鬼王',
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
  // ── 主线：序章 + 链式四幕（由悬赏执事雷九逐幕交接，acceptQuest 支持 locked→active）──
  {
    id: 'ow_prologue',
    title: '初到坊市',
    type: 'main',
    description: '要在云荒讨生活，先去悬赏堂找执事雷九挂名登记。',
    autoAvailable: false,  // 新档由 MainGameScene 直接 acceptQuest 激活；老档迁移视为已完成
    objectives: [
      { id: 'meet_leijou', text: '到悬赏堂找雷九登记', type: 'interact', target: 'bounty_officer', required: 1 },
    ],
    rewards: {},  // 奖励在登记对话里发（回春散×3）
  },
  {
    id: 'ow_first_hunt',
    title: '坊外除祟',
    type: 'main',
    description: '栖云坊市外的浊水精频频侵扰商路。清理一些，回悬赏堂向雷九复命。',
    autoAvailable: false,
    objectives: [
      { id: 'kill_slimes_intro', text: '击败浊水精', type: 'kill', target: 'slime', required: 5 },
    ],
    rewards: { xp: 80, gold: 60 },
  },
  {
    id: 'ow_goblin_threat',
    title: '山魈作乱',
    type: 'main',
    description: '西面山林的山魈近来不安分，趁它们侵入坊市前削减其数量，再回报雷九。',
    autoAvailable: false,
    objectives: [
      { id: 'kill_goblins', text: '击败山魈', type: 'kill', target: 'goblin', required: 6 },
    ],
    rewards: { xp: 140, gold: 100 },
  },
  {
    id: 'ow_bone_legion',
    title: '阴兵过境',
    type: 'main',
    description: '北面太虚宗遗址的封印松脱，阴兵四出，还有尸傀将军统领。破去阴煞，回报雷九。',
    autoAvailable: false,
    objectives: [
      { id: 'kill_skeletons', text: '击败阴兵', type: 'kill', target: 'skeleton', required: 6 },
      { id: 'kill_giant', text: '击败尸傀将军', type: 'kill', target: 'giant_skeleton', required: 1 },
    ],
    rewards: { xp: 260, gold: 180 },
  },
  {
    id: 'ow_slay_king',
    title: '镇压白骨鬼王',
    type: 'main',
    description: '操纵这场灵潮的白骨鬼王盘踞在遗址深处。击败它，取回镇界古印，平定云荒异变。',
    autoAvailable: false,
    objectives: [
      { id: 'kill_king', text: '击败白骨鬼王', type: 'kill', target: 'skeleton_king', required: 1 },
    ],
    rewards: { xp: 600, gold: 500 },
  },

  // ── 支线：收集 ──
  {
    id: 'ow_stock_potions',
    title: '行囊备药',
    type: 'side',
    description: '游历六境难免负伤，备齐回春药再踏出坊市。',
    autoAvailable: true,
    objectives: [
      { id: 'collect_potions', text: '持有回春药', type: 'collect', target: 'potion', required: 3 },
    ],
    rewards: { xp: 50, gold: 40 },
  },
];
