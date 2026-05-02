import Phaser from 'phaser';
import { GAME_CONFIG } from '../config/gameConfig.js';
import { PlayerState } from '../entities/Player.js';
import { Item } from '../entities/Item.js';
import { InventorySystem } from '../systems/InventorySystem.js';
import { SaveSystem } from '../systems/SaveSystem.js';
import { UIManager } from '../systems/UIManager.js';
import { LevelSystem } from '../systems/LevelSystem.js';
import { EquipmentSystem } from '../systems/EquipmentSystem.js';
import { SkillTreeSystem } from '../systems/SkillTreeSystem.js';
import { QuestSystem } from '../systems/QuestSystem.js';
import { LootEngine } from '../systems/LootEngine.js';
import { WarFog } from '../systems/WarFog.js';
import { FloatingTextManager } from '../systems/FloatingTextManager.js';
import { levelData } from '../data/levels.js';
import itemData from '../data/items.json';
import { LevelBuilder } from '../managers/LevelBuilder.js';
import { InteractionHandler } from '../managers/InteractionHandler.js';

export class MainGameScene extends Phaser.Scene {
  constructor() {
    super({ key: 'MainGameScene' });
    this.currentLevel = 0;
    this.player = null;
    this.enemies = [];
    this.items = [];
    this.npcs = [];
    this.walls = null;
    this.obstacles = null;
    this.breakables = [];
    this.triggerZones = [];
    this.chests = [];
    this.decorations = null;
    this.groundTiles = null;
    this.portalSprite = null;
    this.portalActivated = false;

    this.hitStopTimer = 0;
    this.screenShakeIntensity = 0;
    this.screenShakeTimer = 0;
    this.dialoguing = false;
    this.activeDialogueWindow = null;
    this.activeDialogueNpc = null;
  }

  create() {
    this.inventory = new InventorySystem(this);
    this.uiManager = new UIManager(this);
    this.floatingText = new FloatingTextManager(this);
    this.levelSystem = new LevelSystem(this);
    this.registry.set('levelSystem', this.levelSystem);
    this.equipmentSystem = new EquipmentSystem(this);
    this.registry.set('equipmentSystem', this.equipmentSystem);
    this.skillTreeSystem = new SkillTreeSystem(this);
    this.registry.set('skillTreeSystem', this.skillTreeSystem);
    this.questSystem = new QuestSystem(this);
    this.registry.set('questSystem', this.questSystem);

    // 若有待加载存档：先读 meta 决定职业/性别/当前关卡，确保 createPlayer 用正确的职业
    const pendingSlot = this.registry.get('pendingLoadSlot');
    if (pendingSlot) {
      const info = SaveSystem.getSaveInfo(pendingSlot);
      if (info) {
        this.registry.set('classType', info.classType);
        this.registry.set('gender', info.gender);
        const gs0 = this.registry.get('gameState') || {};
        gs0.currentLevel = info.currentLevel ?? 0;
        this.registry.set('gameState', gs0);
        // 清空过时的 savedPlayerData，避免 createPlayer 用旧位置/HP
        this.registry.remove('savedPlayerData');
      }
    }

    const gs = this.registry.get('gameState');
    this.currentLevel = gs.currentLevel || 0;

    this.loadLevel(this.currentLevel);
    this.tryLoadSave();
    this.setupEvents();

    // Panel toggle keys
    this.tabKey = this.input.keyboard.addKey(Phaser.Input.Keyboard.KeyCodes.TAB);
    this.iKey = this.input.keyboard.addKey(Phaser.Input.Keyboard.KeyCodes.I);
    this.escKey = this.input.keyboard.addKey(Phaser.Input.Keyboard.KeyCodes.ESC);
    this.gamePaused = false;
    this._exitConfirm = null;

    const openPanel = () => {
      if (this.scene.isActive('PanelScene') || this.gamePaused) return;
      this.pauseGame();
      this.scene.launch('PanelScene');
      this.scene.bringToTop('PanelScene');
    };

    this.tabKey.on('down', (event) => {
      if (event.originalEvent) event.originalEvent.preventDefault();
      openPanel();
    });
    this.iKey.on('down', () => openPanel());

    // ESC：显示返回主菜单确认
    this.escKey.on('down', () => {
      if (this.scene.isActive('PanelScene')) return; // 面板自己处理
      if (this.dialoguing) return;
      if (this._exitConfirm) {
        this._closeExitConfirm();
      } else {
        this._showExitConfirm();
      }
    });

    // F：浏览器真全屏切换（需用户按键触发，浏览器才允许）
    this.fKey = this.input.keyboard.addKey(Phaser.Input.Keyboard.KeyCodes.F);
    this.fKey.on('down', () => {
      if (this.scale.isFullscreen) this.scale.stopFullscreen();
      else this.scale.startFullscreen();
    });

    this.time.addEvent({
      delay: 30000,
      callback: () => SaveSystem.save(this),
      loop: true
    });
  }

