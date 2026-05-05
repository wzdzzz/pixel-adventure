import Phaser from 'phaser';
import { GAME_CONFIG } from '../config/gameConfig.js';
import { TEXTURES } from '../assets/AssetManager.js';
import { Actor } from './Actor.js';
import { SkillEngine } from '../systems/SkillEngine.js';
import { getClassConfig } from '../data/classConfig.js';
import * as WarriorModule from '../data/warriorSkills.js';
import * as ArcherModule from '../data/archerSkills.js';
import * as MageModule from '../data/mageSkills.js';

export const PlayerState = {
  IDLE: 'IDLE',
  WALK: 'WALK',
  ATTACK_STARTUP: 'ATTACK_STARTUP',
  ATTACK_ACTIVE: 'ATTACK_ACTIVE',
  ATTACK_RECOVERY: 'ATTACK_RECOVERY',
  CHARGING: 'CHARGING',
  SKILL_CASTING: 'SKILL_CASTING',
  DODGE: 'DODGE',
  HURT: 'HURT',
  DEAD: 'DEAD'
};

const SKILL_MODULES = {
  warrior: WarriorModule,
  archer: ArcherModule,
  mage: MageModule
};

export class Player extends Actor {
  constructor(scene, x, y, classType = 'warrior', gender = 'male') {
    const classConfig = getClassConfig(classType);
    super(scene, x, y, 'hero_00', classConfig.baseStats, classConfig.texturePrefix);

    this.classType = classType;
    this.gender = gender;
    this.classConfig = classConfig;

    this.sprite.setBounce(0);
    this.sprite.setDrag(GAME_CONFIG.PHYSICS.PLAYER_DRAG);
    this.sprite.setMaxVelocity(GAME_CONFIG.PHYSICS.PLAYER_SPEED, GAME_CONFIG.PHYSICS.PLAYER_SPEED);
    this.sprite.body.pushable = false;
    this.sprite.playerInstance = this;

    this.iFramesDuration = 800;

    // State machine
    this.state = PlayerState.IDLE;
    this.stateTimer = 0;
    this.attackHitRegistered = false;

    // Facing direction: 1 = right, -1 = left
    this.facing = 1;

    // Attack hitbox
    this.attackHitbox = scene.add.rectangle(0, 0, 40, 36, 0xffff00, 0);
    scene.physics.add.existing(this.attackHitbox, false);
    this.attackHitbox.body.enable = false;

    // Interact system
    this.interactTarget = null;
    this.canInteract = false;

    // Input
    this.cursors = scene.input.keyboard.createCursorKeys();
    this.wasd = {
      up: scene.input.keyboard.addKey(Phaser.Input.Keyboard.KeyCodes.W),
      down: scene.input.keyboard.addKey(Phaser.Input.Keyboard.KeyCodes.S),
      left: scene.input.keyboard.addKey(Phaser.Input.Keyboard.KeyCodes.A),
      right: scene.input.keyboard.addKey(Phaser.Input.Keyboard.KeyCodes.D)
    };
    this.eKey = scene.input.keyboard.addKey(Phaser.Input.Keyboard.KeyCodes.E);

    this.interactText = scene.add.text(0, 0, '按 E 交互', {
      fontSize: '12px',
      fill: '#ffffff',
      backgroundColor: '#000000',
      padding: { x: 4, y: 2 }
    }).setOrigin(0.5).setVisible(false).setDepth(10);

    this._onPointerDown = (pointer) => {
      if (pointer.leftButtonDown() && !scene.gamePaused) this.tryAttack();
    };
    this._onEKeyDown = () => this.tryInteract();
    scene.input.on('pointerdown', this._onPointerDown);
    this.eKey.on('down', this._onEKeyDown);

    // ─── Skill System (class-aware) ───
    const skillModule = SKILL_MODULES[classType] || SKILL_MODULES.warrior;
    this._skillModule = skillModule; // exposed for UI panels
    this.skillSlots = [...skillModule.SKILL_SLOTS];
    this.itemSlots = [null, null, null, null]; // F1-F4 物品快捷栏（存物品 id，如 'potion'）
    const SKILL_DEFS_KEY = { warrior: 'WARRIOR_SKILLS', archer: 'ARCHER_SKILLS', mage: 'MAGE_SKILLS' };
    const skillDefs = skillModule[SKILL_DEFS_KEY[classType]] || {};
    this.skillEngine = new SkillEngine(scene, this, skillDefs, skillModule.getSkillAtLevel);

    // Skill hitbox (reusable)
    this.skillHitbox = scene.add.rectangle(0, 0, 10, 10, 0xff0000, 0);
    scene.physics.add.existing(this.skillHitbox, false);
    this.skillHitbox.body.setAllowGravity(false);
    this.skillHitbox.body.enable = false;

    // Bind number keys 1-4
    this.skillKeys = [
      scene.input.keyboard.addKey(Phaser.Input.Keyboard.KeyCodes.ONE),
      scene.input.keyboard.addKey(Phaser.Input.Keyboard.KeyCodes.TWO),
      scene.input.keyboard.addKey(Phaser.Input.Keyboard.KeyCodes.THREE),
      scene.input.keyboard.addKey(Phaser.Input.Keyboard.KeyCodes.FOUR)
    ];

    this._onSkillKeyDown = [];
    this._onSkillKeyUp = [];
    this.skillKeys.forEach((key, index) => {
      const dh = () => this.trySkill(index);
      const uh = () => this.releaseChargeIfMatching(index);
      this._onSkillKeyDown.push(dh);
      this._onSkillKeyUp.push(uh);
      key.on('down', dh);
      key.on('up', uh);
    });

    // Skill state
    this._chargeDashVelocity = null;
    this._chargeDashDir = null;
    this._chargeHitRegistered = false;
    this._whirlwindSuperArmor = false;
    this._whirlwindMoveSpeedMod = 0;
    this._whirlwindTween = null;

    // 蓄力技能状态
    this._chargingSkillId = null;
    this._chargingSlotIdx = -1;
    this._chargingTimer = 0;
    this._chargingMaxTime = 0;
    this._chargingMinTime = 0;
    this._chargingMovementMode = 'interrupt';
    this._chargeRatio = 1.0;  // 释放时计算出的蓄力比例（影响伤害）
    this._chargeBarBg = null;
    this._chargeBarFill = null;
  }

  setState(newState) {
    this.state = newState;
    this.stateTimer = 0;
  }

  update(delta) {
    this.updateActor(delta);
    this.stateTimer += delta;

    switch (this.state) {
      case PlayerState.IDLE:
        this.handleIdleState();
        break;
      case PlayerState.WALK:
        this.handleWalkState();
        break;
      case PlayerState.ATTACK_STARTUP:
        this.handleAttackStartup();
        break;
      case PlayerState.ATTACK_ACTIVE:
        this.handleAttackActive();
        break;
      case PlayerState.ATTACK_RECOVERY:
        this.handleAttackRecovery();
        break;
      case PlayerState.CHARGING:
        this.handleCharging(delta);
        break;
      case PlayerState.SKILL_CASTING:
        this.handleSkillCasting(delta);
        break;
      case PlayerState.HURT:
      case PlayerState.DEAD:
        break;
    }

    // Tick skill cooldowns even when not casting
    if (this.state !== PlayerState.SKILL_CASTING) {
      this.skillEngine.update(delta);
    }

    this.updateInteractHint();
  }

