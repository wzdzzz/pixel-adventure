# 大世界动态加载系统 Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** 将关卡制改为无缝开放世界，Chunk 流式加载/卸载，种子化地形生成，魂系状态持久化。

**Architecture:** 世界由 16×16 个 Chunk（每个 32×32 瓦片）组成。ChunkManager 维护玩家周围 3×3 活跃区域，用独立 Tilemap 渲染。WorldGenerator 纯函数生成地形，WorldStateManager 只记录玩家改变。EntityPool 回收复用实体避免 GC。

**Tech Stack:** Phaser 3.90 Tilemap API, simplex-noise (NPM), vanilla JS ES Modules

**Design Doc:** `docs/plans/2026-05-04-world-streaming-design.md`

---

## Phase 0: 准备工作

### Task 0.1: 安装噪声库

**Files:**
- Modify: `package.json`

**Step 1: 安装 simplex-noise**

```bash
pnpm add simplex-noise
```

**Step 2: 验证安装**

```bash
pnpm dev
```
预期：dev server 正常启动，无报错。

**Step 3: Commit**

```bash
git add package.json pnpm-lock.yaml
git commit -m "chore: 添加 simplex-noise 依赖"
```

---

### Task 0.2: 创建 src/world/ 目录结构

**Files:**
- Create: `src/world/WorldGenerator.js`（空导出）
- Create: `src/world/WorldLayout.js`（空导出）
- Create: `src/world/ChunkManager.js`（空导出）
- Create: `src/world/WorldStateManager.js`（空导出）
- Create: `src/world/EntityPool.js`（空导出）
- Create: `src/world/EntityManager.js`（空导出）
- Create: `src/world/biomes/forest.js`（空导出）

**Step 1: 创建目录和空文件**

每个文件写一个空的 export：

```javascript
// src/world/WorldGenerator.js
export class WorldGenerator {}
```

以此类推，6 个文件 + biomes/forest.js。

**Step 2: Commit**

```bash
git add src/world/
git commit -m "chore: 创建 world 模块目录结构"
```

---

## Phase 1: WorldGenerator — 种子化地形生成

### Task 1.1: 实现 Biome 判定

**Files:**
- Create: `src/world/biomes/biomeConfig.js`
- Modify: `src/world/WorldGenerator.js`

**Step 1: 定义 biome 配置**

```javascript
// src/world/biomes/biomeConfig.js
export const BIOMES = {
  forest:  { id: 'forest',  name: '迷雾森林', color: 0x228b22, groundTile: 0, wallTile: 1, treeDensity: 0.15, enemyDensity: 'medium' },
  ruins:   { id: 'ruins',   name: '古老废墟', color: 0x696969, groundTile: 2, wallTile: 3, treeDensity: 0.03, enemyDensity: 'high' },
  snow:    { id: 'snow',    name: '冰封雪原', color: 0xb0c4de, groundTile: 4, wallTile: 5, treeDensity: 0.08, enemyDensity: 'medium' },
  desert:  { id: 'desert',  name: '灼热沙漠', color: 0xdaa520, groundTile: 6, wallTile: 7, treeDensity: 0.01, enemyDensity: 'low' },
  swamp:   { id: 'swamp',   name: '腐朽沼泽', color: 0x556b2f, groundTile: 8, wallTile: 9, treeDensity: 0.10, enemyDensity: 'high' },
  volcano: { id: 'volcano', name: '熔岩火山', color: 0x8b0000, groundTile: 10, wallTile: 11, treeDensity: 0.02, enemyDensity: 'very_high' }
};

// 世界中心 = (8, 8)，biome 按距离和角度分布
export const WORLD_CENTER = { x: 8, y: 8 };
export const WORLD_RADIUS = 8; // Chunk 单位
```

**Step 2: 实现 WorldGenerator.getBiome()**

在 `WorldGenerator.js` 中用 simplex-noise 低频噪声 + 距中心距离判定 biome。

核心逻辑：
- 距中心 0-2 Chunk → forest（起始区）
- 距中心 2+ → 用噪声值映射到不同 biome
- 距中心越远，越倾向高难 biome（volcano/ruins）