  loadLevel(levelIndex) {
    this.currentLevel = levelIndex;
    const level = levelData[levelIndex];
    if (!level) return;

    this.cleanupLevel();

    this.createMap(level);
    this.createPlayer(level);
    this.createEnemies(level);
    this.createItems(level);
    this.createNPCs(level);
    this.createBreakables();
    this.createTriggerZones();
    this.createHelpSigns(level);
    this.setupCollisions();
    this.setupCamera();

    // War fog disabled for now
    // this.warFog = new WarFog(this, { radius: 180, alpha: 0.7 });

    // Emit level change to UI
    this.events.emit('levelChanged', level.name, levelIndex);

    // Activate quests for this level
    if (this.questSystem) {
      this.questSystem.activateQuestsForLevel(levelIndex);
    }
  }

  cleanupLevel() {
    // Destroy existing entities
    if (this.player) { this.player.destroy(); this.player = null; }
    this.enemies.forEach(e => e.destroy());
    this.enemies = [];
    this.items.forEach(i => { if (i.sprite) i.sprite.destroy(); });
    this.items = [];
    this.npcs.forEach(n => { if (n.destroy) n.destroy(); else if (n.sprite) n.sprite.destroy(); });
    this.npcs = [];
    this.breakables.forEach(b => { if (b && b.destroy) b.destroy(); });
    this.breakables = [];
    this.triggerZones.forEach(z => { if (z && z.destroy) z.destroy(); });
    this.triggerZones = [];
    this.chests.forEach(c => { if (c.sprite) c.sprite.destroy(); if (c.label) c.label.destroy(); });
    this.chests = [];

    if (this.portalSprite) { this.portalSprite.destroy(); this.portalSprite = null; }
    if (this.portalLabel) { this.portalLabel.destroy(); this.portalLabel = null; }
    if (this.portalGlow) { this.portalGlow.destroy(); this.portalGlow = null; }

    // Destroy map groups safely — Phaser may have already destroyed internals on scene restart
    const safelyClearGroup = (group) => {
      try { if (group && group.children) group.clear(true, true); } catch (_) {}
    };
    safelyClearGroup(this.walls);    this.walls = null;
    safelyClearGroup(this.obstacles); this.obstacles = null;
    safelyClearGroup(this.decorations); this.decorations = null;
    safelyClearGroup(this.groundTiles); this.groundTiles = null;

    if (this.endZone) { this.endZone.destroy(); this.endZone = null; }
    if (this.warFog) { this.warFog.destroy(); this.warFog = null; }

    // Close dialogues
    if (this.uiManager) this.uiManager.closeAllWindows();
    this.dialoguing = false;
    this.activeDialogueWindow = null;
    this.activeDialogueNpc = null;
    this.portalActivated = false;
  }

