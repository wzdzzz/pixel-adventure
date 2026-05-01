import Phaser from 'phaser';
import { Stats } from '../systems/Stats.js';
import { CHARACTERS } from '../assets/AssetManager.js';

/**
 * Actor 基类 — Player 和 Enemy 共享的逻辑
 * 提供: Stats属性、HP/Stamina/Rage管理、受伤/击退、I-Frames、死亡
 */
export class Actor {
  constructor(scene, x, y, textureKey, statsConfig = {}, characterType = null) {
    this.scene = scene;
    this.characterType = characterType;

    // 属性系统
    this.stats = new Stats(statsConfig);
    const derived = this.stats.getDerived();

    // 生命
    this.hp = derived.maxHp;
    this.maxHp = derived.maxHp;

    // Stamina (replaces MP) — based on CON
    this.stamina = this.getMaxStamina();
    this.maxStamina = this.getMaxStamina();

    // Rage — combat resource, 0-100
    this.rage = 0;
    this.maxRage = 100;
    this.rageCombatTimer = 0;   // time since last combat action (for decay)
    this.staminaIdleTimer = 0;  // time since last stamina use (for regen delay)

    // I-Frames (无敌帧)
    this.isInvulnerable = false;
    this.iFramesDuration = 200; // ms, 约12帧@60fps
    this.iFramesTimer = 0;

    // HP回复计时器
    this.regenTimer = 0;

    // 创建精灵 — 碰撞体改为脚部小圆
    this.sprite = scene.physics.add.sprite(x, y, textureKey);
    this.sprite.setOrigin(0.5, 0.5);

    // Apply character display size if available
    const charConfig = characterType ? CHARACTERS[characterType] : null;
    if (charConfig) {
      this.sprite.setDisplaySize(charConfig.display.w, charConfig.display.h);
    }

    // Set collision body to cover most of displayed sprite
    const dw = this.sprite.displayWidth;
    const dh = this.sprite.displayHeight;
    const bodyW = dw * 0.85;
    const bodyH = dh * 0.75;
    // Convert display-space body dimensions to unscaled texture coords
    const scaleX = this.sprite.scaleX || 1;
    const scaleY = this.sprite.scaleY || 1;
    const rawBodyW = bodyW / scaleX;
    const rawBodyH = bodyH / scaleY;
    const offsetX = (this.sprite.width - rawBodyW) / 2;
    const offsetY = this.sprite.height - rawBodyH;
    this.sprite.body.setSize(rawBodyW, rawBodyH, false);
    this.sprite.body.setOffset(offsetX, offsetY);
    this.sprite.setCollideWorldBounds(true);

    this.direction = { x: 1, y: 0 };
  }

  /** Play a character animation by name (idle, walk, attack, hurt, die) */
  playAnim(name, ignoreIfPlaying = true) {
    if (!this.characterType) return;
    const key = `${this.characterType}_${name}`;
    if (this.sprite.anims && this.scene.anims.exists(key)) {
      this.sprite.play(key, ignoreIfPlaying);
    }
  }

  /** 刷新属性缓存并同步 maxHp/maxStamina */
  refreshStats() {
    const derived = this.stats.getDerived();
    this.maxHp = derived.maxHp;
    this.maxStamina = this.getMaxStamina();
    if (this.hp > this.maxHp) this.hp = this.maxHp;
    if (this.stamina > this.maxStamina) this.stamina = this.maxStamina;
  }

  /** 获取攻击力 */
  getAttack() {
    return this.stats.getDerived().attack;
  }

  /** 获取移动速度 */
  getMoveSpeed() {
    return this.stats.getDerived().moveSpeed;
  }

  /** Max stamina based on CON */
  getMaxStamina() {
    const con = this.stats.getEffective('con');
    return con * 8 + 60;
  }

  /** Stamina regen rate per second based on CON */
  getStaminaRegenRate() {
    const con = this.stats.getEffective('con');
    return con * 0.8;
  }

  /** Use stamina. Returns true if enough, false otherwise. */
  useStamina(amount) {
    if (this.stamina < amount) return false;
    this.stamina -= amount;
    this.staminaIdleTimer = 0;
    this.onResourceChanged();
    return true;
  }

  /** Add rage (clamped to 0-100) */
  addRage(amount) {
    this.rage = Math.min(this.maxRage, this.rage + amount);
    this.rageCombatTimer = 0;
    this.onResourceChanged();
  }

