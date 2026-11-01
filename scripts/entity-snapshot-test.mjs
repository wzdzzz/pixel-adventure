// scripts/entity-snapshot-test.mjs
// 实体快照:写/读/删、击杀清除、篝火清空、不入存档(纯 node)
import assert from 'node:assert/strict';
import { WorldStateManager } from '../src/world/WorldStateManager.js';

const ws = new WorldStateManager(12345);

// 1) 写读
ws.setEntitySnapshot('enemy_5_5_0', { hp: 42, x: 5300, y: 5310 });
assert.deepEqual(ws.getEntitySnapshot('enemy_5_5_0'), { hp: 42, x: 5300, y: 5310 });
assert.equal(ws.getEntitySnapshot('不存在'), null);

// 2) 击杀 → 快照删除(死人不留快照)
ws.markEntityKilled('enemy_5_5_0');
assert.equal(ws.getEntitySnapshot('enemy_5_5_0'), null, '击杀后快照应被清除');

// 3) 篝火休息 → 快照全清
ws.setEntitySnapshot('enemy_6_6_0', { hp: 10, x: 100, y: 200 });
ws.restAtBonfire();
assert.equal(ws.getEntitySnapshot('enemy_6_6_0'), null, '篝火后快照应清空');

// 4) 序列化不含快照(session 级,不入存档)
ws.setEntitySnapshot('enemy_7_7_0', { hp: 5, x: 1, y: 2 });
const data = ws.serialize();
assert.equal(data.entitySnapshots, undefined, '快照不应进入存档');
const restored = WorldStateManager.deserialize(data);
assert.equal(restored.getEntitySnapshot('enemy_7_7_0'), null, '读档后快照应为空');

console.log('entity-snapshot-test 全部通过 ✓');