  getInputDirection() {
    let vx = 0, vy = 0;
    if (this.wasd.left.isDown || this.cursors.left.isDown) vx = -1;
    else if (this.wasd.right.isDown || this.cursors.right.isDown) vx = 1;
    if (this.wasd.up.isDown || this.cursors.up.isDown) vy = -1;
    else if (this.wasd.down.isDown || this.cursors.down.isDown) vy = 1;
    return { x: vx, y: vy };
  }

  updateFacing(input) {
    if (input.x !== 0) {
      this.facing = input.x > 0 ? 1 : -1;
      this.sprite.setFlipX(this.facing < 0);
    }
  }

  handleIdleState() {
    const input = this.getInputDirection();
    if (input.x !== 0 || input.y !== 0) {
      this.setState(PlayerState.WALK);
      return;
    }
    this.sprite.setVelocity(0, 0);
    this.playAnim('idle');
  }

  handleWalkState() {
    const input = this.getInputDirection();
    if (input.x === 0 && input.y === 0) {
      this.setState(PlayerState.IDLE);
      this.sprite.setVelocity(0, 0);
      return;
    }
    this.updateFacing(input);
    const speed = this.getMoveSpeed();
    const len = Math.sqrt(input.x * input.x + input.y * input.y) || 1;
    this.sprite.setVelocity((input.x / len) * speed, (input.y / len) * speed);
    if (input.y < 0 && input.x === 0) {
      this.playAnim('walk_up');
    } else {
      this.playAnim('walk');
    }
  }

  tryAttack() {
    if (this.state === PlayerState.DEAD) return;
    if (this.isAttacking()) return;

    this.sprite.setVelocity(0, 0);
    this.attackHitRegistered = false;
    this.setState(PlayerState.ATTACK_STARTUP);

    if (this.isRangedClass()) {
      this.playAnim('idle');
      // Brief "charge" tint for ranged classes
      const tint = this.classType === 'archer' ? 0xccffcc : 0xccccff;
      this.sprite.setTint(tint);
      this.scene.time.delayedCall(120, () => { if (this.sprite) this.sprite.clearTint(); });
    } else {
      this.playAnim('attack', false);
    }
  }

  handleAttackStartup() {
    this.sprite.setVelocity(0, 0);
    if (this.stateTimer >= 100) {
      this.setState(PlayerState.ATTACK_ACTIVE);

      if (this.isRangedClass()) {
        // 锁定瞄准方向；该方向在 ACTIVE 期间用于弹道扫掠
        const dir = this.getAimDirection();
        this._rangedAim = dir;
        // 角色按 X 翻面
        if (Math.abs(dir.x) > 0.05) {
          this.facing = dir.x >= 0 ? 1 : -1;
          this.sprite.setFlipX(this.facing < 0);
        }
        // 弹道 visual 沿瞄准方向飞 220px
        const range = 220;
        const color = this.classType === 'archer' ? 0xccff44 : 0x88aaff;
        this.spawnProjectile(dir.x * range, dir.y * range, color, 4, 2);
        // hitbox：小方框 24×24，由 handleAttackActive 沿 dir 扫掠
        this.attackHitbox.setSize(24, 24);
        this.attackHitbox.setPosition(this.sprite.x + dir.x * 30, this.sprite.y + dir.y * 30);
        this.attackHitbox.body.enable = true;
        this._rangedRange = range;
      } else {
        this.activateHitbox();
      }
    }
  }

  activateHitbox() {
    // 近战：固定矩形 hitbox
    const offset = 22;
    const hx = this.sprite.x + this.facing * offset;
    const hy = this.sprite.y;
    this.attackHitbox.setSize(40, 36);
    this.attackHitbox.setPosition(hx, hy);
    this.attackHitbox.body.enable = true;
  }

  handleAttackActive() {
    if (this.isRangedClass() && this._rangedAim) {
      // 沿瞄准方向 0..100ms 内从 30 → range 扫掠
      const t = Math.min(1, this.stateTimer / 100);
      const dist = 30 + (this._rangedRange - 30) * t;
      const dir = this._rangedAim;
      this.attackHitbox.setPosition(
        this.sprite.x + dir.x * dist,
        this.sprite.y + dir.y * dist
      );
      if (this.stateTimer >= 100) {
        this.attackHitbox.body.enable = false;
        this._rangedAim = null;
        this.setState(PlayerState.ATTACK_RECOVERY);
      }
      return;
    }

    // 近战：原地不动
    this.attackHitbox.setPosition(
      this.sprite.x + this.facing * 22,
      this.sprite.y
    );
    if (this.stateTimer >= 100) {
      this.attackHitbox.body.enable = false;
      this.setState(PlayerState.ATTACK_RECOVERY);
    }
  }

  handleAttackRecovery() {
    this.sprite.setVelocity(0, 0);
    if (this.stateTimer >= 150) {
      this.setState(PlayerState.IDLE);
    }
  }

  /** 攻击力按职业主属性缩放（warrior=str, archer=agi, mage=int） */
  getAttack() {
    const primaryStat = this.classConfig?.primaryAttackStat || 'str';
    const primary = this.stats.getEffective(primaryStat);
    const flatAttack = this.stats.flatBonuses?.attack || 0;
    const pctAttack = this.stats.bonusPct?.attack || 0;
    const baseAttack = (primary * 2 + flatAttack) * (1 + pctAttack);
    const mod = this.statusEffects?.getModifiers().attack ?? 1;
    return Math.round(baseAttack * mod);
  }

  /** Returns true for archer/mage */
  isRangedClass() {
    return this.classConfig?.attackType === 'ranged' || this.classConfig?.attackType === 'magic';
  }

  /**
   * 取瞄准方向（单位向量）。远程职业读鼠标世界坐标算角度，
   * 近战职业回退到 facing 水平方向。返回 { x, y, angle }。
   */
  getAimDirection() {
    if (this.isRangedClass()) {
      const pointer = this.scene.input.activePointer;
      // 鼠标在世界坐标系的位置（受相机滚动影响）
      const wp = pointer.positionToCamera(this.scene.cameras.main);
      let dx = wp.x - this.sprite.x;
      let dy = wp.y - this.sprite.y;
      const len = Math.hypot(dx, dy);
      if (len < 1) {
        // 鼠标几乎在角色身上：回退 facing 方向
        return { x: this.facing, y: 0, angle: this.facing > 0 ? 0 : Math.PI };
      }
      return { x: dx / len, y: dy / len, angle: Math.atan2(dy, dx) };
    }
    // 近战：用 facing
    return { x: this.facing, y: 0, angle: this.facing > 0 ? 0 : Math.PI };
  }

  isAttacking() {
    return this.state === PlayerState.ATTACK_STARTUP ||
           this.state === PlayerState.ATTACK_ACTIVE ||
           this.state === PlayerState.ATTACK_RECOVERY ||
           this.state === PlayerState.SKILL_CASTING;
  }

  onAttackHit() {
    if (this.attackHitRegistered) return;
    this.attackHitRegistered = true;
    this.addRage(8);
  }

  applyKnockback() {}

