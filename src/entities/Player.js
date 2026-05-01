import Phaser from 'phaser';
import { GAME_CONFIG } from '../config/gameConfig.js';
import { TEXTURES } from '../assets/AssetManager.js';
import { Actor } from './Actor.js';
import { SkillEngine } from '../systems/SkillEngine.js';
import { SKILL_SLOTS } from '../data/warriorSkills.js';

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

export class Player extends Actor {
  constructor(scene, x, y) {
    const statsConfig = { con: 10, str: 8, int: 5, agi: 8, per: 5, lck: 3 };
    super(scene, x, y, 'hero_00', statsConfig, 'hero');

    this.sprite.setBounce(0);
    this.sprite.setDrag(GAME_CONFIG.PHYSICS.PLAYER_DRAG);
    this.sprite.setMaxVelocity(GAME_CONFIG.PHYSICS.PLAYER_SPEED, GAME_CONFIG.PHYSICS.PLAYER_SPEED);
    this.sprite.playerInstance = this;

    this.iFramesDuration = 800;

    // State machine
    this.state = PlayerState.IDLE;
    this.stateTimer = 0;
    this.attackHitRegistered = false;

    // Facing direction: 1 = right, -1 = left
    this.facing = 1;

    // Attack hitbox (invisible rectangle)
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

    // Store handler references for cleanup
    this._onPointerDown = (pointer) => {
      if (pointer.leftButtonDown() && !scene.gamePaused) this.tryAttack();
    };
    this._onEKeyDown = () => this.tryInteract();
    scene.input.on('pointerdown', this._onPointerDown);
    this.eKey.on('down', this._onEKeyDown);

    // Skill system
    this.skillEngine = new SkillEngine(scene, this);

    // Skill hitbox (reusable, separate from attackHitbox)
    this.skillHitbox = scene.add.rectangle(0, 0, 10, 10, 0xff0000, 0);
    scene.physics.add.existing(this.skillHitbox, false);
    this.skillHitbox.body.setAllowGravity(false);
    this.skillHitbox.body.enable = false;

    // Bind number keys 1-4 to skill slots
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

    // Charge skill dash state
    this._chargeDashVelocity = null;
    this._chargeHitRegistered = false;

    // Whirlwind skill state
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
    // Use walk_up animation when moving upward without horizontal input
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
    this.playAnim('attack', false);
  }

  handleAttackStartup() {
    this.sprite.setVelocity(0, 0);
    if (this.stateTimer >= 100) {
      this.setState(PlayerState.ATTACK_ACTIVE);
      this.activateHitbox();
    }
  }

  activateHitbox() {
    const offset = 22;
    const hx = this.sprite.x + this.facing * offset;
    const hy = this.sprite.y;
    this.attackHitbox.setSize(40, 36);
    this.attackHitbox.setPosition(hx, hy);
    this.attackHitbox.body.enable = true;
  }

