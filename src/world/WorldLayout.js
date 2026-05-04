/**
 * 预制区域定义（城镇/Boss房/营地坐标）
 *
 * 提供 WORLD_LAYOUT（坐标定义）、getTemplate（模板地形+实体）、
 * getLayoutOverride（查询某 chunk 是否为预制区域）。
 * 无 Phaser 依赖。
 */
import { TILE_IDS } from './WorldGenerator.js';

/** chunk 边长（tile 数） */
const CHUNK_SIZE = 32;

// ─── 世界预制区域坐标 ───────────────────────────────────────
export const WORLD_LAYOUT = {
  // 城镇中心 (8,8)
  town: { chunkX: 8, chunkY: 8, template: 'town_center' },

  // 各区营地
  camps: [
    { chunkX: 5,  chunkY: 5,  template: 'camp_small' },
    { chunkX: 11, chunkY: 5,  template: 'camp_small' },
    { chunkX: 5,  chunkY: 11, template: 'camp_small' },
    { chunkX: 11, chunkY: 11, template: 'camp_small' },
  ],

  // Boss 房
  bosses: [
    { chunkX: 2,  chunkY: 2,  bossType: 'giant_skeleton', template: 'boss_arena' },
    { chunkX: 14, chunkY: 2,  bossType: 'skeleton_king',  template: 'boss_arena' },
    { chunkX: 2,  chunkY: 14, bossType: 'giant_skeleton', template: 'boss_arena' },
    { chunkX: 14, chunkY: 14, bossType: 'skeleton_king',  template: 'boss_arena' },
  ]
};

// ─── 快速查找表：(chunkX, chunkY) → 覆盖信息 ──────────────
/** @type {Map<string, {template:string, [key:string]:any}>} */
const _overrideMap = new Map();

// 构建查找表
function _buildOverrideMap() {
  // 城镇
  const t = WORLD_LAYOUT.town;
  _overrideMap.set(`${t.chunkX},${t.chunkY}`, { template: t.template });

  // 营地
  for (const camp of WORLD_LAYOUT.camps) {
    _overrideMap.set(`${camp.chunkX},${camp.chunkY}`, { template: camp.template });
  }

  // Boss 房
  for (const boss of WORLD_LAYOUT.bosses) {
    _overrideMap.set(`${boss.chunkX},${boss.chunkY}`, {
      template: boss.template,
      bossType: boss.bossType
    });
  }
}
_buildOverrideMap();

// ─── 公共 API ──────────────────────────────────────────────

/**
 * 查询某 chunk 是否为预制区域。
 * @param {number} chunkX
 * @param {number} chunkY
 * @returns {{template:string, bossType?:string}|null} 覆盖信息，或 null
 */
export function getLayoutOverride(chunkX, chunkY) {
  return _overrideMap.get(`${chunkX},${chunkY}`) || null;
}

// ─── 辅助：创建空 32×32 网格 ─────────────────────────────────
function makeGrid(fill) {
  return Array.from({ length: CHUNK_SIZE }, () => new Array(CHUNK_SIZE).fill(fill));
}

// ─── 模板生成器 ─────────────────────────────────────────────

/**
 * 生成城镇中心模板（32×32）。
 * - 中央广场 (10-22, 10-22) 石砖地面 + 木栅围栏（四个方向留入口）
 * - 广场外草地
 * - NPC（商店/铁匠/任务）+ 篝火，无敌人
 */
