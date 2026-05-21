import Phaser from 'phaser';
import { MapGenerator, getNodeDisplayConfig } from '../systems/MapGenerator.js';
import { runState } from '../systems/RunState.js';

/**
 * MapScene — 杀戮尖塔式节点地图场景
 *
 * 显示多层节点图，玩家点击可到达的节点进入对应房间。
 */
export class MapScene extends Phaser.Scene {
  constructor() {
    super({ key: 'MapScene' });

    // 地图显示配置
    this.MAP_CONFIG = {
      nodeRadius: 28,
      layerSpacing: 100,
      nodeSpacing: 120,
      startX: 150,
      startY: 100,
      width: 1620,
      height: 880
    };

    this.nodeSprites = new Map();
    this.edgeGraphics = null;
    this.selectedNode = null;
  }

  create() {
    const { width, height } = this.cameras.main;

    // 背景
    this.add.rectangle(width / 2, height / 2, width, height, 0x1a1a2e);

    // 标题
    this.add.text(width / 2, 40, '选择路径', {
      fontSize: '32px',
      color: '#ffffff',
      fontStyle: 'bold'
    }).setOrigin(0.5);

    // 层数显示
    this.layerText = this.add.text(width / 2, 80, '', {
      fontSize: '20px',
      color: '#aaaaaa'
    }).setOrigin(0.5);

    // 金币显示
    this.goldText = this.add.text(width - 100, 40, '', {
      fontSize: '24px',
      color: '#FFD700'
    }).setOrigin(0.5);

    // 遗物数量显示
    this.relicText = this.add.text(width - 100, 70, '', {
      fontSize: '18px',
      color: '#aaaaaa'
    }).setOrigin(0.5);

    // 初始化地图
    this.initMap();

    // 绘制地图
    this.drawMap();

    // 更新 UI
    this.updateUI();
  }

  /**
   * 初始化地图数据
   */
  initMap() {
    // 如果没有地图数据，生成新的
    if (!runState.mapData) {
      const generator = new MapGenerator(Date.now());
      runState.mapData = generator.generate();

      // 设置起始节点
      if (runState.mapData.layers.length > 0) {
        const startNode = runState.mapData.layers[0][0];
        runState.visitNode(startNode.id);
      }
    }
  }

  /**
   * 绘制地图
   */
  drawMap() {
    const { layers, edges } = runState.mapData;
    const config = this.MAP_CONFIG;

    // 清除旧的绘制
    this.nodeSprites.forEach(sprite => sprite.destroy());
    this.nodeSprites.clear();
    if (this.edgeGraphics) this.edgeGraphics.destroy();

    // 计算地图布局
    const totalLayers = layers.length;
    const layerStep = (config.width - config.startX * 2) / (totalLayers - 1);

    // 先计算所有节点位置
    const nodePositions = new Map();

    for (let layerIndex = 0; layerIndex < layers.length; layerIndex++) {
      const nodes = layers[layerIndex];
      const layerX = config.startX + layerIndex * layerStep;

      // 垂直居中分布
      const totalHeight = (nodes.length - 1) * config.nodeSpacing;
      const startY = (config.height + config.startY) / 2 - totalHeight / 2;

      for (let nodeIndex = 0; nodeIndex < nodes.length; nodeIndex++) {
        const node = nodes[nodeIndex];
        const x = layerX;
        const y = startY + nodeIndex * config.nodeSpacing;
        nodePositions.set(node.id, { x, y });
      }
    }

    // 绘制连接线
    this.edgeGraphics = this.add.graphics();
    this.edgeGraphics.setDepth(0);

    for (const edge of edges) {
      const fromPos = nodePositions.get(edge.from);
      const toPos = nodePositions.get(edge.to);

      if (fromPos && toPos) {
        // 检查是否是可到达的边（当前节点到下一层）
        const isReachable = this._isEdgeReachable(edge);

        this.edgeGraphics.lineStyle(
          isReachable ? 3 : 1,
          isReachable ? 0x4CAF50 : 0x444444,
          isReachable ? 1 : 0.5
        );
        this.edgeGraphics.beginPath();
        this.edgeGraphics.moveTo(fromPos.x, fromPos.y);
        this.edgeGraphics.lineTo(toPos.x, toPos.y);
        this.edgeGraphics.strokePath();
      }
    }

    // 绘制节点
    for (let layerIndex = 0; layerIndex < layers.length; layerIndex++) {
      const nodes = layers[layerIndex];

      for (const node of nodes) {
        const pos = nodePositions.get(node.id);
        if (pos) {
          this._createNodeSprite(node, pos.x, pos.y);
        }
      }
    }

    // 滚动控制（如果地图太宽）
    this._setupScrolling(nodePositions);
  }

