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

// WorldGenerator 应在洞口 chunk 的实体清单中附加 site_entrance
const { WorldGenerator } = await import('../src/world/WorldGenerator.js');
const gen = new WorldGenerator(42);
const { chunkX: ecx, chunkY: ecy } = SITES.trial_cave.entrance;
const terrain = gen.generateChunkTerrain(ecx, ecy);
const spawnList = gen.generateChunkEntities(ecx, ecy, terrain.biome, terrain.walls);
const entrances = spawnList.filter(s => s.type === 'site_entrance');
assert.equal(entrances.length, 1, '洞口 chunk 应含 1 个 site_entrance');
assert.equal(entrances[0].siteId, 'trial_cave');
assert.equal(terrain.walls[entrances[0].localY][entrances[0].localX], TILE_IDS.EMPTY, '洞口落点应可行走');

// 换个种子再验证(确定性 + 不同地形下就近寻位仍可行走)
const gen2 = new WorldGenerator(20260911);
const t2 = gen2.generateChunkTerrain(ecx, ecy);
const s2 = gen2.generateChunkEntities(ecx, ecy, t2.biome, t2.walls).filter(s => s.type === 'site_entrance');
assert.equal(s2.length, 1);
assert.equal(t2.walls[s2[0].localY][s2[0].localX], TILE_IDS.EMPTY, '种子2:洞口落点应可行走');

console.log('sites-data-test 全部通过 ✓');
