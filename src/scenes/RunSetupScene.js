import Phaser from 'phaser';
import { CLASS_CONFIG } from '../data/classConfig.js';
import { runState } from '../systems/RunState.js';

/**
 * RunSetupScene — 肉鸽开局选择场景
 *
 * 选择职业、查看起始遗物、开始新局。
 */
export class RunSetupScene extends Phaser.Scene {
  constructor() {
    super({ key: 'RunSetupScene' });
    this.selectedClass = null;
  }

  create() {
    const { width, height } = this.cameras.main;

    // 背景
    this.add.rectangle(width / 2, height / 2, width, height, 0x1a1a2e);

    // 标题
    this.add.text(width / 2, 60, '新的远征', {
      fontSize: '48px',
      color: '#ffffff',
      fontStyle: 'bold'
    }).setOrigin(0.5);

    this.add.text(width / 2, 120, '选择你的职业', {
      fontSize: '24px',
      color: '#aaaaaa'
    }).setOrigin(0.5);

    // 职业选择卡片
    const classes = Object.keys(CLASS_CONFIG);
    const cardWidth = 200;
    const cardSpacing = 40;
    const totalWidth = classes.length * cardWidth + (classes.length - 1) * cardSpacing;
    const startX = (width - totalWidth) / 2;

    classes.forEach((classType, index) => {
      const config = CLASS_CONFIG[classType];
      const x = startX + index * (cardWidth + cardSpacing) + cardWidth / 2;
      const y = height / 2;

      this._createClassCard(classType, config, x, y, cardWidth);
    });

    // 开始按钮（初始隐藏）
    this.startButton = this.add.container(width / 2, height - 100);
    this.startButton.setAlpha(0);

    const btnBg = this.add.rectangle(0, 0, 200, 50, 0x4CAF50);
    btnBg.setStrokeStyle(2, 0xffffff);
    btnBg.setInteractive({ useHandCursor: true });

    const btnText = this.add.text(0, 0, '开始远征', {
      fontSize: '24px',
      color: '#ffffff',
      fontStyle: 'bold'
    }).setOrigin(0.5);

    this.startButton.add([btnBg, btnText]);

    btnBg.on('pointerover', () => btnBg.setFillStyle(0x66BB6A));
    btnBg.on('pointerout', () => btnBg.setFillStyle(0x4CAF50));
    btnBg.on('pointerdown', () => this._startRun());

    // 返回按钮
    const backBtn = this.add.text(100, height - 50, '← 返回', {
      fontSize: '20px',
      color: '#aaaaaa'
    }).setOrigin(0.5);

    backBtn.setInteractive({ useHandCursor: true });
    backBtn.on('pointerdown', () => {
      this.scene.start('MainMenuScene');
    });
    backBtn.on('pointerover', () => backBtn.setColor('#ffffff'));
    backBtn.on('pointerout', () => backBtn.setColor('#aaaaaa'));
  }

  /**
   * 创建职业选择卡片
   */
  _createClassCard(classType, config, x, y, width) {
    const container = this.add.container(x, y);

    // 卡片背景
    const bg = this.add.rectangle(0, 0, width, 280, 0x2d2d4e);
    bg.setStrokeStyle(2, 0x444466);
    bg.setInteractive({ useHandCursor: true });

    // 职业图标（用 emoji 代替）
    const icons = {
      warrior: '⚔️',
      archer: '🏹',
      mage: '🔮'
    };
    const icon = this.add.text(0, -80, icons[classType] || '❓', {
      fontSize: '48px'
    }).setOrigin(0.5);

    // 职业名称
    const name = this.add.text(0, -20, this._getClassName(classType), {
      fontSize: '24px',
      color: '#ffffff',
      fontStyle: 'bold'
    }).setOrigin(0.5);

    // 属性描述
    const primaryStat = config.primaryAttackStat || 'str';
    const statNames = {
      str: '力量',
      agi: '敏捷',
      int: '智力'
    };
    const desc = this.add.text(0, 20, `主属性: ${statNames[primaryStat] || primaryStat}`, {
      fontSize: '16px',
      color: '#aaaaaa'
    }).setOrigin(0.5);

    // 基础属性展示
    const stats = config.baseStats || {};
    const statsText = [
      `HP: ${stats.con * 10 || 100}`,
      `攻击: ${stats[primaryStat] || 10}`,
      `防御: ${Math.floor((stats.con + stats.agi) / 2) || 5}`
    ].join('\n');

    const statsLabel = this.add.text(0, 60, statsText, {
      fontSize: '14px',
      color: '#888888',
      align: 'center',
      lineSpacing: 5
    }).setOrigin(0.5);

    container.add([bg, icon, name, desc, statsLabel]);

    // 交互
    bg.on('pointerover', () => {
      if (this.selectedClass !== classType) {
        bg.setFillStyle(0x3d3d6e);
      }
    });

    bg.on('pointerout', () => {
      if (this.selectedClass !== classType) {
        bg.setFillStyle(0x2d2d4e);
      }
    });

    bg.on('pointerdown', () => {
      this._selectClass(classType, bg);
    });

    // 保存引用
    bg._classType = classType;
    bg._container = container;
  }

  /**
   * 选择职业
   */
  _selectClass(classType, bg) {
    this.selectedClass = classType;

    // 更新所有卡片样式
    this.children.list.forEach(child => {
      if (child.type === 'Container') {
        child.list.forEach(item => {
          if (item.type === 'Rectangle' && item._classType) {
            if (item._classType === classType) {
              item.setFillStyle(0x4d4d8e);
              item.setStrokeStyle(3, 0x66bb6a);
            } else {
              item.setFillStyle(0x2d2d4e);
              item.setStrokeStyle(2, 0x444466);
            }
          }
        });
      }
    });

    // 显示开始按钮
    this.tweens.add({
      targets: this.startButton,
      alpha: 1,
      duration: 300,
      ease: 'Power2'
    });
  }

  /**
   * 获取职业中文名
   */
  _getClassName(classType) {
    const names = {
      warrior: '战士',
      archer: '弓箭手',
      mage: '法师'
    };
    return names[classType] || classType;
  }

  /**
   * 开始新局
   */
  _startRun() {
    if (!this.selectedClass) return;

    // 初始化单局状态
    runState.startNewRun(this.selectedClass, null);

    // 设置 registry
    this.registry.set('classType', this.selectedClass);
    this.registry.set('gender', 'male'); // 默认性别

    // 切换到地图场景
    this.scene.start('MapScene');
  }
}