```javascript
import { createNoise2D } from 'simplex-noise';

export class WorldGenerator {
  constructor(seed) {
    this.seed = seed;
    // 用种子创建确定性噪声函数
    this._rng = this._seedRng(seed);
    this._biomeNoise = createNoise2D(this._rng);
    this._terrainNoise = createNoise2D(this._rng);
    this._detailNoise = createNoise2D(this._rng);
  }

  // 简易种子 RNG（返回 0-1 的函数，供 simplex-noise 使用）
  _seedRng(seed) {
    let s = seed;
    return () => {
      s = (s * 16807 + 0) % 2147483647;
      return (s - 1) / 2147483646;
    };
  }

  getBiome(chunkX, chunkY) {
    // ... 噪声采样 + 距离计算 → 返回 biome id
  }
}
```

**Step 3: 验证** — 在浏览器 console 手动调用 `new WorldGenerator(12345).getBiome(3, 5)` 确认返回合理 biome。

**Step 4: Commit**

```bash
git add src/world/biomes/biomeConfig.js src/world/WorldGenerator.js
git commit -m "feat(world): WorldGenerator biome 判定（种子化噪声）"
```

---

### Task 1.2: 实现地形数据生成

**Files:**
- Modify: `src/world/WorldGenerator.js`

**Step 1: 实现 generateChunkTerrain(chunkX, chunkY)**

返回 `{ tileData: number[32][32], collisionData: number[32][32], biome: string }`。

核心逻辑：
- 中频噪声 → 基础地面（草/泥/沙/雪/水）
- 高频噪声 → 装饰物（树/花/蘑菇/石头）
- cellular automata（3 次迭代）→ 墙壁/洞穴
- 所有噪声采样坐标 = `(chunkX * 32 + localX) * scale`，保证跨 Chunk 连续

tileData 使用新的瓦片 ID 系统（为 Tilemap tileset 设计）：
```javascript
// 地面层 tile IDs（tileset index）
export const TILE_IDS = {
  GRASS: 0, DIRT: 1, SAND: 2, SNOW: 3, WATER: 4,
  STONE_FLOOR: 5, LAVA_FLOOR: 6, SWAMP_FLOOR: 7,
  // 墙壁/碰撞层
  WALL: 16, TREE: 17, TREE_PINE: 18, ROCK: 19, FENCE: 20,
  // 装饰层
  FLOWER: 32, MUSHROOM: 33, GRASS_TALL: 34, BRIDGE: 35, CAMPFIRE: 36
};
```

**Step 2: 处理世界边界**

超出 0-15 Chunk 范围 → 全部生成 WALL（不可通行）。

**Step 3: 验证** — console 调用 `gen.generateChunkTerrain(4, 4)` 检查返回数组维度和内容。

**Step 4: Commit**

```bash
git add src/world/WorldGenerator.js
git commit -m "feat(world): WorldGenerator 地形数据生成（噪声+automata）"
```

---

### Task 1.3: 实现实体生成清单

**Files:**
- Modify: `src/world/WorldGenerator.js`
- Refer: `src/data/enemyConfig.js`

**Step 1: 实现 generateChunkEntities(chunkX, chunkY, biome)**

返回 `SpawnEntry[]`：
```javascript
[
  { id: 'skeleton_3_5_0', type: 'skeleton', localX: 5, localY: 12, pack: 0 },
  { id: 'chest_3_5_0', type: 'chest', localX: 20, localY: 8, locked: true },
  ...
]
```

核心逻辑：
- 用 chunk 坐标 + 种子确定性生成 2-5 个 pack 中心点
- 每个 pack 类型（patrol/camp/nest）决定怪物数量
- biome 决定怪物种类和难度
- 避开墙壁/水域（检查 tileData）
- 宝箱、资源点：按密度随机散布

**Step 2: Commit**

```bash
git add src/world/WorldGenerator.js
git commit -m "feat(world): WorldGenerator 实体生成清单（群落系统）"
```

---

### Task 1.4: 实现 WorldLayout 预制区域

**Files:**
- Modify: `src/world/WorldLayout.js`

**Step 1: 定义固定区域**

```javascript
export const WORLD_LAYOUT = {
  // 城镇：中心位置
  town: { chunkX: 8, chunkY: 8, size: 1, template: 'town_center' },

  // 各区营地
  camps: [
    { chunkX: 4, chunkY: 4, biome: 'forest', template: 'camp_small' },
    { chunkX: 12, chunkY: 4, biome: 'ruins', template: 'camp_small' },
    { chunkX: 4, chunkY: 12, biome: 'snow', template: 'camp_small' },
    { chunkX: 12, chunkY: 12, biome: 'volcano', template: 'camp_small' },
  ],

  // Boss 房
  bosses: [
    { chunkX: 2, chunkY: 2, type: 'forest_boss', template: 'boss_arena' },
    { chunkX: 14, chunkY: 2, type: 'ruins_boss', template: 'boss_arena' },
    { chunkX: 2, chunkY: 14, type: 'snow_boss', template: 'boss_arena' },
    { chunkX: 14, chunkY: 14, type: 'volcano_boss', template: 'boss_arena' },
  ]
};
```

