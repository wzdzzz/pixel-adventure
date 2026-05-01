import Phaser from 'phaser';
import { TEXTURES, CHARACTERS } from '../assets/AssetManager.js';
import { Actor } from './Actor.js';

export const EnemyState = {
  PATROL: 'PATROL',
  CHASE: 'CHASE',
  ATTACK_STARTUP: 'ATTACK_STARTUP',
  ATTACK_ACTIVE: 'ATTACK_ACTIVE',
  HURT: 'HURT',
  DEAD: 'DEAD'
};

export class Enemy extends Actor {
  constructor(scene, x, y, config = {}) {
    // Merge defaults into config
    const mergedConfig = {
      hp: config.hp || 30,
      damage: config.damage || 10,
      speed: config.speed || 60,
      patrolRange: config.patrolRange || 120,
      detectionRange: config.detectionRange || 150,
      ...config
    };

    // Use explicit stats from config, or derive from legacy hp/damage/speed values
    const statsConfig = mergedConfig.stats || {
      con: Math.ceil(mergedConfig.hp / 10),
      str: Math.ceil(mergedConfig.damage / 2),
      int: 1,
      agi: Math.ceil(mergedConfig.speed / 10),
      per: 1,
      lck: 1
    };

    // Determine character type and texture from config
    const characterType = mergedConfig.id || null;
    const charConfig = characterType ? CHARACTERS[characterType] : null;
    const textureKey = charConfig
      ? `${charConfig.prefix}_${String(charConfig.frames[0]).padStart(2, '0')}`
      : TEXTURES.ENEMY;

    super(scene, x, y, textureKey, statsConfig, characterType);

    // Enemy-specific config (detection range, patrol range, raw damage, etc.)
    this.config = mergedConfig;

    // Random slime color variant
    if (characterType === 'slime') {
      const slimeColors = [0x88ff88, 0x8888ff, 0xff8888];
      this.sprite.setTint(slimeColors[Math.floor(Math.random() * 3)]);
    }

    // Bounce — added after super(), body is already set up by Actor
    this.sprite.setBounce(0.1);

    // Enemy i-frames match stagger duration
    this.iFramesDuration = 600;

    // Back-reference so collision callbacks can find this Enemy instance
    this.sprite.enemyInstance = this;

    // State machine
    this.state = EnemyState.PATROL;
    this.stateTimer = 0;

    // Patrol data
    this.spawnX = x;
    this.spawnY = y;
    this.patrolPointA = { x: x - this.config.patrolRange / 2, y: y };
    this.patrolPointB = { x: x + this.config.patrolRange / 2, y: y };
    this.currentPatrolTarget = this.patrolPointB;
    this.patrolWaitTimer = 0;

    // Combat
    this.attackCooldown = 0;
    this.target = null;
    this.direction = 1;
    this.moveTween = null;

    this.startPatrol();
  }

  // ── State helpers ──────────────────────────────────────────────

  setState(newState) {
    this.state = newState;
    this.stateTimer = 0;
  }

  startPatrol() {
    this.setState(EnemyState.PATROL);
    this.playAnim('walk');
    this.moveToPoint(this.currentPatrolTarget);
  }

  moveToPoint(point) {
    const distance = Phaser.Math.Distance.Between(
      this.sprite.x, this.sprite.y, point.x, point.y
    );
    const speed = this.getMoveSpeed();
    const duration = (distance / speed) * 1000;

    if (this.moveTween) {
      this.moveTween.remove();
      this.moveTween = null;
    }

    this.direction = point.x < this.sprite.x ? -1 : 1;
    this.sprite.setFlipX(this.direction < 0);

    this.scene.physics.moveTo(this.sprite, point.x, point.y, speed);

    this.moveTween = this.scene.time.delayedCall(duration, () => {
      this.moveTween = null;
      if (this.state === EnemyState.PATROL) {
        this.currentPatrolTarget = this.currentPatrolTarget === this.patrolPointA
          ? this.patrolPointB : this.patrolPointA;
        this.patrolWaitTimer = 500;
      }
    });
  }

  // ── Main update ────────────────────────────────────────────────

  update(player, delta) {
    if (!player || this.state === EnemyState.DEAD) return;

    // Actor base tick (i-frames, regen, etc.)
    this.updateActor(delta);

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

  // ── Patrol AI ──────────────────────────────────────────────────

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
      this.playAnim('idle');
    }
  }

  // ── Chase AI ───────────────────────────────────────────────────

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

    const chaseSpeed = this.getMoveSpeed() * 1.2;
    this.scene.physics.moveTo(this.sprite, player.x, player.y, chaseSpeed);
    this.direction = player.x < this.sprite.x ? -1 : 1;
    this.sprite.setFlipX(this.direction < 0);
    this.playAnim('walk');
  }

  // ── Attack AI ──────────────────────────────────────────────────

  updateAttackStartup(player) {
    this.sprite.setVelocity(0, 0);
    this.direction = player.x < this.sprite.x ? -1 : 1;
    this.sprite.setFlipX(this.direction < 0);
    this.sprite.setTint(0xff8800);
    this.playAnim('attack');

    if (this.stateTimer >= 300) {
      this.sprite.clearTint();
      this.setState(EnemyState.ATTACK_ACTIVE);
    }
  }

  updateAttackActive(player, distance) {
    if (this.stateTimer >= 100) {
      this.scene.events.emit('enemyAttack', this, this.getAttack());
      this.attackCooldown = 1500;
      this.setState(EnemyState.CHASE);
    }
  }

  // ── Damage ─────────────────────────────────────────────────────

  takeDamage(damage, attackerX, attackerY) {
    if (this.isInvulnerable || this.state === EnemyState.DEAD) return;

    // Enter HURT stagger — stop movement and attacking
    this.setState(EnemyState.HURT);
    this.sprite.setVelocity(0, 0);
    this.playAnim('hurt', false);

    // Reset attack cooldown so enemy can't attack right after stagger
    this.attackCooldown = 800;

    // Delegate damage, knockback, i-frames & flash to Actor
    super.takeDamage(damage, attackerX, attackerY);

    this.scene.events.emit('screenShake', 2, 60);

    // Stagger duration: 600ms before enemy can act again
    this.scene.time.delayedCall(600, () => {
      if (this.hp > 0 && this.state === EnemyState.HURT) {
        this.setState(EnemyState.CHASE);
      }
    });
  }

  // ── Death ──────────────────────────────────────────────────────

  die() {
    this.setState(EnemyState.DEAD);
    this.sprite.body.enable = false;
    this.playAnim('die', false);

    this.scene.tweens.add({
      targets: this.sprite,
      alpha: 0,
      scaleX: 1.5,
      scaleY: 1.5,
      duration: 400,
      onComplete: () => {
        this.dropLoot();
        this.scene.events.emit('enemyDeath', this);
        this.destroyActor();
      }
    });
  }

  // ── Loot ───────────────────────────────────────────────────────

  dropLoot() {
    const dropChance = Math.random();
    if (dropChance < 0.5) {
      this.scene.events.emit('spawnItem', 'coin', this.sprite.x, this.sprite.y);
    } else if (dropChance < 0.7) {
      this.scene.events.emit('spawnItem', 'potion', this.sprite.x, this.sprite.y);
    }
  }

  // ── Cleanup ────────────────────────────────────────────────────

  destroy() {
    if (this.moveTween) {
      this.moveTween.remove();
      this.moveTween = null;
    }
    this.destroyActor();
  }
}
