import Phaser from 'phaser';
import { runState } from '../systems/RunState.js';
import { LootEngine } from '../systems/LootEngine.js';

/**
 * RewardScene — 战斗奖励选择场景
 *
 * 房间完成后显示，提供三选一装备奖励 + 金币奖励。
 */
export class RewardScene extends Phaser.Scene {
  constructor() {
    super({ key: 'RewardScene' });
    this.rewards = [];
    this.selectedReward = null;
    this.roomConfig = null;
  }

  create() {
    const { width, height } = this.cameras.main;
    this.roomConfig = this.scene.settings.data || {};

    // 背景
    this.add.rectangle(width / 2, height / 2, width, height, 0x1a1a2e, 0.95);

    // 标题
    this.add.text(width / 2, 60, '战斗胜利！', {
      fontSize: '48px',
      color: '#FFD700',
      fontStyle: 'bold'
    }).setOrigin(0.5);

    this.add.text(width / 2, 120, '选择一项奖励', {
      fontSize: '24px',
      color: '#aaaaaa'
    }).setOrigin(0.5);

    // 金币奖励（固定）
    const goldReward = this._calculateGoldReward();
    runState.addGold(goldReward);

    this.add.text(width / 2, 170, `获得 ${goldReward} 金币`, {
      fontSize: '20px',
      color: '#FFD700'
    }).setOrigin(0.5);

    // 生成装备奖励选项
    this.rewards = this._generateRewards();

    // 显示奖励卡片
    this._createRewardCards(width, height);

    // 跳过按钮
    this._createSkipButton(width, height);
  }

  /**
   * 计算金币奖励
   */
  _calculateGoldReward() {
    const layer = this.roomConfig.layer || 0;
    const roomType = this.roomConfig.roomType || 'combat';

    let base = 20 + layer * 5;

    switch (roomType) {
      case 'elite':
        base *= 1.5;
        break;
      case 'boss':
        base *= 3;
        break;
    }

    return Math.floor(base);
  }

  /**
   * 生成奖励选项
   */
  _generateRewards() {
    const layer = this.roomConfig.layer || 0;
    const roomType = this.roomConfig.roomType || 'combat';
    const rewards = [];

    // 根据房间类型决定奖励数量
    let rewardCount = 3;
    if (roomType === 'boss') rewardCount = 4;
    if (roomType === 'elite') rewardCount = 3;

    // 生成装备奖励
    for (let i = 0; i < rewardCount; i++) {
      const equipment = this._generateEquipmentReward(layer, roomType, i);
      if (equipment) {
        rewards.push({
          type: 'equipment',
          data: equipment,
          index: i
        });
      }
    }

    // 添加遗物奖励（Boss 和精英房间）
    if (roomType === 'boss' || (roomType === 'elite' && Math.random() < 0.3)) {
      const relic = this._generateRelicReward(layer);
      if (relic) {
        rewards.push({
          type: 'relic',
          data: relic,
          index: rewards.length
        });
      }
    }

    return rewards;
  }

  /**
   * 生成装备奖励
   */
  _generateEquipmentReward(layer, roomType, index) {
    // 使用 LootEngine 生成装备
    const enemyLevel = layer + 1;
    const isBoss = roomType === 'boss';

    // 基础敌人 ID 用于 loot table
    const enemyId = this._getRandomEnemyId(roomType);

    try {
      const drops = LootEngine.roll(enemyId, 0, enemyLevel, isBoss, roomType);

      // 找到第一个装备
      const equip = drops.find(d => d.itemData?.type === 'equipment');
      if (equip) {
        return equip.itemData;
      }
    } catch (e) {
      console.warn('[RewardScene] 生成装备失败:', e);
    }

    // 备用：手动生成一件装备
    return this._generateFallbackEquipment(layer, roomType);
  }

  /**
   * 获取随机敌人 ID（用于 loot table）
   */
  _getRandomEnemyId(roomType) {
    const enemies = {
      combat: ['slime', 'skeleton', 'goblin'],
      elite: ['orc', 'dark_mage', 'minotaur'],
      boss: ['dragon', 'demon_lord']
    };

    const list = enemies[roomType] || enemies.combat;
    return list[Math.floor(Math.random() * list.length)];
  }