**Step 2: 实现模板生成函数**

`getTemplate(templateName)` → 返回 32×32 tileData + entityList。
初期只实现 `town_center`（NPC + 铁匠 + 篝火 + 围墙）和 `camp_small`（篝火 + 1 NPC + 围墙）。

**Step 3: 在 WorldGenerator 中集成**

`generateChunkTerrain()` 开头检查 `WorldLayout`，命中预制区域则用模板数据替换。

**Step 4: Commit**

```bash
git add src/world/WorldLayout.js src/world/WorldGenerator.js
git commit -m "feat(world): 预制区域模板（城镇+营地+Boss房）"
```

---

## Phase 2: Tilemap 渲染 + Tileset

### Task 2.1: 创建程序化 Tileset

**Files:**
- Modify: `src/assets/AssetManager.js`

**Step 1: 生成 tileset 纹理**

在 `generateAllTextures()` 中新增一个 `generateWorldTileset(scene)` 方法。
将所有地面/墙壁/装饰瓦片绘制到一张 canvas 上，排成 tileset 图集。

```javascript
static generateWorldTileset(scene) {
  // 8 列 × N 行，每格 32×32
  // Row 0: 地面（草/泥/沙/雪/水/石地/熔岩/沼泽）= tile 0-7
  // Row 1: 空(8-15)
  // Row 2: 墙壁（石墙/树/松树/岩石/栅栏）= tile 16-20
  // Row 3: 空(24-31)
  // Row 4: 装饰（花/蘑菇/高草/桥/篝火）= tile 32-36
  const cols = 8, rows = 6, size = 32;
  const canvas = document.createElement('canvas');
  canvas.width = cols * size;
  canvas.height = rows * size;
  const ctx = canvas.getContext('2d');

  // 逐个绘制每种瓦片...
  // 使用现有 AssetManager 的像素绘制方法（colors + shapes）

  scene.textures.addCanvas('world_tileset', canvas);
}
```

**Step 2: 在 BootScene 或 MainGameScene 的 create 中调用**

确保在 Chunk 加载之前 tileset 已生成。

**Step 3: 验证** — `pnpm dev`，打开控制台检查 `scene.textures.exists('world_tileset')` 返回 true。

**Step 4: Commit**

```bash
git add src/assets/AssetManager.js
git commit -m "feat(world): 程序化 tileset 纹理生成"
```

---

### Task 2.2: Chunk Tilemap 创建/销毁

**Files:**
- Modify: `src/world/ChunkManager.js`

**Step 1: 实现单个 Chunk 的 Tilemap 创建**

```javascript
_createChunkTilemap(chunkKey, tileData, collisionData) {
  const [cx, cy] = chunkKey.split('_').map(Number);
  const offsetX = cx * 1024;
  const offsetY = cy * 1024;

  // 地面层
  const groundMap = this.scene.make.tilemap({
    data: tileData.ground,   // 32×32 数组
    tileWidth: 32, tileHeight: 32
  });
  const tileset = groundMap.addTilesetImage('world_tileset', 'world_tileset', 32, 32);
  const groundLayer = groundMap.createLayer(0, tileset, offsetX, offsetY);
  groundLayer.setDepth(-1);

  // 墙壁/碰撞层
  const wallMap = this.scene.make.tilemap({
    data: tileData.walls,
    tileWidth: 32, tileHeight: 32
  });
  const wallTileset = wallMap.addTilesetImage('world_tileset', 'world_tileset', 32, 32);
  const wallLayer = wallMap.createLayer(0, wallTileset, offsetX, offsetY);
  wallLayer.setCollisionByExclusion([-1]);  // -1 = 空，其余全碰撞
  this.scene.physics.add.collider(this.scene.player.sprite, wallLayer);

  return { groundMap, groundLayer, wallMap, wallLayer };
}
```

**Step 2: 实现 Tilemap 销毁**

```javascript
_destroyChunkTilemap(chunkData) {
  chunkData.groundLayer.destroy();
  chunkData.groundMap.destroy();
  chunkData.wallLayer.destroy();
  chunkData.wallMap.destroy();
}
```

**Step 3: 验证** — 后续 Task 2.3 整体验证。

**Step 4: Commit**

