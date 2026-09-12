import { WORLD_CHUNK_PX, WORLD_CONFIG, chunkKey, worldToChunk } from './worldConfig.js';

/** Chunk 流式管理 — 负责 Tilemap 的创建/销毁 + 分帧加载调度 + 实体描述符 */
export class ChunkManager {
  /** 每帧加载预算(step 数)：对角跨线最多新增 9 个 chunk×2 步，6 帧内补齐 */
  static LOAD_STEPS_PER_FRAME = 3;

  /**
   * @param {Phaser.Scene} scene
   * @param {import('./WorldGenerator').WorldGenerator} worldGenerator
   * @param {import('./WorldStateManager').WorldStateManager|null} worldState
   */
  constructor(scene, worldGenerator, worldState = null) {
    this.scene = scene;
    this.generator = worldGenerator;
    /** 世界持久状态（击杀 / 宝箱 / 探索），可为 null */
    this.worldState = worldState;

    /** @type {Map<string, {groundMap: Phaser.Tilemaps.Tilemap, groundLayer: Phaser.Tilemaps.TilemapLayer, wallMap: Phaser.Tilemaps.Tilemap, wallLayer: Phaser.Tilemaps.TilemapLayer, decoMap: Phaser.Tilemaps.Tilemap, decoLayer: Phaser.Tilemaps.TilemapLayer, entities: any[]}>} */
    this.activeChunks = new Map();

    /** 待加载队列：{ chunkX, chunkY, step }  step 0=terrain, 1=entities */
    this.loadQueue = [];
    /** 待卸载队列：{ chunkX, chunkY } */
    this.unloadQueue = [];

    /** 上次玩家所在 chunk（用于判断是否需要重算） */
    this.lastPlayerChunkX = null;
    this.lastPlayerChunkY = null;

    /** 加载半径：加载 (2r+1)² 区域，2 → 5×5（保证已加载边界始终在屏幕外 ≥1000px） */
    this.loadRadius = 2;
    /** 卸载半径：超出 (2r+1)² 外的 chunk 会被回收，3 → 7×7 */
    this.unloadRadius = 3;

    /**
     * 实体模拟半径：实体只在玩家周围 (2r+1)² 生成，1 → 3×3。
     * 与地形半径解耦——地形半径 2 只为消除视野内 pop-in，若实体跟着扩到 5×5~7×7，
     * 同时模拟的敌人会从 ~160 涨到 ~550(AI/物理/血条每帧全跑)，弱机直接卡爆。
     * 实体生成线距玩家 ≥1024px(半屏 960px)，在屏幕外，不可见。
     */
    this.entityRadius = 1;
    /** 实体卸载半径：超出后实体回收(经 chunk-entities-unload → 活怪写快照)，2 → 5×5 */
    this.entityUnloadRadius = 2;
    /** 已生成实体的 chunk key 集合 */
    this.entityChunks = new Set();

    /** 一个 chunk 的像素边长 (32 tiles × 32px) */
    this.CHUNK_PX = WORLD_CHUNK_PX;
  }

  _getChunksInRadius(centerX, centerY, radius) {
    const chunks = [];
    for (let dy = -radius; dy <= radius; dy++) {
      for (let dx = -radius; dx <= radius; dx++) {
        const chunkX = centerX + dx;
        const chunkY = centerY + dy;
        if (!this.generator.isInBounds(chunkX, chunkY)) continue;
        chunks.push({ chunkX, chunkY, distance: Math.max(Math.abs(dx), Math.abs(dy)) });
      }
    }
    return chunks.sort((a, b) => a.distance - b.distance);
  }

  _emitPlayerChunkChanged(chunkX, chunkY) {
    this.worldState?.markChunkExplored?.(chunkKey(chunkX, chunkY));
    this.scene.events.emit('player-chunk-changed', { chunkX, chunkY });
  }

  _loadChunkNow(chunkX, chunkY) {
    const chunkData = this.createChunk(chunkX, chunkY);
    if (!chunkData) return null;
    if (chunkData.ready) return chunkData;
    // 只就绪地形；实体由 _updateEntityChunks 在实体半径内按需生成
    chunkData.ready = true;
    this.scene.events.emit('chunk-loaded', { chunkX, chunkY, chunkData });
    return chunkData;
  }

