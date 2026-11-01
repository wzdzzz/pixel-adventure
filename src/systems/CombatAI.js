import Phaser from 'phaser';

/**
 * CombatAI — 通用战斗状态机（从 Enemy.js 抽离）
 *
 * 状态机：PATROL ↔ CHASE → SKILL_TELEGRAPH → SKILL_ACTIVE → SKILL_RECOVERY
 *
 * Host 接口要求：
 *   - sprite                  Phaser sprite（带 body）
 *   - skillSystem             EnemySkillSystem 实例
 *   - playAnim(name, ignore)  播放动画
 *   - getMoveSpeed()          移动速度
 *   - hp / maxHp / isInvulnerable
 *
 * config:
 *   - patrolRange       (默认 120) 巡逻范围（左右各一半）
 *   - detectionRange    (默认 200) 感知范围
 *   - aggroDelay        (默认 300) 进感知后多久转敌对（ms）
 *   - disengageTime     (默认 3000) 脱战时间
 *   - disengageRange    (默认 detection×2.5) 脱战距离
 *   - skillRecoveryTime (默认 300) 技能 recovery 时长
 *   - getTarget()       返回当前可锁敌方（{x,y} 或带 sprite 的对象）
 *   - canEngage(target) 是否对该目标主动敌对（factionSystem.isHostile 包装）
 */
export const CombatState = {
  PATROL: 'PATROL',
  CHASE: 'CHASE',
  SKILL_TELEGRAPH: 'SKILL_TELEGRAPH',
  SKILL_ACTIVE: 'SKILL_ACTIVE',
  SKILL_RECOVERY: 'SKILL_RECOVERY',
  HURT: 'HURT',
  DEAD: 'DEAD'
};

export class CombatAI {
  constructor(scene, host, config = {}) {
    this.scene = scene;
    this.host = host;

    this.state = CombatState.PATROL;
    this.stateTimer = 0;

    this.patrolRange = config.patrolRange ?? 120;
    this.detectionRange = config.detectionRange ?? 200;
    this.aggroDelay = config.aggroDelay ?? 300;
    this.disengageTime = config.disengageTime ?? 3000;
    this.disengageRange = config.disengageRange ?? this.detectionRange * 2.5;
    this.skillRecoveryTime = config.skillRecoveryTime ?? 300;

    this.getTarget = typeof config.getTarget === 'function' ? config.getTarget : () => null;
    this.canEngage = typeof config.canEngage === 'function' ? config.canEngage : (() => false);

    // 出生点 + 巡逻点
    this.spawnX = host.sprite.x;
    this.spawnY = host.sprite.y;
    this.patrolA = { x: this.spawnX - this.patrolRange / 2, y: this.spawnY };
    this.patrolB = { x: this.spawnX + this.patrolRange / 2, y: this.spawnY };
    this.currentPatrolTarget = this.patrolB;
    this.patrolWaitTimer = 0;
    this._stuckTimer = 0;

    // 战斗
    this.target = null;
    this.inCombat = false;
    this.aggroTimer = 0;
    this.disengageTimer = 0;
    this._activeSkill = null;

    this.direction = 1;
    this.enabled = true;
  }

  // ───── 公共控制 ─────────────────────────────────────────

  setState(s) {
    this.state = s;
    this.stateTimer = 0;
  }

  /** 暂停 AI（投降/对话时） */
  pause() {
    this.enabled = false;
    this.host.sprite?.setVelocity(0, 0);
  }

  resume() {
    this.enabled = true;
  }

  /** 强制进入战斗（受击时调用） */
  forceCombat(target) {
    if (target) this.target = target;
    this._enterCombat();
  }

  /** 取消当前技能 */
  cancelSkill() {
    if (this._activeSkill && this.host.skillSystem) {
      this.host.skillSystem.cancel();
    }
    this._activeSkill = null;
  }

