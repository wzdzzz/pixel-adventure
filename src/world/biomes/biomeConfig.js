/**
 * Biome 定义和配置
 * 纯数据层 — 无 Phaser 依赖
 */

// ─── 6 种 biome 基础配置 ─────────────────────────────────
export const BIOMES = {
  forest:  { id: 'forest',  name: '迷雾森林', groundTile: 0,  wallTile: 1,  treeDensity: 0.15, enemyDensity: 'medium' },
  ruins:   { id: 'ruins',   name: '古老废墟', groundTile: 2,  wallTile: 3,  treeDensity: 0.03, enemyDensity: 'high' },
  snow:    { id: 'snow',    name: '冰封雪原', groundTile: 4,  wallTile: 5,  treeDensity: 0.08, enemyDensity: 'medium' },
  desert:  { id: 'desert',  name: '灼热沙漠', groundTile: 6,  wallTile: 7,  treeDensity: 0.01, enemyDensity: 'low' },
  swamp:   { id: 'swamp',   name: '腐朽沼泽', groundTile: 8,  wallTile: 9,  treeDensity: 0.10, enemyDensity: 'high' },
  volcano: { id: 'volcano', name: '熔岩火山', groundTile: 10, wallTile: 11, treeDensity: 0.02, enemyDensity: 'very_high' }
};

// ─── 每种 biome 可生成的敌人类型 ─────────────────────────
export const BIOME_ENEMIES = {
  forest:  ['slime', 'bat', 'spider'],
  ruins:   ['skeleton', 'goblin'],
  snow:    ['slime', 'bat'],              // 暂用已有怪物
  desert:  ['spider', 'goblin'],
  swamp:   ['slime', 'spider', 'skeleton'],
  volcano: ['orc_warrior', 'fire_mage']
};

// ─── 世界中心 & 半径 ────────────────────────────────────
export const WORLD_CENTER = { x: 8, y: 8 };
export const WORLD_RADIUS = 8;

/**
 * 根据 chunk 坐标计算难度系数
 * @param {number} cx - chunk X
 * @param {number} cy - chunk Y
 * @returns {number} 0（城镇周围最简单）~1（最远最难）
 */
export function getDifficultyAtChunk(cx, cy) {
  const dx = cx - WORLD_CENTER.x;
  const dy = cy - WORLD_CENTER.y;
  const dist = Math.sqrt(dx * dx + dy * dy);
  // 0=城镇周围最简单, 1=最远最难
  return Math.min(1, dist / WORLD_RADIUS);
}
