/**
 * RunState — 单局肉鸽运行状态管理
 *
 * 管理当前局的状态：层数、金币、遗物、已访问节点等。
 * 每次开始新局时重置，死亡或通关时结束。
 */

export class RunState {
  constructor() {
    this.reset();
  }

  /**
   * 重置状态（开始新局）
   */
  reset() {
    // 当前所在层（0-indexed）
    this.currentLayer = 0;

    // 当前所在节点 ID
    this.currentNodeId = null;

    // 金币
    this.gold = 0;

    // 遗物列表 [{id, name, description, rarity, icon}]
    this.relics = [];

    // 已访问的节点 ID 集合
    this.visitedNodes = new Set();

    // 已完成的层数
    this.completedLayers = 0;

    // 当前选择的职业
    this.classType = null;

    // 单局统计
    this.stats = {
      enemiesKilled: 0,
      damageDealt: 0,
      damageTaken: 0,
      goldEarned: 0,
      roomsCleared: 0,
      startTime: Date.now()
    };

    // 当前地图数据
    this.mapData = null;
  }

  /**
   * 开始新局
   * @param {string} classType 职业类型
   * @param {object} mapData 地图数据
   */
  startNewRun(classType, mapData) {
    this.reset();
    this.classType = classType;
    this.mapData = mapData;

    // 起始金币（后续可从 Meta 进度读取加成）
    this.gold = 50;
  }

  /**
   * 访问节点
   * @param {string} nodeId
   */
  visitNode(nodeId) {
    this.currentNodeId = nodeId;
    this.visitedNodes.add(nodeId);
  }

  /**
   * 完成当前层，进入下一层
   */
  advanceLayer() {
    this.completedLayers = this.currentLayer + 1;
    this.currentLayer++;
    this.currentNodeId = null;
  }

  /**
   * 添加金币
   * @param {number} amount
   */
  addGold(amount) {
    this.gold += amount;
    this.stats.goldEarned += amount;
  }

  /**
   * 花费金币
   * @param {number} amount
   * @returns {boolean} 是否成功
   */
  spendGold(amount) {
    if (this.gold >= amount) {
      this.gold -= amount;
      return true;
    }
    return false;
  }

  /**
   * 添加遗物
   * @param {object} relic 遗物数据
   */
  addRelic(relic) {
    this.relics.push(relic);
  }

  /**
   * 移除遗物
   * @param {string} relicId
   * @returns {boolean} 是否成功
   */
  removeRelic(relicId) {
    const index = this.relics.findIndex(r => r.id === relicId);
    if (index !== -1) {
      this.relics.splice(index, 1);
      return true;
    }
    return false;
  }

  /**
   * 检查是否拥有某个遗物
   * @param {string} relicId
   * @returns {boolean}
   */
  hasRelic(relicId) {
    return this.relics.some(r => r.id === relicId);
  }

  /**
   * 获取当前层可用的节点（可到达的下一层节点）
   * @returns {Array<object>}
   */
  getAvailableNodes() {
    if (!this.mapData) return [];

    const { layers, edges } = this.mapData;
    const currentLayer = this.currentLayer;

    // 如果是游戏开始，返回第 0 层的节点
    if (this.currentNodeId === null && currentLayer === 0) {
      return layers[0];
    }

    // 如果已完成所有层，返回空
    if (currentLayer >= layers.length) return [];

    // 如果 currentNodeId 为空（房间完成后），返回当前层的所有节点
    // 这允许玩家在返回地图后选择当前层的任意节点
    if (this.currentNodeId === null) {
      return layers[currentLayer] || [];
    }

    // 找到当前节点连接的下一层节点
    const nextLayer = currentLayer + 1;
    if (nextLayer >= layers.length) return [];

    const connectedEdges = edges.filter(e => e.from === this.currentNodeId);
    const availableNodeIds = connectedEdges.map(e => e.to);

    return layers[nextLayer].filter(node => availableNodeIds.includes(node.id));
  }

  /**
   * 检查是否到达 Boss 层
   * @returns {boolean}
   */
  isAtBoss() {
    return this.currentLayer >= (this.mapData?.layers?.length || 0) - 1;
  }

  /**
   * 检查局是否结束（通关或死亡）
   * @returns {boolean}
   */
  isRunComplete() {
    return this.currentLayer >= (this.mapData?.layers?.length || 0);
  }

  /**
   * 获取运行时长（秒）
   * @returns {number}
   */
  getRunDuration() {
    return Math.floor((Date.now() - this.stats.startTime) / 1000);
  }

  /**
   * 获取摘要信息（用于结算画面）
   * @returns {object}
   */
  getSummary() {
    return {
      classType: this.classType,
      layersCleared: this.completedLayers,
      gold: this.gold,
      relicsCount: this.relics.length,
      duration: this.getRunDuration(),
      stats: { ...this.stats }
    };
  }
}

// 全局单例
export const runState = new RunState();