```bash
git add src/world/ChunkManager.js
git commit -m "feat(world): Chunk Tilemap 创建与销毁"
```

---

## Phase 3: ChunkManager — 流式加载

### Task 3.1: ChunkManager 核心调度

**Files:**
- Modify: `src/world/ChunkManager.js`

**Step 1: 实现 update() 主循环**

```javascript
export class ChunkManager {
  constructor(scene, worldGenerator, worldState) {
    this.scene = scene;
    this.generator = worldGenerator;
    this.worldState = worldState;
    this.activeChunks = new Map();   // chunkKey → ChunkInstance
    this.loadQueue = [];
    this.unloadQueue = [];
    this.lastChunkX = null;
    this.lastChunkY = null;
    this.loadRadius = 1;       // 3×3
    this.unloadRadius = 2;     // 5×5 外卸载
  }

  update(playerX, playerY) {
    const cx = Math.floor(playerX / 1024);
    const cy = Math.floor(playerY / 1024);
    if (cx === this.lastChunkX && cy === this.lastChunkY) {
      this._processQueues();
      return;
    }
    this.lastChunkX = cx;
    this.lastChunkY = cy;

    // 计算应加载的 Chunk 集合
    const needed = new Set();
    for (let dx = -this.loadRadius; dx <= this.loadRadius; dx++) {
      for (let dy = -this.loadRadius; dy <= this.loadRadius; dy++) {
        needed.add(`${cx + dx}_${cy + dy}`);
      }
    }

    // 需要加载的
    for (const key of needed) {
      if (!this.activeChunks.has(key) && !this.loadQueue.find(q => q.key === key)) {
        this.loadQueue.push({ key, step: 0, data: null });
      }
    }

    // 需要卸载的
    for (const [key] of this.activeChunks) {
      const [ax, ay] = key.split('_').map(Number);
      if (Math.abs(ax - cx) > this.unloadRadius || Math.abs(ay - cy) > this.unloadRadius) {
        this.unloadQueue.push(key);
      }
    }
  }
}
```

**Step 2: 实现 _processQueues() 分帧加载**

每帧处理：
- 卸载队列：全部立即处理（销毁很快）
- 加载队列：每帧处理一个 step（step 0 = 生成数据，step 1 = 创建 tilemap，step 2+ = 分批创建实体）

**Step 3: Commit**

```bash
git add src/world/ChunkManager.js
git commit -m "feat(world): ChunkManager 核心调度（分帧加载/卸载）"
```

---

### Task 3.2: Chunk 实体加载与卸载

**Files:**
- Modify: `src/world/ChunkManager.js`
- Refer: `src/world/WorldStateManager.js`

**Step 1: 加载实体（分帧）**

```javascript
_loadEntitiesBatch(chunkInstance, batchSize = 10) {
  const list = chunkInstance.pendingSpawns;
  let count = 0;
  while (list.length > 0 && count < batchSize) {
    const spawn = list.shift();

    // 检查 WorldStateManager
    if (spawn.type === 'chest' && this.worldState.isChestOpened(spawn.id)) {
      // 生成已开启宝箱（仅视觉）
      this._spawnOpenedChest(chunkInstance, spawn);
    } else if (this.worldState.isEntityDead(spawn.id)) {
      // 跳过已击杀
      continue;
    } else {
      this._spawnEntity(chunkInstance, spawn);
    }
    count++;
  }
  return list.length === 0; // 是否全部完成
}
```

**Step 2: 卸载实体**

```javascript
_unloadChunk(chunkKey) {
  const chunk = this.activeChunks.get(chunkKey);
  if (!chunk) return;

  // 保存活跃敌人血量
  for (const entity of chunk.entities) {
    if (entity.hp !== undefined && entity.hp < entity.maxHp) {
      this.worldState.cacheEntityHp(entity.entityId, entity.hp);
    }
    this.scene.entityPool.release(entity);
  }
  chunk.entities = [];

  // 销毁 tilemap
  this._destroyChunkTilemap(chunk.tilemap);
  this.activeChunks.delete(chunkKey);
}
```

**Step 3: Commit**

```bash
git add src/world/ChunkManager.js
git commit -m "feat(world): Chunk 实体分帧加载 + 卸载回收"
```

---

## Phase 4: WorldStateManager — 持久化

### Task 4.1: WorldStateManager 核心实现

**Files:**
- Modify: `src/world/WorldStateManager.js`

**Step 1: 完整实现**