  /** 受击响应 — 把状态机切到 HURT，并在指定 ms 后回 CHASE */
  enterHurt(staggerMs = 0) {
    if (staggerMs <= 0) return;
    this.cancelSkill();
    this.setState(CombatState.HURT);
    this.host.sprite?.setVelocity(0, 0);
    this.scene.time.delayedCall(staggerMs, () => {
      if (this.state === CombatState.HURT && this.host.hp > 0) {
        this.setState(this.inCombat ? CombatState.CHASE : CombatState.PATROL);
      }
    });
  }

  // ───── 主循环 ───────────────────────────────────────────

  update(delta) {
    if (!this.enabled) return;
    if (!this.host.sprite || !this.host.sprite.active) return;
    if (this.state === CombatState.DEAD) return;

    if (this.host.skillSystem) {
      this.host.skillSystem.tick(delta);
      this.host.skillSystem.updateHitboxFollow();
    }

    this.stateTimer += delta;

    // 更新目标
    const candidate = this.getTarget();
    const tgtSprite = candidate?.sprite || candidate;
    let dist = Infinity;
    if (tgtSprite && tgtSprite.x !== undefined) {
      dist = Phaser.Math.Distance.Between(
        this.host.sprite.x, this.host.sprite.y, tgtSprite.x, tgtSprite.y
      );
    }

    // 战斗状态推进（只对可敌对目标）
    if (candidate && this.canEngage(candidate)) {
      this._updateCombatState(candidate, dist, delta);
    } else if (this.inCombat) {
      this._exitCombat();
    }

    switch (this.state) {
      case CombatState.PATROL:
        // followMode（出战伙伴）：无敌对目标时不巡逻，移动交由 CompanionManager 接管跟随玩家
        if (!this.followMode) this._updatePatrol(delta);
        break;
      case CombatState.CHASE:
        this._updateChase(tgtSprite, dist);
        break;
      case CombatState.SKILL_TELEGRAPH:
        this._updateTelegraph(tgtSprite);
        break;
      case CombatState.SKILL_ACTIVE:
        this._updateActive(tgtSprite);
        break;
      case CombatState.SKILL_RECOVERY:
        this._updateRecovery();
        break;
      case CombatState.HURT:
        break;
    }
  }

  // ───── 战斗进出 ─────────────────────────────────────────

