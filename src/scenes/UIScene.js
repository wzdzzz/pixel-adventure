import Phaser from 'phaser';
import { TEXTURES } from '../assets/AssetManager.js';

/**
 * UI 场景
 *
 * 独立渲染的 HUD 层
 * 显示生命值、分数、背包等信息
 *
 * 生命周期说明：
 * - 作为独立场景与 MainGameScene 并行运行
 * - 通过事件系统与主游戏场景通信
 */
export class UIScene extends Phaser.Scene {
  constructor() {
    super({ key: 'UIScene' });
  }

  /**
   * create 生命周期
   * 创建 UI 元素
   */
  create() {
    // 获取主游戏场景引用
    this.gameScene = this.scene.get('MainGameScene');

    // 创建 HUD 背景
    this.createHUD();

    // 创建生命值条
    this.createHealthBar();

    // 创建分数显示
    this.createScoreDisplay();

    // 创建钥匙计数
    this.createKeyDisplay();

    // 创建对话框
    this.createDialogueBox();

    // 绑定事件
    this.setupEvents();

    // 创建快捷键提示
    this.createControlsHint();
  }

  /**
   * 创建 HUD 背景
   */
  createHUD() {
    // 顶部 HUD 背景
    this.hudBg = this.add.rectangle(0, 0, 800, 50, 0x000000, 0.7);
    this.hudBg.setOrigin(0, 0);

    // 底部提示栏背景
    this.bottomBar = this.add.rectangle(0, 570, 800, 30, 0x000000, 0.5);
    this.bottomBar.setOrigin(0, 0);
  }

  /**
   * 创建生命值条
   */
  createHealthBar() {
    // 生命值图标
    this.heartIcon = this.add.image(20, 25, TEXTURES.HEART);
    this.heartIcon.setScale(0.8);

    // 生命值条背景
    this.hpBarBg = this.add.rectangle(50, 25, 150, 16, 0x333333);
    this.hpBarBg.setOrigin(0, 0.5);
    this.hpBarBg.setStrokeStyle(1, 0x666666);

    // 生命值条
    this.hpBar = this.add.rectangle(51, 25, 148, 14, 0x00ff00);
    this.hpBar.setOrigin(0, 0.5);

    // 生命值文字
    this.hpText = this.add.text(210, 25, '100/100', {
      fontSize: '14px',
      fill: '#ffffff',
      fontFamily: 'Courier New'
    }).setOrigin(0, 0.5);
  }

  /**
   * 创建分数显示
   */
  createScoreDisplay() {
    // 分数标签
    this.add.text(400, 15, '分数', {
      fontSize: '12px',
      fill: '#aaaaaa',
      fontFamily: 'Courier New'
    }).setOrigin(0.5);

    // 分数值
    this.scoreText = this.add.text(400, 32, '0', {
      fontSize: '18px',
      fill: '#ffff00',
      fontFamily: 'Courier New'
    }).setOrigin(0.5);
  }

  /**
   * 创建钥匙计数显示
   */
  createKeyDisplay() {
    // 钥匙图标
    this.keyIcon = this.add.image(600, 25, TEXTURES.KEY);
    this.keyIcon.setScale(0.8);

    // 钥匙数量
    this.keyText = this.add.text(620, 25, 'x0', {
      fontSize: '14px',
      fill: '#ff69b4',
      fontFamily: 'Courier New'
    }).setOrigin(0, 0.5);
  }

  /**
   * 创建对话框
   */
  createDialogueBox() {
    // 对话框容器（初始隐藏）
    this.dialogueContainer = this.add.container(400, 480);

    // 对话框背景
    this.dialogueBg = this.add.rectangle(0, 0, 600, 100, 0x000000, 0.9);
    this.dialogueBg.setStrokeStyle(2, 0x00ff00);

    // NPC名称
    this.npcNameText = this.add.text(-280, -35, '', {
      fontSize: '14px',
      fill: '#00bfff',
      fontFamily: 'Courier New',
      fontStyle: 'bold'
    });

    // 对话内容
    this.dialogueText = this.add.text(-280, -15, '', {
      fontSize: '13px',
      fill: '#ffffff',
      fontFamily: 'Courier New',
      wordWrap: { width: 560 }
    });

    // 关闭提示
    this.closeHint = this.add.text(250, 30, '[按 E 关闭]', {
      fontSize: '11px',
      fill: '#888888',
      fontFamily: 'Courier New'
    });

    this.dialogueContainer.add([
      this.dialogueBg,
      this.npcNameText,
      this.dialogueText,
      this.closeHint
    ]);

    this.dialogueContainer.setVisible(false);
    this.dialogueVisible = false;
  }