  /**
   * 每帧调用：维护实体半径内的实体生成/回收（与地形加载解耦）。
   * - 生成：entityRadius 内、地形已就绪、尚未生成实体的 chunk → 加载描述符 + 发 chunk-entities-ready
   * - 回收：超出 entityUnloadRadius 的 → 发 chunk-entities-unload（MainGameScene 回收 GameObject、活怪写快照）
   */
  _updateEntityChunks(cx, cy) {
    if (cx == null || cy == null) return;

    for (const { chunkX, chunkY } of this._getChunksInRadius(cx, cy, this.entityRadius)) {
      const key = chunkKey(chunkX, chunkY);
      if (this.entityChunks.has(key)) continue;
      const chunkData = this.activeChunks.get(key);
      if (!chunkData?.ready) continue;
      this._loadChunkEntities(chunkX, chunkY);
      this.entityChunks.add(key);
      this.scene.events.emit('chunk-entities-ready', { chunkX, chunkY, chunkData });
    }

    for (const key of this.entityChunks) {
      const [ax, ay] = key.split(',').map(Number);
      if (Math.abs(ax - cx) > this.entityUnloadRadius || Math.abs(ay - cy) > this.entityUnloadRadius) {
        this.scene.events.emit('chunk-entities-unload', { chunkX: ax, chunkY: ay });
        const chunkData = this.activeChunks.get(key);
        if (chunkData) chunkData.entities = [];
        this.entityChunks.delete(key);
      }
    }
  }

  // ═══════════════════════════════════════════════════════════
  //  流式调度 — 每帧由 Scene.update() 调用
  // ═══════════════════════════════════════════════════════════

  /**
   * 每帧调用：根据玩家位置决定哪些 chunk 需要加载/卸载，然后分帧处理队列。
   * @param {number} playerX - 玩家世界 X 坐标（像素）
   * @param {number} playerY - 玩家世界 Y 坐标（像素）
   */
  update(playerX, playerY) {
    const { chunkX: cx, chunkY: cy } = worldToChunk(playerX, playerY);
    if (!this.generator.isInBounds(cx, cy)) return;

    // 玩家仍在同一 chunk → 只处理队列，不重算（实体维护仍需跑：排队 chunk 就绪后要补实体）
    if (cx === this.lastPlayerChunkX && cy === this.lastPlayerChunkY) {
      this._processQueues();
      this._updateEntityChunks(cx, cy);
      return;
    }

    // 玩家进入了新 chunk → 更新缓存并重新计算加载/卸载
    this.lastPlayerChunkX = cx;
    this.lastPlayerChunkY = cy;
    this._emitPlayerChunkChanged(cx, cy);

    // 玩家脚下的 chunk 必须立即具备地形、碰撞和实体；邻居再分帧加载。
    const currentKey = chunkKey(cx, cy);
    const currentChunk = this.activeChunks.get(currentKey);
    if (!currentChunk?.ready) {
      this.loadQueue = this.loadQueue.filter(q => q.chunkX !== cx || q.chunkY !== cy);
      this._loadChunkNow(cx, cy);
    }

    // --- 收集需要加载的 chunk（loadRadius 范围内） ---
    const neededChunks = this._getChunksInRadius(cx, cy, this.loadRadius);
    for (const { chunkX, chunkY } of neededChunks) {
      const key = chunkKey(chunkX, chunkY);
      if (this.activeChunks.has(key)) continue;
      if (this.loadQueue.some(q => q.chunkX === chunkX && q.chunkY === chunkY)) continue;
      this.loadQueue.push({ chunkX, chunkY, step: 0 });
    }

    // --- 收集需要卸载的 chunk（超出 unloadRadius） ---
    for (const [key] of this.activeChunks) {
      const [ax, ay] = key.split(',').map(Number);
      if (Math.abs(ax - cx) > this.unloadRadius || Math.abs(ay - cy) > this.unloadRadius) {
        // 避免重复入队
        if (!this.unloadQueue.some(q => q.chunkX === ax && q.chunkY === ay)) {
          this.unloadQueue.push({ chunkX: ax, chunkY: ay });
        }
      }
    }

    // 同时从 loadQueue 中移除已经超出 unloadRadius 的条目（玩家快速移动时可能出现）
    this.loadQueue = this.loadQueue.filter(q => {
      return Math.abs(q.chunkX - cx) <= this.unloadRadius &&
             Math.abs(q.chunkY - cy) <= this.unloadRadius;
    });

    this._processQueues();
    this._updateEntityChunks(cx, cy);
  }

