/**
 * 世界状态持久化管理器
 *
 * 只记录玩家对世界的改变（击杀、开箱、拾取、探索）。
 * 地形由种子确定性生成，不需要存储。
 * 篝火休息时清除击杀/拾取记录（魂系重生机制）。
 * 无 Phaser 依赖。
 */
export class WorldStateManager {
  constructor(seed) {
    /** 世界种子 */
    this.seed = seed;
    /** 已探索的 chunk (Set of "chunkX,chunkY" keys) */
    this.exploredChunks = new Set();
    /** 已击杀的实体 (Map: entityId → timestamp) */
    this.killedEntities = new Map();
    /** 已开启的宝箱 (Set of chestId) — 永久，不被篝火重置 */
    this.openedChests = new Set();
    /** 已拾取的物品 (Set of itemId) */
    this.pickedItems = new Set();
    /** 实体血量缓存 (Map: entityId → hp) — 临时，不存档 */
    this.entityHpCache = new Map();
    /** 上次篝火休息时间戳 */
    this.bonfireReset = 0;
    /** 永久标记（如 Boss 击杀） (Map: key → value) */
    this.permanentFlags = new Map();
  }

  // ── 查询方法 ─────────────────────────────────────
  isEntityDead(entityId) { return this.killedEntities.has(entityId); }
  isChestOpened(chestId) { return this.openedChests.has(chestId); }
  isItemPicked(itemId) { return this.pickedItems.has(itemId); }
  isChunkExplored(chunkKey) { return this.exploredChunks.has(chunkKey); }

  // ── 记录方法 ─────────────────────────────────────
  markEntityKilled(entityId) { this.killedEntities.set(entityId, Date.now()); }
  markChestOpened(chestId) { this.openedChests.add(chestId); }
  markItemPicked(itemId) { this.pickedItems.add(itemId); }
  markChunkExplored(chunkKey) { this.exploredChunks.add(chunkKey); }

  // ── 永久标记 ─────────────────────────────────────
  setFlag(key, value) { this.permanentFlags.set(key, value); }
  getFlag(key) { return this.permanentFlags.get(key); }
  hasFlag(key) { return this.permanentFlags.has(key); }

  // ── 血量缓存（临时，不存档） ─────────────────────
  cacheEntityHp(entityId, hp) { this.entityHpCache.set(entityId, hp); }
  getCachedHp(entityId) { return this.entityHpCache.get(entityId) ?? null; }
  clearHpCache() { this.entityHpCache.clear(); }

  // ── 篝火休息（魂系重生机制） ─────────────────────
  /**
   * 在篝火休息：清除击杀记录和拾取记录（敌人重生）。
   * 宝箱、探索记录、永久标记不受影响。
   */
  restAtBonfire() {
    this.killedEntities.clear();
    this.pickedItems.clear();
    this.entityHpCache.clear();
    this.bonfireReset = Date.now();
  }

  // ── 序列化（存档） ──────────────────────────────
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

  /**
   * 从存档数据恢复
   * @param {object} data - serialize() 的输出
   * @returns {WorldStateManager}
   */
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
