/** Chunk 流式管理 — 负责 Tilemap 的创建/销毁 + 分帧加载调度 + 实体管理 */
export class ChunkManager {
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

    /** 加载半径：加载 (2r+1)² 区域，1 → 3×3 */
    this.loadRadius = 1;
    /** 卸载半径：超出 (2r+1)² 外的 chunk 会被回收，2 → 5×5 */
    this.unloadRadius = 2;

    /** 一个 chunk 的像素边长 (32 tiles × 32px) */
    this.CHUNK_PX = 1024;
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
    const cx = Math.floor(playerX / this.CHUNK_PX);
    const cy = Math.floor(playerY / this.CHUNK_PX);

    // 玩家仍在同一 chunk → 只处理队列，不重算
    if (cx === this.lastPlayerChunkX && cy === this.lastPlayerChunkY) {
      this._processQueues();
      return;
    }

    // 玩家进入了新 chunk → 更新缓存并重新计算加载/卸载
    this.lastPlayerChunkX = cx;
    this.lastPlayerChunkY = cy;

    // --- 收集需要加载的 chunk（loadRadius 范围内） ---
    const neededKeys = new Set();
    for (let dy = -this.loadRadius; dy <= this.loadRadius; dy++) {
      for (let dx = -this.loadRadius; dx <= this.loadRadius; dx++) {
        const nx = cx + dx;
        const ny = cy + dy;
        const key = `${nx},${ny}`;
        neededKeys.add(key);

        // 跳过已激活或已在加载队列中的 chunk
        if (this.activeChunks.has(key)) continue;
        if (this.loadQueue.some(q => q.chunkX === nx && q.chunkY === ny)) continue;

        this.loadQueue.push({ chunkX: nx, chunkY: ny, step: 0 });
      }
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
  }

  // ═══════════════════════════════════════════════════════════
  //  队列处理 — 分帧加载，批量卸载
  // ═══════════════════════════════════════════════════════════

  /**
   * 每帧处理一轮加载/卸载队列。
   * - 卸载：全部立即处理（销毁 tilemap 很快）
   * - 加载：每帧只处理 1 个队列项的 1 个 step（避免卡帧）
   */
  _processQueues() {
    // --- 卸载：全部立即处理 ---
    while (this.unloadQueue.length > 0) {
      const { chunkX, chunkY } = this.unloadQueue.pop();
      const key = `${chunkX},${chunkY}`;
      if (!this.activeChunks.has(key)) continue;

      this._unloadChunkEntities(chunkX, chunkY);
      this.destroyChunk(chunkX, chunkY);
      this.scene.events.emit('chunk-unloaded', { chunkX, chunkY });
    }

    // --- 加载：每帧处理 1 个 step ---
    if (this.loadQueue.length === 0) return;

    const item = this.loadQueue[0];

    if (item.step === 0) {
      // Step 0: 创建 tilemap 层
      this.createChunk(item.chunkX, item.chunkY);
      item.step = 1;
    } else if (item.step === 1) {
      // Step 1: 加载实体描述
      this._loadChunkEntities(item.chunkX, item.chunkY);

      const key = `${item.chunkX},${item.chunkY}`;
      const chunkData = this.activeChunks.get(key);
      this.scene.events.emit('chunk-loaded', {
        chunkX: item.chunkX,
        chunkY: item.chunkY,
        chunkData
      });

      // 完成，从队列移除
      this.loadQueue.shift();
    }
  }

  // ═══════════════════════════════════════════════════════════
  //  实体管理
  // ═══════════════════════════════════════════════════════════

  /**
   * 为已创建 tilemap 的 chunk 加载实体生成清单。
   * 根据 WorldStateManager 过滤已击杀/已开启的实体。
   * 实际的 Phaser GameObject 创建由后续 EntityManager (Phase 5+6) 负责。
   *
   * @param {number} chunkX
   * @param {number} chunkY
   */
  _loadChunkEntities(chunkX, chunkY) {
    const key = `${chunkX},${chunkY}`;
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

    // 标记该 chunk 为已探索
    this.worldState?.markChunkExplored?.(key);
  }