  handleAttackActive() {
    // Keep hitbox following player
    const offset = 22;
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

  isAttacking() {
    return this.state === PlayerState.ATTACK_STARTUP ||
           this.state === PlayerState.ATTACK_ACTIVE ||
           this.state === PlayerState.ATTACK_RECOVERY ||
           this.state === PlayerState.SKILL_CASTING;
  }

  onAttackHit() {
    if (this.attackHitRegistered) return;
    this.attackHitRegistered = true;

    // Rage gain on dealing damage
    this.addRage(8);
  }

  // Player has no knockback — override to do nothing
  applyKnockback() {}

  takeDamage(damage, attackerX, attackerY) {
    // Whirlwind: fully invulnerable (isInvulnerable is already true)
    if (this.isInvulnerable || this.state === PlayerState.DEAD || this.state === PlayerState.HURT) return;

    // Cancel any active skill on hit (e.g. charge gets interrupted)
    if (this.state === PlayerState.SKILL_CASTING) {
      this.skillEngine.cancelActiveSkill();
      this.skillHitbox.body.enable = false;
      this._chargeDashVelocity = null;
      this._chargeDashDir = null;
      if (this._whirlwindTween) { this._whirlwindTween.stop(); this._whirlwindTween = null; }
      this.sprite.setAngle(0);
    }

    this.attackHitbox.body.enable = false;

    this.scene.events.emit('screenShake', 3, 80);

    this.setState(PlayerState.HURT);
    this.playAnim('hurt', false);

    super.takeDamage(damage, attackerX, attackerY);

    // Rage gain on taking damage
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
    this.sprite.body.enable = false;
    this.sprite.setTint(0xff0000);
    this.playAnim('die', false);

    this.scene.tweens.add({
      targets: this.sprite,
      alpha: 0,
      scaleX: 2,
      scaleY: 2,
      duration: 1000,
      onComplete: () => this.scene.events.emit('playerDeath')
    });
  }

  // ─── Skill System ───

  /** Try to activate a skill by slot index (0-3). */
  trySkill(slotIndex) {
    if (this.state === PlayerState.DEAD || this.state === PlayerState.HURT) return;
    if (this.state === PlayerState.SKILL_CASTING) return;
    if (this.scene.gamePaused) return;

    const skillId = SKILL_SLOTS[slotIndex];
    if (!skillId) return;

    const skill = this.skillEngine.execute(skillId);
    if (!skill) return;

    // Stop movement, enter casting state
    this.sprite.setVelocity(0, 0);
    this.attackHitbox.body.enable = false;
    this.setState(PlayerState.SKILL_CASTING);
    this.playAnim('attack', false); // reuse attack anim for now
  }

  /** Handle SKILL_CASTING state each frame. */
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
        this.sprite.setVelocity(
          (input.x / len) * modifiedSpeed,
          (input.y / len) * modifiedSpeed
        );
      } else {
        this.sprite.setVelocity(0, 0);
      }
    }

    // Update active skill hitbox position
    if (activeSkill && this.skillEngine.activePhase === 'active') {
      if (activeSkill.effect.type === 'dash') {
        // Keep charge hitbox in front of player along dash direction
        const dir = this._chargeDashDir || { x: this.facing, y: 0 };
        this.skillHitbox.setPosition(
          this.sprite.x + dir.x * 22,
          this.sprite.y + dir.y * 22
        );
        // Maintain dash velocity
        if (this._chargeDashVelocity) {
          this.sprite.setVelocity(this._chargeDashVelocity.vx, this._chargeDashVelocity.vy);
        }
      } else if (activeSkill.effect.type === 'spin') {
        // Keep spin hitbox centered on player
        this.skillHitbox.setPosition(this.sprite.x, this.sprite.y);
      }
    }

    // Tick the skill engine
    const result = this.skillEngine.update(delta);
    if (!result) return;

    const skill = result.skill;

    switch (result.event) {
      case 'phase_active':
        this.onSkillActive(skill);
        break;
      case 'skill_tick':
        this.onSkillTick(skill);
        break;
      case 'phase_recovery':
        this.onSkillRecovery(skill);
        break;
      case 'skill_complete':
        this.onSkillComplete(skill);
        break;
    }
  }

  /** Called when skill enters active phase. */
  onSkillActive(skill) {
    if (skill.effect.type === 'dash') {
      this.startChargeDash(skill);
    } else if (skill.effect.type === 'spin') {
      this.startWhirlwind(skill);
    }
  }

  /** Called on each tick of a multi-hit skill. */
  onSkillTick(skill) {
    if (skill.effect.type === 'spin') {
      this.whirlwindTick(skill);
    }
  }

  /** Called when skill enters recovery phase. */
  onSkillRecovery(skill) {
    this.skillHitbox.body.enable = false;
    if (this._whirlwindSuperArmor) {
      this._whirlwindSuperArmor = false;
      this.isInvulnerable = false;
    }
    this._chargeDashVelocity = null;
    this._chargeDashDir = null;
    this.sprite.setVelocity(0, 0);
    if (this._whirlwindTween) {
      this._whirlwindTween.stop();
      this._whirlwindTween = null;
    }
    this.sprite.setAngle(0);
  }

  /** Called when skill fully completes. */
  onSkillComplete(skill) {
    this.skillHitbox.body.enable = false;
    if (this._whirlwindSuperArmor) {
      this._whirlwindSuperArmor = false;
      this.isInvulnerable = false;
    }
    this._chargeDashVelocity = null;
    this._chargeDashDir = null;
    if (this._whirlwindTween) {
      this._whirlwindTween.stop();
      this._whirlwindTween = null;
    }
    this.sprite.setAngle(0);
    this.setState(PlayerState.IDLE);
  }

  // ─── Charge Skill ───

  /** Begin the Charge dash: dash toward mouse cursor position. */
  startChargeDash(skill) {
    const effect = skill.effect;

    // Calculate direction from player to mouse cursor
    const pointer = this.scene.input.activePointer;
    const cam = this.scene.cameras.main;
    const targetX = pointer.x + cam.scrollX;
    const targetY = pointer.y + cam.scrollY;
    const angle = Phaser.Math.Angle.Between(this.sprite.x, this.sprite.y, targetX, targetY);
    const dirX = Math.cos(angle);
    const dirY = Math.sin(angle);

    // Update facing based on dash direction
    if (dirX !== 0) {
      this.facing = dirX > 0 ? 1 : -1;
      this.sprite.setFlipX(this.facing < 0);
    }

    // Store dash direction for hitbox tracking
    this._chargeDashDir = { x: dirX, y: dirY };

    // Activate skill hitbox in front of player along dash direction
    const hx = this.sprite.x + dirX * 22;
    const hy = this.sprite.y + dirY * 22;
    this.skillHitbox.setSize(effect.hitbox.w, effect.hitbox.h);
    this.skillHitbox.body.setSize(effect.hitbox.w, effect.hitbox.h);
    this.skillHitbox.setPosition(hx, hy);
    this.skillHitbox.body.enable = true;

    // Set dash velocity toward mouse
    this._chargeDashVelocity = {
      vx: dirX * effect.speed,
      vy: dirY * effect.speed
    };
    this._chargeHitRegistered = false;

    this.sprite.setVelocity(this._chargeDashVelocity.vx, this._chargeDashVelocity.vy);
  }

  // ─── Whirlwind Skill ───

  /** Begin Whirlwind: create circular hitbox, enable invincibility. */
  startWhirlwind(skill) {
    const effect = skill.effect;

    // Circular hitbox centered on player (using a square approximation)
    const size = effect.radius * 2;
    this.skillHitbox.setSize(size, size);
    this.skillHitbox.body.setSize(size, size);
    this.skillHitbox.setPosition(this.sprite.x, this.sprite.y);
    this.skillHitbox.body.enable = true;

    // Full invincibility during spin
    this._whirlwindSuperArmor = true;
    this.isInvulnerable = true;

    // Store the move speed modifier
    this._whirlwindMoveSpeedMod = effect.moveSpeedMod;

    // Visual spin effect -- rotate sprite
    const spinDuration = skill.phases.active;
    const rotations = 4;
    this._whirlwindTween = this.scene.tweens.add({
      targets: this.sprite,
      angle: 360 * rotations,
      duration: spinDuration,
      ease: 'Linear',
      onComplete: () => {
        this.sprite.setAngle(0);
      }
    });
  }

  /** Process a whirlwind damage tick. */
  whirlwindTick(skill) {
    // Re-center hitbox on player
    this.skillHitbox.setPosition(this.sprite.x, this.sprite.y);
  }

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

    // Clean up skill key listeners
    if (this.skillKeys && this._onSkillKeyDown) {
      this.skillKeys.forEach((key, i) => {
        if (this._onSkillKeyDown[i]) key.off('down', this._onSkillKeyDown[i]);
      });
    }

    this.destroyActor();
  }
}
