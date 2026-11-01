/**
 * 流式加载参数验证：半径 2 覆盖 5×5、卸载半径 3、每帧 3 步加载预算（纯 node，无浏览器）
 */
import assert from 'node:assert/strict';
import { ChunkManager } from '../src/world/ChunkManager.js';

const stubScene = { events: { emit() {} } };
const stubGenerator = { isInBounds: () => true };

// 1) 默认半径
const cm = new ChunkManager(stubScene, stubGenerator, null);
assert.equal(cm.loadRadius, 2, 'loadRadius 应为 2');
assert.equal(cm.unloadRadius, 3, 'unloadRadius 应为 3');

// 2) 半径 2 → 5×5 = 25 个 chunk，按距离排序（中心最先）
const chunks = cm._getChunksInRadius(8, 8, cm.loadRadius);
assert.equal(chunks.length, 25, '5×5 应为 25 个 chunk');
assert.deepEqual({ x: chunks[0].chunkX, y: chunks[0].chunkY }, { x: 8, y: 8 }, '中心 chunk 应排最前');

// 3) 加载预算：每帧最多消化 3 个 step
// 注：createChunk/_loadChunkNow 被整体 stub，本测试是黑盒步进预算检查，不覆盖 tilemap 创建路径
let stepCount = 0;
cm.createChunk = (x, y) => { stepCount++; return { ready: false, entities: [] }; };
cm._loadChunkNow = (x, y) => { stepCount++; return { ready: true, entities: [] }; };
cm.loadQueue = [
  { chunkX: 1, chunkY: 0, step: 0 }, { chunkX: 2, chunkY: 0, step: 0 },
  { chunkX: 3, chunkY: 0, step: 0 }, { chunkX: 4, chunkY: 0, step: 0 },
];
cm._processQueues();
assert.equal(stepCount, 3, '一帧应恰好消化 3 步(旧实现只消化 1 步)');
assert.equal(cm.loadQueue.length, 3, '4 项×2步=8步,消化3步后:第1项完成出队,第2项完成一半,剩 3 项');

// 4) clearAllChunks:清队列 + 逐 chunk 发 chunk-unloaded + 销毁 + 重置位置缓存
const emitted = [];
const cm2 = new ChunkManager(
  { events: { emit: (name, data) => emitted.push([name, data]) } },
  stubGenerator, null
);
cm2.activeChunks.set('3,4', { entities: [] });
cm2.activeChunks.set('5,6', { entities: [] });
cm2.destroyChunk = (x, y) => { cm2.activeChunks.delete(`${x},${y}`); };
cm2.loadQueue.push({ chunkX: 9, chunkY: 9, step: 0 });
cm2.unloadQueue.push({ chunkX: 7, chunkY: 7 });
cm2.lastPlayerChunkX = 3; cm2.lastPlayerChunkY = 4;
cm2.clearAllChunks();
assert.equal(cm2.activeChunks.size, 0, 'clearAllChunks 应清空所有 chunk');
assert.equal(cm2.loadQueue.length, 0, 'clearAllChunks 应清空加载队列');
assert.equal(cm2.lastPlayerChunkX, null, 'clearAllChunks 应重置位置缓存');
assert.equal(cm2.lastPlayerChunkY, null, 'clearAllChunks 应重置 Y 位置缓存');
assert.equal(cm2.unloadQueue.length, 0, 'clearAllChunks 应清空卸载队列');
assert.equal(emitted.filter(([n]) => n === 'chunk-unloaded').length, 2, '每个 chunk 应发 chunk-unloaded');

// 5) 实体半径解耦:地形半径 2 预取,实体只在 entityRadius(1) 内生成,超出 entityUnloadRadius(2) 回收
//    (防止实体模拟量随地形半径翻倍 — 555 敌人卡顿回归的修复)
const events3 = [];
const cm3 = new ChunkManager(
  { events: { emit: (name, data) => events3.push([name, data]) } },
  stubGenerator, null
);
assert.equal(cm3.entityRadius, 1, 'entityRadius 应为 1(旧版模拟预算)');
assert.equal(cm3.entityUnloadRadius, 2, 'entityUnloadRadius 应为 2');
cm3._loadChunkEntities = () => {}; // stub 描述符加载
// 地形就绪的 5×5(以 (8,8) 为中心)
for (let y = 6; y <= 10; y++) for (let x = 6; x <= 10; x++) {
  cm3.activeChunks.set(`${x},${y}`, { ready: true, entities: [] });
}
cm3._updateEntityChunks(8, 8);
assert.equal(cm3.entityChunks.size, 9, '实体应只在 3×3 生成');
assert.equal(events3.filter(([n]) => n === 'chunk-entities-ready').length, 9, '应发 9 次 chunk-entities-ready');

// 玩家移到 (10,8):前方新生成 3 个,身后超出卸载半径回收 3 个,稳态仍 9 个
events3.length = 0;
cm3._updateEntityChunks(10, 8);
assert.equal(events3.filter(([n]) => n === 'chunk-entities-ready').length, 3, '前进方向应新生成 3 个');
assert.equal(events3.filter(([n]) => n === 'chunk-entities-unload').length, 3, '身后应回收 3 个');
assert.equal(cm3.entityChunks.size, 9, '稳态实体 chunk 应保持 9 个');

// 地形未就绪的 chunk 不生成实体
cm3.activeChunks.set('11,8', { ready: false, entities: [] });
events3.length = 0;
cm3._updateEntityChunks(10, 8);
assert.equal(events3.length, 0, '未就绪 chunk 不应生成实体');

// clearAllChunks 同时清空实体记录
cm3.destroyChunk = (x, y) => { cm3.activeChunks.delete(`${x},${y}`); };
cm3.clearAllChunks();
assert.equal(cm3.entityChunks.size, 0, 'clearAllChunks 应清空 entityChunks');

console.log('chunk-stream-test 全部通过 ✓');
