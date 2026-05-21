/**
 * MapGenerator — 杀戮尖塔式节点地图生成
 *
 * 生成一个多层节点图，每层 2-4 个节点，节点间有分支连接。
 * 玩家从底层出发，每层选一个节点进入，最终到达 Boss 节点。
 */

// 房间类型权重（普通层）
const ROOM_WEIGHTS = {
  combat: 50,
  elite: 15,
  shop: 15,
  event: 20
};

// Boss 层之前的特殊层配置
const GUARANTEED_TYPES = {
  1: 'combat',    // 第 1 层固定战斗
  8: 'elite',     // 第 8 层固定精英
  15: 'boss'      // 第 15 层固定 Boss
};

export class MapGenerator {
  /**
   * @param {number} seed 随机种子
   * @param {number} totalLayers 总层数（默认 15）
   */
  constructor(seed = Date.now(), totalLayers = 15) {
    this.seed = seed;
    this.totalLayers = totalLayers;
    this._rng = this._createRNG(seed);
  }

  /**
   * 生成完整地图
   * @returns {{ layers: Array<Array<Node>>, edges: Array<{from: string, to: string}> }}
   */
  generate() {
    const layers = [];
    const edges = [];

    // 生成每层节点
    for (let layer = 0; layer < this.totalLayers; layer++) {
      const nodes = this._generateLayer(layer);
      layers.push(nodes);
    }

    // 生成连接边
    for (let layer = 0; layer < this.totalLayers - 1; layer++) {
      const currentLayer = layers[layer];
      const nextLayer = layers[layer + 1];
      const layerEdges = this._connectLayers(currentLayer, nextLayer, layer);
      edges.push(...layerEdges);
    }

    return { layers, edges };
  }

  /**
   * 生成单层节点
   */
  _generateLayer(layerIndex) {
    // 确定节点数量
    let nodeCount;
    if (layerIndex === 0) {
      nodeCount = 1; // 起始层只有 1 个节点
    } else if (layerIndex === this.totalLayers - 1) {
      nodeCount = 1; // Boss 层只有 1 个节点
    } else {
      nodeCount = 2 + Math.floor(this._rng() * 3); // 2-4 个节点
    }

    const nodes = [];
    for (let i = 0; i < nodeCount; i++) {
      const node = {
        id: `${layerIndex}_${i}`,
        layer: layerIndex,
        index: i,
        type: this._getRoomType(layerIndex),
        visited: false
      };
      nodes.push(node);
    }

    return nodes;
  }

  /**
   * 确定房间类型
   */
  _getRoomType(layerIndex) {
    // 固定类型层
    if (GUARANTEED_TYPES[layerIndex]) {
      return GUARANTEED_TYPES[layerIndex];
    }

    // 按权重随机选择
    const roll = this._rng() * 100;
    let cumulative = 0;

    for (const [type, weight] of Object.entries(ROOM_WEIGHTS)) {
      cumulative += weight;
      if (roll < cumulative) {
        return type;
      }
    }

    return 'combat'; // fallback
  }

  /**
   * 连接两层节点（确保每个节点至少有一个连接）
   */
  _connectLayers(currentLayer, nextLayer, layerIndex) {
    const edges = [];

    if (nextLayer.length === 1) {
      // 下一层只有 1 个节点，所有当前层节点都连接它
      for (const node of currentLayer) {
        edges.push({ from: node.id, to: nextLayer[0].id });
      }
    } else if (currentLayer.length === 1) {
      // 当前层只有 1 个节点，连接到下一层所有节点
      for (const node of nextLayer) {
        edges.push({ from: currentLayer[0].id, to: node.id });
      }
    } else {
      // 多对多：确保每个节点至少有一个连接，避免交叉
      const usedNext = new Set();

      // 先给每个当前层节点分配一个随机下一层节点
      for (const node of currentLayer) {
        const targetIndex = Math.floor(this._rng() * nextLayer.length);
        const target = nextLayer[targetIndex];
        edges.push({ from: node.id, to: target.id });
        usedNext.add(targetIndex);
      }

      // 确保下一层每个节点都被连接
      for (let i = 0; i < nextLayer.length; i++) {
        if (!usedNext.has(i)) {
          // 随机选一个当前层节点连接
          const sourceIndex = Math.floor(this._rng() * currentLayer.length);
          edges.push({ from: currentLayer[sourceIndex].id, to: nextLayer[i].id });
        }
      }

      // 额外随机连接（增加路径多样性）
      for (const node of currentLayer) {
        if (this._rng() < 0.3) { // 30% 概率额外连接
          const targetIndex = Math.floor(this._rng() * nextLayer.length);
          const target = nextLayer[targetIndex];
          const edgeExists = edges.some(e =>
            e.from === node.id && e.to === target.id
          );
          if (!edgeExists) {
            edges.push({ from: node.id, to: target.id });
          }
        }
      }
    }

    return edges;
  }

  /**
   * 简单的伪随机数生成器（种子化）
   */
  _createRNG(seed) {
    let state = seed;
    return () => {
      state = (state * 1103515245 + 12345) & 0x7fffffff;
      return state / 0x7fffffff;
    };
  }
}

/**
 * 获取节点的显示配置
 */
export function getNodeDisplayConfig(type) {
  const configs = {
    combat: {
      color: 0x4CAF50,  // 绿色
      icon: '⚔️',
      label: '战斗'
    },
    elite: {
      color: 0xFF9800,  // 橙色
      icon: '💀',
      label: '精英'
    },
    shop: {
      color: 0x2196F3,  // 蓝色
      icon: '🛒',
      label: '商店'
    },
    event: {
      color: 0x9C27B0,  // 紫色
      icon: '❓',
      label: '事件'
    },
    boss: {
      color: 0xF44336,  // 红色
      icon: '👹',
      label: 'Boss'
    }
  };

  return configs[type] || configs.combat;
}