  /**
   * 创建节点精灵
   */
  _createNodeSprite(node, x, y) {
    const config = this.MAP_CONFIG;
    const display = getNodeDisplayConfig(node.type);

    // 节点容器
    const container = this.add.container(x, y);
    container.setDepth(1);

    // 节点背景圆
    const circle = this.add.circle(0, 0, config.nodeRadius, display.color);
    circle.setStrokeStyle(3, 0xffffff);

    // 已访问状态
    if (runState.visitedNodes.has(node.id)) {
      circle.setAlpha(0.5);
      circle.setStrokeStyle(3, 0x888888);
    }

    container.add(circle);

    // 节点图标
    const icon = this.add.text(0, 0, display.icon, {
      fontSize: '28px'
    }).setOrigin(0.5);
    container.add(icon);

    // 节点标签（在下方）
    const label = this.add.text(0, config.nodeRadius + 15, display.label, {
      fontSize: '14px',
      color: '#ffffff'
    }).setOrigin(0.5);
    container.add(label);

    // 交互设置
    const isReachable = this._isNodeReachable(node);

    if (isReachable) {
      circle.setInteractive({ useHandCursor: true });

      // 悬停效果
      circle.on('pointerover', () => {
        circle.setScale(1.2);
        this._showNodeTooltip(node, x, y);
      });

      circle.on('pointerout', () => {
        circle.setScale(1);
        this._hideNodeTooltip();
      });

      // 点击进入房间
      circle.on('pointerdown', () => {
        this._enterNode(node);
      });

      // 可到达节点的呼吸动画
      this.tweens.add({
        targets: circle,
        scaleX: 1.1,
        scaleY: 1.1,
        duration: 800,
        yoyo: true,
        repeat: -1,
        ease: 'Sine.easeInOut'
      });
    }

    this.nodeSprites.set(node.id, container);
  }

  /**
   * 检查节点是否可到达
   */
  _isNodeReachable(node) {
    const availableNodes = runState.getAvailableNodes();
    return availableNodes.some(n => n.id === node.id);
  }

  /**
   * 检查边是否可到达
   */
  _isEdgeReachable(edge) {
    const availableNodes = runState.getAvailableNodes();

    // 当 currentNodeId 为 null 时（房间完成后），高亮到可到达节点的边
    if (runState.currentNodeId === null) {
      // 找到上一层的节点作为起点
      const prevLayer = runState.currentLayer - 1;
      if (prevLayer >= 0 && runState.mapData) {
        const prevNodes = runState.mapData.layers[prevLayer];
        // 检查边是否从上一层节点到当前可到达节点
        const isFromPrevLayer = prevNodes.some(n => n.id === edge.from);
        const isToAvailable = availableNodes.some(n => n.id === edge.to);
        return isFromPrevLayer && isToAvailable;
      }
      return false;
    }

    // 正常情况：当前节点出发的边，且目标是可到达的
    if (edge.from === runState.currentNodeId) {
      return availableNodes.some(n => n.id === edge.to);
    }
    return false;
  }

  /**
   * 显示节点提示
   */
  _showNodeTooltip(node, x, y) {
    if (this.tooltip) this.tooltip.destroy();

    const display = getNodeDisplayConfig(node.type);
    const text = `${display.icon} ${display.label}\n层 ${node.layer + 1}`;

    this.tooltip = this.add.container(x, y - 60);
    this.tooltip.setDepth(100);

    const bg = this.add.rectangle(0, 0, 120, 50, 0x000000, 0.8);
    bg.setStrokeStyle(1, 0xffffff);
    this.tooltip.add(bg);

    const label = this.add.text(0, 0, text, {
      fontSize: '14px',
      color: '#ffffff',
      align: 'center'
    }).setOrigin(0.5);
    this.tooltip.add(label);
  }

  /**
   * 隐藏节点提示
   */
  _hideNodeTooltip() {
    if (this.tooltip) {
      this.tooltip.destroy();
      this.tooltip = null;
    }
  }

  /**
   * 进入节点
   */
  _enterNode(node) {
    console.log(`进入节点: ${node.id} (${node.type})`);

    // 记录当前节点
    runState.visitNode(node.id);

    // 启动 UIScene（如果未启动）
    if (!this.scene.isActive('UIScene')) {
      this.scene.launch('UIScene');
    }

    // 根据节点类型切换场景
    const roomConfig = {
      roomType: node.type,
      layer: node.layer,
      nodeId: node.id
    };

    this.scene.start('MainGameScene', roomConfig);
  }

  /**
   * 设置地图滚动（如果地图太宽）
   */
  _setupScrolling(nodePositions) {
    // 计算地图边界
    let minX = Infinity, maxX = -Infinity;
    nodePositions.forEach(pos => {
      minX = Math.min(minX, pos.x);
      maxX = Math.max(maxX, pos.x);
    });

    const mapWidth = maxX - minX + this.MAP_CONFIG.nodeRadius * 2 + 100;
    const screenWidth = this.cameras.main.width;

    if (mapWidth > screenWidth) {
      // 启用拖拽滚动
      this.input.on('pointermove', (pointer) => {
        if (pointer.isDown) {
          this.cameras.main.scrollX -= pointer.velocity.x * 0.1;
        }
      });

      // 限制滚动范围
      this.cameras.main.setBounds(
        0, 0,
        mapWidth, this.cameras.main.height
      );
    }
  }

  /**
   * 更新 UI 显示
   */
  updateUI() {
    this.layerText.setText(`层 ${runState.currentLayer + 1} / ${runState.mapData.layers.length}`);
    this.goldText.setText(`💰 ${runState.gold}`);
    this.relicText.setText(`遗物: ${runState.relics.length}`);
  }
}