  _updateCombatState(target, distance, delta) {
    if (!this.inCombat) {
      if (distance < this.detectionRange) {
        this.aggroTimer += delta;
        if (this.aggroTimer >= this.aggroDelay) {
          this.target = target;
          this._enterCombat();
        }
      } else if (this.aggroTimer > 0) {
        this.aggroTimer = Math.max(0, this.aggroTimer - delta * 2);
      }
    } else {
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
    if (this.state === CombatState.PATROL) {
      this.setState(CombatState.CHASE);
    }
  }

  _exitCombat() {
    this.inCombat = false;
    this.aggroTimer = 0;
    this.disengageTimer = 0;
    this.target = null;
    if (this.host.hp !== undefined && this.host.maxHp !== undefined) {
      this.host.hp = this.host.maxHp;
      if (typeof this.host.onHpChanged === 'function') this.host.onHpChanged();
    }
    this.cancelSkill();
    if (this.state !== CombatState.DEAD) {
      this._startPatrol();
    }
  }

  // ───── 巡逻 ───────────────────────────────────────────────

  _startPatrol() {
    this.setState(CombatState.PATROL);
    this.host.playAnim?.('walk');
    this.patrolWaitTimer = 0;
    this._moveToPoint(this.currentPatrolTarget);
  }

  _moveToPoint(point) {
    const speed = this.host.getMoveSpeed?.() ?? 60;
    this.direction = point.x < this.host.sprite.x ? -1 : 1;
    this.host.sprite.setFlipX(this.direction < 0);
    this.scene.physics.moveTo(this.host.sprite, point.x, point.y, speed);
  }

  _updatePatrol(delta) {
    if (this.patrolWaitTimer > 0) {
      this.patrolWaitTimer -= delta;
      this.host.sprite.setVelocity(0, 0);
      if (this.patrolWaitTimer <= 0) {
        this.patrolWaitTimer = 0;
        this.currentPatrolTarget = this.currentPatrolTarget === this.patrolA ? this.patrolB : this.patrolA;
        this._moveToPoint(this.currentPatrolTarget);
        this.host.playAnim?.('walk');
        this._stuckTimer = 0;
      }
      return;
    }

    const distToTarget = Phaser.Math.Distance.Between(
      this.host.sprite.x, this.host.sprite.y,
      this.currentPatrolTarget.x, this.currentPatrolTarget.y
    );
    if (distToTarget < 8) {
      this.host.sprite.setVelocity(0, 0);
      this.host.playAnim?.('idle');
      this.patrolWaitTimer = 1500;
      this._stuckTimer = 0;
      return;
    }

    // 卡墙
    const body = this.host.sprite.body;
    const sp = body ? Math.hypot(body.velocity.x || 0, body.velocity.y || 0) : 0;
    if (sp < 5) {
      this._stuckTimer += delta;
      if (this._stuckTimer > 800) {
        this._stuckTimer = 0;
        this.currentPatrolTarget = this.currentPatrolTarget === this.patrolA ? this.patrolB : this.patrolA;
        this._moveToPoint(this.currentPatrolTarget);
        this.host.playAnim?.('walk');
      }
    } else {
      this._stuckTimer = 0;
    }
  }

  // ───── 追击 / 技能 ─────────────────────────────────────

  _updateChase(tgtSprite, distance) {
    if (!this.inCombat) {
      this._startPatrol();
      return;
    }
    if (!tgtSprite) {
      this._exitCombat();
      return;
    }

    // 技能优先：可施放即施
    const chosen = this.host.skillSystem?.pickSkill(tgtSprite);
    if (chosen) {
      this._activeSkill = chosen;
      this.host.sprite.setVelocity(0, 0);
      this.direction = tgtSprite.x < this.host.sprite.x ? -1 : 1;
      this.host.sprite.setFlipX(this.direction < 0);
      this.host.skillSystem.executeTelegraph(chosen);
      this.setState(CombatState.SKILL_TELEGRAPH);
      return;
    }

    const targetMin = 36;
    if (distance < targetMin) {
      this.host.sprite.setVelocity(0, 0);
      this.host.playAnim?.('idle');
    } else {
      const chaseSpeed = (this.host.getMoveSpeed?.() ?? 60) * 1.2;
      this.scene.physics.moveTo(this.host.sprite, tgtSprite.x, tgtSprite.y, chaseSpeed);
      this.direction = tgtSprite.x < this.host.sprite.x ? -1 : 1;
      this.host.sprite.setFlipX(this.direction < 0);
      this.host.playAnim?.('walk');
    }
  }

  _updateTelegraph(tgtSprite) {
    if (!this._activeSkill) { this.setState(CombatState.CHASE); return; }
    this.host.sprite.setVelocity(0, 0);
    if (this.stateTimer >= (this._activeSkill.telegraph || 300)) {
      this.host.skillSystem?.executeActive(this._activeSkill, tgtSprite);
      this.setState(CombatState.SKILL_ACTIVE);
    }
  }

  _updateActive(tgtSprite) {
    if (!this._activeSkill) { this.setState(CombatState.CHASE); return; }
    const window = this._activeSkill.activeWindow ?? 100;
    if (this.stateTimer >= window) {
      this.host.skillSystem?.executeRecovery(this._activeSkill);
      this.setState(CombatState.SKILL_RECOVERY);
    }
  }

  _updateRecovery() {
    this.host.sprite.setVelocity(0, 0);
    if (this.stateTimer >= this.skillRecoveryTime) {
      this._activeSkill = null;
      this.setState(CombatState.CHASE);
    }
  }
}