  setupCollisions() {
    this.physics.add.collider(this.player.sprite, this.walls);
    this.physics.add.collider(this.player.sprite, this.obstacles);

    this.decorations.getChildren().forEach(d => {
      if (d.body) this.physics.add.collider(this.player.sprite, d);
    });

    this.enemies.forEach(enemy => {
      this.physics.add.collider(enemy.sprite, this.walls);
      this.physics.add.collider(enemy.sprite, this.obstacles);
      // Enemies also blocked by decorations (trees, water, fences, etc.)
      this.decorations.getChildren().forEach(d => {
        if (d.body) this.physics.add.collider(enemy.sprite, d);
      });
      // Enemies blocked by breakables
      this.breakables.forEach(b => {
        this.physics.add.collider(enemy.sprite, b);
      });
    });

    // Enemy-enemy collision — prevent stacking
    for (let i = 0; i < this.enemies.length; i++) {
      for (let j = i + 1; j < this.enemies.length; j++) {
        this.physics.add.collider(this.enemies[i].sprite, this.enemies[j].sprite);
      }
    }

    this.items.forEach(item => {
      this.physics.add.overlap(this.player.sprite, item.sprite, () => this.handleItemPickup(item), null, this);
    });

    this.enemies.forEach(enemy => {
      this.physics.add.collider(
        this.player.sprite, enemy.sprite,
        () => this.handleEnemyContact(enemy),
        // Process callback: controls whether collision is applied
        (playerSprite, enemySprite) => {
          // During charge dash: pass through enemies (no collision)
          if (this.player.state === PlayerState.SKILL_CASTING) {
            const activeSkill = this.player.skillEngine.getActiveSkill();
            if (activeSkill && activeSkill.effect.type === 'dash') {
              return false;
            }
          }
          // Normal collision: block each other, neither pushes
          // Player pushable=false is set in constructor;
          // enemy pushable=false here, reset to true each frame in update()
          enemySprite.body.pushable = false;
          return true;
        },
        this
      );
      this.physics.add.overlap(this.player.attackHitbox, enemy.sprite, () => this.handleAttackHit(enemy), null, this);
      // Skill hitbox overlaps (charge, whirlwind)
      this.physics.add.overlap(this.player.skillHitbox, enemy.sprite, () => this.handleSkillHit(enemy), null, this);
    });

    this.npcs.forEach(npc => {
      const sprite = npc.sprite || npc;
      this.physics.add.overlap(this.player.sprite, sprite, () => this.handleNPCProximity(npc), null, this);
    });

    this.breakables.forEach(b => {
      this.physics.add.collider(this.player.sprite, b);
      this.physics.add.overlap(this.player.attackHitbox, b, () => this.handleBreakableHit(b), null, this);
      // 技能 hitbox 也能破坏
      this.physics.add.overlap(this.player.skillHitbox, b, () => this.handleBreakableHit(b, true), null, this);
    });

    this.triggerZones.forEach(zone => {
      this.physics.add.overlap(this.player.sprite, zone, () => this.handleTriggerZone(zone), null, this);
    });

    // Chests
    this.chests.forEach(chest => {
      this.physics.add.overlap(this.player.sprite, chest.sprite, () => this.handleChestProximity(chest), null, this);
    });

    // Portal
    if (this.portalSprite) {
      this.physics.add.overlap(this.player.sprite, this.portalSprite, () => this.handlePortalProximity(), null, this);
    }

    // End zone (level 2)
    if (this.endZone) {
      this.physics.add.overlap(this.player.sprite, this.endZone, () => this.handleVictoryZone(), null, this);
    }
  }

  setupCamera() {
    const mapData = this.mapData;
    const mapWidth = mapData[0].length * GAME_CONFIG.MAP.TILE_SIZE;
    const mapHeight = mapData.length * GAME_CONFIG.MAP.TILE_SIZE;
    this.cameras.main.startFollow(this.player.sprite, true, 0.1, 0.1);
    this.cameras.main.setBounds(0, 0, mapWidth, mapHeight);
    this.cameras.main.setDeadzone(80, 60);
  }