  /**
   * 卸载 chunk 的实体数据。
   * 实际 Phaser GameObject 的回收由后续 EntityPool/EntityManager (Phase 5) 处理。
   *
   * @param {number} chunkX
   * @param {number} chunkY
   */
  _unloadChunkEntities(chunkX, chunkY) {
    const key = `${chunkX},${chunkY}`;
    const chunkData = this.activeChunks.get(key);
    if (!chunkData) return;

    // 清空实体描述列表（GameObject 回收在 Phase 5 实现）
    chunkData.entities = [];
  }

  /**
   * 重新加载所有活跃 Chunk 的实体（篝火休息后调用）
   * worldState.killedEntities 已被清空，所以重新生成会包含之前被杀的怪物
   */
  respawnAllEntities() {
    // 清除所有 chunk 中的实体描述符
    for (const [key, chunkData] of this.activeChunks) {
      chunkData.entities = [];
    }

    // 重新为所有活跃 chunk 加载实体
    for (const [key] of this.activeChunks) {
      const [cx, cy] = key.split(',').map(Number);
      this._loadChunkEntities(cx, cy);
    }

    console.log('[ChunkManager] 所有活跃 Chunk 实体已重生');
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
    return {
      chunkX: Math.floor(playerX / this.CHUNK_PX),
      chunkY: Math.floor(playerY / this.CHUNK_PX)
    };
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
    const key = `${chunkX},${chunkY}`;
    if (this.activeChunks.has(key)) {
      return this.activeChunks.get(key);
    }

    const terrain = this.generator.generateChunkTerrain(chunkX, chunkY);
    const worldX = chunkX * 1024;
    const worldY = chunkY * 1024;

    // --- Ground 层 (depth -2) ---
    const groundMap = this.scene.make.tilemap({
      data: terrain.ground,
      tileWidth: 32,
      tileHeight: 32
    });
    const groundTileset = groundMap.addTilesetImage('world_tileset', 'world_tileset', 32, 32);
    const groundLayer = groundMap.createLayer(0, groundTileset, worldX, worldY);
    groundLayer.setDepth(-2);

    // --- Wall 层 (depth 0, 带碰撞) ---
    const wallMap = this.scene.make.tilemap({
      data: terrain.walls,
      tileWidth: 32,
      tileHeight: 32
    });
    const wallTileset = wallMap.addTilesetImage('world_tileset', 'world_tileset', 32, 32);
    const wallLayer = wallMap.createLayer(0, wallTileset, worldX, worldY);
    wallLayer.setDepth(0);
    wallLayer.setCollisionByExclusion([-1]);

    // --- Decoration 层 (depth -1) ---
    const decoMap = this.scene.make.tilemap({
      data: terrain.decorations,
      tileWidth: 32,
      tileHeight: 32
    });
    const decoTileset = decoMap.addTilesetImage('world_tileset', 'world_tileset', 32, 32);
    const decoLayer = decoMap.createLayer(0, decoTileset, worldX, worldY);
    decoLayer.setDepth(-1);

    const chunkData = {
      groundMap, groundLayer,
      wallMap, wallLayer,
      decoMap, decoLayer,
      entities: []
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
    const key = `${chunkX},${chunkY}`;
    const chunkData = this.activeChunks.get(key);
    if (!chunkData) return;

    chunkData.groundLayer.destroy();
    chunkData.groundMap.destroy();
    chunkData.wallLayer.destroy();
    chunkData.wallMap.destroy();
    chunkData.decoLayer.destroy();
    chunkData.decoMap.destroy();

    this.activeChunks.delete(key);
    console.log(`[ChunkManager] 销毁 chunk (${chunkX}, ${chunkY})`);
  }

  /**
   * 获取 chunk 数据对象
   * @param {number} chunkX
   * @param {number} chunkY
   * @returns {object|null}
   */
  getChunk(chunkX, chunkY) {
    return this.activeChunks.get(`${chunkX},${chunkY}`) || null;
  }

  /**
   * 检查 chunk 是否已加载
   * @param {number} chunkX
   * @param {number} chunkY
   * @returns {boolean}
   */
  hasChunk(chunkX, chunkY) {
    return this.activeChunks.has(`${chunkX},${chunkY}`);
  }

  /**
   * 获取指定 chunk 的墙壁碰撞层（用于物理碰撞注册）
   * @param {number} chunkX
   * @param {number} chunkY
   * @returns {Phaser.Tilemaps.TilemapLayer|null}
   */
  getWallLayer(chunkX, chunkY) {
    const chunkData = this.activeChunks.get(`${chunkX},${chunkY}`);
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
