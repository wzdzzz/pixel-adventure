/**
 * 秘境(副本)定义 — 手工模板，整图一次构建，无流式
 *
 * 每个秘境：三层 tile 地图(同 world_tileset 索引) + 固定实体摆放 + 出入口 + 大世界洞口。
 * 实体 id 统一 `site:<siteId>:<n>` 前缀，击杀/宝箱记录直接复用 WorldStateManager。
 * 无 Phaser 依赖。
 */
import { TILE_IDS } from './WorldGenerator.js';

/** 创建 H×W 网格 */
function makeGrid(w, h, fill) {
  return Array.from({ length: h }, () => new Array(w).fill(fill));
}

// ─── 试炼洞窟 40×40：入口厅 → 中厅 → 宝箱后厅 ──────────────
function generateTrialCaveMap() {
  const W = 40, H = 40;
  const ground = makeGrid(W, H, TILE_IDS.STONE_FLOOR);
  const walls = makeGrid(W, H, TILE_IDS.EMPTY);
  const decorations = makeGrid(W, H, TILE_IDS.EMPTY);

  // 外墙一圈
  for (let x = 0; x < W; x++) { walls[0][x] = TILE_IDS.WALL; walls[H - 1][x] = TILE_IDS.WALL; }
  for (let y = 0; y < H; y++) { walls[y][0] = TILE_IDS.WALL; walls[y][W - 1] = TILE_IDS.WALL; }

  // 横向隔断 1(y=28)：入口厅与中厅之间，留 x=18..21 门洞
  for (let x = 1; x < W - 1; x++) if (x < 18 || x > 21) walls[28][x] = TILE_IDS.WALL;
  // 横向隔断 2(y=12)：中厅与宝箱后厅之间，留 x=18..21 门洞
  for (let x = 1; x < W - 1; x++) if (x < 18 || x > 21) walls[12][x] = TILE_IDS.WALL;
  // 中厅两列石柱(走位掩体)
  for (let y = 16; y < 25; y += 4) { walls[y][10] = TILE_IDS.ROCK; walls[y][29] = TILE_IDS.ROCK; }

  // 装饰点缀
  decorations[30][8] = TILE_IDS.MUSHROOM;
  decorations[33][30] = TILE_IDS.MUSHROOM;
  decorations[20][20] = TILE_IDS.GRASS_TALL;
  decorations[8][12] = TILE_IDS.MUSHROOM;

  return { ground, walls, decorations };
}

export const SITES = {
  trial_cave: {
    id: 'trial_cave',
    name: '试炼洞窟',
    widthTiles: 40,
    heightTiles: 40,
    generateMap: generateTrialCaveMap,
    /** 玩家进入落点(入口厅) */
    entry: { tileX: 20, tileY: 35 },
    /** 出口传送门位置(入口厅内、entry 下方两格) */
    exit: { tileX: 20, tileY: 37 },
    /** 秘境环境音乐(现有曲库 key，null=不切换) */
    musicKey: 'explore',
    /** 大世界洞口：城镇 (8,8) 东侧邻 chunk */
    entrance: { chunkX: 9, chunkY: 8, tileX: 8, tileY: 8, label: '试炼洞窟' },
    /** 固定实体摆放(tile 坐标) */
    spawns: [
      { id: 'site:trial_cave:e1', type: 'skeleton', level: 3, tileX: 14, tileY: 22 },
      { id: 'site:trial_cave:e2', type: 'skeleton', level: 3, tileX: 26, tileY: 22 },
      { id: 'site:trial_cave:e3', type: 'spider', level: 4, tileX: 20, tileY: 17 },
      { id: 'site:trial_cave:e4', type: 'orc_warrior', level: 5, tileX: 20, tileY: 8 },
      { id: 'site:trial_cave:chest1', type: 'chest', rare: true, lootTable: 'treasure_rare', tileX: 20, tileY: 5 },
    ],
  },
};

// ─── 洞口按 chunk 查询(WorldGenerator 生成实体时调用) ────────
/** @type {Map<string, Array>} "chunkX,chunkY" → entrance 列表 */
const _entranceByChunk = new Map();
for (const site of Object.values(SITES)) {
  const key = `${site.entrance.chunkX},${site.entrance.chunkY}`;
  if (!_entranceByChunk.has(key)) _entranceByChunk.set(key, []);
  _entranceByChunk.get(key).push({ siteId: site.id, ...site.entrance });
}

/**
 * 查询某 chunk 上的秘境洞口
 * @returns {Array<{siteId:string, chunkX:number, chunkY:number, tileX:number, tileY:number, label:string}>}
 */
export function getSiteEntrancesForChunk(chunkX, chunkY) {
  return _entranceByChunk.get(`${chunkX},${chunkY}`) || [];
}
