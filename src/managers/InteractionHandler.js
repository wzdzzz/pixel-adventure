import { TEXTURES } from '../assets/AssetManager.js';
import { PlayerState } from '../entities/Player.js';
import { EnemyState } from '../entities/Enemy.js';
import { SaveSystem } from '../systems/SaveSystem.js';
import { levelData } from '../data/levels.js';
import itemData from '../data/items.json';
import { getEffectTemplate } from '../data/statusEffects.js';
import { getLevelSuppression } from '../data/monsterScaling.js';

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

    // 标记宝箱到世界状态（持久化）
    if (this.worldState && chest.entityId) {
      this.worldState.markChestOpened(chest.entityId);
    }

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

    // 飘字显示奖励，在箱子上方而非屏幕中央
    if (this.floatingText) {
      const cx = chest.sprite.x;
      const cy = chest.sprite.y - 16;
      this.floatingText.spawn(cx, cy, `+${chest.reward.score} 分`, {
        color: '#ffdd44', fontSize: 14, bold: true
      });
      if (chest.reward.healAmount > 0) {
        this.floatingText.spawn(cx, cy - 16, `+${chest.reward.healAmount} HP`, {
          color: '#66ff66', fontSize: 12, prefix: ''
        });
      }
    }
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
    // 在销毁旧玩家前快照当前状态
    const playerSnapshot = this.player ? {
      stats: this.player.stats.toJSON(),
      hp: this.player.hp,
      stamina: this.player.stamina,
      mana: this.player.mana,
      rage: this.player.rage,
      skillSlots: this.player.skillSlots ? this.player.skillSlots.slice() : null,
      skillEngine: this.player.skillEngine ? this.player.skillEngine.toJSON() : null,
    } : null;

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

        // 恢复玩家状态（等级/属性/技能/装备加成）
        if (playerSnapshot && this.player) {
          // 1) 恢复 base stats（升级获得的属性点）
          Object.keys(playerSnapshot.stats.base).forEach(key => {
            this.player.stats.setBase(key, playerSnapshot.stats.base[key]);
          });

          // 2) 等级系统 HP 加成
          const lvlHp = this.levelSystem ? (this.levelSystem.level - 1) * 5 : 0;
          this.player.stats.setFlatBonus('maxHp', lvlHp);

          // 3) 重新计算装备加成（装备系统在 scene 级别持久，只需重算）
          if (this.equipmentSystem) {
            this.equipmentSystem._applyBonuses();
          }

          // 4) 刷新属性缓存
          this.player.stats.invalidate();
          this.player.refreshStats();

          // 5) 恢复资源（HP 回满 or 延续，这里选择延续当前值）
          this.player.hp = Math.min(playerSnapshot.hp, this.player.maxHp);
          this.player.stamina = Math.min(playerSnapshot.stamina, this.player.maxStamina);
          this.player.mana = Math.min(playerSnapshot.mana, this.player.maxMana);
          this.player.rage = Math.min(playerSnapshot.rage, this.player.maxRage);

          // 6) 恢复技能槽配置
          if (playerSnapshot.skillSlots && this.player.skillSlots) {
            for (let i = 0; i < this.player.skillSlots.length && i < playerSnapshot.skillSlots.length; i++) {
              this.player.skillSlots[i] = playerSnapshot.skillSlots[i] || null;
            }
            this.events.emit('skillSlotsChanged', this.player.skillSlots.slice());
          }

          // 7) 恢复技能引擎状态（已解锁技能等）
          if (playerSnapshot.skillEngine && this.player.skillEngine) {
            this.player.skillEngine.fromJSON(playerSnapshot.skillEngine);
          }

          // 8) 刷新 UI
          this.player.onHpChanged();
          if (this.player.onResourceChanged) this.player.onResourceChanged();
        }

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
      // 装备实例：直接用挂载的完整实例数据入背包
      const fullData = item.equipmentInstance || itemData.items[item.type] || result;
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

      // 装备拾取提示（所有品质）
      if (fullData.type === 'equipment') {
        const rarityColors = {
          common: 0xaaaaaa, uncommon: 0x44aa44, rare: 0x4444ff,
          epic: 0xaa44aa, legendary: 0xffaa00, mythic: 0xff4444
        };
        const color = rarityColors[fullData.rarity] || 0xaaaaaa;
        this.showQuickMessage(`获得了 ${fullData.name}！`, color);
      }
    }
  },

  handleEnemyContact(enemy) {
    // 接触不再造成伤害（敌人改用技能造伤），仅保留物理碰撞推开
  },

  handleAttackHit(enemy) {
    if (!this.player.attackHitbox.body.enable) return;
    if (this.player.attackHitRegistered) return;
    if (enemy.isInvulnerable || enemy.state === EnemyState.DEAD) return;
    const baseDmg = this.player.getAttack();
    const playerLevel = this.player.levelSystem?.level || 1;
    const suppressMult = getLevelSuppression(playerLevel, enemy.finalLevel || 1);
    const finalDmg = Math.round(baseDmg * suppressMult);
    enemy.takeDamage(finalDmg, this.player.sprite.x, this.player.sprite.y);
    if (this.triggerSystem) {
      this.triggerSystem.fire('onHit', { enemy, damage: finalDmg });
      if (enemy.hp <= 0) this.triggerSystem.fire('onKill', { enemy });
    }
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

    const effectType = skill.effect.type;

    // ─── Single-hit types: dash, melee, leap ───
    if (effectType === 'dash' || effectType === 'melee') {
      if (skillEngine.hasHitTarget(enemy)) return;
      skillEngine.markTargetHit(enemy);

      let damageMultiplier = skill.effect.damageMultiplier;

      // Execute: bonus damage when target HP low
      if (skill.effect.executeThreshold && enemy.hp / enemy.maxHp < skill.effect.executeThreshold) {
        damageMultiplier *= skill.effect.executeMultiplier;
      }

      // 蓄力技能：按蓄力比例缩放伤害
      const chargeRatio = (skill.effect.chargeable && this.player._chargeRatio) ? this.player._chargeRatio : 1.0;
      let damage = Math.floor(this.player.getAttack() * damageMultiplier * chargeRatio);
      const playerLevel = this.player.levelSystem?.level || 1;
      const suppressMult = getLevelSuppression(playerLevel, enemy.finalLevel || 1);
      damage = Math.round(damage * suppressMult);

      // Apply lifesteal from status effects + equipment flatBonuses
      const mods = this.player.statusEffects.getModifiers();
      const buffLs = mods.lifesteal || 0;
      const eqLs = this.player.stats.flatBonuses?.lifesteal || 0;
      const totalLs = buffLs + eqLs;
      if (totalLs > 0) {
        this.player.heal(Math.floor(damage * totalLs));
      }

      // 仅技能 effect.stagger > 0 时造成僵直（普攻无僵直）
      const skillStagger = skill.effect.stagger || 0;
      enemy.takeDamage(damage, this.player.sprite.x, this.player.sprite.y, skillStagger);

      if (this.triggerSystem) {
        this.triggerSystem.fire('onHit', { enemy, damage });
        if (enemy.hp <= 0) this.triggerSystem.fire('onKill', { enemy });
      }

      // Apply status effects from skill (bleed, armorBreak, slow, etc.)
      if (skill.effect.applyEffects) {
        this.applySkillEffects(enemy, skill.effect.applyEffects);
      }

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

      // 击退仅在技能显式声明 dedicatedKnockback 时生效（避免每次攻击都击退）
      if (skill.effect.dedicatedKnockback && skill.effect.knockback) {
        enemy.applyKnockback(this.player.sprite.x, this.player.sprite.y, skill.effect.knockback);
      }

      // Camera shake
      if (skill.effect.cameraShake) {
        this.events.emit('screenShake', skill.effect.cameraShake.intensity, skill.effect.cameraShake.duration);
      }

      this.events.emit('hitStop', 50);
      this.player.addRage(8);

      // Flash
      this.player.sprite.setTint(0xffffff);
      this.time.delayedCall(100, () => {
        if (this.player.sprite) this.player.sprite.clearTint();
      });
    }
    // ─── Multi-hit: spin ───
    else if (effectType === 'spin') {
      let damage = Math.floor(this.player.getAttack() * skill.effect.damageMultiplier);
      const playerLevel = this.player.levelSystem?.level || 1;
      const suppressMult = getLevelSuppression(playerLevel, enemy.finalLevel || 1);
      damage = Math.round(damage * suppressMult);

      const originalIFrames = enemy.iFramesDuration;
      enemy.iFramesDuration = 180;
      // spin 类多段连击不打僵直，避免持续锁死
      enemy.takeDamage(damage, this.player.sprite.x, this.player.sprite.y, 0);
      enemy.iFramesDuration = originalIFrames;

      if (this.triggerSystem) {
        this.triggerSystem.fire('onHit', { enemy, damage });
        if (enemy.hp <= 0) this.triggerSystem.fire('onKill', { enemy });
      }

      this.events.emit('screenShake', 2, 50);
      this.player.addRage(4);
    }
    // buff/taunt: no hitbox, shouldn't reach here
  },

  /**
   * 把技能的 applyEffects 数组转化为 StatusEffectSystem 的 apply 调用。
   * 自动从 STATUS_EFFECTS 模板拼出 type/tickInterval/maxStacks，
   * 对 DoT 类型自动绑 onTick 通过 source.getAttack() × damagePerTick × stacks 造成伤害。
   */
  applySkillEffects(target, applyEffects) {
    const source = this.player;
    for (const effectDef of applyEffects) {
      if (Math.random() >= (effectDef.chance ?? 1.0)) continue;

      const tpl = getEffectTemplate(effectDef.effectId) || {};
      const config = {
        id: effectDef.effectId,
        type: tpl.type || 'debuff',
        duration: effectDef.duration ?? tpl.duration ?? 3000,
        tickInterval: tpl.tickInterval || 0,
        maxStacks: effectDef.maxStacks ?? tpl.maxStacks ?? 1,
        refreshable: tpl.refreshable !== false,
        modifiers: effectDef.modifiers || tpl.modifiers || null,
        source,
        icon: tpl.icon || '✨',
        name: tpl.name || effectDef.effectId
      };

      // DoT：拼出 onTick 回调（按施加者攻击力 × 每跳系数 × 层数）
      if (tpl.type === 'dot' && tpl.damagePerTick) {
        const dpt = tpl.damagePerTick;
        config.onTick = (actor, stacks) => {
          if (!source) return;
          const dmg = source.getAttack() * dpt * stacks;
          actor.takeTickDamage(dmg);
        };
      }

      target.statusEffects.apply(effectDef.effectId, config);
    }
  },

  handleBreakableHit(b, fromSkill = false) {
    if (b.isBroken) return;
    if (!fromSkill) {
      // 普攻：受 attackHitRegistered 单次保护
      if (!this.player.attackHitbox.body.enable || this.player.attackHitRegistered) return;
      this.player.onAttackHit();
    } else {
      // 技能：仅检查 hitbox 启用；不限制单次命中（让多帧 overlap 累计破坏 hp>1 的木桶）
      if (!this.player.skillHitbox.body.enable) return;
    }
    b.hp--;
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

  handleBonfireInteraction(bonfire) {
    if (!this.worldState) return;

    // 标记当前篝火所在 chunk 为已探索（确保传送解锁）
    if (this.chunkManager && bonfire.x != null) {
      const cx = Math.floor(bonfire.x / 1024);
      const cy = Math.floor(bonfire.y / 1024);
      const chunkKey = `${cx},${cy}`;
      this.worldState.markChunkExplored(chunkKey);
    }

    // 篝火休息：重置世界状态（魂系重生）
    this.worldState.restAtBonfire();

    // 回满 HP/MP/体力
    const player = this.player;
    if (player) {
      player.hp = player.maxHp;
      if (player.mana !== undefined) player.mana = player.maxMana;
      if (player.stamina !== undefined) player.stamina = player.maxStamina;
      player.onHpChanged();
      if (player.onResourceChanged) player.onResourceChanged();
    }

    // 重新加载所有活跃 Chunk 的实体（怪物重生）
    if (this.chunkManager?.respawnAllEntities) {
      // 先清理所有已生成的 GameObjects
      this._despawnAllWorldEntities();
      // 重新生成实体描述符
      this.chunkManager.respawnAllEntities();
      // 重新实例化 GameObjects
      for (const [key] of this.chunkManager.activeChunks) {
        const [cx, cy] = key.split(',').map(Number);
        this._spawnChunkEntities(cx, cy);
      }
    }

    // 自动存档
    SaveSystem.save(this);

    this.events.emit('showMessage', '在篝火旁休息...怪物已重生');
    this.events.emit('bonfireRest');

    console.log('[InteractionHandler] 篝火休息完成');
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
