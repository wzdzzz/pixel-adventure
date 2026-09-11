/**
 * 秘境数据结构验证：尺寸/封闭边界/出入口可行走/实体落点可行走/id 命名空间
 * 纯 node，无 Phaser 依赖
 */
import assert from 'node:assert/strict';
import { SITES, getSiteEntrancesForChunk } from '../src/world/sites.js';
import { TILE_IDS } from '../src/world/WorldGenerator.js';

for (const [key, site] of Object.entries(SITES)) {
  assert.equal(site.id, key, `${key}: id 应与键一致`);
  const { ground, walls, decorations } = site.generateMap();
  const H = site.heightTiles, W = site.widthTiles;
  for (const [name, grid] of [['ground', ground], ['walls', walls], ['decorations', decorations]]) {
    assert.equal(grid.length, H, `${key}.${name}: 高度应为 ${H}`);
    assert.ok(grid.every(row => row.length === W), `${key}.${name}: 每行宽度应为 ${W}`);
  }
  // 边界封闭(玩家不可能走出图)
  for (let x = 0; x < W; x++) {
    assert.notEqual(walls[0][x], TILE_IDS.EMPTY, `${key}: 上边界应封闭`);
    assert.notEqual(walls[H - 1][x], TILE_IDS.EMPTY, `${key}: 下边界应封闭`);
  }
  for (let y = 0; y < H; y++) {
    assert.notEqual(walls[y][0], TILE_IDS.EMPTY, `${key}: 左边界应封闭`);
    assert.notEqual(walls[y][W - 1], TILE_IDS.EMPTY, `${key}: 右边界应封闭`);
  }
  // 出入口与实体落点可行走
  const walkable = (t) => walls[t.tileY][t.tileX] === TILE_IDS.EMPTY;
  assert.ok(walkable(site.entry), `${key}: entry 应可行走`);
  assert.ok(walkable(site.exit), `${key}: exit 应可行走`);
  for (const s of site.spawns) {
    assert.ok(s.id.startsWith(`site:${key}:`), `${key}: 实体 id 应带 site 前缀: ${s.id}`);
    assert.ok(walkable(s), `${key}: 实体 ${s.id} 落点应可行走`);
  }
  // 洞口定义完整
  assert.ok(Number.isInteger(site.entrance.chunkX) && Number.isInteger(site.entrance.chunkY), `${key}: entrance chunk 坐标`);
}

// 洞口按 chunk 查询
const ents = getSiteEntrancesForChunk(SITES.trial_cave.entrance.chunkX, SITES.trial_cave.entrance.chunkY);
assert.equal(ents.length, 1);
assert.equal(ents[0].siteId, 'trial_cave');
assert.deepEqual(getSiteEntrancesForChunk(0, 0), []);

console.log('sites-data-test 全部通过 ✓');
