import Phaser from 'phaser';
import { GAME_CONFIG } from '../config/gameConfig.js';
import { TEXTURES } from '../assets/AssetManager.js';
import { Actor } from './Actor.js';

export const PlayerState = {
  IDLE: 'IDLE',
  WALK: 'WALK',
  ATTACK_STARTUP: 'ATTACK_STARTUP',
  ATTACK_ACTIVE: 'ATTACK_ACTIVE',
  ATTACK_RECOVERY: 'ATTACK_RECOVERY',
  HURT: 'HURT',
  DEAD: 'DEAD'
};

export class Player extends Actor {
  constructor(scene, x, y) {
    const statsConfig = { con: 10, str: 8, int: 5, agi: 8, per: 5, lck: 3 };
    super(scene, x, y, 'hero_00', statsConfig, 'hero');

    this.sprite.setBounce(0.05);
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
      case PlayerState.HURT:
      case PlayerState.DEAD:
        break;
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
           this.state === PlayerState.ATTACK_RECOVERY;
  }

  onAttackHit() {
    if (this.attackHitRegistered) return;
    this.attackHitRegistered = true;
  }

  // Player has no knockback — override to do nothing
  applyKnockback() {}

  takeDamage(damage, attackerX, attackerY) {
    if (this.isInvulnerable || this.state === PlayerState.DEAD || this.state === PlayerState.HURT) return;

    this.attackHitbox.body.enable = false;

    this.scene.events.emit('screenShake', 3, 80);

    this.setState(PlayerState.HURT);
    this.playAnim('hurt', false);

    super.takeDamage(damage, attackerX, attackerY);

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
    this.scene.events.emit('playerHpChanged', this.hp, this.maxHp, this.mp, this.maxMp);
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
    if (this.interactText) this.interactText.destroy();
    this.destroyActor();
  }
}
