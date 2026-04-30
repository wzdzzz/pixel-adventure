import Phaser from 'phaser';
import { GAME_CONFIG } from '../config/gameConfig.js';
import { TEXTURES } from '../assets/AssetManager.js';
import { Player } from '../entities/Player.js';
import { Enemy } from '../entities/Enemy.js';
import { Item } from '../entities/Item.js';
import { InventorySystem } from '../systems/InventorySystem.js';
import { SaveSystem } from '../systems/SaveSystem.js';
import itemData from '../data/items.json';

/**
 * 主游戏场景
 *
 * 生命周期钩子说明：
 * - preload(): 加载资源（已在 BootScene 完成）
 * - create(): 创建游戏世界、实体、物理碰撞等
 * - update(time, delta): 每帧更新游戏逻辑
 */
export class MainGameScene extends Phaser.Scene {
  constructor() {
    super({ key: 'MainGameScene' });

    // 游戏对象容器
    this.player = null;
    this.enemies = [];
    this.items = [];
    this.npcs = [];
    this.walls = null;
    this.obstacles = null;
  }

  /**
   * create 生命周期
   * 场景创建时调用，初始化所有游戏对象
   */
  create() {
    console.log('[MainGameScene] 场景创建');

    // 初始化背包系统
    this.inventory = new InventorySystem(this);

    // 创建地图
    this.createMap();

    // 创建玩家
    this.createPlayer();

    // 创建敌人
    this.createEnemies();

    // 创建道具
    this.createItems();

    // 创建NPC
    this.createNPCs();

    // 设置物理碰撞
    this.setupCollisions();

    // 设置相机
    this.setupCamera();

    // 绑定事件
    this.setupEvents();

    // 尝试加载存档
    this.tryLoadSave();

    // 自动存档定时器
    this.time.addEvent({
      delay: 30000, // 每30秒自动保存
      callback: () => SaveSystem.save(this),
      loop: true
    });
  }

  /**
   * 创建瓦片地图
   * 使用二维数组生成地图，包含墙壁和障碍物
   */
  createMap() {
    const tileSize = GAME_CONFIG.MAP.TILE_SIZE;
    const mapData = GAME_CONFIG.MAP.LAYERS.GROUND;

    // 创建墙壁组（静态物理组）
    this.walls = this.physics.add.staticGroup();
    this.obstacles = this.physics.add.staticGroup();

    // 根据地图数据创建瓦片
    for (let y = 0; y < mapData.length; y++) {
      for (let x = 0; x < mapData[y].length; x++) {
        const tileType = mapData[y][x];
        const worldX = x * tileSize + tileSize / 2;
        const worldY = y * tileSize + tileSize / 2;

        switch (tileType) {
          case 1: // 墙壁
            const wall = this.walls.create(worldX, worldY, TEXTURES.WALL);
            wall.setOrigin(0.5, 0.5);
            wall.refreshBody();
            break;

          case 2: // 障碍物
            const obstacle = this.obstacles.create(worldX, worldY, TEXTURES.OBSTACLE);
            obstacle.setOrigin(0.5, 0.5);
            obstacle.refreshBody();
            break;

          case 3: // 终点
            this.endZone = this.add.rectangle(worldX, worldY, tileSize, tileSize, 0x00ffff, 0.3);
            this.physics.add.existing(this.endZone, true);
            break;
        }
      }
    }

    // 设置世界边界
    const mapWidth = mapData[0].length * tileSize;
    const mapHeight = mapData.length * tileSize;
    this.physics.world.setBounds(0, 0, mapWidth, mapHeight);
  }

  /**
   * 创建玩家
   */
  createPlayer() {
    // 检查是否有保存的玩家位置
    const savedData = this.registry.get('savedPlayerData');
    const startX = savedData?.position?.x || 150;
    const startY = savedData?.position?.y || 150;

    this.player = new Player(this, startX, startY);

    // 恢复HP
    if (savedData?.hp) {
      this.player.hp = savedData.hp;
      this.player.maxHp = savedData.maxHp || 100;
    }
  }

  /**
   * 创建敌人
   */
  createEnemies() {
    // 在地图上放置敌人
    const enemyPositions = [
      { x: 500, y: 300, config: itemData.enemies.slime },
      { x: 800, y: 500, config: itemData.enemies.slime },
      { x: 1200, y: 400, config: itemData.enemies.slime },
      { x: 600, y: 800, config: itemData.enemies.slime },
      { x: 1000, y: 200, config: itemData.enemies.slime }
    ];

    enemyPositions.forEach(({ x, y, config }) => {
      const enemy = new Enemy(this, x, y, config);
      this.enemies.push(enemy);
    });
  }