  // ═══════════════════════════════════════════════════════════
  //  队列处理 — 分帧加载，批量卸载
  // ═══════════════════════════════════════════════════════════

  /**
   * 每帧处理一轮加载/卸载队列。
   * - 卸载：全部立即处理（销毁 tilemap 很快）
   * - 加载：每帧最多处理 LOAD_STEPS_PER_FRAME(=3) 个 step，跨 chunk 边界后约 6 帧内补齐邻居
   */
  _processQueues() {
    // --- 卸载：全部立即处理 ---
    while (this.unloadQueue.length > 0) {
      const { chunkX, chunkY } = this.unloadQueue.pop();
      const key = chunkKey(chunkX, chunkY);
      if (!this.activeChunks.has(key)) continue;

      this.scene.events.emit('chunk-unloaded', { chunkX, chunkY });
      this._unloadChunkEntities(chunkX, chunkY);
      this.destroyChunk(chunkX, chunkY);
    }

    // --- 加载：每帧最多处理 LOAD_STEPS_PER_FRAME 个 step ---
    for (let i = 0; i < ChunkManager.LOAD_STEPS_PER_FRAME; i++) {
      if (this.loadQueue.length === 0) return;
      const item = this.loadQueue[0];
      if (item.step === 0) {
        // Step 0: 创建 tilemap 层
        this.createChunk(item.chunkX, item.chunkY);
        item.step = 1;
      } else {
        // Step 1: 加载实体描述并发出一次 ready 通知
        this._loadChunkNow(item.chunkX, item.chunkY);
        this.loadQueue.shift();
      }
    }
  }

  // ═══════════════════════════════════════════════════════════
  //  实体管理
  // ═══════════════════════════════════════════════════════════

  /**
   * 为已创建 tilemap 的 chunk 加载实体生成清单。
   * 根据 WorldStateManager 过滤已击杀/已开启的实体。
   * 实际的 Phaser GameObject 创建由 MainGameScene 的 chunk-loaded 监听负责。
   *
   * @param {number} chunkX
   * @param {number} chunkY
   */
  _loadChunkEntities(chunkX, chunkY) {
    const key = chunkKey(chunkX, chunkY);
    const chunkData = this.activeChunks.get(key);
    if (!chunkData) return;

    // 获取地形数据（确定性，相同坐标返回相同结果）
    const terrain = this.generator.generateChunkTerrain(chunkX, chunkY);

    // 获取实体生成清单
    const spawnList = this.generator.generateChunkEntities(
      chunkX, chunkY, terrain.biome, terrain.walls
    );

    // 过滤已死亡/已开启的实体
    const filtered = [];
    for (const spawn of spawnList) {
      // 已击杀的敌人 → 跳过
      if (this.worldState?.isEntityDead?.(spawn.id)) continue;

      // 已开启的宝箱 → 跳过
      if (spawn.type === 'chest' && this.worldState?.isChestOpened?.(spawn.id)) continue;

      filtered.push(spawn);
    }

    chunkData.entities = filtered;

    // 探索记录由玩家实际所在 chunk 写入；加载相邻 chunk 不代表已探索。
  }

  /**
   * 卸载 chunk 的实体数据。
   * 实际 Phaser GameObject 的回收由 MainGameScene 的 chunk-unloaded 监听负责。
   *
   * @param {number} chunkX
   * @param {number} chunkY
   */
  _unloadChunkEntities(chunkX, chunkY) {
    const key = chunkKey(chunkX, chunkY);
    const chunkData = this.activeChunks.get(key);
    if (!chunkData) return;

    // GameObject 已由 chunk-unloaded 监听回收，这里只清空描述符。
    chunkData.entities = [];
  }

  /**
   * 重新加载所有活跃 Chunk 的实体（篝火休息后调用）
   * worldState.killedEntities 已被清空，所以重新生成会包含之前被杀的怪物
   */
  respawnAllEntities() {
    // 只重载"实体半径内"的 chunk 描述符;地形预取 chunk 本就没有实体
    for (const key of this.entityChunks) {
      const chunkData = this.activeChunks.get(key);
      if (chunkData) chunkData.entities = [];
      const [cx, cy] = key.split(',').map(Number);
      this._loadChunkEntities(cx, cy);
    }

    console.log('[ChunkManager] 实体半径内 Chunk 实体已重生');
  }

