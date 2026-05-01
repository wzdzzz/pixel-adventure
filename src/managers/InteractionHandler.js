import { TEXTURES } from '../assets/AssetManager.js';
import { PlayerState } from '../entities/Player.js';
import { EnemyState } from '../entities/Enemy.js';
import { SaveSystem } from '../systems/SaveSystem.js';
import { levelData } from '../data/levels.js';
import itemData from '../data/items.json';

export const InteractionHandler = {
  handleChestProximity(chest) {
    if (this.dialoguing || chest.opened) return;
    this.player.setInteractTarget(chest.sprite);
    chest.label.setVisible(true);
  },

  handleChestInteract(chest) {
    if (chest.opened) return;

    if (chest.locked) {
      const gs = this.registry.get('gameState');
      if (gs.keysCollected <= 0) {
        // Show "need key" message
        this.showQuickMessage('需要一把钥匙才能打开！');
        return;
      }
      // Consume a key
      gs.keysCollected -= 1;
      this.registry.set('gameState', gs);
      this.events.emit('keysChanged', gs.keysCollected);
    }

    // Open chest
    chest.opened = true;
    chest.sprite.setTexture(TEXTURES.CHEST_OPEN);
    chest.label.setVisible(false);
    this.player.canInteract = false;
    this.player.interactTarget = null;

    // Reward
    const gs = this.registry.get('gameState');
    gs.score += chest.reward.score;
    this.registry.set('gameState', gs);
    this.events.emit('scoreChanged', gs.score);

    if (chest.reward.healAmount > 0) {
      this.player.heal(chest.reward.healAmount);
    }

    // Open animation
    this.tweens.add({
      targets: chest.sprite,
      scaleY: 1.2, scaleX: 0.9,
      duration: 100, yoyo: true,
      onComplete: () => {
        // Sparkle particles
        for (let i = 0; i < 5; i++) {
          const p = this.add.image(chest.sprite.x, chest.sprite.y, TEXTURES.PARTICLE);
          p.setTint(0xffd700);
          p.setDepth(chest.sprite.y + 10);
          this.tweens.add({
            targets: p,
            x: chest.sprite.x + (Math.random() - 0.5) * 40,
            y: chest.sprite.y - 20 - Math.random() * 30,
            alpha: 0, scaleX: 0, scaleY: 0,
            duration: 400 + Math.random() * 200,
            onComplete: () => p.destroy()
          });
        }
        // Fade out and destroy opened chest
        this.tweens.add({
          targets: chest.sprite,
          alpha: 0,
          duration: 500,
          delay: 300,
          onComplete: () => {
            if (chest.sprite.body) chest.sprite.body.enable = false;
            chest.sprite.setVisible(false);
          }
        });
      }
    });

    this.showQuickMessage(`获得 ${chest.reward.score} 分！${chest.reward.healAmount > 0 ? ` 恢复 ${chest.reward.healAmount} HP！` : ''}`);
  },

  handlePortalProximity() {
    if (this.dialoguing) return;
    if (this.portalSprite) {
      this.player.setInteractTarget(this.portalSprite);
    }
  },

  handlePortalInteract() {
    if (!this.portalActivated) {
      const gs = this.registry.get('gameState');
      this.showQuickMessage(`需要 ${this.portalRequiredKeys} 把钥匙！(当前: ${gs.keysCollected})`);
      return;
    }

    // Show confirmation dialogue
    this.dialoguing = true;
    const windowObj = this.uiManager.createDialogueWindow();
    this.activeDialogueWindow = windowObj;

    this.uiManager.openWindow(windowObj, '传送门', ['是否传送到下一关？按 [E] 确认传送。'], () => {
      // On all complete (E pressed after reading)
      this.uiManager.closeWindow(windowObj);
      this.activeDialogueWindow = null;
      this.dialoguing = false;
      this.startLevelTransition();
    });
  },

  startLevelTransition() {
    // Fade out
    this.cameras.main.fadeOut(500, 0, 0, 0);
    this.cameras.main.once('camerafadeoutcomplete', () => {
      const gs = this.registry.get('gameState');
      gs.currentLevel = this.currentLevel + 1;
      gs.keysCollected = 0; // Reset keys for new level
      gs.collectedItems = []; // Reset collected items for new level
      this.registry.set('gameState', gs);

      // Clear saved position so new level uses its own start
      this.registry.remove('savedPlayerData');

      if (this.currentLevel + 1 < levelData.length) {
        this.loadLevel(this.currentLevel + 1);
        this.cameras.main.fadeIn(500, 0, 0, 0);
      } else {
        // No more levels - victory
        this.handleVictory();
      }
    });
  },

  handleItemPickup(item) {
    if (item.isCollected) return;
    const result = item.collect();
    if (result) {
      // Use full item definition from items.json for proper stacking/type
      const fullData = itemData.items[item.type] || result;
      const qty = item.spawnQuantity || 1;
      this.inventory.addItem(fullData, qty);

      // Floating text for gold pickup
      if (fullData.type === 'currency' && this.player) {
        const goldAmount = (fullData.value || 0) * qty;
        if (goldAmount > 0) {
          const goldText = this.add.text(
            this.player.sprite.x, this.player.sprite.y - 20,
            `+${goldAmount} Gold`,
            { fontSize: '12px', fill: '#ffd700', fontFamily: 'Courier New',
              fontStyle: 'bold', stroke: '#000000', strokeThickness: 2 }
          ).setOrigin(0.5).setDepth(200);
          this.tweens.add({
            targets: goldText, y: goldText.y - 30, alpha: 0,
            duration: 1000,
            onComplete: () => goldText.destroy()
          });
        }
      }

      const gs = this.registry.get('gameState');
      if (item.id) {
        gs.collectedItems.push(item.id);
        this.registry.set('gameState', gs);
      }
      const idx = this.items.indexOf(item);
      if (idx > -1) this.items.splice(idx, 1);

      // Rarity notification for rare+ equipment
      const rarityOrder = ['common', 'uncommon', 'rare', 'epic', 'legendary'];
      if (fullData.type === 'equipment' && rarityOrder.indexOf(fullData.rarity) >= 2) {
        const color = fullData.rarity === 'legendary' ? 0xffaa00 : fullData.rarity === 'epic' ? 0xaa44aa : 0x4444ff;
        this.showQuickMessage(`获得了 ${fullData.name}！`, color);
      }
    }
  },

  handleEnemyContact(enemy) {
    if (this.player.isInvulnerable || this.player.state === PlayerState.DEAD) return;
    if (enemy.state === EnemyState.DEAD) return;
    this.player.takeDamage(enemy.getAttack(), enemy.sprite.x, enemy.sprite.y);
  },

  handleAttackHit(enemy) {
    if (!this.player.attackHitbox.body.enable) return;
    if (this.player.attackHitRegistered) return;
    if (enemy.isInvulnerable || enemy.state === EnemyState.DEAD) return;
    enemy.takeDamage(this.player.getAttack(), this.player.sprite.x, this.player.sprite.y);
    this.player.onAttackHit();
    // Disable hitbox immediately after hit to prevent same-frame duplicates
    this.player.attackHitbox.body.enable = false;
  },

  handleSkillHit(enemy) {
    if (!this.player.skillHitbox.body.enable) return;
    if (enemy.isInvulnerable || enemy.state === EnemyState.DEAD) return;

    const skillEngine = this.player.skillEngine;
    const skill = skillEngine.getActiveSkill();
    if (!skill) return;

    if (skill.effect.type === 'dash') {
      // Charge: single-hit per enemy
      if (skillEngine.hasHitTarget(enemy)) return;
      skillEngine.markTargetHit(enemy);

      const damage = Math.floor(this.player.getAttack() * skill.effect.damageMultiplier);
      enemy.takeDamage(damage, this.player.sprite.x, this.player.sprite.y);

      // Stun
      if (skill.effect.stun) {
        enemy.setState(EnemyState.HURT);
        enemy.sprite.setVelocity(0, 0);
        enemy.attackCooldown = skill.effect.stun;
        this.time.delayedCall(skill.effect.stun, () => {
          if (enemy.hp > 0 && enemy.state === EnemyState.HURT) {
            enemy.setState(EnemyState.CHASE);
          }
        });
      }

      // Extra knockback
      if (skill.effect.knockback) {
        enemy.applyKnockback(this.player.sprite.x, this.player.sprite.y, skill.effect.knockback);
      }

      // Camera shake on hit
      if (skill.effect.cameraShake) {
        this.events.emit('screenShake', skill.effect.cameraShake.intensity, skill.effect.cameraShake.duration);
      }

      // Hit-stop
      this.events.emit('hitStop', 50);

      // Rage gain
      this.player.addRage(8);

      // Flash player sprite white
      this.player.sprite.setTint(0xffffff);
      this.time.delayedCall(100, () => {
        if (this.player.sprite) this.player.sprite.clearTint();
      });

    } else if (skill.effect.type === 'spin') {
      // Whirlwind: multi-hit with reduced enemy i-frames
      const damage = Math.floor(this.player.getAttack() * skill.effect.damageMultiplier);

      // Temporarily reduce enemy i-frames for whirlwind hits
      const originalIFrames = enemy.iFramesDuration;
      enemy.iFramesDuration = 180;
      enemy.takeDamage(damage, this.player.sprite.x, this.player.sprite.y);
      enemy.iFramesDuration = originalIFrames;

      this.events.emit('screenShake', 2, 50);
      this.player.addRage(4);
    }
  },

  handleBreakableHit(b) {
    if (!this.player.attackHitbox.body.enable || b.isBroken || this.player.attackHitRegistered) return;
    b.hp--;
    this.player.onAttackHit();
    this.screenShakeIntensity = 3;
    this.screenShakeTimer = 60;
    this.tweens.add({
      targets: b, scaleX: 0.8, scaleY: 1.2, duration: 50, yoyo: true,
      onComplete: () => {
        if (b.hp <= 0) {
          b.isBroken = true;
          this.events.emit('enemyDropLoot', 'barrel', b.x, b.y);
          this.tweens.add({
            targets: b, alpha: 0, scaleX: 0, scaleY: 0, duration: 300,
            onComplete: () => b.destroy()
          });
        }
      }
    });
  },

  handleNPCProximity(npc) {
    if (this.dialoguing) return;
    const sprite = npc.sprite || npc;
    this.player.setInteractTarget(sprite);
  },

  handleNPCDialogue(npc) {
    if (this.dialoguing) return;
    if (npc.isDialoguing) return;

    // Get all dialogues for pagination
    const dialogues = npc.dialogues || [npc.getNextDialogue()];
    if (npc.setTalking) npc.setTalking(true);
    this.dialoguing = true;
    this.activeDialogueNpc = npc;

    const windowObj = this.uiManager.createDialogueWindow();
    this.activeDialogueWindow = windowObj;

    this.uiManager.openWindow(windowObj, npc.name || '???', dialogues, () => {
      // All pages read - auto close
      if (npc.setTalking) npc.setTalking(false);
      this.dialoguing = false;
      this.activeDialogueWindow = null;
      this.activeDialogueNpc = null;
    });
  },

  closeCurrentDialogue() {
    if (this.activeDialogueWindow) {
      this.uiManager.closeWindow(this.activeDialogueWindow);
      this.activeDialogueWindow = null;
    }
    if (this.activeDialogueNpc && this.activeDialogueNpc.setTalking) {
      this.activeDialogueNpc.setTalking(false);
    }
    this.activeDialogueNpc = null;
    this.dialoguing = false;
  },

  handleTriggerZone(zone) {
    if (zone.triggered || this.dialoguing) return;
    zone.triggered = true;
    this.showQuickMessage(zone.triggerMessage);
  },

  handleVictoryZone() {
    const gs = this.registry.get('gameState');
    if (gs.hasArtifact) this.handleVictory();
  },

  handleVictory() {
    SaveSystem.save(this);
    this.physics.pause();
    this.time.delayedCall(500, () => this.scene.start('VictoryScene'));
  },

  handleGameOver() {
    this.physics.pause();
    this.time.delayedCall(1000, () => this.scene.start('GameOverScene'));
  }
};