function _templateTownCenter(chunkX, chunkY) {
  const ground      = makeGrid(TILE_IDS.GRASS);
  const walls       = makeGrid(TILE_IDS.EMPTY);
  const decorations = makeGrid(TILE_IDS.EMPTY);
  const entities    = [];

  // 中央广场区域 (10..21, 10..21) → 石砖地面
  for (let ly = 10; ly < 22; ly++) {
    for (let lx = 10; lx < 22; lx++) {
      ground[ly][lx] = TILE_IDS.STONE_FLOOR;
    }
  }

  // 围栏边界（广场边缘一圈）
  for (let lx = 10; lx < 22; lx++) {
    walls[10][lx] = TILE_IDS.FENCE; // 上边
    walls[21][lx] = TILE_IDS.FENCE; // 下边
  }
  for (let ly = 10; ly < 22; ly++) {
    walls[ly][10] = TILE_IDS.FENCE; // 左边
    walls[ly][21] = TILE_IDS.FENCE; // 右边
  }

  // 四个方向留入口（各 2 格宽）
  // 北入口 (15-16, 10)
  walls[10][15] = TILE_IDS.EMPTY;
  walls[10][16] = TILE_IDS.EMPTY;
  // 南入口 (15-16, 21)
  walls[21][15] = TILE_IDS.EMPTY;
  walls[21][16] = TILE_IDS.EMPTY;
  // 西入口 (10, 15-16)
  walls[15][10] = TILE_IDS.EMPTY;
  walls[16][10] = TILE_IDS.EMPTY;
  // 东入口 (21, 15-16)
  walls[15][21] = TILE_IDS.EMPTY;
  walls[16][21] = TILE_IDS.EMPTY;

  // 广场内放一些装饰
  decorations[12][12] = TILE_IDS.FLOWER;
  decorations[12][19] = TILE_IDS.FLOWER;
  decorations[19][12] = TILE_IDS.FLOWER;
  decorations[19][19] = TILE_IDS.FLOWER;

  // 实体：NPC + 篝火
  entities.push(
    { id: 'town_npc_shop',  type: 'npc', subtype: 'shop',  localX: 16, localY: 12 },
    { id: 'town_npc_smith', type: 'npc', subtype: 'smith', localX: 14, localY: 16 },
    { id: 'town_bonfire',   type: 'bonfire',               localX: 16, localY: 16 },
    { id: 'town_npc_quest', type: 'npc', subtype: 'quest', localX: 18, localY: 16 }
  );

  return { ground, walls, decorations, biome: 'forest', entities };
}

/**
 * 生成小营地模板（32×32）。
 * - 中央空地 (12-20, 12-20) 石砖
 * - 部分围栏 + 2 个入口
 * - 篝火 + 商人 NPC，无敌人
 */
function _templateCampSmall(chunkX, chunkY) {
  const ground      = makeGrid(TILE_IDS.GRASS);
  const walls       = makeGrid(TILE_IDS.EMPTY);
  const decorations = makeGrid(TILE_IDS.EMPTY);
  const entities    = [];

  // 小空地 (12..19, 12..19) → 石砖
  for (let ly = 12; ly < 20; ly++) {
    for (let lx = 12; lx < 20; lx++) {
      ground[ly][lx] = TILE_IDS.STONE_FLOOR;
    }
  }

  // 部分围栏（上、下边完整，左右各留 2 格入口）
  for (let lx = 12; lx < 20; lx++) {
    walls[12][lx] = TILE_IDS.FENCE; // 上边
    walls[19][lx] = TILE_IDS.FENCE; // 下边
  }
  for (let ly = 12; ly < 20; ly++) {
    walls[ly][12] = TILE_IDS.FENCE; // 左边
    walls[ly][19] = TILE_IDS.FENCE; // 右边
  }

  // 入口：南侧 (15-16, 19) 和 北侧 (15-16, 12)
  walls[19][15] = TILE_IDS.EMPTY;
  walls[19][16] = TILE_IDS.EMPTY;
  walls[12][15] = TILE_IDS.EMPTY;
  walls[12][16] = TILE_IDS.EMPTY;

  // 实体：篝火 + 商人 NPC（ID 包含 chunk 坐标以保证唯一性）
  entities.push(
    { id: `camp_bonfire_${chunkX}_${chunkY}`, type: 'bonfire',               localX: 16, localY: 16 },
    { id: `camp_npc_${chunkX}_${chunkY}`,     type: 'npc', subtype: 'merchant', localX: 16, localY: 14 }
  );

  return { ground, walls, decorations, biome: 'forest', entities };
}