```javascript
export class WorldStateManager {
  constructor(seed) {
    this.seed = seed;
    this.exploredChunks = new Set();
    this.killedEntities = new Map();    // id → timestamp
    this.openedChests = new Set();
    this.pickedItems = new Set();
    this.entityHpCache = new Map();     // 临时，不存档
    this.bonfireReset = 0;
    this.permanentFlags = new Map();
  }

  // ── 查询方法 ──
  isEntityDead(entityId) { return this.killedEntities.has(entityId); }
  isChestOpened(chestId) { return this.openedChests.has(chestId); }
  isItemPicked(itemId) { return this.pickedItems.has(itemId); }

  // ── 记录方法 ──
  markEntityKilled(entityId) { this.killedEntities.set(entityId, Date.now()); }
  markChestOpened(chestId) { this.openedChests.add(chestId); }
  markItemPicked(itemId) { this.pickedItems.add(itemId); }
  markChunkExplored(chunkKey) { this.exploredChunks.add(chunkKey); }
  setFlag(key, value) { this.permanentFlags.set(key, value); }
  getFlag(key) { return this.permanentFlags.get(key); }

  // ── 血量缓存（不存档） ──
  cacheEntityHp(entityId, hp) { this.entityHpCache.set(entityId, hp); }
  getCachedHp(entityId) { return this.entityHpCache.get(entityId) ?? null; }

  // ── 篝火休息 ──
  restAtBonfire() {
    // 清除击杀记录（Boss 通过 permanentFlags 保护，不在 killedEntities 里）
    this.killedEntities.clear();
    this.pickedItems.clear();
    this.entityHpCache.clear();
    this.bonfireReset = Date.now();
  }

  // ── 序列化 ──
  serialize() {
    return {
      seed: this.seed,
      exploredChunks: [...this.exploredChunks],
      killedEntities: [...this.killedEntities.entries()],
      openedChests: [...this.openedChests],
      pickedItems: [...this.pickedItems],
      permanentFlags: [...this.permanentFlags.entries()],
      bonfireReset: this.bonfireReset
    };
  }

  static deserialize(data) {
    const ws = new WorldStateManager(data.seed);
    ws.exploredChunks = new Set(data.exploredChunks || []);
    ws.killedEntities = new Map(data.killedEntities || []);
    ws.openedChests = new Set(data.openedChests || []);
    ws.pickedItems = new Set(data.pickedItems || []);
    ws.permanentFlags = new Map(data.permanentFlags || []);
    ws.bonfireReset = data.bonfireReset || 0;
    return ws;
  }
}
```

**Step 2: Commit**

```bash
git add src/world/WorldStateManager.js
git commit -m "feat(world): WorldStateManager 完整实现（持久化+篝火重置）"
```

---

### Task 4.2: SaveSystem 集成

**Files:**
- Modify: `src/systems/SaveSystem.js`

**Step 1: save() 中新增 worldState 字段**

在 `saveData` 对象中追加：
```javascript
worldState: scene.worldState?.serialize() || null
```

**Step 2: load() 中恢复 worldState**

在加载流程中追加：
```javascript
if (saveData.worldState) {
  scene.worldState = WorldStateManager.deserialize(saveData.worldState);
} else {
  // 旧存档兼容：创建新的 worldState
  scene.worldState = new WorldStateManager(Date.now());
}
```

**Step 3: getSaveInfo() meta 中追加世界信息**

```javascript
meta.worldSeed = data.worldState?.seed || null;
meta.exploredCount = data.worldState?.exploredChunks?.length || 0;
```

**Step 4: Commit**

```bash
git add src/systems/SaveSystem.js
git commit -m "feat(save): SaveSystem 集成 WorldStateManager 序列化"
```

---

## Phase 5: EntityPool + EntityManager

### Task 5.1: EntityPool 对象池

**Files:**
- Modify: `src/world/EntityPool.js`

**Step 1: 实现对象池**

```javascript
export class EntityPool {
  constructor(scene) {
    this.scene = scene;
    this.pools = new Map();  // type → Entity[]
  }

  acquire(type, x, y, config) {
    const pool = this.pools.get(type);
    if (pool && pool.length > 0) {
      const entity = pool.pop();
      entity.reset(x, y, config);
      return entity;
    }
    // 池空，新建
    return this._createNew(type, x, y, config);
  }

  release(entity) {
    if (!entity || !entity.type) return;
    entity.sleep();
    if (!this.pools.has(entity.type)) {
      this.pools.set(entity.type, []);
    }
    this.pools.get(entity.type).push(entity);
  }

  _createNew(type, x, y, config) {
    // 根据 type 创建 Enemy / Item / NPC
    // 需要 import 对应类
    const Enemy = this.scene._enemyClass; // 后续注入
    return new Enemy(this.scene, x, y, config);
  }

  preWarm(type, count, config) {
    for (let i = 0; i < count; i++) {
      const entity = this._createNew(type, -1000, -1000, config);
      this.release(entity);
    }
  }
}
```

