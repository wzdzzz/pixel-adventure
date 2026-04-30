import Phaser from 'phaser';
import { TEXTURES } from '../assets/AssetManager.js';

export const EnemyState = {
  PATROL: 'PATROL',
  CHASE: 'CHASE',
  ATTACK_STARTUP: 'ATTACK_STARTUP',
  ATTACK_ACTIVE: 'ATTACK_ACTIVE',
  HURT: 'HURT',
  DEAD: 'DEAD'
};

export class Enemy {
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

    this.sprite = scene.physics.add.sprite(x, y, TEXTURES.ENEMY);
    this.sprite.setOrigin(0.5, 0.5);
    this.sprite.setCollideWorldBounds(true);
    this.sprite.setBounce(0.1);
    this.sprite.body.setSize(20, 24);
    this.sprite.body.setOffset(4, 4);
    this.sprite.enemyInstance = this;

    this.hp = this.config.hp;
    this.maxHp = this.config.hp;
    this.state = EnemyState.PATROL;
    this.stateTimer = 0;

    this.spawnX = x;
    this.spawnY = y;
    this.patrolPointA = { x: x - this.config.patrolRange / 2, y: y };
    this.patrolPointB = { x: x + this.config.patrolRange / 2, y: y };
    this.currentPatrolTarget = this.patrolPointB;
    this.patrolWaitTimer = 0;

    this.attackCooldown = 0;
    this.target = null;
    this.direction = 1;
    this.moveTween = null;

    this.startPatrol();
  }

  setState(newState) {
    this.state = newState;
    this.stateTimer = 0;
  }

  startPatrol() {
    this.setState(EnemyState.PATROL);
    this.moveToPoint(this.currentPatrolTarget);
  }

  moveToPoint(point) {
    const distance = Phaser.Math.Distance.Between(
      this.sprite.x, this.sprite.y, point.x, point.y
    );
    const duration = (distance / this.config.speed) * 1000;

    if (this.moveTween) {
      this.moveTween.remove();
      this.moveTween = null;
    }

    this.direction = point.x < this.sprite.x ? -1 : 1;
    this.sprite.setFlipX(this.direction < 0);

    this.scene.physics.moveTo(this.sprite, point.x, point.y, this.config.speed);

    this.moveTween = this.scene.time.delayedCall(duration, () => {
      this.moveTween = null;
      if (this.state === EnemyState.PATROL) {
        this.currentPatrolTarget = this.currentPatrolTarget === this.patrolPointA
          ? this.patrolPointB : this.patrolPointA;
        this.patrolWaitTimer = 500;
      }
    });
  }

  update(player, delta) {
    if (!player || this.state === EnemyState.DEAD) return;

    this.stateTimer += delta;
    if (this.attackCooldown > 0) this.attackCooldown -= delta;

    const distanceToPlayer = Phaser.Math.Distance.Between(
      this.sprite.x, this.sprite.y, player.x, player.y
    );

    switch (this.state) {
      case EnemyState.PATROL:
        this.updatePatrol(player, distanceToPlayer);
        break;
      case EnemyState.CHASE:
        this.updateChase(player, distanceToPlayer);
        break;
      case EnemyState.ATTACK_STARTUP:
        this.updateAttackStartup(player);
        break;
      case EnemyState.ATTACK_ACTIVE:
        this.updateAttackActive(player, distanceToPlayer);
        break;
      case EnemyState.HURT:
        break;
    }
  }

  updatePatrol(player, distance) {
    if (this.patrolWaitTimer > 0) {
      this.patrolWaitTimer -= this.scene.game.loop.delta;
      this.sprite.setVelocity(0, 0);
      return;
    }

    if (distance < this.config.detectionRange) {
      this.target = player;
      this.setState(EnemyState.CHASE);
      return;
    }

    const distToTarget = Phaser.Math.Distance.Between(
      this.sprite.x, this.sprite.y,
      this.currentPatrolTarget.x, this.currentPatrolTarget.y
    );
    if (distToTarget < 5) {
      this.sprite.setVelocity(0, 0);
    }
  }

  updateChase(player, distance) {
    if (distance > this.config.detectionRange * 2) {
      this.target = null;
      this.startPatrol();
      return;
    }

    if (distance < 36 && this.attackCooldown <= 0) {
      this.sprite.setVelocity(0, 0);
      this.setState(EnemyState.ATTACK_STARTUP);
      return;
    }

    this.scene.physics.moveTo(this.sprite, player.x, player.y, this.config.speed * 1.2);
    this.direction = player.x < this.sprite.x ? -1 : 1;
    this.sprite.setFlipX(this.direction < 0);
  }

  updateAttackStartup(player) {
    this.sprite.setVelocity(0, 0);
    this.direction = player.x < this.sprite.x ? -1 : 1;
    this.sprite.setFlipX(this.direction < 0);
    this.sprite.setTint(0xff8800);

    if (this.stateTimer >= 300) {
      this.sprite.clearTint();
      this.setState(EnemyState.ATTACK_ACTIVE);
    }
  }

  updateAttackActive(player, distance) {
    if (this.stateTimer >= 100) {
      this.scene.events.emit('enemyAttack', this, this.config.damage);
      this.attackCooldown = 1500;
      this.setState(EnemyState.CHASE);
    }
  }

  takeDamage(damage, attackerX, attackerY) {
    if (this.state === EnemyState.HURT || this.state === EnemyState.DEAD) return;

    this.hp -= damage;
    this.setState(EnemyState.HURT);
    this.sprite.setVelocity(0, 0);
    this.sprite.setTint(0xff0000);

    this.scene.events.emit('hitStop', 50);
    this.scene.events.emit('screenShake', 3, 80);

    const knockbackAngle = Phaser.Math.Angle.Between(
      attackerX || this.scene.player.sprite.x,
      attackerY || this.scene.player.sprite.y,
      this.sprite.x,
      this.sprite.y
    );
    const knockbackForce = 200;
    this.sprite.setVelocity(
      Math.cos(knockbackAngle) * knockbackForce,
      Math.sin(knockbackAngle) * knockbackForce
    );

    this.scene.tweens.add({
      targets: this.sprite,
      alpha: 0.5,
      duration: 80,
      yoyo: true,
      repeat: 2,
      onComplete: () => {
        this.sprite.setAlpha(1);
        this.sprite.clearTint();
        if (this.hp <= 0) {
          this.die();
        } else {
          this.setState(EnemyState.CHASE);
        }
      }
    });
  }

  die() {
    this.setState(EnemyState.DEAD);
    this.sprite.body.enable = false;

    this.scene.tweens.add({
      targets: this.sprite,
      alpha: 0,
      scaleX: 1.5,
      scaleY: 1.5,
      duration: 400,
      onComplete: () => {
        this.dropLoot();
        this.scene.events.emit('enemyDeath', this);
        this.destroy();
      }
    });
  }

  dropLoot() {
    const dropChance = Math.random();
    if (dropChance < 0.5) {
      this.scene.events.emit('spawnItem', 'coin', this.sprite.x, this.sprite.y);
    } else if (dropChance < 0.7) {
      this.scene.events.emit('spawnItem', 'potion', this.sprite.x, this.sprite.y);
    }
  }

  destroy() {
    if (this.moveTween) {
      this.moveTween.remove();
      this.moveTween = null;
    }
    if (this.sprite) this.sprite.destroy();
  }
}