  takeDamage(damage, attackerX, attackerY) {
    if (this.isInvulnerable || this.state === PlayerState.DEAD || this.state === PlayerState.HURT) return;

    // Apply damage reduction from status effects
    const mods = this.statusEffects.getModifiers();
    if (mods.damageReduction) {
      damage = Math.floor(damage * (1 - mods.damageReduction));
    }

    // 蓄力中被打 → 取消蓄力 + 销毁进度条
    if (this.state === PlayerState.CHARGING) {
      this._cancelCharge();
    }

    if (this.state === PlayerState.SKILL_CASTING) {
      this.skillEngine.cancelActiveSkill();
      this.skillHitbox.body.enable = false;
      this._chargeDashVelocity = null;
      this._chargeDashDir = null;
      this._cleanupSkillVisuals();
    }

    this.attackHitbox.body.enable = false;
    this.scene.events.emit('screenShake', 3, 80);
    this.setState(PlayerState.HURT);
    this.playAnim('hurt', false);

    super.takeDamage(damage, attackerX, attackerY);
    this.addRage(12);

    this.scene.time.delayedCall(200, () => {
      if (this.state === PlayerState.HURT && this.hp > 0) {
        this.setState(PlayerState.IDLE);
      }
    });
  }

  heal(amount) {
    if (this.state === PlayerState.DEAD) return;
    super.heal(amount);
  }

  onHpChanged() {
    this.scene.events.emit('playerHpChanged', this.hp, this.maxHp);
    this.scene.events.emit('playerResourceChanged', this.stamina, this.maxStamina, this.rage, this.maxRage, this.mana, this.maxMana);
  }

  onResourceChanged() {
    this.scene.events.emit('playerResourceChanged', this.stamina, this.maxStamina, this.rage, this.maxRage, this.mana, this.maxMana);
  }

  die() {
    this.setState(PlayerState.DEAD);
    this.statusEffects.clearAll();
    this.sprite.body.enable = false;
    this.sprite.setTint(0xff0000);
    this.playAnim('die', false);

    this.scene.tweens.add({
      targets: this.sprite,
      alpha: 0, scaleX: 2, scaleY: 2,
      duration: 1000,
      onComplete: () => this.scene.events.emit('playerDeath')
    });
  }

  // ═══════════════════════════════════════════════
  // Skill System
  // ═══════════════════════════════════════════════

  /**
   * 把技能装备到 1-4 号槽位。
   * - 同一技能已在其他槽位 → 先从原槽移除，避免重复
   * - 仅允许已学习（level ≥ 1）的技能装备
   * - 装备后 emit 'skillSlotsChanged'，UI 监听刷新
   */
  setSkillSlot(slotIndex, skillId) {
    if (slotIndex < 0 || slotIndex >= this.skillSlots.length) return false;
    if (skillId && !this.skillEngine.skillDefs[skillId]) return false;
    if (skillId && this.skillEngine.getSkillLevel(skillId) < 1) return false;

    // 去重：移除其他槽位的同一技能
    if (skillId) {
      for (let i = 0; i < this.skillSlots.length; i++) {
        if (i !== slotIndex && this.skillSlots[i] === skillId) {
          this.skillSlots[i] = null;
        }
      }
    }
    this.skillSlots[slotIndex] = skillId || null;
    this.scene.events.emit('skillSlotsChanged', this.skillSlots.slice());
    return true;
  }

  // ─── Charge skill (蓄力技能) ───────────────────────────────────

  handleCharging(delta) {
    this._chargingTimer += delta;
    this._updateChargeBar();

    // 移动中断
    if (this._chargingMovementMode === 'interrupt') {
      const input = this.getInputDirection();
      if (input.x !== 0 || input.y !== 0) {
        this._cancelCharge();
        return;
      }
    }
    this.sprite.setVelocity(0, 0);

    // 超过 maxTime 自动释放
    if (this._chargingTimer >= this._chargingMaxTime) {
      this._releaseCharge();
    }
  }

  releaseChargeIfMatching(slotIndex) {
    if (this.state !== PlayerState.CHARGING) return;
    if (slotIndex !== this._chargingSlotIdx) return;
    if (this._chargingTimer < this._chargingMinTime) {
      // 不足最低蓄力 → 取消
      this._cancelCharge();
      return;
    }
    this._releaseCharge();
  }

  _releaseCharge() {
    const skillId = this._chargingSkillId;
    if (!skillId) return;

    // 计算蓄力比例：[minTime, maxTime] → [0.4, 1.0]
    const t = Phaser.Math.Clamp(
      (this._chargingTimer - this._chargingMinTime) /
        Math.max(1, this._chargingMaxTime - this._chargingMinTime),
      0, 1
    );
    this._chargeRatio = 0.4 + 0.6 * t;

    this._hideChargeBar();
    this._chargingSkillId = null;
    this._chargingSlotIdx = -1;
    this._chargingTimer = 0;

    // 执行技能（消耗资源、进冷却）
    const skill = this.skillEngine.execute(skillId);
    if (!skill) {
      this._chargeRatio = 1.0;
      this.setState(PlayerState.IDLE);
      return;
    }
    this.attackHitbox.body.enable = false;
    this.setState(PlayerState.SKILL_CASTING);
    if (this.isRangedClass()) {
      this.playAnim('idle');
    } else {
      this.playAnim('attack', false);
    }
  }

  _cancelCharge() {
    this._hideChargeBar();
    this._chargingSkillId = null;
    this._chargingSlotIdx = -1;
    this._chargingTimer = 0;
    this._chargeRatio = 1.0;
    this.setState(PlayerState.IDLE);
  }

  _showChargeBar() {
    if (this._chargeBarBg) return;
    const w = 36, h = 4;
    const yOff = -this.sprite.displayHeight / 2 - 12;
    this._chargeBarBg = this.scene.add.rectangle(
      this.sprite.x, this.sprite.y + yOff, w, h, 0x222222, 0.85
    ).setStrokeStyle(1, 0x000000, 0.7).setDepth(900);
    this._chargeBarFill = this.scene.add.rectangle(
      this.sprite.x - w / 2, this.sprite.y + yOff, 0, h - 1, 0xffdd44, 1
    ).setOrigin(0, 0.5).setDepth(901);
  }

  _updateChargeBar() {
    if (!this._chargeBarBg) return;
    const w = 36;
    const yOff = -this.sprite.displayHeight / 2 - 12;
    this._chargeBarBg.setPosition(this.sprite.x, this.sprite.y + yOff);
    this._chargeBarFill.setPosition(this.sprite.x - w / 2, this.sprite.y + yOff);
    const t = Phaser.Math.Clamp(this._chargingTimer / this._chargingMaxTime, 0, 1);
    this._chargeBarFill.width = (w - 2) * t;
    // 颜色按蓄力程度：黄→橙→红
    const color = t < 0.4 ? 0xffdd44 : t < 0.8 ? 0xff8833 : 0xff3333;
    this._chargeBarFill.setFillStyle(color);
  }

  _hideChargeBar() {
    if (this._chargeBarBg) { this._chargeBarBg.destroy(); this._chargeBarBg = null; }
    if (this._chargeBarFill) { this._chargeBarFill.destroy(); this._chargeBarFill = null; }
  }