**Step 2: Enemy.js 增加 reset() 和 sleep() 方法**

```javascript
// Enemy.js 新增：
reset(x, y, config) {
  this.sprite.setPosition(x, y);
  this.sprite.setActive(true).setVisible(true);
  this.sprite.body.enable = true;
  // 重置 HP、AI 状态、技能冷却
  this.hp = config.hp || this.maxHp;
  this.state = 'PATROL';
  this.inCombat = false;
  // ... 重置其他战斗状态
}

sleep() {
  this.sprite.setActive(false).setVisible(false);
  this.sprite.body.enable = false;
  this.state = 'PATROL';
  this.inCombat = false;
}
```

**Step 3: Commit**

```bash
git add src/world/EntityPool.js src/entities/Enemy.js
git commit -m "feat(world): EntityPool 对象池 + Enemy reset/sleep"
```

---

### Task 5.2: EntityManager 距离分级

**Files:**
- Modify: `src/world/EntityManager.js`

**Step 1: 实现距离分级激活**

```javascript
export class EntityManager {
  constructor(scene) {
    this.scene = scene;
    this.activeRadius = 1200;    // 完整更新
    this.dormantRadius = 2048;   // 冻结但保留
  }

  update(cameraCenterX, cameraCenterY) {
    const chunks = this.scene.chunkManager.activeChunks;
    for (const [, chunk] of chunks) {
      for (const entity of chunk.entities) {
        if (!entity.sprite || !entity.sprite.active) continue;
        const dx = entity.sprite.x - cameraCenterX;
        const dy = entity.sprite.y - cameraCenterY;
        const dist = Math.sqrt(dx * dx + dy * dy);

        if (dist < this.activeRadius) {
          // ACTIVE
          if (!entity.sprite.body.enable) {
            entity.sprite.body.enable = true;
            entity.sprite.setVisible(true);
          }
          entity._isActive = true;
        } else if (dist < this.dormantRadius) {
          // DORMANT
          entity.sprite.body.enable = false;
          entity.sprite.setVisible(false);
          entity._isActive = false;
        }
        // 超出 dormantRadius 的由 ChunkManager 卸载处理
      }
    }
  }
}
```

**Step 2: 修改 MainGameScene update 中的敌人更新循环**

只对 `entity._isActive === true` 的敌人调用 `update(delta)`。

**Step 3: Commit**

```bash
git add src/world/EntityManager.js
git commit -m "feat(world): EntityManager 距离分级激活（active/dormant）"
```

---

## Phase 6: MainGameScene 重构

### Task 6.1: 新增 enterWorld() 替代 loadLevel()

**Files:**
- Modify: `src/scenes/MainGameScene.js`
- Refer: `src/world/ChunkManager.js`, `src/world/WorldGenerator.js`, `src/world/WorldStateManager.js`

**Step 1: 新增 enterWorld()**

```javascript
enterWorld(saveData = null) {
  // 初始化世界系统
  if (saveData?.worldState) {
    this.worldState = WorldStateManager.deserialize(saveData.worldState);
  } else {
    this.worldState = new WorldStateManager(Date.now());
  }

  this.worldGenerator = new WorldGenerator(this.worldState.seed);
  this.entityPool = new EntityPool(this);
  this.entityManager = new EntityManager(this);
  this.chunkManager = new ChunkManager(this, this.worldGenerator, this.worldState);

  // 创建玩家
  const spawnX = saveData?.player?.position?.x || 8 * 1024 + 512; // 城镇中心
  const spawnY = saveData?.player?.position?.y || 8 * 1024 + 512;
  this._createWorldPlayer(spawnX, spawnY, saveData);

  // 摄像机
  this.cameras.main.startFollow(this.player.sprite, true, 0.1, 0.1);
  this.cameras.main.setDeadzone(80, 60);
  // 不设 setBounds — 世界无固定边界

  // 首次加载周围 Chunk
  this.chunkManager.update(spawnX, spawnY);
}
```

**Step 2: 修改 create() 调用 enterWorld()**

将原来的 `loadLevel()` 调用替换为 `enterWorld()`。
保留原有系统初始化（InventorySystem、UIManager 等不变）。