  setupEvents() {
    this.events.on('playerInteract', (target) => {
      if (this.dialoguing) {
        // If dialogue is open, advance page
        if (this.activeDialogueWindow) {
          const closed = this.uiManager.advancePage(this.activeDialogueWindow);
          if (closed) {
            if (this.activeDialogueNpc && this.activeDialogueNpc.setTalking) {
              this.activeDialogueNpc.setTalking(false);
            }
            this.activeDialogueNpc = null;
            this.activeDialogueWindow = null;
            this.dialoguing = false;
          }
        }
        return;
      }

      const npcInst = target.npcInstance || target;

      // Check if it's a chest
      if (target.chestInstance) {
        this.handleChestInteract(target.chestInstance);
        return;
      }

      // Check if it's a portal
      if (target.portalInstance) {
        this.handlePortalInteract();
        return;
      }

      if (npcInst && typeof npcInst.getNextDialogue === 'function') {
        this.handleNPCDialogue(npcInst);
      }
    });

    // 敌人技能 hitbox 生成 → 与 player 注册 overlap
    this.events.off('enemyHitboxSpawned');
    this.events.on('enemyHitboxSpawned', (hitbox, lifetime) => {
      if (!hitbox || !this.player) return;
      this.enemyHitboxes = this.enemyHitboxes || [];
      this.enemyHitboxes.push(hitbox);
      const overlap = this.physics.add.overlap(this.player.sprite, hitbox, () => {
        const dmg = hitbox._enemySkillDamage || 0;
        const owner = hitbox._enemyOwner;
        if (this.player && dmg > 0 && !this.player.isInvulnerable) {
          this.player.takeDamage(dmg, owner?.sprite?.x, owner?.sprite?.y);
        }
        hitbox.body.enable = false;
      });
      // 到期清理
      this.time.delayedCall(lifetime || 200, () => {
        if (overlap) this.physics.world.removeCollider(overlap);
        const idx = this.enemyHitboxes?.indexOf(hitbox);
        if (idx >= 0) this.enemyHitboxes.splice(idx, 1);
        if (hitbox.active) hitbox.destroy();
      });
    });

    // 敌人弹道生成 → 与 player 注册 overlap + 加入 update 列表
    this.events.off('enemyProjectileSpawned');
    this.enemyProjectiles = this.enemyProjectiles || [];
    this.events.on('enemyProjectileSpawned', (proj) => {
      if (!proj || !this.player) return;
      this.enemyProjectiles.push(proj);
      this.physics.add.overlap(this.player.sprite, proj.sprite, () => {
        if (this.player && !this.player.isInvulnerable) {
          proj.onHit(this.player);
        }
      });
    });

    this.events.on('enemyDeath', (enemy) => {
      const idx = this.enemies.indexOf(enemy);
      if (idx > -1) this.enemies.splice(idx, 1);
      const g = this.registry.get('gameState');
      g.score += 20;
      this.registry.set('gameState', g);
      this.events.emit('scoreChanged', g.score);

      // Grant XP for kill
      let xpAmount = 0;
      if (this.levelSystem) {
        xpAmount = this.levelSystem.getEnemyXp(enemy.config);
        this.levelSystem.addXp(xpAmount, enemy.config.level || 1);
      }

      // Show XP floating text
      if (enemy.sprite && xpAmount > 0) {
        const xpText = this.add.text(
          enemy.sprite.x, enemy.sprite.y - 20,
          `+${xpAmount} XP`, {
            fontSize: '12px', fill: '#aa88ff', fontFamily: 'Courier New', fontStyle: 'bold'
          }
        ).setOrigin(0.5).setDepth(100);

        this.tweens.add({
          targets: xpText, y: xpText.y - 30, alpha: 0,
          duration: 1200,
          onComplete: () => xpText.destroy()
        });
      }
    });

    this.events.on('enemyDropLoot', (enemyId, x, y) => {
      const dropBonus = this.player ? this.player.stats.getDerived().dropBonus : 0;
      const drops = LootEngine.roll(enemyId, dropBonus);

      drops.forEach((drop, i) => {
        // Scatter drops in a circle to prevent stacking
        const angle = (Math.PI * 2 / Math.max(drops.length, 1)) * i + Math.random() * 0.5;
        const dist = 20 + Math.random() * 15;
        const dx = x + Math.cos(angle) * dist;
        const dy = y + Math.sin(angle) * dist;

        this.events.emit('spawnItem', drop.itemData.id, dx, dy, drop.quantity);

        // Rarity glow for equipment drops
        if (drop.itemData.type === 'equipment') {
          const rarityGlowColors = {
            uncommon: 0x44aa44, rare: 0x4444ff, epic: 0xaa44aa, legendary: 0xffaa00
          };
          const glowColor = rarityGlowColors[drop.itemData.rarity];
          if (glowColor) {
            const glow = this.add.circle(dx, dy, 14, glowColor, 0.3).setDepth(0);
            this.tweens.add({
              targets: glow, alpha: 0.1, duration: 800, yoyo: true, repeat: -1
            });
            // Auto-destroy glow after 60 seconds
            this.time.delayedCall(60000, () => { if (glow.active) glow.destroy(); });
          }
        }

        // Legendary drop notification
        if (drop.itemData.rarity === 'legendary') {
          const msg = this.add.text(
            this.cameras.main.width / 2, 60,
            `传说装备掉落: ${drop.itemData.name}`,
            {
              fontSize: '16px', fill: '#ffaa00', fontFamily: 'Courier New',
              fontStyle: 'bold', stroke: '#000000', strokeThickness: 3
            }
          ).setOrigin(0.5).setScrollFactor(0).setDepth(300);

          this.tweens.add({
            targets: msg, alpha: 0, y: msg.y - 20,
            duration: 3000, delay: 1500,
            onComplete: () => msg.destroy()
          });
        }
      });
    });

    this.events.on('spawnItem', (type, x, y, quantity = 1) => {
      const config = itemData.items[type];
      if (config) {
        const item = new Item(this, x, y, type, {
          id: `${type}_${Date.now()}_${Math.random().toString(36).substr(2, 4)}`,
          ...config,
          spawnQuantity: quantity,
          onCollect: (item) => {
            if (type === 'coin') {
              const g = this.registry.get('gameState');
              g.score += item.value * quantity;
              this.registry.set('gameState', g);
              this.events.emit('scoreChanged', g.score);
            } else if (type === 'potion' || type === 'heart') {
              // Consumable items handled by inventory
            }
          }
        });
        this.items.push(item);
        this.physics.add.overlap(this.player.sprite, item.sprite, () => this.handleItemPickup(item), null, this);
      }
    });

    this.events.on('playerDeath', () => this.handleGameOver());
    this.events.on('hitStop', (d) => this.startHitStop(d));

    // 飘字伤害/治疗（先清旧监听避免场景重启重复）
    this.events.off('actorDamaged');
    this.events.off('actorHealed');
    this.events.on('actorDamaged', (actor, dmg) => {
      if (!actor || !actor.sprite || !this.floatingText) return;
      const isPlayer = actor === this.player;
      const x = actor.sprite.x;
      const y = actor.sprite.y - actor.sprite.displayHeight / 2;
      this.floatingText.spawn(x, y, Math.floor(dmg), {
        color: isPlayer ? '#ff4444' : '#ffeb3b',
        fontSize: isPlayer ? 13 : 12,
        bold: isPlayer
      });
    });

    this.events.on('actorHealed', (actor, amount) => {
      if (!actor || !actor.sprite || !this.floatingText) return;
      const x = actor.sprite.x;
      const y = actor.sprite.y - actor.sprite.displayHeight / 2;
      this.floatingText.spawn(x, y, Math.floor(amount), {
        color: '#66ff66',
        fontSize: 12,
        prefix: '+'
      });
    });
    this.events.on('screenShake', (i, d) => this.startScreenShake(i, d));

    // 装备/系统提示消息（来自 EquipmentSystem 等）
    this.events.off('showMessage');
    this.events.on('showMessage', (text, color) => this.showQuickMessage(text, color));

    // 技能槽位变更：立即保存到 localStorage（避免刷新丢失）
    this.events.on('skillSlotsChanged', () => {
      SaveSystem.save(this);
    });

    this.events.on('levelUp', (level, statPoints, skillPoints) => {
      // Apply level bonus to maxHp: Level*5
      if (this.player) {
        this.player.stats.setFlatBonus('maxHp', (level - 1) * 5);
        this.player.stats.invalidate();
        this.player.refreshStats();

        // Full HP/MP restore
        this.player.hp = this.player.maxHp;
        this.player.mp = this.player.maxMp;
        this.player.onHpChanged();
      }

      // White flash effect
      const flash = this.add.rectangle(
        this.cameras.main.width / 2,
        this.cameras.main.height / 2,
        this.cameras.main.width, this.cameras.main.height,
        0xffffff, 0
      ).setDepth(200).setScrollFactor(0);

      this.tweens.add({
        targets: flash, alpha: 0.6, duration: 150, yoyo: true,
        onComplete: () => flash.destroy()
      });

      // Gold tint on player
      if (this.player && this.player.sprite) {
        this.player.sprite.setTint(0xffd700);
        this.time.delayedCall(1000, () => {
          if (this.player && this.player.sprite) this.player.sprite.clearTint();
        });
      }

      // "LEVEL UP!" floating text
      const lvlText = this.add.text(
        this.cameras.main.width / 2, this.cameras.main.height / 2 - 50,
        `LEVEL UP! LV.${level}`, {
          fontSize: '28px', fill: '#ffd700', fontFamily: 'Courier New', fontStyle: 'bold'
        }
      ).setOrigin(0.5).setDepth(201).setScrollFactor(0);

      this.tweens.add({
        targets: lvlText, y: lvlText.y - 60, alpha: 0,
        scaleX: 1.5, scaleY: 1.5, duration: 2000,
        onComplete: () => lvlText.destroy()
      });
    });

    // Item use handler
    this.events.on('useItem', (itemData) => {
      if (itemData.effect) {
        switch (itemData.effect.type) {
          case 'heal':
            if (this.player) this.player.heal(itemData.effect.amount);
            break;
        }
      }
    });
  }