  /**
   * 清空全部 chunk:清队列 → 逐 chunk 发 chunk-unloaded(回收实体/NPC/写怪物快照)→ 销毁 tilemap。
   * teleportReset 与秘境进出共用。
   */
  clearAllChunks() {
    this.loadQueue.length = 0;
    this.unloadQueue.length = 0;
    for (const [key] of this.activeChunks) {
      const [cx, cy] = key.split(',').map(Number);
      this.scene.events.emit('chunk-unloaded', { chunkX: cx, chunkY: cy });
      this.destroyChunk(cx, cy);
    }
    this.lastPlayerChunkX = null;
    this.lastPlayerChunkY = null;
    // 实体记录同步清空(GameObject 已由 chunk-unloaded 监听回收)
    this.entityChunks.clear();
  }

  /**
   * 传送专用：销毁所有 chunk 并在新位置同步加载
   * @param {number} destX - 目标世界 X 坐标（像素）
   * @param {number} destY - 目标世界 Y 坐标（像素）
   */
  teleportReset(destX, destY) {
    const { chunkX: cx, chunkY: cy } = worldToChunk(destX, destY);
    if (!this.generator.isInBounds(cx, cy)) return false;

    // 清空队列 + 逐 chunk 发 chunk-unloaded + 销毁 tilemap + 重置位置缓存
    this.clearAllChunks();

    // 目标 chunk 同步可用，邻居继续走分帧队列，避免传送帧一次创建 9 个 tilemap。
    this._emitPlayerChunkChanged(cx, cy);
    this._loadChunkNow(cx, cy);

    for (const { chunkX, chunkY } of this._getChunksInRadius(cx, cy, this.loadRadius)) {
      if (chunkX === cx && chunkY === cy) continue;
      this.loadQueue.push({ chunkX, chunkY, step: 0 });
    }

    // 更新缓存为新位置
    this.lastPlayerChunkX = cx;
    this.lastPlayerChunkY = cy;

    // 落点 chunk 的实体立即生成(邻居随队列就绪后由每帧维护补上)
    this._updateEntityChunks(cx, cy);

    console.log(`[ChunkManager] 传送重置完成 → chunk(${cx},${cy})`);
    return true;
  }

  // ═══════════════════════════════════════════════════════════
  //  工具方法
  // ═══════════════════════════════════════════════════════════

  /**
   * 将像素坐标转为 chunk 坐标
   * @param {number} playerX - 世界 X 坐标（像素）
   * @param {number} playerY - 世界 Y 坐标（像素）
   * @returns {{ chunkX: number, chunkY: number }}
   */
  getPlayerChunk(playerX, playerY) {
    return worldToChunk(playerX, playerY);
  }

  /**
   * 返回所有当前活跃 chunk 的 key 列表（调试用）
   * @returns {string[]}
   */
  getActiveChunkKeys() {
    return Array.from(this.activeChunks.keys());
  }

  // ═══════════════════════════════════════════════════════════
  //  Tilemap 创建 / 销毁（原有方法）
  // ═══════════════════════════════════════════════════════════