  trySkill(slotIndex) {
    if (this.state === PlayerState.DEAD || this.state === PlayerState.HURT) return;
    if (this.state === PlayerState.SKILL_CASTING || this.state === PlayerState.CHARGING) return;
    if (this.scene.gamePaused) return;

    const skillId = this.skillSlots[slotIndex];
    if (!skillId) return;

    // 蓄力技能：先进 CHARGING（不消耗资源、不进冷却），松开按键时再执行
    const scaled = this.skillEngine.getScaledSkill(skillId);
    if (scaled && scaled.effect && scaled.effect.chargeable) {
      // 资源不足直接 abort
      const check = this.skillEngine.canUse(skillId);
      if (!check.canUse) return;

      this._chargingSkillId = skillId;
      this._chargingSlotIdx = slotIndex;
      this._chargingTimer = 0;
      this._chargingMaxTime = scaled.effect.chargeTime || 1500;
      this._chargingMinTime = scaled.effect.minChargeTime || 200;
      this._chargingMovementMode = scaled.effect.chargeMovement || 'interrupt';

      this.sprite.setVelocity(0, 0);
      this.attackHitbox.body.enable = false;
      this.setState(PlayerState.CHARGING);
      this._showChargeBar();
      this.playAnim('idle');
      return;
    }

    const skill = this.skillEngine.execute(skillId);
    if (!skill) return;

    this.sprite.setVelocity(0, 0);
    this.attackHitbox.body.enable = false;
    this.setState(PlayerState.SKILL_CASTING);

    // Ranged classes: don't play melee attack anim for non-dash skills
    if (this.isRangedClass() && skill.effect.type !== 'dash') {
      this.playAnim('idle');
    } else {
      this.playAnim('attack', false);
    }

    // Spin: invulnerable from startup
    if (skill.effect.type === 'spin') {
      this._whirlwindSuperArmor = true;
      this.isInvulnerable = true;
    }
  }

  handleSkillCasting(delta) {
    const activeSkill = this.skillEngine.getActiveSkill();

    // Allow movement during whirlwind active phase
    if (activeSkill && this.skillEngine.activePhase === 'active' && activeSkill.effect.type === 'spin') {
      const input = this.getInputDirection();
      if (input.x !== 0 || input.y !== 0) {
        this.updateFacing(input);
        const baseSpeed = this.getMoveSpeed();
        const modifiedSpeed = baseSpeed * (1 + this._whirlwindMoveSpeedMod);
        const len = Math.sqrt(input.x * input.x + input.y * input.y) || 1;
        this.sprite.setVelocity((input.x / len) * modifiedSpeed, (input.y / len) * modifiedSpeed);
      } else {
        this.sprite.setVelocity(0, 0);
      }
    }

    // Update hitbox position during active phase
    if (activeSkill && this.skillEngine.activePhase === 'active') {
      if (activeSkill.effect.type === 'leap_slam') {
        // leap_slam 自行管理位移，不干预
      } else if (activeSkill.effect.type === 'dash') {
        const dir = this._chargeDashDir || { x: this.facing, y: 0 };
        this.skillHitbox.setPosition(
          this.sprite.x + dir.x * 22,
          this.sprite.y + dir.y * 22
        );
        if (this._chargeDashVelocity) {
          this.sprite.setVelocity(this._chargeDashVelocity.vx, this._chargeDashVelocity.vy);
        }
      } else if (activeSkill.effect.type === 'spin') {
        this.skillHitbox.setPosition(this.sprite.x, this.sprite.y);
      } else if (activeSkill.effect.type === 'melee') {
        if (this.isRangedClass() && this._skillIsCone) {
          // 扇形技能：hitbox 静止覆盖扇形区域（startConeSkill 已设置）
        } else if (this.isRangedClass() && this._skillAim) {
          // 远程单弹道：沿瞄准方向扫掠
          const phaseDur = activeSkill.phases?.active || 100;
          const t = Math.min(1, this.skillEngine.phaseTimer / phaseDur);
          const dist = this._skillStartDist + (this._skillRange - this._skillStartDist) * t;
          const dir = this._skillAim;
          this.skillHitbox.setPosition(
            this.sprite.x + dir.x * dist,
            this.sprite.y + dir.y * dist
          );
        } else {
          this.skillHitbox.setPosition(
            this.sprite.x + this.facing * 22,
            this.sprite.y
          );
        }
      }
      // buff/taunt: no hitbox positioning
    }

    const result = this.skillEngine.update(delta);
    if (!result) return;

    switch (result.event) {
      case 'phase_active':
        this.onSkillActive(result.skill);
        break;
      case 'skill_tick':
        this.onSkillTick(result.skill);
        break;
      case 'phase_recovery':
        this.onSkillRecovery(result.skill);
        break;
      case 'skill_complete':
        this.onSkillComplete(result.skill);
        break;
    }
  }

  onSkillActive(skill) {
    switch (skill.effect.type) {
      case 'dash':
        this.startChargeDash(skill);
        break;
      case 'leap_slam':
        this.startLeapSlam(skill);
        break;
      case 'spin':
        this.startWhirlwind(skill);
        break;
      case 'melee':
        this.startMeleeSkill(skill);
        break;
      case 'buff':
        this.startBuffSkill(skill);
        break;
      case 'taunt':
        this.startTauntSkill(skill);
        break;
    }
    this.scene.triggerSystem?.fire('onSkillCast', { skillId: skill.id });
  }

  onSkillTick(skill) {
    if (skill.effect.type === 'spin') {
      this.whirlwindTick(skill);
    }
  }

  onSkillRecovery(skill) {
    this.skillHitbox.body.enable = false;
    if (this._whirlwindSuperArmor) {
      this._whirlwindSuperArmor = false;
      this.isInvulnerable = false;
    }
    this._chargeDashVelocity = null;
    this._chargeDashDir = null;
    this.sprite.setVelocity(0, 0);
    this._cleanupSkillVisuals();
  }

  onSkillComplete(skill) {
    this.skillHitbox.body.enable = false;
    if (this._whirlwindSuperArmor) {
      this._whirlwindSuperArmor = false;
      this.isInvulnerable = false;
    }
    this._chargeDashVelocity = null;
    this._chargeDashDir = null;
    this._chargeRatio = 1.0;  // 重置蓄力比例
    this._cleanupSkillVisuals();
    this.setState(PlayerState.IDLE);
  }

  _cleanupSkillVisuals() {
    if (this._whirlwindTween) {
      this._whirlwindTween.stop();
      this._whirlwindTween = null;
    }
    if (this._auraInnerTween) {
      this._auraInnerTween.stop();
      this._auraInnerTween = null;
    }
    if (this._auraRing) {
      this._auraRing.destroy();
      this._auraRing = null;
    }
    if (this._auraInner) {
      this._auraInner.destroy();
      this._auraInner = null;
    }
    this._aoeAnchor = null;
    this._skillAim = null;
    this._skillRange = 0;
    this._skillStartDist = 0;
    this._skillIsCone = false;
    if (this._fanIndicator) {
      this.scene.tweens.killTweensOf(this._fanIndicator);
      this._fanIndicator.destroy();
      this._fanIndicator = null;
    }
    this.sprite.setAngle(0);
  }

  // ─── Dash (Charge, Leap Strike) ───