  /**
   * 备用装备生成
   */
  _generateFallbackEquipment(layer, roomType) {
    const slots = ['weapon', 'armor', 'helmet', 'boots', 'gloves', 'ring', 'amulet'];
    const slot = slots[Math.floor(Math.random() * slots.length)];

    const rarities = ['common', 'uncommon', 'rare', 'epic', 'legendary'];
    let rarityIndex = 0;

    // 根据层数和房间类型提升稀有度概率
    if (layer > 10) rarityIndex += 1;
    if (layer > 5) rarityIndex += 1;
    if (roomType === 'elite') rarityIndex += 1;
    if (roomType === 'boss') rarityIndex += 2;

    // 随机稀有度
    const roll = Math.random();
    if (roll < 0.4) rarityIndex = Math.max(0, rarityIndex - 1);
    else if (roll < 0.1) rarityIndex = Math.max(0, rarityIndex - 2);

    const rarity = rarities[Math.min(rarityIndex, rarities.length - 1)];

    return {
      id: `equip_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
      slot,
      rarity,
      level: layer + 1,
      name: this._generateEquipName(slot, rarity),
      stats: this._generateEquipStats(slot, rarity, layer)
    };
  }

  /**
   * 生成装备名称
   */
  _generateEquipName(slot, rarity) {
    const prefixes = {
      common: ['普通的', '基础的'],
      uncommon: ['精良的', '改良的'],
      rare: ['稀有的', '优质的'],
      epic: ['史诗的', '卓越的'],
      legendary: ['传说的', '神话的']
    };

    const slotNames = {
      weapon: '武器',
      armor: '护甲',
      helmet: '头盔',
      boots: '靴子',
      gloves: '手套',
      ring: '戒指',
      amulet: '项链'
    };

    const prefix = prefixes[rarity]?.[Math.floor(Math.random() * 2)] || '';
    const slotName = slotNames[slot] || '装备';

    return `${prefix}${slotName}`;
  }

  /**
   * 生成装备属性
   */
  _generateEquipStats(slot, rarity, layer) {
    const stats = {};
    const multiplier = { common: 1, uncommon: 1.2, rare: 1.5, epic: 2, legendary: 3 }[rarity] || 1;

    // 基础属性
    const baseStat = Math.floor((5 + layer * 2) * multiplier);

    switch (slot) {
      case 'weapon':
        stats.attack = baseStat;
        if (Math.random() < 0.3) stats.critRate = Math.floor(5 * multiplier);
        break;
      case 'armor':
        stats.defense = baseStat;
        stats.hp = Math.floor(baseStat * 5);
        break;
      case 'helmet':
        stats.defense = Math.floor(baseStat * 0.7);
        stats.hp = Math.floor(baseStat * 3);
        break;
      case 'boots':
        stats.defense = Math.floor(baseStat * 0.5);
        stats.speed = Math.floor(10 * multiplier);
        break;
      case 'gloves':
        stats.attack = Math.floor(baseStat * 0.6);
        stats.critRate = Math.floor(3 * multiplier);
        break;
      case 'ring':
        stats.attack = Math.floor(baseStat * 0.4);
        stats.defense = Math.floor(baseStat * 0.4);
        break;
      case 'amulet':
        stats.hp = Math.floor(baseStat * 8);
        if (Math.random() < 0.5) stats.critDamage = Math.floor(10 * multiplier);
        break;
    }

    return stats;
  }

  /**
   * 生成遗物奖励
   */
  _generateRelicReward(layer) {
    // 临时遗物列表（后续可移到 relics.js）
    const relics = [
      {
        id: 'relic_healing_potion',
        name: '生命药水瓶',
        description: '每次进入房间恢复 10% HP',
        rarity: 'common',
        icon: '🧪'
      },
      {
        id: 'relic_lucky_coin',
        name: '幸运硬币',
        description: '金币获取 +20%',
        rarity: 'uncommon',
        icon: '🪙'
      },
      {
        id: 'relic_blood_ring',
        name: '嗜血戒指',
        description: '击杀敌人恢复 5% HP',
        rarity: 'rare',
        icon: '💍'
      },
      {
        id: 'relic_shield_charm',
        name: '护盾符文',
        description: '每层开始获得护盾',
        rarity: 'epic',
        icon: '🛡️'
      },
      {
        id: 'relic_crown',
        name: '征服者之冠',
        description: '所有属性 +10%',
        rarity: 'legendary',
        icon: '👑'
      }
    ];

    // 根据层数筛选稀有度
    const available = relics.filter(r => {
      if (layer < 3 && r.rarity === 'legendary') return false;
      if (layer < 5 && r.rarity === 'epic') return false;
      return true;
    });

    return available[Math.floor(Math.random() * available.length)];
  }

  /**
   * 创建奖励卡片
   */
  _createRewardCards(width, height) {
    const cardWidth = 180;
    const cardHeight = 250;
    const spacing = 30;
    const totalWidth = this.rewards.length * cardWidth + (this.rewards.length - 1) * spacing;
    const startX = (width - totalWidth) / 2;
    const cardY = height / 2 + 30;

    this.rewards.forEach((reward, index) => {
      const x = startX + index * (cardWidth + spacing) + cardWidth / 2;
      this._createRewardCard(x, cardY, cardWidth, cardHeight, reward);
    });
  }

  /**
   * 创建单个奖励卡片
   */
  _createRewardCard(x, y, width, height, reward) {
    const container = this.add.container(x, y);

    // 卡片背景
    const bgColor = this._getRarityColor(reward.data.rarity || 'common');
    const bg = this.add.rectangle(0, 0, width, height, 0x2d2d4e);
    bg.setStrokeStyle(3, bgColor);
    bg.setInteractive({ useHandCursor: true });

    container.add(bg);

    // 图标区域
    let iconText;
    if (reward.type === 'equipment') {
      iconText = this._getEquipIcon(reward.data.slot);
    } else if (reward.type === 'relic') {
      iconText = reward.data.icon || '✨';
    }

    const icon = this.add.text(0, -70, iconText, {
      fontSize: '48px'
    }).setOrigin(0.5);
    container.add(icon);

    // 名称
    const name = this.add.text(0, -10, reward.data.name || '未知', {
      fontSize: '16px',
      color: '#ffffff',
      fontStyle: 'bold',
      wordWrap: { width: width - 20 },
      align: 'center'
    }).setOrigin(0.5);
    container.add(name);

    // 稀有度标签
    const rarityNames = {
      common: '普通',
      uncommon: '精良',
      rare: '稀有',
      epic: '史诗',
      legendary: '传说'
    };
    const rarityLabel = this.add.text(0, 20, rarityNames[reward.data.rarity] || '', {
      fontSize: '14px',
      color: Phaser.Display.Color.IntegerToColor(bgColor).rgba
    }).setOrigin(0.5);
    container.add(rarityLabel);

    // 属性描述
    let descText = '';
    if (reward.type === 'equipment' && reward.data.stats) {
      descText = Object.entries(reward.data.stats)
        .map(([stat, value]) => {
          const statNames = {
            attack: '攻击',
            defense: '防御',
            hp: '生命',
            speed: '速度',
            critRate: '暴击率',
            critDamage: '暴击伤害'
          };
          return `${statNames[stat] || stat}: +${value}`;
        })
        .join('\n');
    } else if (reward.type === 'relic') {
      descText = reward.data.description || '';
    }

    const desc = this.add.text(0, 70, descText, {
      fontSize: '12px',
      color: '#aaaaaa',
      align: 'center',
      lineSpacing: 4,
      wordWrap: { width: width - 20 }
    }).setOrigin(0.5);
    container.add(desc);

    // 悬停效果
    bg.on('pointerover', () => {
      bg.setFillStyle(0x3d3d6e);
      container.setScale(1.05);
    });

    bg.on('pointerout', () => {
      bg.setFillStyle(0x2d2d4e);
      container.setScale(1);
    });

    // 点击选择
    bg.on('pointerdown', () => {
      this._selectReward(reward, container);
    });
  }

  /**
   * 获取装备图标
   */
  _getEquipIcon(slot) {
    const icons = {
      weapon: '⚔️',
      armor: '🛡️',
      helmet: '⛑️',
      boots: '👢',
      gloves: '🧤',
      ring: '💍',
      amulet: '📿'
    };
    return icons[slot] || '📦';
  }

  /**
   * 获取稀有度颜色
   */
  _getRarityColor(rarity) {
    const colors = {
      common: 0x888888,
      uncommon: 0x00cc00,
      rare: 0x0088ff,
      epic: 0xaa00ff,
      legendary: 0xffaa00
    };
    return colors[rarity] || colors.common;
  }

  /**
   * 选择奖励
   */
  _selectReward(reward, container) {
    console.log('[奖励] 选择:', reward);

    // 添加到玩家背包/装备
    if (reward.type === 'equipment') {
      this._addToInventory(reward.data);
    } else if (reward.type === 'relic') {
      runState.addRelic(reward.data);
    }

    // 选中动画
    this.tweens.add({
      targets: container,
      scaleX: 1.2,
      scaleY: 1.2,
      alpha: 0,
      duration: 500,
      ease: 'Power2'
    });

    // 延迟返回地图
    this.time.delayedCall(600, () => {
      this._returnToMap();
    });
  }

  /**
   * 添加装备到背包
   */
  _addToInventory(equipment) {
    // 获取 MainGameScene 的 inventory 系统
    const mainScene = this.scene.get('MainGameScene');
    if (mainScene && mainScene.inventory) {
      mainScene.inventory.addItem(equipment);
      this.events.emit('showMessage', `获得 ${equipment.name}`, '#00ff88');
    }
  }

  /**
   * 创建跳过按钮
   */
  _createSkipButton(width, height) {
    const skipBtn = this.add.text(width / 2, height - 60, '跳过奖励', {
      fontSize: '18px',
      color: '#888888'
    }).setOrigin(0.5);

    skipBtn.setInteractive({ useHandCursor: true });

    skipBtn.on('pointerover', () => skipBtn.setColor('#ffffff'));
    skipBtn.on('pointerout', () => skipBtn.setColor('#888888'));
    skipBtn.on('pointerdown', () => this._returnToMap());
  }

  /**
   * 返回地图
   */
  _returnToMap() {
    runState.advanceLayer();
    this.scene.start('MapScene');
  }
}