  /**
   * 创建指定 chunk 的三层 Tilemap（ground / walls / decorations）
   * @param {number} chunkX
   * @param {number} chunkY
   * @returns {object} chunk 数据对象
   */
  createChunk(chunkX, chunkY) {
    if (!this.generator.isInBounds(chunkX, chunkY)) return null;
    const key = chunkKey(chunkX, chunkY);
    if (this.activeChunks.has(key)) {
      return this.activeChunks.get(key);
    }

    const terrain = this.generator.generateChunkTerrain(chunkX, chunkY);
    const worldX = chunkX * WORLD_CHUNK_PX;
    const worldY = chunkY * WORLD_CHUNK_PX;

    // --- Ground 层 (depth -2) ---
    const groundMap = this.scene.make.tilemap({
      data: terrain.ground,
      tileWidth: WORLD_CONFIG.tileSize,
      tileHeight: WORLD_CONFIG.tileSize
    });
    const groundTileset = groundMap.addTilesetImage(
      'world_tileset', 'world_tileset', WORLD_CONFIG.tileSize, WORLD_CONFIG.tileSize
    );
    const groundLayer = groundMap.createLayer(0, groundTileset, worldX, worldY);
    groundLayer.setDepth(-2);

    // --- Wall 层 (depth 0, 带碰撞) ---
    const wallMap = this.scene.make.tilemap({
      data: terrain.walls,
      tileWidth: WORLD_CONFIG.tileSize,
      tileHeight: WORLD_CONFIG.tileSize
    });
    const wallTileset = wallMap.addTilesetImage(
      'world_tileset', 'world_tileset', WORLD_CONFIG.tileSize, WORLD_CONFIG.tileSize
    );
    const wallLayer = wallMap.createLayer(0, wallTileset, worldX, worldY);
    wallLayer.setDepth(0);
    wallLayer.setCollisionByExclusion([-1]);

    // --- Decoration 层 (depth -1) ---
    const decoMap = this.scene.make.tilemap({
      data: terrain.decorations,
      tileWidth: WORLD_CONFIG.tileSize,
      tileHeight: WORLD_CONFIG.tileSize
    });
    const decoTileset = decoMap.addTilesetImage(
      'world_tileset', 'world_tileset', WORLD_CONFIG.tileSize, WORLD_CONFIG.tileSize
    );
    const decoLayer = decoMap.createLayer(0, decoTileset, worldX, worldY);
    decoLayer.setDepth(-1);

    // 淡入兜底:极端情况(高速移动/传送)下的刷入不突兀(A3)
    for (const layer of [groundLayer, wallLayer, decoLayer]) {
      layer.setAlpha(0);
      this.scene.tweens.add({ targets: layer, alpha: 1, duration: 150 });
    }

    const chunkData = {
      groundMap, groundLayer,
      wallMap, wallLayer,
      decoMap, decoLayer,
      entities: [],
      ready: false,
    };

    this.activeChunks.set(key, chunkData);
    console.log(`[ChunkManager] 创建 chunk (${chunkX}, ${chunkY})  biome=${terrain.biome}`);
    return chunkData;
  }

  /**
   * 销毁指定 chunk，释放 Tilemap 资源
   * @param {number} chunkX
   * @param {number} chunkY
   */
  destroyChunk(chunkX, chunkY) {
    const key = chunkKey(chunkX, chunkY);
    const chunkData = this.activeChunks.get(key);
    if (!chunkData) return;

    // 先销毁所有关联的物理碰撞器（必须在 layer 销毁之前）
    if (chunkData.colliders) {
      for (const collider of chunkData.colliders) {
        if (collider?.world) collider.destroy();
      }
      chunkData.colliders = [];
    }

    chunkData.groundLayer.destroy();
    chunkData.groundMap.destroy();
    chunkData.wallLayer.destroy();
    chunkData.wallMap.destroy();
    chunkData.decoLayer.destroy();
    chunkData.decoMap.destroy();

    this.activeChunks.delete(key);
    this.entityChunks.delete(key);
    console.log(`[ChunkManager] 销毁 chunk (${chunkX}, ${chunkY})`);
  }

  /**
   * 获取 chunk 数据对象
   * @param {number} chunkX
   * @param {number} chunkY
   * @returns {object|null}
   */
  getChunk(chunkX, chunkY) {
    return this.activeChunks.get(chunkKey(chunkX, chunkY)) || null;
  }

  /**
   * 检查 chunk 是否已加载
   * @param {number} chunkX
   * @param {number} chunkY
   * @returns {boolean}
   */
  hasChunk(chunkX, chunkY) {
    return this.activeChunks.has(chunkKey(chunkX, chunkY));
  }

  /**
   * 获取指定 chunk 的墙壁碰撞层（用于物理碰撞注册）
   * @param {number} chunkX
   * @param {number} chunkY
   * @returns {Phaser.Tilemaps.TilemapLayer|null}
   */
  getWallLayer(chunkX, chunkY) {
    const chunkData = this.activeChunks.get(chunkKey(chunkX, chunkY));
    return chunkData ? chunkData.wallLayer : null;
  }

  /**
   * 销毁所有已加载的 chunk 并清空队列（场景关闭时调用）
   */
  destroy() {
    // 清空加载/卸载队列
    this.loadQueue.length = 0;
    this.unloadQueue.length = 0;

    for (const [key] of this.activeChunks) {
      const [cx, cy] = key.split(',').map(Number);
      this.destroyChunk(cx, cy);
    }
    console.log('[ChunkManager] 全部 chunk 已销毁');
  }
}