**Step 3: 修改 update()**

```javascript
update(time, delta) {
  if (this.gamePaused) return;

  // Chunk 流式加载
  this.chunkManager.update(this.player.sprite.x, this.player.sprite.y);

  // 实体距离分级
  const cam = this.cameras.main;
  this.entityManager.update(cam.scrollX + cam.width / 2, cam.scrollY + cam.height / 2);

  // 玩家更新
  this.player.update(delta);

  // 只更新 ACTIVE 敌人
  for (const [, chunk] of this.chunkManager.activeChunks) {
    for (const entity of chunk.entities) {
      if (entity._isActive) entity.update(delta);
    }
  }

  // ... 保留 depth sorting、projectile update 等
}
```

**Step 4: Commit**

```bash
git add src/scenes/MainGameScene.js
git commit -m "feat(world): MainGameScene enterWorld() 替代 loadLevel()"
```

---

### Task 6.2: 碰撞注册改造

**Files:**
- Modify: `src/scenes/MainGameScene.js`

**Step 1: 改用 Physics Group 管理敌人**

```javascript
// 在 enterWorld() 中：
this.enemyGroup = this.physics.add.group();

// 注册一次，永不移除：
this.physics.add.collider(this.player.sprite, this.enemyGroup, ...);
this.physics.add.overlap(this.player.attackHitbox, this.enemyGroup, ...);
```

**Step 2: EntityPool acquire/release 时操作 group**

```javascript
// acquire 时：
this.scene.enemyGroup.add(entity.sprite);
// release 时：
this.scene.enemyGroup.remove(entity.sprite);
```

**Step 3: 墙壁碰撞**

每个 Chunk 的 wallLayer 在创建时注册 collider，卸载时 Phaser 随 layer 销毁自动移除。
ChunkManager._createChunkTilemap() 中已处理（Task 2.2）。

**Step 4: Commit**

```bash
git add src/scenes/MainGameScene.js src/world/EntityPool.js
git commit -m "feat(world): 碰撞注册改为 Group 模式"
```

---

### Task 6.3: 篝火交互与事件集成

**Files:**
- Modify: `src/managers/InteractionHandler.js`
- Modify: `src/world/WorldStateManager.js`

**Step 1: 在 InteractionHandler 中添加篝火交互**

当玩家与 campfire 类型的实体交互（按 E 键）：

```javascript
handleBonfireInteraction(bonfire) {
  const ws = this.scene.worldState;
  ws.restAtBonfire();

  // 回满 HP/MP
  this.scene.player.hp = this.scene.player.maxHp;
  this.scene.player.mana = this.scene.player.maxMana;
  this.scene.player.stamina = this.scene.player.maxStamina;
  this.scene.player.onHpChanged();
  this.scene.player.onResourceChanged();

  // 重新加载当前所有活跃 Chunk 的实体
  this.scene.chunkManager.respawnAllEntities();

  // 自动存档
  SaveSystem.save(this.scene);

  this.scene.events.emit('showMessage', '在篝火旁休息...怪物已重生');
}
```

**Step 2: 在 ChunkManager 中实现 respawnAllEntities()**

销毁所有活跃 Chunk 的实体并重新从 spawnList 生成（此时 killedEntities 已清空）。

**Step 3: 敌人死亡时标记 WorldStateManager**

在 Enemy 死亡回调中：
```javascript
this.scene.worldState.markEntityKilled(enemy.entityId);
```

Boss 额外标记 permanentFlag：
```javascript
if (enemy.isBoss) {
  this.scene.worldState.setFlag(`boss_${enemy.entityId}_defeated`, true);
}
```

**Step 4: Commit**

```bash
git add src/managers/InteractionHandler.js src/world/ChunkManager.js
git commit -m "feat(world): 篝火交互（休息重置）+ 击杀状态记录"
```

---

## Phase 7: 清理与兼容

### Task 7.1: 移除关卡制逻辑

**Files:**
- Modify: `src/scenes/MainGameScene.js` — 删除 `loadLevel()`, `cleanupLevel()`, 关卡相关 gameState 字段
- Modify: `src/managers/InteractionHandler.js` — 移除传送门切关逻辑
- Modify: `src/scenes/UIScene.js` — 关卡显示改为区域名称
- Modify: `src/data/levels.js` — 保留文件但标记废弃（biome 配置取代）

**Step 1: MainGameScene 清理**

