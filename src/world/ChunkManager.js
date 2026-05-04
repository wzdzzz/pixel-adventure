/** Chunk 流式管理 — 负责 Tilemap 的创建与销毁 */
export class ChunkManager {
  /**
   * @param {Phaser.Scene} scene
   * @param {import('./WorldGenerator').WorldGenerator} worldGenerator
   */
  constructor(scene, worldGenerator) {
    this.scene = scene;
    this.generator = worldGenerator;
    /** @type {Map<string, {groundMap: Phaser.Tilemaps.Tilemap, groundLayer: Phaser.Tilemaps.TilemapLayer, wallMap: Phaser.Tilemaps.Tilemap, wallLayer: Phaser.Tilemaps.TilemapLayer, decoMap: Phaser.Tilemaps.Tilemap, decoLayer: Phaser.Tilemaps.TilemapLayer, entities: any[]}>} */
    this.activeChunks = new Map();
  }

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
   * 销毁所有已加载的 chunk（场景关闭时调用）
   */
  destroy() {
    for (const [key] of this.activeChunks) {
      const [cx, cy] = key.split(',').map(Number);
      this.destroyChunk(cx, cy);
    }
    console.log('[ChunkManager] 全部 chunk 已销毁');
  }
}
