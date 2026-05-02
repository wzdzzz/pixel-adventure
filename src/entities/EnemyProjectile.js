import Phaser from 'phaser';

/**
 * 敌人弹道实体
 *
 * - 朝目标方向匀速移动
 * - 命中玩家时造成伤害然后销毁
 * - 超过 lifetime 自动销毁
 *
 * 由 EnemySkillSystem 创建，MainGameScene 持有引用便于碰撞注册。
 */
export class EnemyProjectile {
  /**
   * @param {Phaser.Scene} scene
   * @param {number} x        起点 x
   * @param {number} y        起点 y
   * @param {number} dirX     单位向量 x
   * @param {number} dirY     单位向量 y
   * @param {object} config   { speed, size, color, lifetime, damage, owner }
   */
  constructor(scene, x, y, dirX, dirY, config = {}) {
    this.scene = scene;
    this.damage = config.damage || 0;
    this.owner = config.owner || null;
    this.lifetime = config.lifetime || 2000;
    this.alive = true;

    const size = config.size || 8;
    const color = config.color ?? 0xffaa44;

    // 主体（菱形外观：用 rect rotated）
    this.sprite = scene.physics.add.sprite(x, y, '__missing');
    this.sprite.setVisible(false);

    this.body = this.sprite.body;
    this.body.setCircle(size / 2);
    this.body.setOffset(0, 0);
    this.body.setAllowGravity(false);

    // 视觉：圆形 + 描边
    this.visual = scene.add.circle(x, y, size / 2, color, 1)
      .setStrokeStyle(1, 0xffffff, 0.7).setDepth(50);

    // 拖尾
    this.trail = scene.add.circle(x, y, size * 0.7, color, 0.35).setDepth(49);
    scene.tweens.add({
      targets: this.trail,
      scaleX: 0.3, scaleY: 0.3, alpha: 0,
      duration: 300, repeat: -1
    });

    // 反向引用（碰撞回调用）
    this.sprite.projectileInstance = this;

    // 速度
    const speed = config.speed || 200;
    this.body.setVelocity(dirX * speed, dirY * speed);

    // 自动销毁
    this._destroyTimer = scene.time.delayedCall(this.lifetime, () => this.destroy());
  }

  update() {
    if (!this.alive) return;
    // 视觉跟随物理体
    this.visual.setPosition(this.sprite.x, this.sprite.y);
    this.trail.setPosition(this.sprite.x, this.sprite.y);
  }

  /** 命中目标 */
  onHit(target) {
    if (!this.alive) return;
    if (target && typeof target.takeDamage === 'function' && this.damage > 0) {
      target.takeDamage(this.damage, this.sprite.x, this.sprite.y);
    }
    // 命中爆点
    this.scene.tweens.add({
      targets: this.visual,
      scaleX: 2, scaleY: 2, alpha: 0,
      duration: 150, onComplete: () => this.visual.destroy()
    });
    this.alive = false;
    this.body.enable = false;
    if (this._destroyTimer) { this._destroyTimer.remove(); this._destroyTimer = null; }
    this.sprite.destroy();
    if (this.trail) { this.trail.destroy(); this.trail = null; }
  }

  destroy() {
    if (!this.alive) return;
    this.alive = false;
    if (this._destroyTimer) { this._destroyTimer.remove(); this._destroyTimer = null; }
    if (this.sprite) this.sprite.destroy();
    if (this.visual) this.visual.destroy();
    if (this.trail) this.trail.destroy();
  }
}
