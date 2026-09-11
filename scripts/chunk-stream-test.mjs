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

console.log('chunk-stream-test 全部通过 ✓');