/**
 * 生成 Boss 竞技场模板（32×32）。
 * - 大开放区域 (4-28, 4-28) 石砖地面
 * - 四周封闭墙壁，底部中央入口
 * - Boss + 6-8 随从 + 锁定宝箱
 */
function _templateBossArena(chunkX, chunkY, extra) {
  const ground      = makeGrid(TILE_IDS.STONE_FLOOR);
  const walls       = makeGrid(TILE_IDS.EMPTY);
  const decorations = makeGrid(TILE_IDS.EMPTY);
  const entities    = [];

  // 外围区域填充墙壁（0-3 和 28-31 行/列）
  for (let ly = 0; ly < CHUNK_SIZE; ly++) {
    for (let lx = 0; lx < CHUNK_SIZE; lx++) {
      if (lx < 4 || lx >= 28 || ly < 4 || ly >= 28) {
        walls[ly][lx] = TILE_IDS.WALL;
        ground[ly][lx] = TILE_IDS.STONE_FLOOR;
      }
    }
  }

  // 底部中央入口 (14-18, 28-31)：清除墙壁
  for (let ly = 28; ly < CHUNK_SIZE; ly++) {
    for (let lx = 14; lx <= 18; lx++) {
      walls[ly][lx] = TILE_IDS.EMPTY;
    }
  }

  // Boss 实体
  const bossType = extra?.bossType || 'giant_skeleton';
  entities.push({
    id: `boss_${bossType}_${chunkX}_${chunkY}`,
    type: bossType,
    localX: 16,
    localY: 14,
    level: 20,
    isBoss: true
  });

  // 6-8 随从（使用确定性种子计算数量）
  // 简单 hash 决定随从数量：6 + (chunkX * 3 + chunkY * 7) % 3
  const minionCount = 6 + ((chunkX * 3 + chunkY * 7) % 3);
  const minionType = bossType === 'skeleton_king' ? 'skeleton' : 'goblin';

  // 随从位置：围绕 Boss 均匀分布
  const angleStep = (2 * Math.PI) / minionCount;
  const radius = 5;
  for (let i = 0; i < minionCount; i++) {
    const angle = angleStep * i;
    const lx = 16 + Math.round(Math.cos(angle) * radius);
    const ly = 14 + Math.round(Math.sin(angle) * radius);
    // 确保在竞技场范围内
    const clampedX = Math.max(5, Math.min(27, lx));
    const clampedY = Math.max(5, Math.min(27, ly));
    entities.push({
      id: `minion_${minionType}_${chunkX}_${chunkY}_${i}`,
      type: minionType,
      localX: clampedX,
      localY: clampedY,
      level: 15,
      pack: 0
    });
  }

  // 锁定宝箱（击败 Boss 的奖励）
  entities.push({
    id: `boss_chest_${chunkX}_${chunkY}`,
    type: 'chest',
    localX: 16,
    localY: 24,
    locked: true
  });

  return { ground, walls, decorations, biome: 'ruins', entities };
}

// ─── 模板注册表 ──────────────────────────────────────────────
const TEMPLATE_GENERATORS = {
  town_center: _templateTownCenter,
  camp_small:  _templateCampSmall,
  boss_arena:  _templateBossArena,
};

/**
 * 根据模板名称生成完整的 chunk 数据（地形 + 实体）。
 *
 * @param {string} templateName - 模板名（如 'town_center'）
 * @param {number} chunkX
 * @param {number} chunkY
 * @param {object} [extra] - 额外参数（如 bossType）
 * @returns {{ ground: number[][], walls: number[][], decorations: number[][], biome: string, entities: Array }}
 */
export function getTemplate(templateName, chunkX, chunkY, extra) {
  const generator = TEMPLATE_GENERATORS[templateName];
  if (!generator) {
    console.warn(`[WorldLayout] 未知模板: ${templateName}`);
    // 返回默认空模板
    return {
      ground: makeGrid(TILE_IDS.GRASS),
      walls: makeGrid(TILE_IDS.EMPTY),
      decorations: makeGrid(TILE_IDS.EMPTY),
      biome: 'forest',
      entities: []
    };
  }
  return generator(chunkX, chunkY, extra);
}