- 删除 `currentLevel`、`loadLevel()`、`cleanupLevel()` 方法
- 删除 `VictoryScene`/`GameOverScene` 中的关卡相关逻辑
- gameState 中移除 `currentLevel`、`keysCollected`、`collectedItems`（由 WorldStateManager 替代）

**Step 2: UIScene 显示区域名称**

```javascript
// 读取玩家所在 Chunk 的 biome
const biome = this.gameScene.worldGenerator.getBiome(chunkX, chunkY);
this.areaText.setText(biome.name); // "迷雾森林"
```

**Step 3: Commit**

```bash
git add src/scenes/MainGameScene.js src/managers/InteractionHandler.js src/scenes/UIScene.js
git commit -m "refactor: 移除关卡制逻辑，切换到开放世界"
```

---

### Task 7.2: 存档兼容迁移

**Files:**
- Modify: `src/systems/SaveSystem.js`

**Step 1: load() 中处理旧存档**

```javascript
// 旧存档没有 worldState 字段
if (!saveData.worldState) {
  // 创建新世界，玩家从城镇出发
  scene.worldState = new WorldStateManager(Date.now());
  // 旧存档的装备/背包/技能保留
  // 位置重置到城镇中心
}
```

**Step 2: 版本号升级**

`version: '3.0.0'`（大版本变更）

**Step 3: Commit**

```bash
git add src/systems/SaveSystem.js
git commit -m "feat(save): 旧存档兼容迁移（关卡制→开放世界）"
```

---

### Task 7.3: 整体冒烟测试

**Step 1: 新游戏测试**

```
pnpm dev
```

验证清单：
- [ ] 新建存档，出生在城镇中心
- [ ] 走出城镇，周围 Chunk 自动加载（无卡顿）
- [ ] 远离后回头，旧 Chunk 卸载后重新加载
- [ ] 不同方向走，看到不同 biome 过渡
- [ ] 杀怪后走远再回来，怪不在
- [ ] 在篝火休息后，怪物重新出现
- [ ] 开宝箱后休息，宝箱仍然是开的
- [ ] 存档 → 刷新页面 → 读档 → 位置和状态正确

**Step 2: 性能测试**

- [ ] 打开 FPS 计数器，在密集区域保持 55+ FPS
- [ ] 快速跑动时无明显卡顿（分帧加载生效）
- [ ] 长时间跑图无内存泄漏（对象池回收正常）

**Step 3: Commit**

```bash
git add -A
git commit -m "feat: 大世界动态加载系统完成（v3.0.0）"
```

---

## 任务依赖图

```
Phase 0 (准备)
  ├── 0.1 安装噪声库
  └── 0.2 创建目录结构
         ↓
Phase 1 (WorldGenerator)
  ├── 1.1 Biome 判定
  ├── 1.2 地形数据生成 (depends on 1.1)
  ├── 1.3 实体生成清单 (depends on 1.2)
  └── 1.4 预制区域模板 (depends on 1.2)
         ↓
Phase 2 (Tilemap)
  ├── 2.1 程序化 Tileset
  └── 2.2 Chunk Tilemap 创建/销毁 (depends on 2.1)
         ↓
Phase 3 (ChunkManager)
  ├── 3.1 核心调度 (depends on 2.2)
  └── 3.2 实体加载/卸载 (depends on 3.1)
         ↓
Phase 4 (WorldStateManager)
  ├── 4.1 核心实现
  └── 4.2 SaveSystem 集成 (depends on 4.1)
         ↓
Phase 5 (EntityPool + EntityManager)
  ├── 5.1 对象池 (depends on 3.2)
  └── 5.2 距离分级 (depends on 5.1)
         ↓
Phase 6 (MainGameScene 重构)
  ├── 6.1 enterWorld() (depends on 3.1, 4.1, 5.1)
  ├── 6.2 碰撞改造 (depends on 6.1)
  └── 6.3 篝火交互 (depends on 6.1, 4.1)
         ↓
Phase 7 (清理)
  ├── 7.1 移除关卡制 (depends on 6.1)
  ├── 7.2 存档兼容 (depends on 4.2)
  └── 7.3 冒烟测试 (depends on all)
```

## 预估

| Phase | 任务数 | 说明 |
|:-----:|:-----:|------|
| 0 | 2 | 准备工作 |
| 1 | 4 | 世界生成核心 |
| 2 | 2 | Tilemap 渲染 |
| 3 | 2 | Chunk 流式加载 |
| 4 | 2 | 状态持久化 |
| 5 | 2 | 实体优化 |
| 6 | 3 | 场景重构 |
| 7 | 3 | 清理兼容 |
| **总计** | **20** | |
