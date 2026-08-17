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

const TECHNIQUE_COLORS = {
  warrior: { primary: 0xc65343, secondary: 0xc9a35f, pale: 0xf0dfbd },
  archer: { primary: 0x58b89a, secondary: 0xe7e1d2, pale: 0x9cd8c0 },
  mage: { primary: 0xb84b3e, secondary: 0x70c7c7, pale: 0xd0aa62 }
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
    this.sprite.setMaxVelocity(GAME_CONFIG.PHYSICS.PLAYER_MAX_SPEED, GAME_CONFIG.PHYSICS.PLAYER_MAX_SPEED);
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
      if (pointer.leftButtonDown() && !scene.gamePaused && !scene.dialoguing && !scene.uiBlocking) this.tryAttack();
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
      this.handleWalkState();
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

    // 攻击音效（按职业区分近战 / 远程）
    this.scene.events.emit('playerAttack', this.classType);

    if (this.isRangedClass()) {
      this.playAnim('idle');
      // 御剑与施术前摇使用职业技法色短暂提亮
      const tint = TECHNIQUE_COLORS[this.classType]?.secondary || 0xe7e1d2;
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
        // 飞剑或符箓沿瞄准方向飞行 220px
        const range = 220;
        const color = this.classType === 'archer'
          ? TECHNIQUE_COLORS.archer.primary
          : TECHNIQUE_COLORS.mage.pale;
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
    let baseAttack = (primary * 2 + flatAttack) * (1 + pctAttack);
    // 职业专属伤害加成
    const attackType = this.classConfig?.attackType;
    if (attackType === 'ranged') {
      baseAttack *= 1 + (this.stats.bonusPct?.rangedDmg || 0);
    } else if (attackType === 'magic') {
      baseAttack *= 1 + (this.stats.bonusPct?.spellDmg || 0);
    }
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
    // 对话 / 商店 / 训练师面板打开时屏蔽技能（数字键被对话选项使用）
    if (this.scene.dialoguing || this.scene.uiBlocking) return;

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
    this.scene.events.emit('skillCast', skill.id);
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

  // ─── 身法与突进（铁山靠、流云步、缩地符） ───

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
    this._spawnMovementTechniqueVisual(skill, this.sprite.x, this.sprite.y, dirX, dirY);

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
      this._spawnTechniqueSeal(skill, dest.x, dest.y, 24);
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

    // 剑修身法：短暂虚化，位移残光由绘制层负责
    if (this.classType === 'archer') {
      this.sprite.setAlpha(0.5);
      this.scene.time.delayedCall(skill.phases.active, () => {
        if (this.sprite) this.sprite.setAlpha(1);
      });
    }

    this.sprite.setVelocity(this._chargeDashVelocity.vx, this._chargeDashVelocity.vy);
  }

  // ─── 天坠式落地技 ───

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

    // 落地视觉：山纹与罡气冲击环
    this._spawnImpactArray(skill, x, y, hw / 2 + 20);

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

    // 视觉：持续的朱砂山阵，不遮挡地表细节
    const colors = TECHNIQUE_COLORS.warrior;
    const zone = this.scene.add.graphics().setPosition(x, y).setDepth(0);
    zone.fillStyle(colors.primary, 0.08);
    zone.fillCircle(0, 0, radius);
    zone.lineStyle(2, colors.secondary, 0.65);
    zone.strokeCircle(0, 0, radius);
    zone.lineStyle(1, colors.primary, 0.55);
    zone.beginPath();
    zone.moveTo(-radius * 0.7, radius * 0.22);
    zone.lineTo(-radius * 0.28, -radius * 0.32);
    zone.lineTo(0, radius * 0.08);
    zone.lineTo(radius * 0.28, -radius * 0.42);
    zone.lineTo(radius * 0.72, radius * 0.22);
    zone.strokePath();

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

  // ─── 持续阵技（罡风、剑阵、术阵） ───

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

    const colors = this._getTechniquePalette(skill);
    this._auraRing = this._createTechniqueArrayGraphics(
      skill, anchorX, anchorY, effect.radius
    ).setDepth(this.sprite.depth - 1);
    this._auraInner = this.scene.add.graphics()
      .setPosition(anchorX, anchorY)
      .setDepth(this.sprite.depth - 1);
    this._auraInner.lineStyle(1, colors.pale, 0.62);
    this._auraInner.strokeCircle(0, 0, effect.radius * 0.45);
    this._auraInner.lineStyle(2, colors.primary, 0.48);
    this._auraInner.beginPath();
    this._auraInner.moveTo(-effect.radius * 0.3, 0);
    this._auraInner.lineTo(0, -effect.radius * 0.3);
    this._auraInner.lineTo(effect.radius * 0.3, 0);
    this._auraInner.lineTo(0, effect.radius * 0.3);
    this._auraInner.closePath();
    this._auraInner.strokePath();

    this._whirlwindTween = this.scene.tweens.add({
      targets: this._auraRing,
      rotation: this.classType === 'warrior' ? Math.PI * 2 : -Math.PI * 2,
      scaleX: 1.08,
      scaleY: 1.08,
      alpha: 0.42,
      duration: Math.max(360, spinDuration),
      ease: 'Linear'
    });
    this._auraInnerTween = this.scene.tweens.add({
      targets: this._auraInner,
      rotation: this.classType === 'mage' ? Math.PI * 2 : -Math.PI * 2,
      alpha: 0.82,
      duration: Math.max(300, spinDuration * 0.75),
      yoyo: true,
      repeat: -1,
      ease: 'Sine.easeInOut'
    });
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
      if (this._auraInner) this._auraInner.setPosition(this.sprite.x, this.sprite.y);
    }
  }

  // ─── Directed techniques: body strikes, flying swords and talismans ───

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

      // 分光剑等扇形多弹道（effect.arrows > 1）
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
      this._spawnBodyTechniqueVisual(skill);
    }
  }

  /**
   * 扇形多飞剑技能（如分光剑）。
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
      onComplete: () => {
        if (this._fanIndicator === fanGfx) this._fanIndicator = null;
        fanGfx.destroy();
      }
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

  // ─── 护体与增益法印 ───

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
    // 职业色只短暂提亮角色，主要辨识来自脚下法纹
    const colors = this._getTechniquePalette(skill);
    const tint = colors.secondary;
    this.sprite.setTint(tint);
    this.scene.time.delayedCall(300, () => {
      if (this.sprite) this.sprite.clearTint();
    });

    const sealRadius = effect.modifiers?.damageReduction ? 32 : 24;
    this._spawnTechniqueSeal(skill, this.sprite.x, this.sprite.y, sealRadius);
  }

  // ─── 镇魂喝 ───

  startTauntSkill(skill) {
    const effect = skill.effect;
    // Force nearby enemies to target player
    this.scene.events.emit('playerTaunt', this, effect.radius, effect.duration);
    // 镇魂喝：朱砂山印向外震开
    this.sprite.setTint(TECHNIQUE_COLORS.warrior.primary);
    this.scene.time.delayedCall(300, () => {
      if (this.sprite) this.sprite.clearTint();
    });
    this._spawnImpactArray(skill, this.sprite.x, this.sprite.y, effect.radius);
  }

  // ═══════════════════════════════════════════════
  // Cultivation technique visuals (code-generated, gameplay-independent)
  // ═══════════════════════════════════════════════

  _getTechniquePalette(skill = null) {
    const id = skill?.id || '';
    if (this.classType === 'mage' &&
        (id.includes('ice') || id.includes('frost') || id === 'freeze' || id === 'blizzard')) {
      return { primary: 0x6fc7c7, secondary: 0xe4eee8, pale: 0xa7d9d1 };
    }
    return TECHNIQUE_COLORS[this.classType] || TECHNIQUE_COLORS.warrior;
  }

  _drawFlyingSword(graphics, x, y, angle, length, colors, alpha = 1) {
    const ux = Math.cos(angle);
    const uy = Math.sin(angle);
    const px = -uy;
    const py = ux;
    const tipX = x + ux * length * 0.58;
    const tipY = y + uy * length * 0.58;
    const heelX = x - ux * length * 0.35;
    const heelY = y - uy * length * 0.35;
    const halfW = Math.max(1.4, length * 0.085);

    graphics.fillStyle(colors.secondary, alpha * 0.92);
    graphics.fillTriangle(
      heelX + px * halfW, heelY + py * halfW,
      heelX - px * halfW, heelY - py * halfW,
      tipX, tipY
    );
    graphics.lineStyle(1, colors.primary, alpha);
    graphics.beginPath();
    graphics.moveTo(heelX + px * halfW, heelY + py * halfW);
    graphics.lineTo(tipX, tipY);
    graphics.lineTo(heelX - px * halfW, heelY - py * halfW);
    graphics.strokePath();
    graphics.lineStyle(2, colors.pale, alpha * 0.9);
    graphics.lineBetween(
      heelX + px * halfW * 1.7, heelY + py * halfW * 1.7,
      heelX - px * halfW * 1.7, heelY - py * halfW * 1.7
    );
    graphics.lineStyle(2, colors.primary, alpha * 0.75);
    graphics.lineBetween(
      heelX - ux * length * 0.18, heelY - uy * length * 0.18,
      heelX, heelY
    );
  }

  _drawTalisman(graphics, skill, length, height, colors) {
    const id = skill?.id || '';
    if (id.includes('ice') || id.includes('frost') || id === 'freeze') {
      graphics.fillStyle(colors.secondary, 0.9);
      graphics.fillTriangle(-length * 0.45, -height * 0.45, -length * 0.45, height * 0.45, length * 0.55, 0);
      graphics.lineStyle(1, colors.primary, 1);
      graphics.lineBetween(-length * 0.45, -height * 0.45, length * 0.55, 0);
      graphics.lineBetween(-length * 0.45, height * 0.45, length * 0.55, 0);
      graphics.lineBetween(-length * 0.18, 0, length * 0.28, 0);
      return;
    }

    graphics.fillStyle(0xe7d7aa, 0.95);
    graphics.fillRect(-length / 2, -height / 2, length, height);
    graphics.lineStyle(1, colors.primary, 0.95);
    graphics.strokeRect(-length / 2, -height / 2, length, height);
    graphics.beginPath();
    graphics.moveTo(-length * 0.3, 0);
    graphics.lineTo(-length * 0.08, -height * 0.28);
    graphics.lineTo(length * 0.05, height * 0.26);
    graphics.lineTo(length * 0.28, -height * 0.2);
    graphics.strokePath();
  }

  _createTechniqueArrayGraphics(skill, x, y, radius) {
    const graphics = this.scene.add.graphics().setPosition(x, y);
    const colors = this._getTechniquePalette(skill);
    graphics.lineStyle(2, colors.primary, 0.72);
    graphics.strokeCircle(0, 0, radius);
    graphics.lineStyle(1, colors.secondary, 0.58);
    graphics.strokeCircle(0, 0, radius * 0.72);

    if (this.classType === 'archer') {
      for (let i = 0; i < 6; i++) {
        const angle = (Math.PI * 2 * i) / 6;
        this._drawFlyingSword(
          graphics,
          Math.cos(angle) * radius * 0.72,
          Math.sin(angle) * radius * 0.72,
          angle + Math.PI / 2,
          Math.max(12, radius * 0.34),
          colors,
          0.9
        );
      }
    } else if (this.classType === 'mage') {
      graphics.lineStyle(1, colors.pale, 0.7);
      graphics.beginPath();
      for (let i = 0; i <= 8; i++) {
        const angle = (Math.PI * 2 * i) / 8 - Math.PI / 8;
        const px = Math.cos(angle) * radius * 0.72;
        const py = Math.sin(angle) * radius * 0.72;
        if (i === 0) graphics.moveTo(px, py);
        else graphics.lineTo(px, py);
      }
      graphics.strokePath();
      for (let i = 0; i < 8; i++) {
        const angle = (Math.PI * 2 * i) / 8;
        graphics.fillStyle(i % 2 ? colors.primary : colors.secondary, 0.8);
        graphics.fillCircle(Math.cos(angle) * radius, Math.sin(angle) * radius, 2);
      }
      if (skill?.id === 'elementalBurst') {
        const elementColors = [0x58b89a, 0xc65343, 0xc9a35f, 0x70c7c7, 0xe4eee8];
        for (let i = 0; i < elementColors.length; i++) {
          const angle = (Math.PI * 2 * i) / elementColors.length - Math.PI / 2;
          graphics.fillStyle(elementColors[i], 0.92);
          graphics.fillCircle(
            Math.cos(angle) * radius * 0.48,
            Math.sin(angle) * radius * 0.48,
            Math.max(2, radius * 0.07)
          );
        }
      }
    } else {
      graphics.lineStyle(2, colors.secondary, 0.72);
      for (let i = 0; i < 4; i++) {
        const angle = (Math.PI * i) / 2;
        const ux = Math.cos(angle);
        const uy = Math.sin(angle);
        const px = -uy;
        const py = ux;
        const ox = ux * radius * 0.68;
        const oy = uy * radius * 0.68;
        graphics.beginPath();
        graphics.moveTo(ox - px * 9, oy + py * 9);
        graphics.lineTo(ox - ux * radius * 0.2, oy - uy * radius * 0.2);
        graphics.lineTo(ox + px * 9, oy + py * 9);
        graphics.strokePath();
      }
    }
    return graphics;
  }

  _spawnTechniqueSeal(skill, x, y, radius = 24) {
    const seal = this._createTechniqueArrayGraphics(skill, x, y, radius)
      .setDepth(this.sprite.depth - 1)
      .setScale(0.58)
      .setAlpha(0.9);
    this.scene.tweens.add({
      targets: seal,
      scaleX: 1.35,
      scaleY: 1.35,
      alpha: 0,
      rotation: this.classType === 'mage' ? Math.PI / 3 : -Math.PI / 5,
      duration: 420,
      ease: 'Quad.easeOut',
      onComplete: () => seal.destroy()
    });
  }

  _spawnImpactArray(skill, x, y, radius) {
    const impact = this._createTechniqueArrayGraphics(skill, x, y, radius)
      .setDepth(this.sprite.depth - 1)
      .setScale(0.18)
      .setAlpha(0.88);
    this.scene.tweens.add({
      targets: impact,
      scaleX: 1,
      scaleY: 1,
      alpha: 0,
      duration: 360,
      ease: 'Cubic.easeOut',
      onComplete: () => impact.destroy()
    });
  }

  _spawnMovementTechniqueVisual(skill, x, y, dirX, dirY) {
    const colors = this._getTechniquePalette(skill);
    const angle = Math.atan2(dirY, dirX);
    this._spawnTechniqueSeal(skill, x, y, 18);

    const streaks = this.scene.add.graphics()
      .setPosition(x, y)
      .setRotation(angle)
      .setDepth(this.sprite.depth);
    streaks.lineStyle(2, colors.primary, 0.78);
    streaks.lineBetween(-22, -7, 12, -7);
    streaks.lineBetween(-28, 0, 16, 0);
    streaks.lineStyle(1, colors.secondary, 0.75);
    streaks.lineBetween(-18, 7, 10, 7);
    this.scene.tweens.add({
      targets: streaks,
      x: x + dirX * 34,
      y: y + dirY * 34,
      alpha: 0,
      scaleX: 1.45,
      duration: 260,
      ease: 'Quad.easeOut',
      onComplete: () => streaks.destroy()
    });
  }

  _spawnBodyTechniqueVisual(skill) {
    const colors = this._getTechniquePalette(skill);
    const dir = this.facing || 1;
    const graphics = this.scene.add.graphics()
      .setPosition(this.sprite.x + dir * 18, this.sprite.y)
      .setScale(dir, 1)
      .setDepth(this.sprite.depth + 1);
    const id = skill?.id || '';

    graphics.lineStyle(3, colors.primary, 0.86);
    if (id === 'groundSplitter') {
      graphics.beginPath();
      graphics.moveTo(0, 12);
      graphics.lineTo(12, -4);
      graphics.lineTo(22, 9);
      graphics.lineTo(34, -10);
      graphics.lineTo(52, 12);
      graphics.strokePath();
    } else {
      graphics.beginPath();
      graphics.moveTo(-4, -14);
      graphics.lineTo(20, -8);
      graphics.lineTo(34, 0);
      graphics.lineTo(20, 8);
      graphics.lineTo(-4, 14);
      graphics.strokePath();
      graphics.fillStyle(colors.secondary, 0.72);
      graphics.fillCircle(9, 0, id === 'execute' ? 7 : 5);
    }
    graphics.lineStyle(1, colors.secondary, 0.7);
    graphics.lineBetween(-8, -9, 24, -3);
    graphics.lineBetween(-8, 9, 24, 3);

    this.scene.tweens.add({
      targets: graphics,
      x: graphics.x + dir * 26,
      scaleX: dir * 1.18,
      scaleY: 1.18,
      alpha: 0,
      duration: 260,
      ease: 'Quad.easeOut',
      onComplete: () => graphics.destroy()
    });
  }

  /**
   * 绘制飞剑、符箓或拳风弹道。仅负责表现，伤害仍由复用 hitbox 处理。
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

    const angle = Math.atan2(dy, dx);
    const colors = this._getTechniquePalette(skill);
    const proj = this.scene.add.graphics()
      .setPosition(sx, sy)
      .setRotation(angle)
      .setDepth(this.sprite.depth + 1);

    if (this.classType === 'archer') {
      this._drawFlyingSword(proj, 0, 0, 0, Math.max(16, w * 2.8), colors);
    } else if (this.classType === 'mage') {
      this._drawTalisman(proj, skill, Math.max(14, w * 2.3), Math.max(7, h * 2.8), colors);
    } else {
      proj.lineStyle(3, colors.primary, 0.9);
      proj.beginPath();
      proj.moveTo(-w * 1.5, -h);
      proj.lineTo(w * 1.4, 0);
      proj.lineTo(-w * 1.5, h);
      proj.strokePath();
      proj.lineStyle(1, colors.secondary, 0.75);
      proj.lineBetween(-w * 2, 0, w, 0);
    }

    const trailColor = Phaser.Display.Color.IntegerToColor(colors.pale).color;
    const totalDistance = Math.max(1, Math.hypot(dx, dy));
    let trailCount = 0;

    this.scene.tweens.add({
      targets: proj,
      x: tx, y: ty,
      duration: 120,
      ease: 'Quad.easeOut',
      onUpdate: () => {
        const travelled = Math.hypot(proj.x - sx, proj.y - sy);
        if (trailCount >= 3 || travelled < totalDistance * ((trailCount + 1) / 4)) return;
        trailCount++;
        const trail = this.scene.add.graphics()
          .setPosition(proj.x, proj.y)
          .setRotation(angle)
          .setDepth(proj.depth - 1);
        trail.lineStyle(Math.max(1, h * 0.55), trailColor, 0.45);
        trail.lineBetween(-Math.max(8, w * 1.8), 0, 0, 0);
        this.scene.tweens.add({
          targets: trail,
          alpha: 0,
          scaleX: 0.25,
          duration: 150,
          onComplete: () => trail.destroy()
        });
      },
      onComplete: () => {
        const flash = this.scene.add.graphics().setPosition(tx, ty).setDepth(proj.depth);
        flash.lineStyle(2, colors.primary, 0.8);
        flash.strokeCircle(0, 0, Math.max(5, w * 1.2));
        flash.lineStyle(1, colors.secondary, 0.75);
        flash.lineBetween(-w, 0, w, 0);
        flash.lineBetween(0, -w, 0, w);
        this.scene.tweens.add({
          targets: flash,
          scaleX: 2.1,
          scaleY: 2.1,
          alpha: 0,
          duration: 160,
          onComplete: () => flash.destroy()
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

  /** 缩地符残影：纸白轮廓配朱砂符光，避免旧奥术紫色。 */
  spawnGhostAfterimage() {
    const colors = TECHNIQUE_COLORS.mage;
    const ghost = this.scene.add.image(this.sprite.x, this.sprite.y, this.sprite.texture.key)
      .setFlipX(this.sprite.flipX)
      .setDisplaySize(this.sprite.displayWidth, this.sprite.displayHeight)
      .setOrigin(0.5, 0.5)
      .setTint(colors.secondary)
      .setAlpha(0.6)
      .setDepth(this.sprite.depth - 1);
    this.scene.tweens.add({
      targets: ghost, alpha: 0, scaleX: 1.5, scaleY: 1.5,
      duration: 400, onComplete: () => ghost.destroy()
    });
  }

  /** 为阵纹与指示层提供克制的中式技法色。 */
  getSkillProjectileColor(skill) {
    if (!skill) return 0xe7e1d2;
    const id = skill.id || '';
    if (id.includes('poison') || id === 'poisonArrow') return 0x4f9b72;
    if (id.includes('hunter') || id === 'huntersMark') return 0xc9a35f;
    if (this.classType === 'archer') return TECHNIQUE_COLORS.archer.primary;
    if (id.includes('fire') || id === 'fireball' || id === 'meteor') return TECHNIQUE_COLORS.mage.primary;
    if (id.includes('ice') || id.includes('frost') || id === 'freeze' || id === 'blizzard') return TECHNIQUE_COLORS.mage.secondary;
    if (this.classType === 'mage') return TECHNIQUE_COLORS.mage.pale;
    return TECHNIQUE_COLORS.warrior.primary;
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
