/**
 * 技能树系统 — 节点数据结构、解锁逻辑
 * 技能内容预留，具体效果后续填充
 */
export class SkillTreeSystem {
  constructor(scene) {
    this.scene = scene;
    this.nodes = [];
    this.unlockedNodes = new Set();
    this.initDefaultTree();
  }

  initDefaultTree() {
    // Placeholder tree: 1 root + 4 tier-1 + 2 tier-2 + 1 tier-3
    this.nodes = [
      { id: 'root', name: '起始', type: 'passive', tier: 0, x: 0, y: 0,
        prerequisites: [], requiredLevel: 1, cost: 0, maxRank: 1, currentRank: 1,
        effects: [], description: '冒险的起点' },
      { id: 'node_1a', name: '???', type: 'passive', tier: 1, x: -1.5, y: 1,
        prerequisites: ['root'], requiredLevel: 3, cost: 1, maxRank: 3, currentRank: 0,
        effects: [], description: '待填充' },
      { id: 'node_1b', name: '???', type: 'passive', tier: 1, x: -0.5, y: 1,
        prerequisites: ['root'], requiredLevel: 3, cost: 1, maxRank: 3, currentRank: 0,
        effects: [], description: '待填充' },
      { id: 'node_1c', name: '???', type: 'active', tier: 1, x: 0.5, y: 1,
        prerequisites: ['root'], requiredLevel: 3, cost: 1, maxRank: 3, currentRank: 0,
        effects: [], description: '待填充' },
      { id: 'node_1d', name: '???', type: 'active', tier: 1, x: 1.5, y: 1,
        prerequisites: ['root'], requiredLevel: 3, cost: 1, maxRank: 3, currentRank: 0,
        effects: [], description: '待填充' },
      { id: 'node_2a', name: '???', type: 'passive', tier: 2, x: -1, y: 2,
        prerequisites: ['node_1a', 'node_1b'], requiredLevel: 6, cost: 1, maxRank: 3, currentRank: 0,
        effects: [], description: '待填充' },
      { id: 'node_2b', name: '???', type: 'active', tier: 2, x: 1, y: 2,
        prerequisites: ['node_1c', 'node_1d'], requiredLevel: 6, cost: 1, maxRank: 3, currentRank: 0,
        effects: [], description: '待填充' },
      { id: 'node_3', name: '???', type: 'active', tier: 3, x: 0, y: 3,
        prerequisites: ['node_2a', 'node_2b'], requiredLevel: 10, cost: 2, maxRank: 1, currentRank: 0,
        effects: [], description: '待填充' }
    ];
    this.unlockedNodes.add('root');
  }

  canUnlock(nodeId) {
    const node = this.getNode(nodeId);
    if (!node || node.currentRank >= node.maxRank) return false;
    const levelSystem = this.scene.registry.get('levelSystem');
    if (!levelSystem || levelSystem.level < node.requiredLevel) return false;
    if (levelSystem.skillPoints < node.cost) return false;
    return node.prerequisites.every(p => this.unlockedNodes.has(p));
  }

  unlock(nodeId) {
    if (!this.canUnlock(nodeId)) return false;
    const node = this.getNode(nodeId);
    const levelSystem = this.scene.registry.get('levelSystem');
    levelSystem.skillPoints -= node.cost;
    node.currentRank++;
    if (node.currentRank >= 1) this.unlockedNodes.add(nodeId);
    this.scene.events.emit('skillUnlocked', nodeId, node);
    return true;
  }

  getNode(id) {
    return this.nodes.find(n => n.id === id);
  }

  getNodeState(nodeId) {
    const node = this.getNode(nodeId);
    if (!node) return 'unknown';
    if (this.unlockedNodes.has(nodeId) && node.currentRank >= node.maxRank) return 'maxed';
    if (this.unlockedNodes.has(nodeId)) return 'unlocked';
    if (this.canUnlock(nodeId)) return 'available';
    return 'locked';
  }

  toJSON() {
    return {
      unlockedNodes: [...this.unlockedNodes],
      nodes: this.nodes.map(n => ({ id: n.id, currentRank: n.currentRank }))
    };
  }

  fromJSON(data) {
    if (!data) return;
    if (data.unlockedNodes) {
      this.unlockedNodes = new Set(data.unlockedNodes);
    }
    if (data.nodes) {
      data.nodes.forEach(saved => {
        const node = this.getNode(saved.id);
        if (node) node.currentRank = saved.currentRank;
      });
    }
  }
}