  startChargeDash(skill) {
    const effect = skill.effect;

    // 方向：优先鼠标瞄准，鼠标在身上时回退到 facing
    const aim = this.getAimDirection();
    let dirX = aim.x, dirY = aim.y;

    // 反向位移（如翻滚射击 — 向后退）
    if (effect.reverse) {
      dirX = -dirX;
      dirY = -dirY;
    }

    if (Math.abs(dirX) > 0.05) {
      // 反向技能保持原 facing（视觉朝鼠标方向射箭）
      if (!effect.reverse) {
        this.facing = dirX > 0 ? 1 : -1;
        this.sprite.setFlipX(this.facing < 0);
      }
    }

    this._chargeDashDir = { x: dirX, y: dirY };

    // 闪现：瞬移到终点（不走 velocity）
    if (effect.blink) {
      const distance = effect.distance || 200;

      // 沿方向检测碰撞，在墙壁/障碍前停下
      const dest = this._findBlinkEndpoint(
        this.sprite.x, this.sprite.y, dirX, dirY, distance
      );

      // 终点 hitbox（短暂 AOE）
      this.skillHitbox.setSize(effect.hitbox.w, effect.hitbox.h);
      this.skillHitbox.body.setSize(effect.hitbox.w, effect.hitbox.h);
      this.skillHitbox.setPosition(dest.x, dest.y);
      this.skillHitbox.body.enable = true;

      // 残影
      this.spawnGhostAfterimage();
      this.sprite.setAlpha(0.4);
      this.scene.time.delayedCall(skill.phases.active, () => {
        if (this.sprite) this.sprite.setAlpha(1);
      });

      // 瞬移到合法终点
      this.sprite.setPosition(dest.x, dest.y);
      this.sprite.setVelocity(0, 0);
      this._chargeDashVelocity = null;
      this._chargeHitRegistered = false;
      return;
    }

    // 常规 dash：用速度推进
    const hx = this.sprite.x + dirX * 22;
    const hy = this.sprite.y + dirY * 22;
    this.skillHitbox.setSize(effect.hitbox.w, effect.hitbox.h);
    this.skillHitbox.body.setSize(effect.hitbox.w, effect.hitbox.h);
    this.skillHitbox.setPosition(hx, hy);
    this.skillHitbox.body.enable = true;

    this._chargeDashVelocity = {
      vx: dirX * effect.speed,
      vy: dirY * effect.speed
    };
    this._chargeHitRegistered = false;

    // Archer 翻滚：半透明
    if (this.classType === 'archer') {
      this.sprite.setAlpha(0.5);
      this.scene.time.delayedCall(skill.phases.active, () => {
        if (this.sprite) this.sprite.setAlpha(1);
      });
    }

    this.sprite.setVelocity(this._chargeDashVelocity.vx, this._chargeDashVelocity.vy);
  }

  // ─── Leap Slam (跳斩) ───

  startLeapSlam(skill) {
    const effect = skill.effect;
    const maxDistance = effect.distance || 350;

    // 目标：鼠标位置，超出最大距离则沿方向取最远点
    const pointer = this.scene.input.activePointer;
    const cam = this.scene.cameras.main;
    const mouseX = pointer.worldX ?? (pointer.x + cam.scrollX);
    const mouseY = pointer.worldY ?? (pointer.y + cam.scrollY);

    const startX = this.sprite.x;
    const startY = this.sprite.y;
    let dx = mouseX - startX;
    let dy = mouseY - startY;
    let dist = Math.sqrt(dx * dx + dy * dy) || 1;

    // 归一化方向
    const dirX = dx / dist;
    const dirY = dy / dist;

    // 距离取 min(鼠标距离, 最大距离)
    const actualDist = Math.min(dist, maxDistance);

    if (Math.abs(dirX) > 0.05) {
      this.facing = dirX > 0 ? 1 : -1;
      this.sprite.setFlipX(this.facing < 0);
    }

    // 用闪现的墙壁碰撞检测找合法终点
    const dest = this._findBlinkEndpoint(startX, startY, dirX, dirY, actualDist);
    const endX = dest.x;
    const endY = dest.y;

    const leapHeight = effect.leapHeight || 80;
    const leapDuration = effect.leapDuration || 400;

    // 跳跃期间无敌 + 禁止移动
    this.isInvulnerable = true;
    this.sprite.setVelocity(0, 0);
    this._leapSlamActive = true;

    // 跳跃动画：抛物线位移
    const startTime = this.scene.time.now;
    const leapUpdate = () => {
      if (!this._leapSlamActive || !this.sprite) return;
      const elapsed = this.scene.time.now - startTime;
      const t = Math.min(1, elapsed / leapDuration);

      // 水平线性插值
      const cx = startX + (endX - startX) * t;
      const cy = startY + (endY - startY) * t;
      // 抛物线高度偏移
      const heightOffset = -leapHeight * 4 * t * (1 - t);

      this.sprite.setPosition(cx, cy + heightOffset);

      if (t < 1) {
        this.scene.time.delayedCall(16, leapUpdate);
      } else {
        // 落地
        this.sprite.setPosition(endX, endY);
        this._leapSlamActive = false;
        this.isInvulnerable = false;
        this._onLeapSlamLand(skill, endX, endY);
      }
    };
    leapUpdate();
  }

  _onLeapSlamLand(skill, x, y) {
    const effect = skill.effect;

    // 相机震动
    if (effect.cameraShake) {
      this.scene.cameras.main.shake(effect.cameraShake.duration, effect.cameraShake.intensity / 1000);
    }

    // 落地 AOE hitbox
    const hw = effect.hitbox.w, hh = effect.hitbox.h;
    this.skillHitbox.setSize(hw, hh);
    this.skillHitbox.body.setSize(hw, hh);
    this.skillHitbox.setPosition(x, y);
    this.skillHitbox.body.enable = true;
    this._chargeHitRegistered = false;

    // 落地恢复怒气（基础 15）
    const baseRageGain = 15;
    this.addRage(baseRageGain);

    // 检测范围内敌人并造伤
    const enemies = this.scene.enemies || [];
    let hitCount = 0;
    enemies.forEach(enemy => {
      if (!enemy.sprite?.active || !enemy.hp || enemy.hp <= 0) return;
      const dx = enemy.sprite.x - x;
      const dy = enemy.sprite.y - y;
      if (Math.abs(dx) <= hw / 2 + 16 && Math.abs(dy) <= hh / 2 + 16) {
        const dmg = Math.round(this.getAttack() * effect.baseDamageMultiplier);
        enemy.takeDamage(dmg, this.sprite);
        hitCount++;
        // 击退
        if (effect.knockback) {
          const dist = Math.sqrt(dx * dx + dy * dy) || 1;
          const kx = (dx / dist) * effect.knockback;
          const ky = (dy / dist) * effect.knockback;
          enemy.sprite.body?.setVelocity(kx, ky);
        }
      }
    });

    // 命中敌人额外恢复怒气
    if (hitCount > 0) {
      this.addRage(10 + hitCount * 5);
    }

    // 落地视觉特效：冲击波
    const ring = this.scene.add.circle(x, y, 10, 0xff6600, 0.6).setDepth(1);
    this.scene.tweens.add({
      targets: ring,
      radius: hw / 2 + 20,
      alpha: 0,
      duration: 300,
      onUpdate: () => { ring.setRadius(ring.radius); },
      onComplete: () => ring.destroy()
    });

    // 地面持续伤害区域
    if (effect.groundDot) {
      this._createGroundDot(x, y, skill);
    }

    // 短暂后关闭 hitbox
    this.scene.time.delayedCall(150, () => {
      if (this.skillHitbox) this.skillHitbox.body.enable = false;
    });
  }

