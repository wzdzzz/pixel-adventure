/**
 * 背包系统
 *
 * 管理玩家的物品收集和使用
 * 使用可配置的 JSON 数据定义道具效果
 */
export class InventorySystem {
  /**
   * @param {Phaser.Scene} scene - 场景实例
   */
  constructor(scene) {
    this.scene = scene;
    this.items = [];
    this.maxSlots = 20;

    // 物品效果处理器
    this.effectHandlers = {
      'score': this.handleScoreEffect.bind(this),
      'heal': this.handleHealEffect.bind(this),
      'key': this.handleKeyEffect.bind(this),
      'artifact': this.handleArtifactEffect.bind(this)
    };
  }

  /**
   * 添加物品到背包
   * @param {object} item - 物品数据
   * @returns {boolean} 是否成功添加
   */
  addItem(item) {
    if (this.items.length >= this.maxSlots) {
      console.log('[Inventory] 背包已满');
      return false;
    }

    // 对于消耗品，直接使用效果
    if (item.effect) {
      this.applyEffect(item.effect, item.value);
    }

    // 对于非消耗品（钥匙、神器等），存入背包
    if (item.type !== 'consumable' && item.type !== 'currency') {
      this.items.push({
        id: item.id || item.type,
        name: item.name,
        type: item.type,
        value: item.value
      });
    }

    // 发送背包更新事件
    this.scene.events.emit('inventoryUpdated', this.items);

    return true;
  }

  /**
   * 应用物品效果
   * @param {object} effect - 效果配置
   * @param {number} fallbackValue - 默认值
   */
  applyEffect(effect, fallbackValue) {
    const handler = this.effectHandlers[effect.type];
    if (handler) {
      handler(effect.amount || fallbackValue);
    }
  }

  /**
   * 处理分数效果
   * @param {number} amount - 分数值
   */
  handleScoreEffect(amount) {
    const gameState = this.scene.registry.get('gameState');
    gameState.score += amount;
    this.scene.registry.set('gameState', gameState);
    this.scene.events.emit('scoreChanged', gameState.score);
    console.log(`[Inventory] 获得 ${amount} 分，总分: ${gameState.score}`);
  }

  /**
   * 处理治疗效果
   * @param {number} amount - 治疗量
   */
  handleHealEffect(amount) {
    if (this.scene.player) {
      this.scene.player.heal(amount);
      console.log(`[Inventory] 恢复 ${amount} 生命值`);
    }
  }

  /**
   * 处理钥匙效果
   * @param {number} amount - 钥匙数量
   */
  handleKeyEffect(amount) {
    const gameState = this.scene.registry.get('gameState');
    gameState.keysCollected += amount;
    this.scene.registry.set('gameState', gameState);
    this.scene.events.emit('keysChanged', gameState.keysCollected);
    console.log(`[Inventory] 获得 ${amount} 把钥匙`);
  }

  /**
   * 处理神器效果
   * @param {number} amount - 数量
   */
  handleArtifactEffect(amount) {
    const gameState = this.scene.registry.get('gameState');
    gameState.hasArtifact = true;
    this.scene.registry.set('gameState', gameState);
    this.scene.events.emit('artifactCollected');
    console.log('[Inventory] 获得远古神器！');
  }

  /**
   * 检查是否拥有某物品
   * @param {string} itemId - 物品ID
   * @returns {boolean}
   */
  hasItem(itemId) {
    return this.items.some(item => item.id === itemId);
  }

  /**
   * 移除物品
   * @param {string} itemId - 物品ID
   * @returns {boolean} 是否成功移除
   */
  removeItem(itemId) {
    const index = this.items.findIndex(item => item.id === itemId);
    if (index !== -1) {
      this.items.splice(index, 1);
      this.scene.events.emit('inventoryUpdated', this.items);
      return true;
    }
    return false;
  }

  /**
   * 获取所有物品
   * @returns {Array} 物品列表
   */
  getItems() {
    return [...this.items];
  }

  /**
   * 清空背包
   */
  clear() {
    this.items = [];
    this.scene.events.emit('inventoryUpdated', this.items);
  }

  /**
   * 导出背包数据（用于存档）
   * @returns {Array}
   */
  exportData() {
    return this.items.map(item => ({ ...item }));
  }

  /**
   * 导入背包数据（用于读档）
   * @param {Array} data - 物品数据
   */
  importData(data) {
    this.items = data || [];
    this.scene.events.emit('inventoryUpdated', this.items);
  }
}