  /** Use rage. Returns true if enough, false otherwise. */
  useRage(amount) {
    if (this.rage < amount) return false;
    this.rage -= amount;
    this.rageCombatTimer = 0;
    this.onResourceChanged();
    return true;
  }

  /** Subclass override for resource change notification */
  onResourceChanged() {}

  /** 受伤 (通用) */
  takeDamage(damage, attackerX, attackerY) {
    if (this.isInvulnerable || this.hp <= 0) return;

    // 防御减伤
    const defense = this.stats.getDerived().defense;
    const finalDamage = Math.max(1, damage - defense);

    this.hp = Math.max(0, this.hp - finalDamage);

    // 开启 I-Frames
    this.isInvulnerable = true;
    this.iFramesTimer = this.iFramesDuration;

    // 击退
    this.applyKnockback(attackerX, attackerY);

    // 受伤闪烁
    this.flashDamage();

    // 通知 HP 变更
    this.onHpChanged();

    if (this.hp <= 0) {
      // 延迟到闪烁结束再死亡
      this.scene.time.delayedCall(300, () => this.die());
    }
  }

  /** 击退 */
  applyKnockback(attackerX, attackerY, force = 200) {
    if (attackerX == null && attackerY == null) return;
    const angle = Phaser.Math.Angle.Between(
      attackerX, attackerY,
      this.sprite.x, this.sprite.y
    );
    // 韧性减少击退 (diminishing returns: tenacity / (tenacity + 20))
    const tenacity = this.stats.getDerived().tenacity;
    const reduction = tenacity / (tenacity + 20);
    const finalForce = force * (1 - reduction);
    this.sprite.setVelocity(
      Math.cos(angle) * finalForce,
      Math.sin(angle) * finalForce
    );
  }

  /** 受伤闪烁特效 */
  flashDamage() {
    this.sprite.setTint(0xff0000);
    let flashCount = 0;
    this.scene.time.addEvent({
      delay: 70,
      callback: () => {
        flashCount++;
        if (flashCount % 2 === 0) this.sprite.setTint(0xff0000);
        else this.sprite.clearTint();
      },
      repeat: 5
    });
    this.scene.time.delayedCall(420, () => this.sprite.clearTint());
  }

  /** 治疗 */
  heal(amount) {
    if (this.hp <= 0) return;
    this.hp = Math.min(this.maxHp, this.hp + amount);
    this.onHpChanged();
  }

  /** HP/Stamina/Rage 回复 (每帧调用) */
  updateRegen(delta) {
    if (this.hp <= 0) return;

    // HP regen
    const hpRegen = this.stats.getDerived().hpRegen;
    if (hpRegen > 0) {
      this.regenTimer += delta;
      if (this.regenTimer >= 1000) {
        this.regenTimer -= 1000;
        if (this.hp < this.maxHp) {
          this.hp = Math.min(this.maxHp, this.hp + hpRegen);
          this.onHpChanged();
        }
      }
    }

    // Stamina regen (after 1s idle)
    this.staminaIdleTimer += delta;
    if (this.staminaIdleTimer >= 1000 && this.stamina < this.maxStamina) {
      const regenPerFrame = this.getStaminaRegenRate() * (delta / 1000);
      this.stamina = Math.min(this.maxStamina, this.stamina + regenPerFrame);
      this.onResourceChanged();
    }

    // Rage decay (5/sec after 3s of no combat)
    this.rageCombatTimer += delta;
    if (this.rageCombatTimer >= 3000 && this.rage > 0) {
      const decayPerFrame = 5 * (delta / 1000);
      this.rage = Math.max(0, this.rage - decayPerFrame);
      this.onResourceChanged();
    }
  }

  /** I-Frames 计时 (每帧调用) */
  updateIFrames(delta) {
    if (!this.isInvulnerable) return;
    this.iFramesTimer -= delta;
    if (this.iFramesTimer <= 0) {
      this.isInvulnerable = false;
      this.iFramesTimer = 0;
      this.sprite.setAlpha(1);
    }
  }

  /** 基础 update — 子类应 super.update(delta) */
  updateActor(delta) {
    this.updateIFrames(delta);
    this.updateRegen(delta);
  }

  /** 子类覆写 — HP变更时的回调 */
  onHpChanged() {}

  /** 子类覆写 — 死亡逻辑 */
  die() {}

  /** 销毁 */
  destroyActor() {
    if (this.sprite) this.sprite.destroy();
  }
}