  showQuickMessage(text) {
    const msg = this.add.text(
      this.cameras.main.width / 2,
      this.cameras.main.height / 2 - 60,
      text,
      { fontSize: '14px', fill: '#ffffff', backgroundColor: '#000000aa', padding: { x: 8, y: 4 }, fontFamily: 'Courier New' }
    ).setOrigin(0.5).setDepth(100).setScrollFactor(0);

    this.tweens.add({
      targets: msg,
      y: msg.y - 30, alpha: 0,
      duration: 1500, delay: 800,
      onComplete: () => msg.destroy()
    });
  }

  startHitStop(duration) {
    this.hitStopTimer = duration;
    this.physics.pause();
  }

  startScreenShake(intensity, duration) {
    this.screenShakeIntensity = intensity;
    this.screenShakeTimer = duration;
  }

  tryLoadSave() {
    // 优先读取 SaveSelectScene 设置的待加载槽位
    const pending = this.registry.get('pendingLoadSlot');
    if (pending) {
      this.registry.set('pendingLoadSlot', null);
      if (SaveSystem.hasSave(pending)) {
        SaveSystem.load(this, pending);
      }
      return;
    }
    // 否则按当前活跃槽（兜底：找第一个有数据的槽）
    const active = this.registry.get('activeSaveSlot') || 1;
    if (SaveSystem.hasSave(active)) {
      SaveSystem.load(this, active);
    }
  }

