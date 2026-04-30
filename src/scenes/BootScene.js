import Phaser from 'phaser';
import { AssetManager } from '../assets/AssetManager.js';

/**
 * Boot/Preload 场景
 *
 * 生命周期钩子说明：
 * - preload(): 在场景创建时调用，用于加载外部资源（图片、音频、JSON等）
 *   由于我们使用代码生成纹理，这里主要调用 AssetManager
 *
 * - create(): 在 preload 完成后调用，用于创建游戏对象
 *   这里我们显示加载完成信息并跳转到主菜单或游戏场景
 */
export class BootScene extends Phaser.Scene {
  constructor() {
    super({ key: 'BootScene' });
  }

  /**
   * preload 生命周期
   * 在场景启动时最先执行，负责加载所有外部资源
   * 这里我们使用 AssetManager 生成像素占位纹理
   */
  preload() {
    // 创建加载进度条
    const width = this.cameras.main.width;
    const height = this.cameras.main.height;

    // 进度条背景
    const progressBg = this.add.rectangle(width / 2, height / 2, 300, 20, 0x333333);
    progressBg.setStrokeStyle(2, 0x666666);

    // 进度条填充
    const progressBar = this.add.rectangle(width / 2 - 148, height / 2, 0, 16, 0x00ff00);
    progressBar.setOrigin(0, 0.5);

    // 加载文字
    const loadingText = this.add.text(width / 2, height / 2 - 40, '加载中...', {
      fontSize: '20px',
      fill: '#00ff00',
      fontFamily: 'Courier New'
    }).setOrigin(0.5);

    // 模拟加载进度
    this.load.on('progress', (value) => {
      progressBar.width = 296 * value;
    });

    // 在这里可以加载外部资源
    // 例如: this.load.image('key', 'path/to/image.png');
    // 例如: this.load.tilemapTiledJSON('map', 'path/to/map.json');
  }

  /**
   * create 生命周期
   * 在 preload 完成后调用，所有资源已加载完毕
   * 这里我们生成所有像素纹理并准备跳转
   */
  create() {
    console.log('[BootScene] 开始生成像素纹理...');

    // 使用 AssetManager 生成所有游戏所需的像素纹理
    AssetManager.generateAllTextures(this);

    // 设置全局游戏状态
    this.registry.set('gameState', {
      hp: 100,
      maxHp: 100,
      score: 0,
      inventory: [],
      keysCollected: 0,
      hasArtifact: false,
      playerPosition: { x: 100, y: 100 },
      collectedItems: []
    });

    // 初始化全局事件系统
    this.registry.set('events', this.events);

    console.log('[BootScene] 纹理生成完成，准备进入游戏...');

    // 短暂延迟后进入主游戏场景
    this.time.delayedCall(500, () => {
      // 启动主游戏场景和UI场景（并行运行）
      this.scene.start('MainGameScene');
      this.scene.start('UIScene');
      this.scene.bringToTop('UIScene');
    });
  }
}
