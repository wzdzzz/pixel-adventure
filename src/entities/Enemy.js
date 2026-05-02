import Phaser from 'phaser';
import { TEXTURES, CHARACTERS } from '../assets/AssetManager.js';
import { Actor } from './Actor.js';
import { EnemySkillSystem } from '../systems/EnemySkillSystem.js';
import { getEnemyConfig } from '../data/enemyConfig.js';

export const EnemyState = {
  PATROL: 'PATROL',
  CHASE: 'CHASE',
  SKILL_TELEGRAPH: 'SKILL_TELEGRAPH',
  SKILL_ACTIVE: 'SKILL_ACTIVE',
  SKILL_RECOVERY: 'SKILL_RECOVERY',
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

    // 头顶血条
    this.createHealthBar();

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
    this.target = null;
    this.direction = 1;
    this.moveTween = null;

    // 技能系统：从 enemyConfig 读取本怪物的技能列表
    const enemyCfg = getEnemyConfig(characterType);
    this.isBoss = !!enemyCfg.isBoss;
    this.skillSystem = new EnemySkillSystem(scene, this, enemyCfg.skills || ['basic_melee']);
    this._activeSkill = null;     // 当前 telegraph/active/recovery 中的技能
    this._skillRecoveryTime = 300;

    // 战斗状态机
    this.inCombat = false;
    this.aggroTimer = 0;
    this.disengageTimer = 0;
    this.aggroDelay = enemyCfg.aggroDelay ?? 500;       // 进入感知范围多久后真正仇恨
    this.disengageTime = enemyCfg.disengageTime ?? 3000; // 离开多久后脱战
    this.disengageRange = enemyCfg.disengageRange ?? (this.config.detectionRange * 2.5);

    // Boss 视觉调整（缩放 + tint）
    if (enemyCfg.displayScale) {
      const cw = this.sprite.displayWidth * enemyCfg.displayScale;
      const ch = this.sprite.displayHeight * enemyCfg.displayScale;
      this.sprite.setDisplaySize(cw, ch);
    }
    if (enemyCfg.tint) {
      this._baseTint = enemyCfg.tint;
      this.sprite.setTint(enemyCfg.tint);
    }

    this.startPatrol();
  }

  // ── Health bar (头顶血条) ──────────────────────────────────────

  createHealthBar() {
    const w = Math.max(20, Math.floor(this.sprite.displayWidth * 0.8));
    const h = 3;
    this.hbWidth = w;
    this.hbHeight = h;
    // 背景（深灰）
    this.hbBg = this.scene.add.rectangle(this.sprite.x, this.sprite.y, w, h, 0x222222, 0.85);
    this.hbBg.setOrigin(0.5, 0.5);
    this.hbBg.setStrokeStyle(1, 0x000000, 0.6);
    this.hbBg.setDepth(900);
    // 前景（HP 颜色）
    this.hbFill = this.scene.add.rectangle(this.sprite.x, this.sprite.y, w, h, 0x00ff00, 1);
    this.hbFill.setOrigin(0, 0.5);
    this.hbFill.setDepth(901);

    this.updateHealthBar();
  }

  updateHealthBar() {
    if (!this.hbBg || !this.hbFill) return;
    const topY = this.sprite.y - this.sprite.displayHeight / 2 - 6;
    this.hbBg.setPosition(this.sprite.x, topY);
    // 前景从背景左边缘起
    const leftX = this.sprite.x - this.hbWidth / 2;
    this.hbFill.setPosition(leftX, topY);

    const pct = Math.max(0, Math.min(1, this.hp / this.maxHp));
    this.hbFill.width = this.hbWidth * pct;

    // 颜色：>60% 绿、>30% 黄、其他红
    if (pct > 0.6) {
      this.hbFill.setFillStyle(0x00dd44);
    } else if (pct > 0.3) {
      this.hbFill.setFillStyle(0xffdd00);
    } else {
      this.hbFill.setFillStyle(0xff3333);
    }
  }

  destroyHealthBar() {
    if (this.hbBg) { this.hbBg.destroy(); this.hbBg = null; }
    if (this.hbFill) { this.hbFill.destroy(); this.hbFill = null; }
  }

  // ── Combat state ──────────────────────────────────────────────

  /** 战斗状态推进：进入仇恨需要在感知范围内停留 aggroDelay；脱战需要离开 disengageRange 持续 disengageTime */
  _updateCombatState(distance, delta) {
    if (!this.inCombat) {
      // 未进战斗：在感知范围内积累仇恨
      if (distance < this.config.detectionRange) {
        this.aggroTimer += delta;
        if (this.aggroTimer >= this.aggroDelay) {
          this._enterCombat();
        }
      } else if (this.aggroTimer > 0) {
        // 离开范围则衰减
        this.aggroTimer = Math.max(0, this.aggroTimer - delta * 2);
      }
    } else {
      // 已进战斗：超出脱战范围积累脱战时间
      if (distance > this.disengageRange) {
        this.disengageTimer += delta;
        if (this.disengageTimer >= this.disengageTime) {
          this._exitCombat();
        }
      } else {
        this.disengageTimer = 0;
      }
    }
  }

  _enterCombat() {
    this.inCombat = true;
    this.aggroTimer = 0;
    this.disengageTimer = 0;
    this.target = this.scene.player;
    if (this.state === EnemyState.PATROL) {
      this.setState(EnemyState.CHASE);
    }
  }

  _exitCombat() {
    this.inCombat = false;
    this.aggroTimer = 0;
    this.disengageTimer = 0;
    this.target = null;
    // 脱战满血
    this.hp = this.maxHp;
    this.onHpChanged();
    // 取消任何进行中的技能
    if (this.skillSystem) this.skillSystem.cancel();
    this._activeSkill = null;
    // 回到巡逻
    if (this.state !== EnemyState.DEAD) {
      this.startPatrol();
    }
  }

  // ── State helpers ──────────────────────────────────────────────

  setState(newState) {
    this.state = newState;
    this.stateTimer = 0;
  }

  startPatrol() {
    this.setState(EnemyState.PATROL);
    this.playAnim('walk');
    this.patrolWaitTimer = 0;
    this.moveToPoint(this.currentPatrolTarget);
  }

  /** 简单地朝目标点设置速度（不再用 delayedCall，由 updatePatrol 距离驱动到达检测） */
  moveToPoint(point) {
    const speed = this.getMoveSpeed();
    this.direction = point.x < this.sprite.x ? -1 : 1;
    this.sprite.setFlipX(this.direction < 0);
    this.scene.physics.moveTo(this.sprite, point.x, point.y, speed);
  }

  // ── Main update ────────────────────────────────────────────────

  update(player, delta) {
    if (!player || this.state === EnemyState.DEAD) return;

    // Actor base tick (i-frames, regen, etc.)
    this.updateActor(delta);

    // 头顶血条跟随
    this.updateHealthBar();

    // 技能冷却推进
    if (this.skillSystem) {
      this.skillSystem.tick(delta);
      this.skillSystem.updateHitboxFollow();
    }

    this.stateTimer += delta;

    const distanceToPlayer = Phaser.Math.Distance.Between(
      this.sprite.x, this.sprite.y, player.x, player.y
    );

    // 战斗状态推进（先于具体 state 行为）
    this._updateCombatState(distanceToPlayer, delta);

    switch (this.state) {
      case EnemyState.PATROL:
        this.updatePatrol(player, distanceToPlayer);
        break;
      case EnemyState.CHASE:
        this.updateChase(player, distanceToPlayer);
        break;
      case EnemyState.SKILL_TELEGRAPH:
        this.updateSkillTelegraph(player);
        break;
      case EnemyState.SKILL_ACTIVE:
        this.updateSkillActive(player);
        break;
      case EnemyState.SKILL_RECOVERY:
        this.updateSkillRecovery(player);
        break;
      case EnemyState.HURT:
        break;
    }
  }

  // ── Patrol AI ──────────────────────────────────────────────────

  updatePatrol(player, distance) {
    // 等待中：定时器到期则切换目标并继续走
    if (this.patrolWaitTimer > 0) {
      this.patrolWaitTimer -= this.scene.game.loop.delta;
      this.sprite.setVelocity(0, 0);
      if (this.patrolWaitTimer <= 0) {
        this.patrolWaitTimer = 0;
        this.currentPatrolTarget = this.currentPatrolTarget === this.patrolPointA
          ? this.patrolPointB : this.patrolPointA;
        this.moveToPoint(this.currentPatrolTarget);
        this.playAnim('walk');
        this._stuckTimer = 0;
      }
      return;
    }

    // 到达目标点 → 等 1.5s 再去对面（仇恨改由 _updateCombatState 处理，不再这里转 CHASE）
    const distToTarget = Phaser.Math.Distance.Between(
      this.sprite.x, this.sprite.y,
      this.currentPatrolTarget.x, this.currentPatrolTarget.y
    );
    if (distToTarget < 8) {
      this.sprite.setVelocity(0, 0);
      this.playAnim('idle');
      this.patrolWaitTimer = 1500;
      this._stuckTimer = 0;
      return;
    }

    // 卡墙检测：被地形挡住时 800ms 后调头
    const body = this.sprite.body;
    const speed = body ? Math.hypot(body.velocity.x || 0, body.velocity.y || 0) : 0;
    if (speed < 5) {
      this._stuckTimer = (this._stuckTimer || 0) + (this.scene.game.loop.delta || 16);
      if (this._stuckTimer > 800) {
        this._stuckTimer = 0;
        this.currentPatrolTarget = this.currentPatrolTarget === this.patrolPointA
          ? this.patrolPointB : this.patrolPointA;
        this.moveToPoint(this.currentPatrolTarget);
        this.playAnim('walk');
      }
    } else {
      this._stuckTimer = 0;
    }
  }

  // ── Chase AI ───────────────────────────────────────────────────

  updateChase(player, distance) {
    // 不再自动脱战：脱战由 _updateCombatState 控制（disengageRange + disengageTime）
    if (!this.inCombat) {
      this.startPatrol();
      return;
    }

    // 选择技能：可用即施放
    const chosen = this.skillSystem.pickSkill(player);
    if (chosen) {
      this._activeSkill = chosen;
      this.sprite.setVelocity(0, 0);
      // 朝玩家方向翻面
      this.direction = player.x < this.sprite.x ? -1 : 1;
      this.sprite.setFlipX(this.direction < 0);
      this.skillSystem.executeTelegraph(chosen);
      this.setState(EnemyState.SKILL_TELEGRAPH);
      return;
    }

    // 没技能可用：保持距离/接近
    const targetMin = 36;
    if (distance < targetMin) {
      // 太近了停下
      this.sprite.setVelocity(0, 0);
      this.playAnim('idle');
    } else {
      const chaseSpeed = this.getMoveSpeed() * 1.2;
      this.scene.physics.moveTo(this.sprite, player.x, player.y, chaseSpeed);
      this.direction = player.x < this.sprite.x ? -1 : 1;
      this.sprite.setFlipX(this.direction < 0);
      this.playAnim('walk');
    }
  }

  // ── Skill state machine ───────────────────────────────────────

  updateSkillTelegraph(player) {
    if (!this._activeSkill) {
      this.setState(EnemyState.CHASE);
      return;
    }
    this.sprite.setVelocity(0, 0);
    if (this.stateTimer >= (this._activeSkill.telegraph || 300)) {
      this.skillSystem.executeActive(this._activeSkill, player);
      this.setState(EnemyState.SKILL_ACTIVE);
    }
  }

  updateSkillActive(player) {
    if (!this._activeSkill) {
      this.setState(EnemyState.CHASE);
      return;
    }
    const activeWindow = this._activeSkill.activeWindow ?? 100;
    if (this.stateTimer >= activeWindow) {
      this.skillSystem.executeRecovery(this._activeSkill);
      this.setState(EnemyState.SKILL_RECOVERY);
    }
  }

  updateSkillRecovery(player) {
    this.sprite.setVelocity(0, 0);
    if (this.stateTimer >= this._skillRecoveryTime) {
      this._activeSkill = null;
      this.setState(EnemyState.CHASE);
    }
  }

  // ── Damage ─────────────────────────────────────────────────────

  takeDamage(damage, attackerX, attackerY, staggerMs = 0) {
    if (this.isInvulnerable || this.state === EnemyState.DEAD) return;

    // 受击后强制进入战斗（远程攻击从感知范围外打也能拉仇恨）
    if (!this.inCombat) {
      this._enterCombat();
    }

    // Boss 抗 stagger
    const effectiveStagger = this.isBoss ? Math.min(staggerMs, 200) : staggerMs;

    // staggerMs > 0：进入 HURT，并取消当前技能（telegraph/active 都中断）
    if (effectiveStagger > 0) {
      if (this._activeSkill) {
        this.skillSystem.cancel();
        this._activeSkill = null;
      }
      this.setState(EnemyState.HURT);
      this.sprite.setVelocity(0, 0);
      this.playAnim('hurt', false);
    } else {
      // 不打断：仅播一帧 hurt 动画
      this.playAnim('hurt', false);
    }

    super.takeDamage(damage, attackerX, attackerY);

    this.scene.events.emit('screenShake', 2, 60);

    if (effectiveStagger > 0) {
      this.scene.time.delayedCall(effectiveStagger, () => {
        if (this.hp > 0 && this.state === EnemyState.HURT) {
          this.setState(EnemyState.CHASE);
        }
      });
    }
  }

  // ── Death ──────────────────────────────────────────────────────

  die() {
    this.setState(EnemyState.DEAD);
    this.sprite.body.enable = false;
    this.playAnim('die', false);
    this.destroyHealthBar();
    // 清理任何进行中的技能视觉/hitbox（如 telegraph 圆环、AOE 圈）
    if (this.skillSystem) this.skillSystem.cancel();
    this._activeSkill = null;

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
    this.scene.events.emit('enemyDropLoot', this.config.id, this.sprite.x, this.sprite.y);
  }

  // ── Cleanup ────────────────────────────────────────────────────

  destroy() {
    if (this.moveTween) {
      this.moveTween.remove();
      this.moveTween = null;
    }
    if (this.skillSystem) {
      this.skillSystem.cancel();
    }
    this.destroyHealthBar();
    this.destroyActor();
  }
}