  _createGroundDot(x, y, skill) {
    const dot = skill.effect.groundDot;
    const radius = dot.radius || 60;
    const duration = dot.duration || 3000;
    const tickInterval = dot.tickInterval || 500;
    const dmgMult = dot.damageMultiplier || 0.3;

    // 视觉：地面灼烧圈
    const zone = this.scene.add.circle(x, y, radius, 0xff4400, 0.25)
      .setDepth(0).setStrokeStyle(2, 0xff6600, 0.5);

    let elapsed = 0;
    const tickTimer = this.scene.time.addEvent({
      delay: tickInterval,
      repeat: Math.floor(duration / tickInterval) - 1,
      callback: () => {
        elapsed += tickInterval;
        // 对区域内敌人造伤
        const enemies = this.scene.enemies || [];
        enemies.forEach(enemy => {
          if (!enemy.sprite?.active || !enemy.hp || enemy.hp <= 0) return;
          const dx = enemy.sprite.x - x;
          const dy = enemy.sprite.y - y;
          if (dx * dx + dy * dy <= radius * radius) {
            const tickDmg = Math.round(this.getAttack() * dmgMult);
            enemy.takeDamage(tickDmg, this.sprite);
          }
        });
        // 闪烁效果
        zone.setAlpha(0.15 + Math.random() * 0.15);
      }
    });

    // 到期销毁
    this.scene.time.delayedCall(duration, () => {
      tickTimer.destroy();
      this.scene.tweens.add({
        targets: zone, alpha: 0, duration: 300,
        onComplete: () => zone.destroy()
      });
    });
  }

  // ─── Spin (Whirlwind) ───

  startWhirlwind(skill) {
    const effect = skill.effect;
    const size = effect.radius * 2;
    this.skillHitbox.setSize(size, size);
    this.skillHitbox.body.setSize(size, size);

    // 决定 AOE 锚点：远程职业 → 鼠标位置（限最大施法距离）；近战 → 玩家身上
    let anchorX = this.sprite.x;
    let anchorY = this.sprite.y;
    const MAX_AOE_RANGE = 200;

    if (this.isRangedClass()) {
      const pointer = this.scene.input.activePointer;
      const wp = pointer.positionToCamera(this.scene.cameras.main);
      const dx = wp.x - this.sprite.x;
      const dy = wp.y - this.sprite.y;
      const dist = Math.hypot(dx, dy);
      if (dist <= MAX_AOE_RANGE || dist < 1) {
        anchorX = wp.x;
        anchorY = wp.y;
      } else {
        anchorX = this.sprite.x + (dx / dist) * MAX_AOE_RANGE;
        anchorY = this.sprite.y + (dy / dist) * MAX_AOE_RANGE;
      }
      // 角色按 X 翻面朝 AOE
      if (Math.abs(dx) > 0.05) {
        this.facing = dx >= 0 ? 1 : -1;
        this.sprite.setFlipX(this.facing < 0);
      }
    }

    this._aoeAnchor = { x: anchorX, y: anchorY };
    this.skillHitbox.setPosition(anchorX, anchorY);
    this.skillHitbox.body.enable = true;

    if (effect.superArmor) {
      this._whirlwindSuperArmor = true;
      this.isInvulnerable = true;
    }
    this._whirlwindMoveSpeedMod = effect.moveSpeedMod;

    const spinDuration = skill.phases.active;

    if (this.isRangedClass()) {
      // 远程 AOE 视觉：外圈描边脉冲 + 内圈实心反向脉冲
      const color = this.getSkillProjectileColor(skill);

      // 外圈
      this._auraRing = this.scene.add.circle(
        anchorX, anchorY, effect.radius, color, 0.18
      ).setStrokeStyle(2, color, 0.75).setDepth(this.sprite.depth - 1);

      // 内圈（更小更亮）
      this._auraInner = this.scene.add.circle(
        anchorX, anchorY, effect.radius * 0.55, color, 0.32
      ).setDepth(this.sprite.depth - 1);

      // 外圈：膨胀+渐淡
      this._whirlwindTween = this.scene.tweens.add({
        targets: this._auraRing,
        scaleX: 1.12, scaleY: 1.12, alpha: 0.06,
        duration: 320, yoyo: true, repeat: -1, ease: 'Sine.easeInOut'
      });
      // 内圈：反向收缩+变亮
      this._auraInnerTween = this.scene.tweens.add({
        targets: this._auraInner,
        scaleX: 0.75, scaleY: 0.75, alpha: 0.5,
        duration: 220, yoyo: true, repeat: -1, ease: 'Sine.easeInOut'
      });
    } else {
      // 战士：玩家身上旋转
      this._whirlwindTween = this.scene.tweens.add({
        targets: this.sprite,
        angle: 360 * 4,
        duration: spinDuration,
        ease: 'Linear',
        onComplete: () => { this.sprite.setAngle(0); }
      });
    }
  }

  whirlwindTick(skill) {
    if (this.isRangedClass() && this._aoeAnchor) {
      // 远程：hitbox/视觉锚定在鼠标点（不跟随玩家）
      this.skillHitbox.setPosition(this._aoeAnchor.x, this._aoeAnchor.y);
      if (this._auraRing) this._auraRing.setPosition(this._aoeAnchor.x, this._aoeAnchor.y);
      if (this._auraInner) this._auraInner.setPosition(this._aoeAnchor.x, this._aoeAnchor.y);
    } else {
      // 战士：跟随玩家
      this.skillHitbox.setPosition(this.sprite.x, this.sprite.y);
      if (this._auraRing) this._auraRing.setPosition(this.sprite.x, this.sprite.y);
    }
  }

  // ─── Melee (Heavy Strike, Execute, Ground Splitter, Armor Break) ───

  startMeleeSkill(skill) {
    const effect = skill.effect;

    if (this.isRangedClass()) {
      const dir = this.getAimDirection();
      this._skillAim = dir;

      // 射程 = clamp(180 + (dmgMul-1)×50, 140, 240)
      const dmgMul = effect.damageMultiplier ?? 1.0;
      const range = Phaser.Math.Clamp(180 + (dmgMul - 1.0) * 50, 140, 240);
      this._skillRange = range;
      this._skillStartDist = 30;

      // 角色按 X 翻面
      if (Math.abs(dir.x) > 0.05) {
        this.facing = dir.x >= 0 ? 1 : -1;
        this.sprite.setFlipX(this.facing < 0);
      }

      // 扇形多弹道（multiShot 等：effect.arrows > 1）
      if (effect.arrows && effect.arrows > 1) {
        this.startConeSkill(skill, dir, range);
        return;
      }

      // 蓄力技：用一个覆盖完整 path 的长 hitbox（不扫掠，避免高速扫错过敌人）
      if (effect.chargeable) {
        const longW = range;                          // 矩形长度 = 射程
        const longH = Math.max(effect.hitbox.h, 32);  // 给敌人体宽留余量
        this.skillHitbox.setSize(longW, longH);
        this.skillHitbox.body.setSize(longW, longH);
        // 中点放置 hitbox（沿 dir 中点）
        const cx = this.sprite.x + dir.x * (range / 2);
        const cy = this.sprite.y + dir.y * (range / 2);
        this.skillHitbox.setPosition(cx, cy);
        this.skillHitbox.body.enable = true;
        this._skillIsCone = true;  // 让 handleSkillCasting 不要 sweep

        const color = this.getSkillProjectileColor(skill);
        const size = Math.max(4, Math.min(effect.hitbox.w, effect.hitbox.h) / 6);
        this.spawnProjectile(dir.x * range, dir.y * range, color, size, size * 0.5, skill);
        return;
      }

      // 普通单弹道：hitbox 沿 dir 扫掠
      this.skillHitbox.setSize(effect.hitbox.w, effect.hitbox.h);
      this.skillHitbox.body.setSize(effect.hitbox.w, effect.hitbox.h);
      this.skillHitbox.setPosition(
        this.sprite.x + dir.x * this._skillStartDist,
        this.sprite.y + dir.y * this._skillStartDist
      );
      this.skillHitbox.body.enable = true;

      const color = this.getSkillProjectileColor(skill);
      const size = Math.max(4, Math.min(effect.hitbox.w, effect.hitbox.h) / 6);
      this.spawnProjectile(dir.x * range, dir.y * range, color, size, size * 0.5, skill);
    } else {
      // 近战职业：保持 facing
      const offset = 22;
      this.skillHitbox.setSize(effect.hitbox.w, effect.hitbox.h);
      this.skillHitbox.body.setSize(effect.hitbox.w, effect.hitbox.h);
      this.skillHitbox.setPosition(
        this.sprite.x + this.facing * offset,
        this.sprite.y
      );
      this.skillHitbox.body.enable = true;
    }
  }

