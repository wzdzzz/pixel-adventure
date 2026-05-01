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
    this.skillKeys.forEach((key, index) => {
      const handler = () => this.trySkill(index);
      this._onSkillKeyDown.push(handler);
      key.on('down', handler);
    });

    // Skill state
    this._chargeDashVelocity = null;
    this._chargeDashDir = null;
    this._chargeHitRegistered = false;
    this._whirlwindSuperArmor = false;
    this._whirlwindMoveSpeedMod = 0;
    this._whirlwindTween = null;
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
      this.activateHitbox();

      // Ranged classes: spawn basic-attack projectile
      if (this.isRangedClass()) {
        const color = this.classType === 'archer' ? 0xccff44 : 0x88aaff;
        this.spawnProjectile(this.facing * 60, 0, color, 4, 2);
      }
    }
  }

  activateHitbox() {
    const offset = this.isRangedClass() ? 50 : 22;
    const hx = this.sprite.x + this.facing * offset;
    const hy = this.sprite.y;
    const hw = this.isRangedClass() ? 20 : 40;
    const hh = this.isRangedClass() ? 16 : 36;
    this.attackHitbox.setSize(hw, hh);
    this.attackHitbox.setPosition(hx, hy);
    this.attackHitbox.body.enable = true;
  }

  handleAttackActive() {
    const offset = this.isRangedClass() ? 50 : 22;
    this.attackHitbox.setPosition(
      this.sprite.x + this.facing * offset,
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

  /** Returns true for archer/mage */
  isRangedClass() {
    return this.classConfig?.attackType === 'ranged' || this.classConfig?.attackType === 'magic';
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
    this.scene.events.emit('playerResourceChanged', this.stamina, this.maxStamina, this.rage, this.maxRage);
  }

  onResourceChanged() {
    this.scene.events.emit('playerResourceChanged', this.stamina, this.maxStamina, this.rage, this.maxRage);
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

  trySkill(slotIndex) {
    if (this.state === PlayerState.DEAD || this.state === PlayerState.HURT) return;
    if (this.state === PlayerState.SKILL_CASTING) return;
    if (this.scene.gamePaused) return;

    const skillId = this.skillSlots[slotIndex];
    if (!skillId) return;

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
      if (activeSkill.effect.type === 'dash') {
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
        this.skillHitbox.setPosition(
          this.sprite.x + this.facing * 22,
          this.sprite.y
        );
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
    this._cleanupSkillVisuals();
    this.setState(PlayerState.IDLE);
  }

  _cleanupSkillVisuals() {
    if (this._whirlwindTween) {
      this._whirlwindTween.stop();
      this._whirlwindTween = null;
    }
    if (this._auraRing) {
      this._auraRing.destroy();
      this._auraRing = null;
    }
    this.sprite.setAngle(0);
  }

  // ─── Dash (Charge, Leap Strike) ───

  startChargeDash(skill) {
    const effect = skill.effect;
    const input = this.getInputDirection();
    let dirX, dirY;
    if (input.x !== 0 || input.y !== 0) {
      const len = Math.sqrt(input.x * input.x + input.y * input.y);
      dirX = input.x / len;
      dirY = input.y / len;
    } else {
      dirX = this.facing;
      dirY = 0;
    }

    if (dirX !== 0) {
      this.facing = dirX > 0 ? 1 : -1;
      this.sprite.setFlipX(this.facing < 0);
    }

    this._chargeDashDir = { x: dirX, y: dirY };
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

    // Mage blink: leave ghost afterimage then teleport at high speed
    if (this.classType === 'mage') {
      this.spawnGhostAfterimage();
      this.sprite.setAlpha(0.4);
      this.scene.time.delayedCall(skill.phases.active, () => {
        if (this.sprite) this.sprite.setAlpha(1);
      });
    }
    // Archer roll: briefly lower alpha
    if (this.classType === 'archer') {
      this.sprite.setAlpha(0.5);
      this.scene.time.delayedCall(skill.phases.active, () => {
        if (this.sprite) this.sprite.setAlpha(1);
      });
    }

    this.sprite.setVelocity(this._chargeDashVelocity.vx, this._chargeDashVelocity.vy);
  }

  // ─── Spin (Whirlwind) ───

  startWhirlwind(skill) {
    const effect = skill.effect;
    const size = effect.radius * 2;
    this.skillHitbox.setSize(size, size);
    this.skillHitbox.body.setSize(size, size);
    this.skillHitbox.setPosition(this.sprite.x, this.sprite.y);
    this.skillHitbox.body.enable = true;

    if (effect.superArmor) {
      this._whirlwindSuperArmor = true;
      this.isInvulnerable = true;
    }
    this._whirlwindMoveSpeedMod = effect.moveSpeedMod;

    const spinDuration = skill.phases.active;

    if (this.isRangedClass()) {
      // Ranged: show aura ring instead of rotating sprite
      const color = this.classType === 'archer' ? 0x88cc44 : 0x6688ff;
      this._auraRing = this.scene.add.circle(
        this.sprite.x, this.sprite.y, effect.radius, color, 0.15
      ).setStrokeStyle(2, color, 0.6).setDepth(this.sprite.depth - 1);

      // Pulse the aura
      this._whirlwindTween = this.scene.tweens.add({
        targets: this._auraRing,
        scaleX: 1.15, scaleY: 1.15, alpha: 0.08,
        duration: 300, yoyo: true, repeat: -1, ease: 'Sine.easeInOut'
      });
    } else {
      // Warrior: physical spin
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
    this.skillHitbox.setPosition(this.sprite.x, this.sprite.y);
    // Keep aura ring following player
    if (this._auraRing) {
      this._auraRing.setPosition(this.sprite.x, this.sprite.y);
    }
  }

  // ─── Melee (Heavy Strike, Execute, Ground Splitter, Armor Break) ───

  startMeleeSkill(skill) {
    const effect = skill.effect;
    const offset = this.isRangedClass() ? 40 : 22;
    const hx = this.sprite.x + this.facing * offset;
    const hy = this.sprite.y;
    this.skillHitbox.setSize(effect.hitbox.w, effect.hitbox.h);
    this.skillHitbox.body.setSize(effect.hitbox.w, effect.hitbox.h);
    this.skillHitbox.setPosition(hx, hy);
    this.skillHitbox.body.enable = true;

    // Ranged classes: spawn a visible projectile flying to hitbox
    if (this.isRangedClass()) {
      const color = this.getSkillProjectileColor(skill);
      const size = Math.max(4, Math.min(effect.hitbox.w, effect.hitbox.h) / 6);
      this.spawnProjectile(this.facing * (offset + effect.hitbox.w / 2), 0, color, size, size * 0.5, skill);
    }
  }

  // ─── Buff (War Cry, Blood Rage, Defensive Stance, Berserker Rage) ───

  startBuffSkill(skill) {
    const effect = skill.effect;
    if (effect.target === 'self') {
      this.statusEffects.apply(effect.buffId, {
        id: effect.buffId,
        type: 'buff',
        duration: effect.duration,
        modifiers: effect.modifiers,
        source: this
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
      const tx = this.interactTarget.x || this.interactTarget.sprite?.x;
      const ty = this.interactTarget.y || this.interactTarget.sprite?.y;
      if (tx !== undefined && ty !== undefined) {
        this.interactText.setPosition(tx, ty - 35);
        this.interactText.setVisible(true);
      }
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

    if (this.skillKeys && this._onSkillKeyDown) {
      this.skillKeys.forEach((key, i) => {
        if (this._onSkillKeyDown[i]) key.off('down', this._onSkillKeyDown[i]);
      });
    }

    this.statusEffects.clearAll();
    this.destroyActor();
  }
}
