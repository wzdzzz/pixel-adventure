import Phaser from 'phaser';
import { TEXTURES } from '../assets/AssetManager.js';

/**
 * 敌人实体类
 *
 * 实现巡逻、仇恨追踪和受击反馈
 * 使用简单的状态机管理AI行为
 */

// 敌人状态枚举
const ENEMY_STATE = {
  PATROL: 'patrol',
  CHASE: 'chase',
  ATTACK: 'attack',
  HURT: 'hurt'
};

export class Enemy {
  /**
   * @param {Phaser.Scene} scene - 场景实例
   * @param {number} x - 初始X坐标
   * @param {number} y - 初始Y坐标
   * @param {object} config - 敌人配置
   */
  constructor(scene, x, y, config = {}) {
    this.scene = scene;
    this.config = {
      hp: config.hp || 30,
      damage: config.damage || 10,
      speed: config.speed || 60,
      patrolRange: config.patrolRange || 120,
      detectionRange: config.detectionRange || 150,
      ...config
    };

    // 创建精灵
    this.sprite = scene.physics.add.sprite(x, y, TEXTURES.ENEMY);
    this.sprite.setOrigin(0.5, 0.5);
    this.sprite.setCollideWorldBounds(true);
    this.sprite.setBounce(0.1);

    // 设置碰撞体
    this.sprite.body.setSize(20, 24);
    this.sprite.body.setOffset(4, 4);

    // 存储引用
    this.sprite.enemyInstance = this;

    // 状态
    this.hp = this.config.hp;
    this.state = ENEMY_STATE.PATROL;
    this.isHurt = false;

    // 巡逻参数
    this.spawnX = x;
    this.spawnY = y;
    this.patrolPointA = { x: x - this.config.patrolRange / 2, y: y };
    this.patrolPointB = { x: x + this.config.patrolRange / 2, y: y };
    this.currentPatrolTarget = this.patrolPointB;

    // 伤害冷却
    this.damageCooldown = false;

    // 启动巡逻
    this.startPatrol();
  }

  /**
   * 启动巡逻行为
   * 敌人在 A、B 两点之间往返
   */
  startPatrol() {
    this.state = ENEMY_STATE.PATROL;
    this.moveToPoint(this.currentPatrolTarget);
  }

  /**
   * 移动到指定点
   * @param {object} point - 目标点 {x, y}
   */
  moveToPoint(point) {
    const distance = Phaser.Math.Distance.Between(
      this.sprite.x, this.sprite.y,
      point.x, point.y
    );

    // 计算移动时间
    const duration = (distance / this.config.speed) * 1000;

    // 停止当前移动
    if (this.moveTween) {
      this.moveTween.stop();
    }

    // 设置朝向
    if (point.x < this.sprite.x) {
      this.sprite.setFlipX(true);
    } else {
      this.sprite.setFlipX(false);
    }

    // 使用物理移动
    this.scene.physics.moveTo(this.sprite, point.x, point.y, this.config.speed);

    // 到达目标点后的处理
    this.scene.time.delayedCall(duration, () => {
      if (this.state === ENEMY_STATE.PATROL) {
        // 切换巡逻目标
        this.currentPatrolTarget = this.currentPatrolTarget === this.patrolPointA
          ? this.patrolPointB
          : this.patrolPointA;

        // 短暂停留后继续巡逻
        this.scene.time.delayedCall(500, () => {
          if (this.state === ENEMY_STATE.PATROL) {
            this.moveToPoint(this.currentPatrolTarget);
          }
        });
      }
    });
  }