  /**
   * 扇形多弹道技能（如多重射击）。
   * - arrows: 弹道数量
   * - spreadAngle: 总扩散角度（度）
   * hitbox: 用扇形 4 角点的 AABB 覆盖整个扇形区域，active 期间静止（不扫掠）
   */
  startConeSkill(skill, dir, range) {
    const effect = skill.effect;
    const arrows = effect.arrows;
    const spread = (effect.spreadAngle || 60) * Math.PI / 180;
    const baseAngle = dir.angle;
    const halfSpread = spread / 2;

    // 标记本次为 cone：handleSkillCasting 不要 sweep
    this._skillIsCone = true;

    // 4 个特征点：原点 + 弧两端 + 弧中点
    const corners = [
      { x: 0, y: 0 },
      { x: Math.cos(baseAngle - halfSpread) * range, y: Math.sin(baseAngle - halfSpread) * range },
      { x: Math.cos(baseAngle) * range, y: Math.sin(baseAngle) * range },
      { x: Math.cos(baseAngle + halfSpread) * range, y: Math.sin(baseAngle + halfSpread) * range }
    ];
    const minX = Math.min(...corners.map(p => p.x));
    const maxX = Math.max(...corners.map(p => p.x));
    const minY = Math.min(...corners.map(p => p.y));
    const maxY = Math.max(...corners.map(p => p.y));
    const bw = Math.max(20, maxX - minX);
    const bh = Math.max(20, maxY - minY);
    const cx = (minX + maxX) / 2;
    const cy = (minY + maxY) / 2;

    this.skillHitbox.setSize(bw, bh);
    this.skillHitbox.body.setSize(bw, bh);
    this.skillHitbox.setPosition(this.sprite.x + cx, this.sprite.y + cy);
    this.skillHitbox.body.enable = true;

    // 扇形指示视觉（轻量描边 + 半透明填充三角扇）
    const color = this.getSkillProjectileColor(skill);
    const fanGfx = this.scene.add.graphics();
    fanGfx.setDepth(this.sprite.depth - 1);
    fanGfx.fillStyle(color, 0.18);
    fanGfx.lineStyle(1, color, 0.55);
    fanGfx.beginPath();
    fanGfx.moveTo(this.sprite.x, this.sprite.y);
    const segments = 16;
    for (let i = 0; i <= segments; i++) {
      const a = baseAngle - halfSpread + (spread * i / segments);
      fanGfx.lineTo(this.sprite.x + Math.cos(a) * range, this.sprite.y + Math.sin(a) * range);
    }
    fanGfx.closePath();
    fanGfx.fillPath();
    fanGfx.strokePath();
    this._fanIndicator = fanGfx;

    // 渐淡消失
    this.scene.tweens.add({
      targets: fanGfx,
      alpha: 0,
      duration: 350,
      onComplete: () => fanGfx.destroy()
    });

    // 多发弹道按角度散开
    const size = 5;
    for (let i = 0; i < arrows; i++) {
      const t = arrows === 1 ? 0.5 : i / (arrows - 1);
      const a = baseAngle - halfSpread + spread * t;
      const dx = Math.cos(a) * range;
      const dy = Math.sin(a) * range;
      this.spawnProjectile(dx, dy, color, size, size * 0.5, skill);
    }
  }

  // ─── Buff (War Cry, Blood Rage, Defensive Stance, Berserker Rage) ───

  startBuffSkill(skill) {
    const effect = skill.effect;
    if (effect.target === 'self') {
      const level = this.skillEngine.getSkillLevel(skill.id);
      const desc = this._skillModule?.getSkillDescription?.(skill.id, level) || skill.description || '';
      this.statusEffects.apply(effect.buffId, {
        id: effect.buffId,
        type: 'buff',
        duration: effect.duration,
        modifiers: effect.modifiers,
        source: this,
        icon: skill.icon,
        name: skill.name,
        description: desc
      });
    }
    // Class-colored visual feedback
    const buffColors = { warrior: 0xffdd44, archer: 0x66ff88, mage: 0x88bbff };
    const tint = buffColors[this.classType] || 0xffdd44;
    this.sprite.setTint(tint);
    this.scene.time.delayedCall(300, () => {
      if (this.sprite) this.sprite.clearTint();
    });

    // Mage: extra sparkle ring on shield-type buffs
    if (this.classType === 'mage' && effect.modifiers?.damageReduction) {
      const ring = this.scene.add.circle(this.sprite.x, this.sprite.y, 24, 0x6688ff, 0.2)
        .setStrokeStyle(2, 0x88bbff, 0.7).setDepth(this.sprite.depth + 1);
      this.scene.tweens.add({
        targets: ring, scaleX: 2, scaleY: 2, alpha: 0,
        duration: 400, onComplete: () => ring.destroy()
      });
    }
  }

  // ─── Taunt ───

  startTauntSkill(skill) {
    const effect = skill.effect;
    // Force nearby enemies to target player
    this.scene.events.emit('playerTaunt', this, effect.radius, effect.duration);
    // Visual: red pulse
    this.sprite.setTint(0xff4444);
    this.scene.time.delayedCall(300, () => {
      if (this.sprite) this.sprite.clearTint();
    });
  }

  // ═══════════════════════════════════════════════
  // Projectile & Visual Effects (code-generated)
  // ═══════════════════════════════════════════════

  /**
   * Spawn a simple projectile visual (no physics — hitbox handles damage)
   * @param {number} dx - relative X offset to travel
   * @param {number} dy - relative Y offset to travel
   * @param {number} color - tint color
   * @param {number} w - width
   * @param {number} h - height
   * @param {object} [skill] - optional skill for extra effects
   */
  spawnProjectile(dx, dy, color, w = 6, h = 3, skill = null) {
    const sx = this.sprite.x;
    const sy = this.sprite.y;
    const tx = sx + dx;
    const ty = sy + dy;

    // Main projectile body
    const proj = this.scene.add.rectangle(sx, sy, w, h, color)
      .setDepth(this.sprite.depth + 1);

    // Rotate to face travel direction
    const angle = Math.atan2(dy, dx);
    proj.setRotation(angle);

    // Trail particles
    const trailColor = Phaser.Display.Color.IntegerToColor(color).brighten(30).color;

    this.scene.tweens.add({
      targets: proj,
      x: tx, y: ty,
      duration: 120,
      ease: 'Quad.easeOut',
      onUpdate: () => {
        // Spawn trail particle
        const t = this.scene.add.circle(proj.x, proj.y, w * 0.4, trailColor, 0.5)
          .setDepth(proj.depth - 1);
        this.scene.tweens.add({
          targets: t, alpha: 0, scaleX: 0.2, scaleY: 0.2,
          duration: 150, onComplete: () => t.destroy()
        });
      },
      onComplete: () => {
        // Impact flash
        const flash = this.scene.add.circle(tx, ty, w * 1.5, color, 0.6)
          .setDepth(proj.depth);
        this.scene.tweens.add({
          targets: flash, scaleX: 2.5, scaleY: 2.5, alpha: 0,
          duration: 150, onComplete: () => flash.destroy()
        });
        proj.destroy();
      }
    });
  }