  /**
   * 创建道具
   */
  createItems() {
    const gameState = this.registry.get('gameState');
    const collectedItems = gameState.collectedItems || [];

    // 金币位置
    const coinPositions = [
      { x: 300, y: 200 }, { x: 500, y: 400 }, { x: 700, y: 300 },
      { x: 900, y: 600 }, { x: 1100, y: 500 }, { x: 400, y: 700 },
      { x: 600, y: 900 }, { x: 800, y: 800 }, { x: 1000, y: 400 }
    ];

    coinPositions.forEach((pos, index) => {
      const itemId = `coin_${index}`;
      if (!collectedItems.includes(itemId)) {
        const item = new Item(this, pos.x, pos.y, 'coin', {
          id: itemId,
          ...itemData.items.coin
        });
        this.items.push(item);
      }
    });

    // 钥匙位置
    const keyPositions = [
      { x: 450, y: 350 },
      { x: 900, y: 250 }
    ];

    keyPositions.forEach((pos, index) => {
      const itemId = `key_${index}`;
      if (!collectedItems.includes(itemId)) {
        const item = new Item(this, pos.x, pos.y, 'key', {
          id: itemId,
          ...itemData.items.key
        });
        this.items.push(item);
      }
    });

    // 药水位置
    const potionPositions = [
      { x: 350, y: 500 }, { x: 750, y: 700 }, { x: 1100, y: 300 }
    ];

    potionPositions.forEach((pos, index) => {
      const itemId = `potion_${index}`;
      if (!collectedItems.includes(itemId)) {
        const item = new Item(this, pos.x, pos.y, 'potion', {
          id: itemId,
          ...itemData.items.potion
        });
        this.items.push(item);
      }
    });

    // 神器位置（放在终点附近）
    const artifactId = 'artifact_0';
    if (!collectedItems.includes(artifactId)) {
      const artifact = new Item(this, 1200, 800, 'artifact', {
        id: artifactId,
        ...itemData.items.artifact
      });
      this.items.push(artifact);
    }
  }

  /**
   * 创建NPC
   */
  createNPCs() {
    // 创建NPC精灵
    const npc = this.physics.add.sprite(200, 400, TEXTURES.NPC);
    npc.setOrigin(0.5, 0.5);
    npc.body.setAllowGravity(false);
    npc.body.setImmovable(true);

    // NPC对话数据
    npc.npcData = itemData.npcs.elder;
    npc.dialogueIndex = 0;

    // NPC浮动动画
    this.tweens.add({
      targets: npc,
      y: npc.y - 5,
      duration: 1500,
      yoyo: true,
      repeat: -1,
      ease: 'Sine.easeInOut'
    });

    // 显示NPC名称
    this.add.text(npc.x, npc.y - 30, npc.npcData.name, {
      fontSize: '12px',
      fill: '#00bfff',
      fontFamily: 'Courier New'
    }).setOrigin(0.5);

    this.npcs.push(npc);
  }

  /**
   * 设置物理碰撞
   */
  setupCollisions() {
    // 玩家与墙壁碰撞
    this.physics.add.collider(this.player.sprite, this.walls);
    this.physics.add.collider(this.player.sprite, this.obstacles);

    // 敌人与墙壁碰撞
    this.enemies.forEach(enemy => {
      this.physics.add.collider(enemy.sprite, this.walls);
      this.physics.add.collider(enemy.sprite, this.obstacles);
    });

    // 玩家与道具重叠（拾取检测）
    this.items.forEach(item => {
      this.physics.add.overlap(
        this.player.sprite,
        item.sprite,
        () => this.handleItemPickup(item),
        null,
        this
      );
    });

    // 玩家与敌人重叠（伤害检测）
    this.enemies.forEach(enemy => {
      this.physics.add.overlap(
        this.player.sprite,
        enemy.sprite,
        () => this.handleEnemyContact(enemy),
        null,
        this
      );
    });

    // 攻击判定区与敌人重叠
    this.enemies.forEach(enemy => {
      this.physics.add.overlap(
        this.player.attackHitbox,
        enemy.sprite,
        () => this.handleAttackHit(enemy),
        null,
        this
      );
    });

    // 玩家与NPC重叠（交互检测）
    this.npcs.forEach(npc => {
      this.physics.add.overlap(
        this.player.sprite,
        npc,
        () => this.handleNPCProximity(npc),
        () => this.handleNPCLeave(npc),
        this
      );
    });

    // 玩家与终点重叠（胜利检测）
    if (this.endZone) {
      this.physics.add.overlap(
        this.player.sprite,
        this.endZone,
        () => this.handleVictoryZone(),
        null,
        this
      );
    }
  }

  /**
   * 设置相机
   * 实现平滑的 lerp 跟随效果，限制相机不超出地图边界
   */
  setupCamera() {
    const mapData = GAME_CONFIG.MAP.LAYERS.GROUND;
    const mapWidth = mapData[0].length * GAME_CONFIG.MAP.TILE_SIZE;
    const mapHeight = mapData.length * GAME_CONFIG.MAP.TILE_SIZE;

    // 设置相机跟随玩家，使用平滑插值
    this.cameras.main.startFollow(this.player.sprite, true, 0.08, 0.08);

    // 设置相机边界
    this.cameras.main.setBounds(0, 0, mapWidth, mapHeight);

    // 设置死区（相机不响应的区域）
    this.cameras.main.setDeadzone(100, 80);
  }

