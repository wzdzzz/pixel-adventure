import Phaser from 'phaser';
import { GAME_CONFIG } from '../config/gameConfig.js';
import { TEXTURES } from '../assets/AssetManager.js';

export const PlayerState = {
  IDLE: 'IDLE',
  WALK: 'WALK',
  ATTACK_STARTUP: 'ATTACK_STARTUP',
  ATTACK_ACTIVE: 'ATTACK_ACTIVE',
  ATTACK_RECOVERY: 'ATTACK_RECOVERY',
  HURT: 'HURT',
  DEAD: 'DEAD'
};

export class Player {
  constructor(scene, x, y) {
    this.scene = scene;

    this.sprite = scene.physics.add.sprite(x, y, TEXTURES.PLAYER);
    this.sprite.setOrigin(0.5, 0.5);
    this.sprite.setCollideWorldBounds(true);
    this.sprite.setBounce(0.1);
    this.sprite.setDrag(GAME_CONFIG.PHYSICS.PLAYER_DRAG);
    this.sprite.setMaxVelocity(GAME_CONFIG.PHYSICS.PLAYER_SPEED, GAME_CONFIG.PHYSICS.PLAYER_SPEED);
    this.sprite.body.setSize(20, 24);
    this.sprite.body.setOffset(4, 4);
    this.sprite.playerInstance = this;

    this.hp = 100;
    this.maxHp = 100;
    this.direction = { x: 1, y: 0 };
    this.state = PlayerState.IDLE;
    this.stateTimer = 0;

    this.isInvulnerable = false;
    this.attackHitRegistered = false;

    this.attackHitbox = scene.add.rectangle(0, 0, 40, 20, 0xffff00, 0);
    scene.physics.add.existing(this.attackHitbox, false);
    this.attackHitbox.body.enable = false;

    this.interactTarget = null;
    this.canInteract = false;

    this.cursors = scene.input.keyboard.createCursorKeys();
    this.wasd = {
      up: scene.input.keyboard.addKey(Phaser.Input.Keyboard.KeyCodes.W),
      down: scene.input.keyboard.addKey(Phaser.Input.Keyboard.KeyCodes.S),
      left: scene.input.keyboard.addKey(Phaser.Input.Keyboard.KeyCodes.A),
      right: scene.input.keyboard.addKey(Phaser.Input.Keyboard.KeyCodes.D)
    };
    this.spaceKey = scene.input.keyboard.addKey(Phaser.Input.Keyboard.KeyCodes.SPACE);
    this.eKey = scene.input.keyboard.addKey(Phaser.Input.Keyboard.KeyCodes.E);

    this.interactText = scene.add.text(0, 0, '按 E 交互', {
      fontSize: '12px',
      fill: '#ffffff',
      backgroundColor: '#000000',
      padding: { x: 4, y: 2 }
    }).setOrigin(0.5).setVisible(false).setDepth(10);

    this.spaceKey.on('down', () => this.tryAttack());
    this.eKey.on('down', () => this.tryInteract());
  }

  setState(newState) {
    this.state = newState;
    this.stateTimer = 0;
  }

  update(delta) {
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
        break;
      case PlayerState.DEAD:
        break;
    }