  /**
   * 创建控制提示
   */
  createControlsHint() {
    this.add.text(400, 585, 'WASD:移动 | 空格:攻击 | E:交互', {
      fontSize: '12px',
      fill: '#888888',
      fontFamily: 'Courier New'
    }).setOrigin(0.5);
  }

  /**
   * 绑定事件
   */
  setupEvents() {
    // 监听主游戏场景事件
    if (this.gameScene) {
      // HP 变化
      this.gameScene.events.on('playerHpChanged', (hp, maxHp) => {
        this.updateHealthBar(hp, maxHp);
      });

      // 分数变化
      this.gameScene.events.on('scoreChanged', (score) => {
        this.updateScore(score);
      });

      // 钥匙变化
      this.gameScene.events.on('keysChanged', (count) => {
        this.updateKeyCount(count);
      });

      // 显示对话
      this.gameScene.events.on('showDialogue', (name, text) => {
        this.showDialogue(name, text);
      });

      // 背包更新
      this.gameScene.events.on('inventoryUpdated', (items) => {
        // 可以在这里更新背包UI
        console.log('[UI] 背包更新:', items.length, '件物品');
      });
    }

    // 监听 E 键关闭对话
    this.input.keyboard.on('keydown-E', () => {
      if (this.dialogueVisible) {
        this.hideDialogue();
      }
    });
  }

  /**
   * 更新生命值条
   * @param {number} hp - 当前HP
   * @param {number} maxHp - 最大HP
   */
  updateHealthBar(hp, maxHp) {
    const percentage = hp / maxHp;
    const barWidth = 148 * percentage;

    // 更新血条宽度
    this.hpBar.width = barWidth;

    // 根据血量改变颜色
    if (percentage > 0.6) {
      this.hpBar.setFillStyle(0x00ff00); // 绿色
    } else if (percentage > 0.3) {
      this.hpBar.setFillStyle(0xffff00); // 黄色
    } else {
      this.hpBar.setFillStyle(0xff0000); // 红色
    }

    // 更新文字
    this.hpText.setText(`${Math.floor(hp)}/${maxHp}`);

    // 低血量闪烁警告
    if (percentage <= 0.3) {
      this.tweens.add({
        targets: this.heartIcon,
        scaleX: 1.3,
        scaleY: 1.3,
        duration: 200,
        yoyo: true
      });
    }
  }

  /**
   * 更新分数显示
   * @param {number} score - 分数
   */
  updateScore(score) {
    this.scoreText.setText(score.toString());

    // 分数增加动画
    this.tweens.add({
      targets: this.scoreText,
      scaleX: 1.2,
      scaleY: 1.2,
      duration: 100,
      yoyo: true
    });
  }

  /**
   * 更新钥匙数量
   * @param {number} count - 钥匙数量
   */
  updateKeyCount(count) {
    this.keyText.setText(`x${count}`);
  }

  /**
   * 显示对话框
   * @param {string} name - NPC名称
   * @param {string} text - 对话内容
   */
  showDialogue(name, text) {
    this.npcNameText.setText(name);
    this.dialogueText.setText(text);
    this.dialogueContainer.setVisible(true);
    this.dialogueVisible = true;
  }

  /**
   * 隐藏对话框
   */
  hideDialogue() {
    this.dialogueContainer.setVisible(false);
    this.dialogueVisible = false;
  }

  /**
   * update 生命周期
   * 每帧更新 UI 状态
   */
  update() {
    // 可以在这里添加动态 UI 更新逻辑
  }
}