  /**
   * 绑定游戏事件
   */
  setupEvents() {
    // 玩家交互事件
    this.events.on('playerInteract', (target) => {
      if (target.npcData) {
        this.showDialogue(target);
      }
    });

    // 敌人攻击事件
    this.events.on('enemyAttack', (enemy, damage) => {
      if (this.player) {
        this.player.takeDamage(damage);
      }
    });

    // 敌人死亡事件
    this.events.on('enemyDeath', (enemy) => {
      const index = this.enemies.indexOf(enemy);
      if (index > -1) {
        this.enemies.splice(index, 1);
      }
    });

    // 生成物品事件
    this.events.on('spawnItem', (type, x, y) => {
      const config = itemData.items[type];
      if (config) {
        const item = new Item(this, x, y, type, {
          id: `${type}_${Date.now()}`,
          ...config
        });
        this.items.push(item);

        // 添加拾取碰撞
        this.physics.add.overlap(
          this.player.sprite,
          item.sprite,
          () => this.handleItemPickup(item),
          null,
          this
        );
      }
    });

    // 玩家死亡事件
    this.events.on('playerDeath', () => {
      this.handleGameOver();
    });
  }

  /**
   * 尝试加载存档
   */
  tryLoadSave() {
    if (SaveSystem.hasSave()) {
      const loaded = SaveSystem.load(this);
      if (loaded) {
        console.log('[MainGameScene] 已加载存档');
      }
    }
  }

  /**
   * 处理道具拾取
   * @param {Item} item - 被拾取的道具
   */
  handleItemPickup(item) {
    if (item.isCollected) return;

    const result = item.collect();
    if (result) {
      // 添加到背包或应用效果
      this.inventory.addItem(result);

      // 记录已拾取的道具
      const gameState = this.registry.get('gameState');
      if (item.config.id) {
        gameState.collectedItems.push(item.config.id);
        this.registry.set('gameState', gameState);
      }

      // 从物品列表移除
      const index = this.items.indexOf(item);
      if (index > -1) {
        this.items.splice(index, 1);
      }
    }
  }

  /**
   * 处理敌人接触伤害
   * @param {Enemy} enemy - 接触的敌人
   */
  handleEnemyContact(enemy) {
    if (this.player.isInvulnerable) return;
    this.player.takeDamage(enemy.config.damage);
  }

  /**
   * 处理攻击命中
   * @param {Enemy} enemy - 被击中的敌人
   */
  handleAttackHit(enemy) {
    if (!this.player.attackHitbox.body.enable) return;
    enemy.takeDamage(20); // 攻击伤害
    this.player.attackHitbox.body.enable = false; // 防止重复命中
  }

  /**
   * 处理NPC接近
   * @param {Phaser.GameObjects.Sprite} npc - NPC精灵
   */
  handleNPCProximity(npc) {
    this.player.setInteractTarget(npc);
  }

  /**
   * 处理NPC离开
   * @param {Phaser.GameObjects.Sprite} npc - NPC精灵
   */
  handleNPCLeave(npc) {
    if (this.player.interactTarget === npc) {
      this.player.clearInteractTarget();
    }
  }

  /**
   * 显示NPC对话
   * @param {Phaser.GameObjects.Sprite} npc - NPC精灵
   */
  showDialogue(npc) {
    const dialogues = npc.npcData.dialogues;
    const dialogue = dialogues[npc.dialogueIndex % dialogues.length];
    npc.dialogueIndex++;

    // 发送对话到UI场景
    this.events.emit('showDialogue', npc.npcData.name, dialogue);
  }

  /**
   * 处理胜利区域
   */
  handleVictoryZone() {
    const gameState = this.registry.get('gameState');
    if (gameState.hasArtifact) {
      this.handleVictory();
    }
  }

  /**
   * 处理游戏胜利
   */
  handleVictory() {
    // 保存最终状态
    SaveSystem.save(this);

    // 停止游戏
    this.physics.pause();

    // 切换到胜利场景
    this.time.delayedCall(500, () => {
      this.scene.start('VictoryScene');
    });
  }

  /**
   * 处理游戏失败
   */
  handleGameOver() {
    // 停止游戏
    this.physics.pause();

    // 切换到失败场景
    this.time.delayedCall(1000, () => {
      this.scene.start('GameOverScene');
    });
  }

  /**
   * update 生命周期
   * 每帧调用，更新游戏逻辑
   * @param {number} time - 游戏时间
   * @param {number} delta - 帧间隔时间
   */
  update(time, delta) {
    // 更新玩家
    if (this.player) {
      this.player.update();
    }

    // 更新敌人AI
    if (this.player && this.player.sprite) {
      this.enemies.forEach(enemy => {
        enemy.update(this.player.sprite);
      });
    }

    // 保存玩家位置到全局状态
    if (this.player) {
      const gameState = this.registry.get('gameState');
      gameState.playerPosition = this.player.getPosition();
      this.registry.set('gameState', gameState);
    }
  }
}
