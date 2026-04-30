import Phaser from 'phaser';
import { AssetManager } from '../assets/AssetManager.js';

/**
 * 道具实体类
 *
 * 支持自动旋转/漂浮动画
 * 玩家重叠时触发拾取逻辑
 */
export class Item {
  /**
   * @param {Phaser.Scene} scene - 场景实例
   * @param {number} x - X坐标
   * @param {number} y - Y坐标
   * @param {string} type - 道具类型 (coin, key, artifact, potion, heart)
   * @param {object} config - 道具配置数据
   */
  constructor(scene, x, y, type, config = {}) {
    this.scene = scene;
    this.type = type;
    this.config = config;

    // 获取纹理键名
    const textureKey = AssetManager.getTextureKey(type);

    // 创建精灵
    this.sprite = scene.physics.add.sprite(x, y, textureKey);
    this.sprite.setOrigin(0.5, 0.5);
    this.sprite.body.setAllowGravity(false);
    this.sprite.body.setImmovable(true);

    // 存储引用
    this.sprite.itemInstance = this;

    // 设置碰撞体
    this.sprite.body.setSize(16, 16);

    // 启动漂浮动画
    this.startFloatAnimation();

    // 启动旋转动画
    this.startRotateAnimation();

    // 拾取标记
    this.isCollected = false;
  }

  /**
   * 启动漂浮动画
   * 道具在原位置上下浮动
   */
  startFloatAnimation() {
    this.scene.tweens.add({
      targets: this.sprite,
      y: this.sprite.y - 8,
      duration: 1000,
      yoyo: true,
      repeat: -1,
      ease: 'Sine.easeInOut'
    });
  }

  /**
   * 启动旋转动画
   * 道具缓慢旋转
   */
  startRotateAnimation() {
    // 只对特定类型道具旋转
    if (this.type === 'coin' || this.type === 'artifact') {
      this.scene.tweens.add({
        targets: this.sprite,
        angle: 360,
        duration: 3000,
        repeat: -1,
        ease: 'Linear'
      });
    }
  }

  /**
   * 拾取道具
   * @returns {object} 拾取结果
   */
  collect() {
    if (this.isCollected) return null;

    this.isCollected = true;

    // 拾取动画 - 向上飞出并消失
    this.scene.tweens.add({
      targets: this.sprite,
      y: this.sprite.y - 30,
      alpha: 0,
      scaleX: 0,
      scaleY: 0,
      duration: 300,
      onComplete: () => {
        this.destroy();
      }
    });

    // 返回道具效果
    return {
      type: this.type,
      ...this.config
    };
  }

  /**
   * 获取道具信息
   */
  getInfo() {
    return {
      type: this.type,
      config: this.config,
      position: { x: this.sprite.x, y: this.sprite.y }
    };
  }

  /**
   * 销毁道具
   */
  destroy() {
    if (this.sprite) {
      this.sprite.destroy();
    }
  }
}