  /**
   * 闪现终点修正：允许穿墙，但终点不能卡在墙里。
   * 如果终点在墙壁/障碍/世界边界内，从终点往回退找到合法位置。
   */
  _findBlinkEndpoint(startX, startY, dirX, dirY, maxDist) {
    const scene = this.scene;
    const body = this.sprite.body;
    const sx = this.sprite.scaleX || 1;
    const sy = this.sprite.scaleY || 1;
    const bw = body.width * sx;
    const bh = body.height * sy;
    const bodyCenterOffX = -this.sprite.displayWidth / 2 + body.offset.x * sx + bw / 2;
    const bodyCenterOffY = -this.sprite.displayHeight / 2 + body.offset.y * sy + bh / 2;

    // 收集碰撞体（关卡制模式的静态 groups）
    const blockers = [];
    const addGroup = (g) => {
      if (!g) return;
      for (const child of g.getChildren()) {
        if (child.body) blockers.push(child.body);
      }
    };
    addGroup(scene.walls);
    addGroup(scene.obstacles);
    if (scene.decorations) {
      for (const child of scene.decorations.getChildren()) {
        if (child.body) blockers.push(child.body);
      }
    }

    // 收集开放世界 chunk 墙壁层（tilemap layers）
    const wallLayers = [];
    if (scene.useOpenWorld && scene.chunkManager) {
      for (const [, cd] of scene.chunkManager.activeChunks) {
        if (cd.wallLayer) wallLayers.push(cd.wallLayer);
      }
    }

    const halfW = bw / 2;
    const halfH = bh / 2;
    const wb = scene.physics.world.bounds;

    // 检测某位置是否被阻挡
    const isBlocked = (px, py) => {
      const bcx = px + bodyCenterOffX;
      const bcy = py + bodyCenterOffY;
      // 世界边界
      if (bcx - halfW < wb.x || bcx + halfW > wb.x + wb.width ||
          bcy - halfH < wb.y || bcy + halfH > wb.y + wb.height) {
        return true;
      }
      // AABB 碰撞（关卡制墙壁/障碍）
      for (const b of blockers) {
        if (bcx + halfW > b.x && bcx - halfW < b.x + b.width &&
            bcy + halfH > b.y && bcy - halfH < b.y + b.height) {
          return true;
        }
      }
      // 开放世界 chunk 墙壁 tile 碰撞
      for (const layer of wallLayers) {
        // 检查身体四角 + 中心共 5 个采样点
        const pts = [
          [bcx, bcy],
          [bcx - halfW, bcy - halfH],
          [bcx + halfW, bcy - halfH],
          [bcx - halfW, bcy + halfH],
          [bcx + halfW, bcy + halfH],
        ];
        for (const [tx, ty] of pts) {
          const tile = layer.getTileAtWorldXY(tx, ty);
          if (tile && tile.collides) return true;
        }
      }
      return false;
    };

    // 先检测终点是否合法
    const endX = startX + dirX * maxDist;
    const endY = startY + dirY * maxDist;
    if (!isBlocked(endX, endY)) {
      return { x: endX, y: endY };
    }

    // 终点卡墙了，从终点往回退找合法位置
    const stepSize = 8;
    const steps = Math.ceil(maxDist / stepSize);
    for (let i = 1; i <= steps; i++) {
      const d = maxDist - i * stepSize;
      if (d <= 0) break;
      const tx = startX + dirX * d;
      const ty = startY + dirY * d;
      if (!isBlocked(tx, ty)) {
        return { x: tx, y: ty };
      }
    }

    // 全程被挡，留在原地
    return { x: startX, y: startY };
  }

  /** Ghost afterimage for mage blink */
  spawnGhostAfterimage() {
    // Create a tinted copy at current position
    const ghost = this.scene.add.image(this.sprite.x, this.sprite.y, this.sprite.texture.key)
      .setFlipX(this.sprite.flipX)
      .setDisplaySize(this.sprite.displayWidth, this.sprite.displayHeight)
      .setOrigin(0.5, 0.5)
      .setTint(0x6688ff)
      .setAlpha(0.6)
      .setDepth(this.sprite.depth - 1);
    this.scene.tweens.add({
      targets: ghost, alpha: 0, scaleX: 1.5, scaleY: 1.5,
      duration: 400, onComplete: () => ghost.destroy()
    });
  }

  /** Get projectile color based on skill type */
  getSkillProjectileColor(skill) {
    if (!skill) return 0xffffff;
    const id = skill.id || '';
    // Archer colors
    if (id.includes('poison') || id === 'poisonArrow') return 0x66ff44;
    if (id.includes('hunter') || id === 'huntersMark') return 0xff8844;
    if (this.classType === 'archer') return 0xccff44;
    // Mage colors
    if (id.includes('fire') || id === 'fireball' || id === 'meteor') return 0xff6633;
    if (id.includes('ice') || id.includes('frost') || id === 'freeze' || id === 'blizzard') return 0x44ccff;
    if (id.includes('arcane') || id === 'arcaneMissile') return 0xbb66ff;
    if (this.classType === 'mage') return 0x88aaff;
    // Warrior fallback
    return 0xffffff;
  }

  // ═══════════════════════════════════════════════
  // Interaction
  // ═══════════════════════════════════════════════

  updateInteractHint() {
    if (this.canInteract && this.interactTarget) {
      // 挂在玩家头顶（紧跟人物移动），不再贴在交互目标上
      const px = this.sprite.x;
      const py = this.sprite.y - this.sprite.displayHeight / 2 - 14;
      this.interactText.setPosition(px, py);
      this.interactText.setVisible(true);
    } else {
      this.interactText.setVisible(false);
    }
  }

  setInteractTarget(target) {
    this.canInteract = true;
    this.interactTarget = target;
  }

  clearInteractTarget(target) {
    if (this.interactTarget === target) {
      this.canInteract = false;
      this.interactTarget = null;
    }
  }

  tryInteract() {
    if (this.state === PlayerState.DEAD) return;
    if (this.scene.dialoguing) {
      this.scene.events.emit('playerInteract', this.interactTarget);
      return;
    }
    if (!this.canInteract || !this.interactTarget) return;
    this.scene.events.emit('playerInteract', this.interactTarget);
  }

  getPosition() {
    return { x: this.sprite.x, y: this.sprite.y };
  }

  destroy() {
    if (this._onPointerDown) this.scene.input.off('pointerdown', this._onPointerDown);
    if (this._onEKeyDown && this.eKey) this.eKey.off('down', this._onEKeyDown);
    if (this.attackHitbox) this.attackHitbox.destroy();
    if (this.skillHitbox) this.skillHitbox.destroy();
    if (this.interactText) this.interactText.destroy();
    if (this._auraRing) { this._auraRing.destroy(); this._auraRing = null; }
    if (this._auraInner) { this._auraInner.destroy(); this._auraInner = null; }

    if (this.skillKeys && this._onSkillKeyDown) {
      this.skillKeys.forEach((key, i) => {
        if (this._onSkillKeyDown[i]) key.off('down', this._onSkillKeyDown[i]);
        if (this._onSkillKeyUp && this._onSkillKeyUp[i]) key.off('up', this._onSkillKeyUp[i]);
      });
    }
    this._hideChargeBar();

    this.statusEffects.clearAll();
    this.destroyActor();
  }
}