  pauseGame() {
    this.physics.pause();
    this.gamePaused = true;
  }

  resumeGame() {
    this.physics.resume();
    this.gamePaused = false;
  }

  getInteractionPriority(target) {
    if (target.npcInstance && target.npcInstance.dialogues) return 10;
    if (target.chestInstance) return 8;
    if (target.portalInstance) return 6;
    return 2;
  }

  update(time, delta) {
    if (this.hitStopTimer > 0) {
      this.hitStopTimer -= delta;
      if (this.hitStopTimer <= 0) {
        this.hitStopTimer = 0;
        if (!this.gamePaused) this.physics.resume();
      }
      return;
    }

    if (this.gamePaused) return;

    // Reset enemy pushable each frame (player-enemy collider sets it false,
    // but enemies need to stay pushable for enemy-enemy collisions)
    for (let i = 0; i < this.enemies.length; i++) {
      const body = this.enemies[i].sprite?.body;
      if (body) body.pushable = true;
    }

    if (this.screenShakeTimer > 0) {
      this.screenShakeTimer -= delta;
      const ox = (Math.random() - 0.5) * this.screenShakeIntensity * 2;
      const oy = (Math.random() - 0.5) * this.screenShakeIntensity * 2;
      this.cameras.main.setScroll(this.cameras.main.scrollX + ox, this.cameras.main.scrollY + oy);
      if (this.screenShakeTimer <= 0) {
        this.screenShakeTimer = 0;
        this.screenShakeIntensity = 0;
      }
    }

    if (this.player) this.player.update(delta);

    // Clear interact target if player moved away
    if (this.player?.sprite && this.player.interactTarget) {
      const target = this.player.interactTarget;
      const tx = target.x !== undefined ? target.x : target.sprite?.x;
      const ty = target.y !== undefined ? target.y : target.sprite?.y;
      if (tx !== undefined && ty !== undefined) {
        const dist = Phaser.Math.Distance.Between(
          this.player.sprite.x, this.player.sprite.y, tx, ty
        );
        if (dist > 60) {
          this.player.canInteract = false;
          this.player.interactTarget = null;
        }
      }
    }

    // Auto-close dialogue if player moves away from NPC/sign
    if (this.dialoguing && this.activeDialogueNpc && this.player?.sprite) {
      const npcSprite = this.activeDialogueNpc.sprite || this.activeDialogueNpc;
      if (npcSprite && npcSprite.x !== undefined) {
        const dist = Phaser.Math.Distance.Between(
          this.player.sprite.x, this.player.sprite.y,
          npcSprite.x, npcSprite.y
        );
        if (dist > 100) {
          this.closeCurrentDialogue();
        }
      }
    }

    // Y-depth sorting for dynamic entities
    if (this.player?.sprite) {
      this.player.sprite.setDepth(this.player.sprite.y + this.player.sprite.x * 0.001);
    }

    if (this.player && this.player.sprite) {
      this.enemies.forEach(e => {
        e.update(this.player.sprite, delta);
        if (e.sprite) e.sprite.setDepth(e.sprite.y + e.sprite.x * 0.001);
      });
      this.npcs.forEach(n => {
        if (n.updateState) n.updateState(this.inventory.getItems());
        const sprite = n.sprite || n;
        if (sprite) sprite.setDepth((sprite.y || 0) + (sprite.x || 0) * 0.001);
      });
    }

    // 敌人弹道每帧更新（视觉跟物理）
    if (this.enemyProjectiles) {
      for (let i = this.enemyProjectiles.length - 1; i >= 0; i--) {
        const p = this.enemyProjectiles[i];
        if (!p.alive) {
          this.enemyProjectiles.splice(i, 1);
          continue;
        }
        p.update();
      }
    }

    // Update chest label visibility based on distance
    this.chests.forEach(chest => {
      if (chest.opened) { chest.label.setVisible(false); return; }
      if (this.player?.sprite) {
        const dist = Phaser.Math.Distance.Between(
          this.player.sprite.x, this.player.sprite.y,
          chest.sprite.x, chest.sprite.y
        );
        chest.label.setVisible(dist < 60);
      }
    });

    // Update portal state
    this.updatePortalState();

    // War fog
    if (this.warFog && this.player) {
      this.warFog.update(this.player.sprite.x, this.player.sprite.y, delta);
    }

    // Save player position
    if (this.player) {
      const gs = this.registry.get('gameState');
      gs.playerPosition = this.player.getPosition();
      this.registry.set('gameState', gs);
    }
  }

