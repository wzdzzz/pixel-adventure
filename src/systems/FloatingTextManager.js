import Phaser from 'phaser';

/**
 * 飘字管理器 — 在世界坐标飘出伤害/治疗数字
 * 使用对象池复用 Text 对象，避免频繁创建销毁
 */
export class FloatingTextManager {
  constructor(scene) {
    this.scene = scene;
    this.pool = [];
    this.poolMax = 16;
  }

  /**
   * 在世界坐标 (x, y) 飘出文本
   * @param {number} x - 世界 x 坐标
   * @param {number} y - 世界 y 坐标（一般传精灵头顶）
   * @param {string|number} text - 显示内容
   * @param {object} options - { color, fontSize, bold, prefix }
   */
  spawn(x, y, text, options = {}) {
    const {
      color = '#ffffff',
      fontSize = 12,
      bold = false,
      prefix = ''
    } = options;

    const display = `${prefix}${text}`;

    let textObj = this.pool.find(t => !t.active);
    if (!textObj) {
      if (this.pool.length >= this.poolMax) {
        // 池满：复用最早的一个（直接停掉它的动画）
        textObj = this.pool[0];
        this.scene.tweens.killTweensOf(textObj);
      } else {
        textObj = this.scene.add.text(0, 0, '', {});
        textObj.setOrigin(0.5, 1);
        textObj.setDepth(1000);
        this.pool.push(textObj);
      }
    }

    // 水平随机抖动避免重叠
    const jitter = Phaser.Math.Between(-8, 8);

    textObj.setText(display);
    textObj.setStyle({
      fontSize: `${fontSize}px`,
      color,
      fontFamily: 'Courier New',
      fontStyle: bold ? 'bold' : 'normal',
      stroke: '#000000',
      strokeThickness: 3
    });
    textObj.setPosition(x + jitter, y);
    textObj.setAlpha(1);
    textObj.setScale(1);
    textObj.setActive(true);
    textObj.setVisible(true);

    // 弹出 → 漂浮 → 淡出
    this.scene.tweens.add({
      targets: textObj,
      y: y - 30,
      alpha: 0,
      duration: 700,
      ease: 'Quad.easeOut',
      onComplete: () => {
        textObj.setActive(false);
        textObj.setVisible(false);
      }
    });

    // 起始小弹跳
    this.scene.tweens.add({
      targets: textObj,
      scaleX: 1.3,
      scaleY: 1.3,
      duration: 100,
      yoyo: true,
      ease: 'Quad.easeOut'
    });
  }

  /** 场景关闭时清理 */
  destroy() {
    this.pool.forEach(t => {
      this.scene.tweens.killTweensOf(t);
      t.destroy();
    });
    this.pool = [];
  }
}
