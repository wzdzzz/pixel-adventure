import Phaser from 'phaser';
import { ENEMY_SKILLS, getEnemySkill } from '../data/enemySkills.js';
import { EnemyProjectile } from '../entities/EnemyProjectile.js';

/**
 * EnemySkillSystem — 敌人技能管理（每个 Enemy 实例持有一份）
 *
 * 职责：
 *   1. 管理冷却（每个技能独立 CD）
 *   2. AI 选择：从可用列表挑出当前距离/冷却 OK 的最高优先级技能
 *   3. 执行：根据 type 派发到对应 execute_xxx 函数
 *
 * Enemy 状态机会调用：
 *   - tick(delta)            — 每帧推进冷却
 *   - pickSkill(player)      — 在 CHASE 时调用，返回可用技能或 null
 *   - executeTelegraph(skill) - 进入 telegraph 阶段（视觉提示）
 *   - executeActive(skill, player) - active 阶段（实际施加伤害）
 *   - executeRecovery(skill) - 退出技能（清理 + 启动冷却）
 */
export class EnemySkillSystem {
  /**
   * @param {Phaser.Scene} scene
   * @param {Enemy} enemy   宿主敌人
   * @param {string[]} skillIds 技能 ID 列表
   */
  constructor(scene, enemy, skillIds = []) {
    this.scene = scene;
    this.enemy = enemy;
    this.skillIds = skillIds.filter(id => ENEMY_SKILLS[id]);
    this.cooldowns = {};
    this.skillIds.forEach(id => { this.cooldowns[id] = 0; });

    // 当前活跃技能的临时状态
    this._activeHitbox = null;
    this._activeIndicator = null;
    this._activeSkill = null;
  }

  /** 每帧推进冷却 */
  tick(delta) {
    for (const id of this.skillIds) {
      if (this.cooldowns[id] > 0) {
        this.cooldowns[id] = Math.max(0, this.cooldowns[id] - delta);
      }
    }
  }

  /** 列出当前可用（冷却好 + 在 range 内）的技能，按 priority 倒排 */
  pickSkill(player) {
    if (!player || !this.enemy.sprite) return null;
    const dx = player.x - this.enemy.sprite.x;
    const dy = player.y - this.enemy.sprite.y;
    const dist = Math.hypot(dx, dy);

    const candidates = [];
    for (const id of this.skillIds) {
      if (this.cooldowns[id] > 0) continue;
      const skill = getEnemySkill(id);
      if (!skill) continue;
      if (dist > skill.range) continue;
      if (skill.minRange && dist < skill.minRange) continue;
      candidates.push(skill);
    }
    if (candidates.length === 0) return null;
    candidates.sort((a, b) => (b.priority || 0) - (a.priority || 0));
    // 同优先级随机
    const top = candidates.filter(s => (s.priority || 0) === (candidates[0].priority || 0));
    return top[Math.floor(Math.random() * top.length)];
  }

  /** Telegraph 阶段：仅视觉提示，不造成伤害 */
  executeTelegraph(skill) {
    this._activeSkill = skill;
    const sprite = this.enemy.sprite;
    if (!sprite) return;
    sprite.setVelocity(0, 0);
    if (skill.telegraphTint) sprite.setTint(skill.telegraphTint);
    this.enemy.playAnim('attack', false);

    // type 特定指示器
    if (skill.type === 'aoe_burst') {
      // 显示半透明圆圈
      const ring = this.scene.add.circle(sprite.x, sprite.y, skill.radius, skill.color || 0xff4422, 0.18)
        .setStrokeStyle(2, skill.color || 0xff4422, 0.65).setDepth(sprite.depth - 1);
      this.scene.tweens.add({
        targets: ring, scaleX: 1.0, scaleY: 1.0, alpha: 0.4,
        duration: skill.telegraph, ease: 'Sine.easeIn'
      });
      this._activeIndicator = ring;
    } else if (skill.type === 'charge_attack') {
      // 显示朝玩家的方向箭头线
      const player = this.scene.player?.sprite;
      if (player) {
        const angle = Math.atan2(player.y - sprite.y, player.x - sprite.x);
        const len = skill.range * 0.5;
        const ex = sprite.x + Math.cos(angle) * len;
        const ey = sprite.y + Math.sin(angle) * len;
        const line = this.scene.add.line(0, 0, sprite.x, sprite.y, ex, ey, skill.color || 0xff6644, 0.6)
          .setOrigin(0, 0).setLineWidth(3).setDepth(sprite.depth - 1);
        this._activeIndicator = line;
      }
    }
  }

  /** Active 阶段：根据 type 派发实际执行 */
  executeActive(skill, player) {
    const sprite = this.enemy.sprite;
    if (!sprite) return;
    sprite.clearTint();

    switch (skill.type) {
      case 'melee_strike':
        this._executeMeleeStrike(skill, player);
        break;
      case 'ranged_shot':
        this._executeRangedShot(skill, player);
        break;
      case 'charge_attack':
        this._executeChargeAttack(skill, player);
        break;
      case 'aoe_burst':
        this._executeAoeBurst(skill, player);
        break;
    }

    if (this._activeIndicator) {
      this._activeIndicator.destroy();
      this._activeIndicator = null;
    }
  }

  /** Recovery：清理 + 启动冷却 */
  executeRecovery(skill) {
    const sprite = this.enemy.sprite;
    if (sprite) {
      sprite.clearTint();
      sprite.setVelocity(0, 0);
    }
    if (this._activeHitbox) {
      this._activeHitbox.destroy();
      this._activeHitbox = null;
    }
    if (this._activeIndicator) {
      this._activeIndicator.destroy();
      this._activeIndicator = null;
    }
    if (skill && skill.id) {
      this.cooldowns[skill.id] = skill.cooldown;
    }
    this._activeSkill = null;
  }

