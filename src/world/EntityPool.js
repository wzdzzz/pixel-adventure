/**
 * 实体对象池 — 管理实体的创建/回收/复用
 *
 * Phase 5: 基于描述符的池（存储 spawn data），
 * Phase 6 集成后将升级为管理实际 Phaser GameObjects。
 * 无 Phaser 依赖（纯数据管理）。
 */
export class EntityPool {
  constructor() {
    /** 空闲实体池：type → SpawnDescriptor[] */
    this._pools = new Map();
    /** 活跃实体注册表：entityId → { descriptor, gameObject? } */
    this._active = new Map();
    /** 统计信息 */
    this._stats = { acquired: 0, released: 0, created: 0 };
  }

  /**
   * 从池中获取（或新建）一个实体描述符。
   * @param {object} spawnData - 来自 WorldGenerator 的 spawn 数据
   *   { id, type, localX, localY, level?, pack?, locked? }
   * @param {number} worldX - 世界坐标 X
   * @param {number} worldY - 世界坐标 Y
   * @returns {object} 活跃实体记录 { id, type, worldX, worldY, spawnData, gameObject: null }
   */
  acquire(spawnData, worldX, worldY) {
    const type = spawnData.type;
    const pool = this._pools.get(type);
    let record;

    if (pool && pool.length > 0) {
      record = pool.pop();
      // 复用：更新坐标和 spawn 数据
      record.worldX = worldX;
      record.worldY = worldY;
      record.spawnData = spawnData;
      record.id = spawnData.id;
      record.gameObject = null;
    } else {
      // 新建记录
      record = {
        id: spawnData.id,
        type,
        worldX,
        worldY,
        spawnData,
        gameObject: null  // Phase 6 填充
      };
      this._stats.created++;
    }

    this._active.set(spawnData.id, record);
    this._stats.acquired++;
    return record;
  }

  /**
   * 释放实体回池中（卸载 chunk 时调用）。
   * @param {string} entityId
   */
  release(entityId) {
    const record = this._active.get(entityId);
    if (!record) return;

    // 如果有 gameObject，禁用它（Phase 6 实际销毁/隐藏）
    if (record.gameObject) {
      if (record.gameObject.setActive) record.gameObject.setActive(false);
      if (record.gameObject.setVisible) record.gameObject.setVisible(false);
      if (record.gameObject.body) record.gameObject.body.enable = false;
    }

    this._active.delete(entityId);

    // 放回池中
    if (!this._pools.has(record.type)) {
      this._pools.set(record.type, []);
    }
    this._pools.get(record.type).push(record);
    this._stats.released++;
  }

  /**
   * 释放多个实体（批量）
   * @param {string[]} entityIds
   */
  releaseAll(entityIds) {
    for (const id of entityIds) {
      this.release(id);
    }
  }

  /**
   * 获取活跃实体记录
   * @param {string} entityId
   * @returns {object|null}
   */
  getActive(entityId) {
    return this._active.get(entityId) || null;
  }

  /**
   * 检查实体是否活跃
   * @param {string} entityId
   * @returns {boolean}
   */
  isActive(entityId) {
    return this._active.has(entityId);
  }

  /**
   * 获取所有活跃实体
   * @returns {Map<string, object>}
   */
  getActiveEntities() {
    return this._active;
  }

  /**
   * 获取统计信息（调试用）
   */
  getStats() {
    const poolSizes = {};
    for (const [type, pool] of this._pools) {
      poolSizes[type] = pool.length;
    }
    return {
      ...this._stats,
      activeCount: this._active.size,
      poolSizes
    };
  }

  /**
   * 销毁所有实体（场景关闭时调用）
   */
  destroy() {
    // 先释放所有活跃实体
    for (const [id] of this._active) {
      this.release(id);
    }
    // 清空池
    this._pools.clear();
    this._active.clear();
    this._stats = { acquired: 0, released: 0, created: 0 };
  }
}
