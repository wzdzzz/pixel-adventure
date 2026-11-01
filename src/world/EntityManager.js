/**
 * 实体距离分级激活管理器
 *
 * 根据实体与摄像机中心的距离，将实体分为三个等级：
 * - ACTIVE (< activeRadius): 完整更新（AI、物理、动画）
 * - DORMANT (< dormantRadius): 冻结但保留（不更新、不渲染）
 * - CULLED (>= dormantRadius): 由 ChunkManager 卸载处理
 *
 * 无 Phaser 依赖（但操作 gameObject 的方法需要 Phase 6 集成）。
 */

/** 实体激活状态 */
export const ENTITY_STATE = {
  ACTIVE: 'active',
  DORMANT: 'dormant',
  CULLED: 'culled'
};

export class EntityManager {
  /**
   * @param {object} [options]
   * @param {number} [options.activeRadius=1200] - 完整更新半径（像素）
   * @param {number} [options.dormantRadius=2048] - 冻结保留半径（像素）
   */
  constructor(options = {}) {
    this.activeRadius = options.activeRadius || 1200;
    this.dormantRadius = options.dormantRadius || 2048;

    /** @type {Map<string, string>} entityId → ENTITY_STATE */
    this._entityStates = new Map();

    /** 统计 */
    this._counts = { active: 0, dormant: 0 };
  }

  /**
   * 每帧调用：根据距离更新所有实体的激活状态
   * @param {number} cameraCenterX - 摄像机中心 X
   * @param {number} cameraCenterY - 摄像机中心 Y
   * @param {Map<string, object>} activeChunks - ChunkManager.activeChunks
   */
  update(cameraCenterX, cameraCenterY, activeChunks) {
    let activeCount = 0;
    let dormantCount = 0;

    for (const [, chunkData] of activeChunks) {
      if (!chunkData.entities) continue;

      for (const entity of chunkData.entities) {
        // 计算实体到摄像机中心的距离
        const ex = entity.worldX || 0;
        const ey = entity.worldY || 0;
        const dx = ex - cameraCenterX;
        const dy = ey - cameraCenterY;
        const distSq = dx * dx + dy * dy;

        const activeRadiusSq = this.activeRadius * this.activeRadius;
        const dormantRadiusSq = this.dormantRadius * this.dormantRadius;

        let newState;
        if (distSq < activeRadiusSq) {
          newState = ENTITY_STATE.ACTIVE;
          activeCount++;
        } else if (distSq < dormantRadiusSq) {
          newState = ENTITY_STATE.DORMANT;
          dormantCount++;
        } else {
          newState = ENTITY_STATE.CULLED;
        }

        const prevState = this._entityStates.get(entity.id);
        if (prevState !== newState) {
          this._entityStates.set(entity.id, newState);
          // Phase 6: 通知 gameObject 切换状态
          this._applyState(entity, newState, prevState);
        }
      }
    }

    this._counts.active = activeCount;
    this._counts.dormant = dormantCount;
  }

  /**
   * 应用激活状态到实体
   * Phase 5: 只更新描述符的 _state 字段
   * Phase 6: 操作 gameObject 的 active/visible/body
   */
  _applyState(entity, newState, prevState) {
    entity._state = newState;

    // Phase 6 将在此处操作 gameObject：
    // if (entity.gameObject) {
    //   if (newState === ENTITY_STATE.ACTIVE) {
    //     entity.gameObject.setActive(true).setVisible(true);
    //     if (entity.gameObject.body) entity.gameObject.body.enable = true;
    //   } else {
    //     entity.gameObject.setActive(false).setVisible(false);
    //     if (entity.gameObject.body) entity.gameObject.body.enable = false;
    //   }
    // }
  }

  /**
   * 查询实体是否处于活跃状态
   * @param {string} entityId
   * @returns {boolean}
   */
  isActive(entityId) {
    return this._entityStates.get(entityId) === ENTITY_STATE.ACTIVE;
  }

  /**
   * 获取实体状态
   * @param {string} entityId
   * @returns {string|undefined}
   */
  getState(entityId) {
    return this._entityStates.get(entityId);
  }

  /**
   * 移除实体的状态跟踪（实体被销毁时调用）
   * @param {string} entityId
   */
  removeEntity(entityId) {
    this._entityStates.delete(entityId);
  }

  /**
   * 批量移除实体状态
   * @param {string[]} entityIds
   */
  removeEntities(entityIds) {
    for (const id of entityIds) {
      this._entityStates.delete(id);
    }
  }

  /**
   * 获取统计（调试用）
   */
  getCounts() {
    return { ...this._counts };
  }

  /**
   * 清理所有状态
   */
  destroy() {
    this._entityStates.clear();
    this._counts = { active: 0, dormant: 0 };
  }
}