  /** 取消（被打断时调用） */
  cancel() {
    if (this._activeIndicator) {
      this._activeIndicator.destroy();
      this._activeIndicator = null;
    }
    if (this._activeHitbox) {
      this._activeHitbox.destroy();
      this._activeHitbox = null;
    }
    this._activeSkill = null;
  }

  // ── Skill type executors ──────────────────────────────────

  _executeMeleeStrike(skill, player) {
    const sprite = this.enemy.sprite;
    if (!sprite || !player) return;
    const dx = player.x - sprite.x;
    const dy = player.y - sprite.y;
    const dist = Math.hypot(dx, dy);
    if (dist < 1) return;
    const dirX = dx / dist;
    const dirY = dy / dist;
    const offset = 24;
    const hbX = sprite.x + dirX * offset;
    const hbY = sprite.y + dirY * offset;
    const hbW = skill.hitbox?.w || 36;
    const hbH = skill.hitbox?.h || 32;

    // 一次性 hitbox（active window 内有效）
    const hb = this.scene.add.rectangle(hbX, hbY, hbW, hbH, 0xff0000, 0);
    this.scene.physics.add.existing(hb, false);
    hb.body.setAllowGravity(false);
    hb.body.enable = true;
    hb._enemySkillDamage = this.enemy.getAttack() * (skill.damage || 1);
    hb._enemyOwner = this.enemy;
    this._activeHitbox = hb;

    // 通知 MainGameScene 注册玩家 vs hitbox 的 overlap
    this.scene.events.emit('enemyHitboxSpawned', hb, skill.activeWindow || 100);
  }

  _executeRangedShot(skill, player) {
    const sprite = this.enemy.sprite;
    if (!sprite || !player) return;
    const dx = player.x - sprite.x;
    const dy = player.y - sprite.y;
    const dist = Math.hypot(dx, dy);
    if (dist < 1) return;
    const dirX = dx / dist;
    const dirY = dy / dist;

    const proj = new EnemyProjectile(this.scene, sprite.x, sprite.y, dirX, dirY, {
      speed: skill.projectileSpeed || 200,
      size: skill.projectileSize || 8,
      color: skill.color ?? 0xffaa44,
      lifetime: skill.projectileLifetime || 2000,
      damage: this.enemy.getAttack() * (skill.damage || 1),
      owner: this.enemy
    });

    this.scene.events.emit('enemyProjectileSpawned', proj);
  }

  _executeChargeAttack(skill, player) {
    const sprite = this.enemy.sprite;
    if (!sprite || !player) return;
    const dx = player.x - sprite.x;
    const dy = player.y - sprite.y;
    const dist = Math.hypot(dx, dy);
    if (dist < 1) return;
    const dirX = dx / dist;
    const dirY = dy / dist;
    const speed = skill.speed || 250;

    // 设置敌人速度（让其朝玩家冲）
    sprite.setVelocity(dirX * speed, dirY * speed);

    // 撞击 hitbox（跟随敌人，active window 内有效）
    const hbW = skill.hitbox?.w || 40;
    const hbH = skill.hitbox?.h || 36;
    const hb = this.scene.add.rectangle(sprite.x, sprite.y, hbW, hbH, 0xff0000, 0);
    this.scene.physics.add.existing(hb, false);
    hb.body.setAllowGravity(false);
    hb.body.enable = true;
    hb._enemySkillDamage = this.enemy.getAttack() * (skill.damage || 1);
    hb._enemyOwner = this.enemy;
    hb._followEnemy = this.enemy;
    this._activeHitbox = hb;

    this.scene.events.emit('enemyHitboxSpawned', hb, skill.activeWindow || 400);
  }

  _executeAoeBurst(skill, player) {
    const sprite = this.enemy.sprite;
    if (!sprite) return;
    const radius = skill.radius || 60;
    // 圆形 hitbox（用 rectangle 物理体，命中检查时 dist 判定）
    const hb = this.scene.add.circle(sprite.x, sprite.y, radius, 0xff0000, 0);
    this.scene.physics.add.existing(hb, false);
    hb.body.setCircle(radius);
    hb.body.enable = true;
    hb._enemySkillDamage = this.enemy.getAttack() * (skill.damage || 1);
    hb._enemyOwner = this.enemy;
    this._activeHitbox = hb;

    // 爆炸视觉
    const burst = this.scene.add.circle(sprite.x, sprite.y, radius, skill.color || 0xff4422, 0.5)
      .setDepth(sprite.depth - 1);
    this.scene.tweens.add({
      targets: burst,
      scaleX: 1.3, scaleY: 1.3, alpha: 0,
      duration: 350, onComplete: () => burst.destroy()
    });

    this.scene.events.emit('enemyHitboxSpawned', hb, skill.activeWindow || 200);
  }

  /** 跟随敌人移动的 hitbox 每帧更新（charge_attack 用） */
  updateHitboxFollow() {
    if (!this._activeHitbox) return;
    if (!this._activeHitbox._followEnemy) return;
    const e = this._activeHitbox._followEnemy;
    if (e.sprite) {
      this._activeHitbox.setPosition(e.sprite.x, e.sprite.y);
      if (this._activeHitbox.body) {
        this._activeHitbox.body.x = e.sprite.x - this._activeHitbox.body.width / 2;
        this._activeHitbox.body.y = e.sprite.y - this._activeHitbox.body.height / 2;
      }
    }
  }
}