    this.updateInteractHint();
  }

  getInputDirection() {
    let vx = 0;
    let vy = 0;
    if (this.wasd.left.isDown || this.cursors.left.isDown) vx = -1;
    else if (this.wasd.right.isDown || this.cursors.right.isDown) vx = 1;
    if (this.wasd.up.isDown || this.cursors.up.isDown) vy = -1;
    else if (this.wasd.down.isDown || this.cursors.down.isDown) vy = 1;
    return { x: vx, y: vy };
  }

  handleIdleState() {
    const input = this.getInputDirection();
    if (input.x !== 0 || input.y !== 0) {
      this.direction = input;
      this.setState(PlayerState.WALK);
      return;
    }
    this.sprite.setVelocity(0, 0);
    this.updateSpriteFlip();
  }

  handleWalkState() {
    const input = this.getInputDirection();
    if (input.x === 0 && input.y === 0) {
      this.setState(PlayerState.IDLE);
      this.sprite.setVelocity(0, 0);
      return;
    }
    const speed = GAME_CONFIG.PHYSICS.PLAYER_SPEED;
    const len = Math.sqrt(input.x * input.x + input.y * input.y);
    this.sprite.setVelocity((input.x / len) * speed, (input.y / len) * speed);
    this.direction = input;
    this.updateSpriteFlip();
  }

  updateSpriteFlip() {
    if (this.direction.x < 0) this.sprite.setFlipX(true);
    else if (this.direction.x > 0) this.sprite.setFlipX(false);
  }

  tryAttack() {
    if (this.state === PlayerState.DEAD) return;
    if (this.state === PlayerState.ATTACK_STARTUP ||
        this.state === PlayerState.ATTACK_ACTIVE ||
        this.state === PlayerState.ATTACK_RECOVERY) return;

    this.sprite.setVelocity(0, 0);
    this.attackHitRegistered = false;
    this.setState(PlayerState.ATTACK_STARTUP);

    this.scene.tweens.add({
      targets: this.sprite,
      scaleX: 1.15,
      scaleY: 0.9,
      duration: 100,
      ease: 'Quad.easeOut'
    });
  }

  handleAttackStartup() {
    this.sprite.setVelocity(0, 0);
    if (this.stateTimer >= 100) {
      this.setState(PlayerState.ATTACK_ACTIVE);
      this.activateHitbox();
    }
  }

  activateHitbox() {
    const offset = 30;
    let hx = this.sprite.x;
    let hy = this.sprite.y;
    if (this.direction.x > 0) { hx += offset; this.attackHitbox.setSize(40, 24); }
    else if (this.direction.x < 0) { hx -= offset; this.attackHitbox.setSize(40, 24); }
    else if (this.direction.y < 0) { hy -= offset; this.attackHitbox.setSize(24, 40); }
    else if (this.direction.y > 0) { hy += offset; this.attackHitbox.setSize(24, 40); }
    this.attackHitbox.setPosition(hx, hy);
    this.attackHitbox.body.enable = true;

    this.scene.tweens.add({
      targets: this.sprite,
      scaleX: 0.9,
      scaleY: 1.2,
      duration: 80,
      ease: 'Quad.easeOut'
    });
  }

  handleAttackActive() {
    const offset = 30;
    let hx = this.sprite.x;
    let hy = this.sprite.y;
    if (this.direction.x > 0) hx += offset;
    else if (this.direction.x < 0) hx -= offset;
    else if (this.direction.y < 0) hy -= offset;
    else if (this.direction.y > 0) hy += offset;
    this.attackHitbox.setPosition(hx, hy);

    if (this.stateTimer >= 100) {
      this.attackHitbox.body.enable = false;
      this.setState(PlayerState.ATTACK_RECOVERY);

      this.scene.tweens.add({
        targets: this.sprite,
        scaleX: 1,
        scaleY: 1,
        duration: 150,
        ease: 'Back.easeOut'
      });
    }
  }

  handleAttackRecovery() {
    this.sprite.setVelocity(0, 0);
    if (this.stateTimer >= 150) {
      this.setState(PlayerState.IDLE);
    }
  }

  onAttackHit() {
    if (this.attackHitRegistered) return;
    this.attackHitRegistered = true;
  }

  takeDamage(damage, attackerX, attackerY) {
    if (this.isInvulnerable || this.state === PlayerState.DEAD || this.state === PlayerState.HURT) return;

    this.hp = Math.max(0, this.hp - damage);
    this.isInvulnerable = true;
    this.attackHitbox.body.enable = false;

    this.sprite.setVelocity(0, 0);
    this.setState(PlayerState.HURT);

    this.scene.events.emit('hitStop', 50);
    this.scene.events.emit('screenShake', 5, 100);

    const knockbackAngle = Phaser.Math.Angle.Between(
      attackerX || this.sprite.x - this.direction.x * 30,
      attackerY || this.sprite.y - this.direction.y * 30,
      this.sprite.x,
      this.sprite.y
    );
    const knockbackForce = 250;
    this.sprite.setVelocity(
      Math.cos(knockbackAngle) * knockbackForce,
      Math.sin(knockbackAngle) * knockbackForce
    );

    this.sprite.setTint(0xff0000);

    this.scene.tweens.add({
      targets: this.sprite,
      alpha: 0.3,
      duration: 60,
      yoyo: true,
      repeat: 3,
      onComplete: () => {
        this.sprite.setAlpha(1);
        this.sprite.clearTint();
        this.isInvulnerable = false;

        if (this.hp <= 0) {
          this.die();
        } else {
          this.setState(PlayerState.IDLE);
        }
      }
    });

    this.scene.events.emit('playerHpChanged', this.hp, this.maxHp);
  }

  heal(amount) {
    if (this.state === PlayerState.DEAD) return;
    this.hp = Math.min(this.maxHp, this.hp + amount);
    this.scene.events.emit('playerHpChanged', this.hp, this.maxHp);
  }

  die() {
    this.setState(PlayerState.DEAD);
    this.sprite.body.enable = false;
    this.sprite.setTint(0xff0000);

    this.scene.tweens.add({
      targets: this.sprite,
      alpha: 0,
      scaleX: 2,
      scaleY: 2,
      duration: 1000,
      onComplete: () => {
        this.scene.events.emit('playerDeath');
      }
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
    if (!this.canInteract || !this.interactTarget) return;
    this.scene.events.emit('playerInteract', this.interactTarget);
  }

  isInCombatState() {
    return this.state === PlayerState.ATTACK_STARTUP ||
           this.state === PlayerState.ATTACK_ACTIVE ||
           this.state === PlayerState.ATTACK_RECOVERY;
  }

  getPosition() {
    return { x: this.sprite.x, y: this.sprite.y };
  }

  destroy() {
    if (this.sprite) this.sprite.destroy();
    if (this.attackHitbox) this.attackHitbox.destroy();
    if (this.interactText) this.interactText.destroy();
  }
}