  // ─── ESC 退出确认弹窗 ─────────────────────────────────────────

  _showExitConfirm() {
    const w = this.cameras.main.width;
    const h = this.cameras.main.height;
    const container = this.add.container(0, 0).setDepth(2000).setScrollFactor(0);

    // 背景遮罩
    const overlay = this.add.rectangle(w / 2, h / 2, w, h, 0x000000, 0.55)
      .setScrollFactor(0).setInteractive();
    container.add(overlay);

    // 主面板
    const pw = 360, ph = 220;
    const panel = this.add.rectangle(w / 2, h / 2, pw, ph, 0x1a1a2e, 0.98)
      .setScrollFactor(0).setStrokeStyle(2, 0x6666aa);
    container.add(panel);

    const title = this.add.text(w / 2, h / 2 - 80, '游戏菜单', {
      fontSize: '18px', fill: '#ffdd66', fontFamily: 'Courier New', fontStyle: 'bold'
    }).setOrigin(0.5).setScrollFactor(0);
    container.add(title);

    // 按钮工厂
    const mkBtn = (y, label, color, onClick) => {
      const bg = this.add.rectangle(w / 2, y, 240, 36, 0x2a2a3a)
        .setScrollFactor(0).setStrokeStyle(1, color)
        .setInteractive({ useHandCursor: true });
      const txt = this.add.text(w / 2, y, label, {
        fontSize: '14px', fill: '#ffffff', fontFamily: 'Courier New', fontStyle: 'bold'
      }).setOrigin(0.5).setScrollFactor(0);
      container.add([bg, txt]);
      bg.on('pointerover', () => bg.setFillStyle(0x3a3a5a));
      bg.on('pointerout', () => bg.setFillStyle(0x2a2a3a));
      bg.on('pointerdown', onClick);
    };

    mkBtn(h / 2 - 35, '保存进度...', 0x44ff88, () => {
      this._closeExitConfirm();
      // 暂停游戏，打开存档选择
      this.pauseGame();
      this.scene.launch('SaveSelectScene', {
        mode: 'save',
        returnTo: 'MainGameScene'
      });
      this.scene.bringToTop('SaveSelectScene');
    });

    mkBtn(h / 2 + 5, '返回主菜单', 0x66aaff, () => {
      try { SaveSystem.save(this); } catch (e) {}
      this._closeExitConfirm();
      this.scene.stop('UIScene');
      this.scene.stop('PanelScene');
      this.scene.start('MainMenuScene');
    });

    mkBtn(h / 2 + 45, '继续游戏', 0xaaaaaa, () => this._closeExitConfirm());

    this._exitConfirm = container;
  }

  _closeExitConfirm() {
    if (this._exitConfirm) {
      this._exitConfirm.destroy();
      this._exitConfirm = null;
    }
  }
}

// Mix in level building and interaction handling methods
Object.assign(MainGameScene.prototype, LevelBuilder);
Object.assign(MainGameScene.prototype, InteractionHandler);