  /**
   * 每帧更新敌人状态
   * @param {Phaser.GameObjects.Sprite} player - 玩家精灵
   */
  update(player) {
    if (!player || this.isHurt) return;

    const distanceToPlayer = Phaser.Math.Distance.Between(
      this.sprite.x, this.sprite.y,
      player.x, player.y
    );

    // 状态转换逻辑
    switch (this.state) {
      case ENEMY_STATE.PATROL:
        if (distanceToPlayer < this.config.detectionRange) {
          this.state = ENEMY_STATE.CHASE;
        }
        break;

      case ENEMY_STATE.CHASE:
        if (distanceToPlayer > this.config.detectionRange * 1.5) {
          // 脱离仇恨，返回巡逻
          this.state = ENEMY_STATE.PATROL;
          this.startPatrol();
        } else if (distanceToPlayer < 40) {
          // 进入攻击范围
          this.state = ENEMY_STATE.ATTACK;
        } else {
          // 追踪玩家
          this.chasePlayer(player);
        }
        break;

      case ENEMY_STATE.ATTACK:
        if (distanceToPlayer > 60) {
          this.state = ENEMY_STATE.CHASE;
        } else {
          this.attackPlayer(player);
        }
        break;
    }
  }

  /**
   * 追踪玩家
   * @param {Phaser.GameObjects.Sprite} player - 玩家精灵
   */
  chasePlayer(player) {
    this.scene.physics.moveTo(this.sprite, player.x, player.y, this.config.speed * 1.2);

    // 设置朝向
    if (player.x < this.sprite.x) {
      this.sprite.setFlipX(true);
    } else {
      this.sprite.setFlipX(false);
    }
  }

  /**
   * 攻击玩家
   * @param {Phaser.GameObjects.Sprite} player - 玩家精灵
   */
  attackPlayer(player) {
    if (this.damageCooldown) return;

    this.damageCooldown = true;
    this.sprite.setVelocity(0, 0);

    // 通知场景处理伤害
    this.scene.events.emit('enemyAttack', this, this.config.damage);

    // 攻击冷却
    this.scene.time.delayedCall(1000, () => {
      this.damageCooldown = false;
    });
  }

  /**
   * 受到伤害
   * @param {number} damage - 伤害值
   */
  takeDamage(damage) {
    if (this.isHurt) return;

    this.hp -= damage;
    this.isHurt = true;
    this.state = ENEMY_STATE.HURT;

    // 停止移动
    this.sprite.setVelocity(0, 0);

    // 闪红效果
    this.sprite.setTint(0xff0000);

    // 击退效果
    const knockbackAngle = Phaser.Math.Angle.Between(
      this.scene.player.sprite.x,
      this.scene.player.sprite.y,
      this.sprite.x,
      this.sprite.y
    );
    const knockbackForce = 200;
    this.sprite.setVelocity(
      Math.cos(knockbackAngle) * knockbackForce,
      Math.sin(knockbackAngle) * knockbackForce
    );

    // 受伤动画
    this.scene.tweens.add({
      targets: this.sprite,
      alpha: 0.5,
      duration: 100,
      yoyo: true,
      repeat: 2,
      onComplete: () => {
        this.sprite.setAlpha(1);
        this.sprite.clearTint();
        this.isHurt = false;

        // 检查是否死亡
        if (this.hp <= 0) {
          this.die();
        } else {
          // 恢复追逐
          this.state = ENEMY_STATE.CHASE;
        }
      }
    });
  }

  /**
   * 敌人死亡
   */
  die() {
    // 死亡动画
    this.scene.tweens.add({
      targets: this.sprite,
      alpha: 0,
      scaleX: 1.5,
      scaleY: 1.5,
      duration: 500,
      onComplete: () => {
        // 掉落物品
        this.dropLoot();
        // 销毁敌人
        this.scene.events.emit('enemyDeath', this);
        this.destroy();
      }
    });
  }

  /**
   * 掉落物品
   */
  dropLoot() {
    // 随机掉落金币或药水
    const dropChance = Math.random();
    if (dropChance < 0.5) {
      // 50% 掉落金币
      this.scene.events.emit('spawnItem', 'coin', this.sprite.x, this.sprite.y);
    } else if (dropChance < 0.7) {
      // 20% 掉落药水
      this.scene.events.emit('spawnItem', 'potion', this.sprite.x, this.sprite.y);
    }
  }

  /**
   * 销毁敌人
   */
  destroy() {
    if (this.sprite) {
      this.sprite.destroy();
    }
    if (this.moveTween) {
      this.moveTween.stop();
    }
  }
}
