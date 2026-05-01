import Phaser from 'phaser';
import { GAME_CONFIG } from '../config/gameConfig.js';
import { TEXTURES } from '../assets/AssetManager.js';
import { Player, PlayerState } from '../entities/Player.js';
import { Enemy, EnemyState } from '../entities/Enemy.js';
import { Item } from '../entities/Item.js';
import { NPC, NPCState } from '../entities/NPC.js';
import { InventorySystem } from '../systems/InventorySystem.js';
import { SaveSystem } from '../systems/SaveSystem.js';
import { UIManager } from '../systems/UIManager.js';
import { LevelSystem } from '../systems/LevelSystem.js';
import { EquipmentSystem } from '../systems/EquipmentSystem.js';
import { SkillTreeSystem } from '../systems/SkillTreeSystem.js';
import { QuestSystem } from '../systems/QuestSystem.js';
import { LootEngine } from '../systems/LootEngine.js';
import { WarFog } from '../systems/WarFog.js';
import { levelData, LEVEL_TILE } from '../data/levels.js';
import itemData from '../data/items.json';

const TILE = LEVEL_TILE;

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
    this.levelSystem = new LevelSystem(this);
    this.registry.set('levelSystem', this.levelSystem);
    this.equipmentSystem = new EquipmentSystem(this);
    this.registry.set('equipmentSystem', this.equipmentSystem);
    this.skillTreeSystem = new SkillTreeSystem(this);
    this.registry.set('skillTreeSystem', this.skillTreeSystem);
    this.questSystem = new QuestSystem(this);
    this.registry.set('questSystem', this.questSystem);

    const gs = this.registry.get('gameState');
    this.currentLevel = gs.currentLevel || 0;

    this.loadLevel(this.currentLevel);
    this.setupEvents();

    // Panel toggle keys
    this.tabKey = this.input.keyboard.addKey(Phaser.Input.Keyboard.KeyCodes.TAB);
    this.iKey = this.input.keyboard.addKey(Phaser.Input.Keyboard.KeyCodes.I);
    this.gamePaused = false;

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
    this.tryLoadSave();

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

  createMap(level) {
    const ts = GAME_CONFIG.MAP.TILE_SIZE;
    const mapData = level.generateMap();

    this.walls = this.physics.add.staticGroup();
    this.obstacles = this.physics.add.staticGroup();
    this.decorations = this.add.group();
    this.groundTiles = this.add.group();

    for (let y = 0; y < mapData.length; y++) {
      for (let x = 0; x < mapData[y].length; x++) {
        const t = mapData[y][x];
        const wx = x * ts + ts / 2;
        const wy = y * ts + ts / 2;

        // Ground layer: place grass under every non-water, non-wall tile
        if (t !== TILE.WATER && t !== TILE.WALL) {
          const ground = this.add.image(wx, wy, TEXTURES.GRASS).setDepth(-1);
          this.groundTiles.add(ground);
        }

        switch (t) {
          case TILE.WALL: {
            const w = this.walls.create(wx, wy, TEXTURES.WALL);
            w.setOrigin(0.5).setDepth(wy).refreshBody();
            break;
          }
          case TILE.OBSTACLE: {
            const o = this.obstacles.create(wx, wy, TEXTURES.OBSTACLE);
            o.setOrigin(0.5).setDepth(wy).refreshBody();
            break;
          }
          case TILE.END:
            this.endZone = this.add.rectangle(wx, wy, ts, ts, 0x00ffff, 0.3);
            this.physics.add.existing(this.endZone, true);
            break;
          case TILE.TREE: {
            const tr = this.physics.add.staticSprite(wx, wy, TEXTURES.TREE);
            tr.setOrigin(0.5, 0.5).setDepth(wy);
            tr.body.setSize(24, 20);
            tr.body.setOffset(4, 28);
            this.decorations.add(tr);
            break;
          }
          case TILE.TREE_PINE: {
            const tp = this.physics.add.staticSprite(wx, wy, TEXTURES.TREE_PINE);
            tp.setOrigin(0.5, 0.5).setDepth(wy);
            tp.body.setSize(20, 18);
            tp.body.setOffset(6, 30);
            this.decorations.add(tp);
            break;
          }
          case TILE.GRASS: {
            const g = this.add.image(wx, wy, TEXTURES.GRASS).setDepth(1);
            this.decorations.add(g);
            break;
          }
          case TILE.GRASS_TALL: {
            const gt = this.physics.add.staticSprite(wx, wy, TEXTURES.GRASS_TALL);
            gt.setDepth(1);
            this.decorations.add(gt);
            break;
          }
          case TILE.WATER: {
            const wa = this.add.image(wx, wy, TEXTURES.WATER).setDepth(0);
            this.decorations.add(wa);
            break;
          }
          case TILE.STONE: {
            const s = this.physics.add.staticSprite(wx, wy, TEXTURES.STONE);
            s.setOrigin(0.5, 0.5).setDepth(wy);
            s.setDisplaySize(32, 28);
            s.body.setSize(28, 24);
            s.body.setOffset(2, 4);
            this.decorations.add(s);
            break;
          }
          case TILE.FLOWER: {
            const f = this.add.image(wx, wy, TEXTURES.FLOWER).setDepth(1);
            this.decorations.add(f);
            break;
          }
          case TILE.MUSHROOM: {
            const m = this.add.image(wx, wy, TEXTURES.MUSHROOM).setDepth(1);
            this.decorations.add(m);
            break;
          }
          case TILE.BRIDGE: {
            const b = this.add.image(wx, wy, TEXTURES.BRIDGE).setDepth(1);
            this.decorations.add(b);
            break;
          }
          case TILE.FENCE: {
            const fe = this.physics.add.staticSprite(wx, wy, TEXTURES.FENCE);
            fe.setOrigin(0.5, 0.5).setDepth(wy);
            fe.body.setSize(32, 16);
            fe.body.setOffset(0, 4);
            fe.refreshBody();
            this.decorations.add(fe);
            break;
          }
          case TILE.CAMPFIRE: {
            const cf = this.add.image(wx, wy, TEXTURES.CAMPFIRE).setDepth(wy);
            cf.setDisplaySize(28, 40);
            cf.setOrigin(0.5, 0.7);
            this.decorations.add(cf);
            this.tweens.add({
              targets: cf,
              scaleX: cf.scaleX * 1.1, scaleY: cf.scaleY * 0.9,
              duration: 300, yoyo: true, repeat: -1, ease: 'Sine.easeInOut'
            });
            break;
          }
          case TILE.CHEST:
            this.createChest(wx, wy, false);
            break;
          case TILE.CHEST_LOCKED:
            this.createChest(wx, wy, true);
            break;
          case TILE.PORTAL:
            this.createPortal(wx, wy, level);
            break;
        }
      }
    }

    this.mapData = mapData;
    const mapWidth = mapData[0].length * ts;
    const mapHeight = mapData.length * ts;
    this.physics.world.setBounds(0, 0, mapWidth, mapHeight);
  }

  createChest(x, y, locked) {
    const sprite = this.physics.add.sprite(x, y, locked ? TEXTURES.CHEST_LOCKED : TEXTURES.CHEST_CLOSED);
    sprite.setOrigin(0.5, 0.5).setDepth(y);
    sprite.setDisplaySize(32, 28);
    sprite.body.setImmovable(true);
    sprite.body.setAllowGravity(false);

    const label = this.add.text(x, y - 24, locked ? '需要钥匙' : '按 E 打开', {
      fontSize: '10px', fill: locked ? '#ff6666' : '#aaaaaa',
      fontFamily: 'Courier New'
    }).setOrigin(0.5).setDepth(y + 1).setVisible(false);

    const chest = {
      sprite, label, locked, opened: false,
      reward: locked ? { score: 50, healAmount: 25 } : { score: 20, healAmount: 0 }
    };

    // NPC-like interaction
    sprite.chestInstance = chest;
    this.chests.push(chest);
  }

  createPortal(x, y, level) {
    this.portalSprite = this.physics.add.sprite(x, y, TEXTURES.PORTAL);
    this.portalSprite.setOrigin(0.5, 0.5).setDepth(y).setDisplaySize(32, 32);
    this.portalSprite.body.setImmovable(true);
    this.portalSprite.body.setAllowGravity(false);

    const requiredKeys = level.portalRequiredKeys || 0;
    this.portalRequiredKeys = requiredKeys;

    this.portalLabel = this.add.text(x, y - 28, `需要 ${requiredKeys} 把钥匙`, {
      fontSize: '10px', fill: '#ff6666',
      fontFamily: 'Courier New'
    }).setOrigin(0.5).setDepth(y + 1);

    // Inactive state: gray tint
    this.portalSprite.setTint(0x666666);
    this.portalSprite.setAlpha(0.6);

    // Rotation animation
    this.tweens.add({
      targets: this.portalSprite,
      angle: 360,
      duration: 3000,
      repeat: -1,
      ease: 'Linear'
    });

    this.portalSprite.portalInstance = true;
  }

  updatePortalState() {
    if (!this.portalSprite) return;
    const gs = this.registry.get('gameState');
    const hasEnoughKeys = gs.keysCollected >= this.portalRequiredKeys;

    if (hasEnoughKeys && !this.portalActivated) {
      this.portalActivated = true;
      this.portalSprite.clearTint();
      this.portalSprite.setAlpha(1);
      this.portalLabel.setText('按 E 传送');
      this.portalLabel.setFill('#00ff00');

      // Activation glow pulse
      this.portalGlow = this.tweens.add({
        targets: this.portalSprite,
        scaleX: 1.2, scaleY: 1.2,
        duration: 800, yoyo: true, repeat: -1,
        ease: 'Sine.easeInOut'
      });
    } else if (!hasEnoughKeys) {
      this.portalLabel.setText(`需要 ${this.portalRequiredKeys} 把钥匙 (${gs.keysCollected}/${this.portalRequiredKeys})`);
    }
  }

  getEmptyTiles() {
    const ts = GAME_CONFIG.MAP.TILE_SIZE;
    const level = levelData[this.currentLevel];
    const startX = level.playerStart.x;
    const startY = level.playerStart.y;
    const empty = [];
    for (let y = 2; y < this.mapData.length - 2; y++) {
      for (let x = 2; x < this.mapData[0].length - 2; x++) {
        if (this.mapData[y][x] === TILE.EMPTY) {
          const wx = x * ts + ts / 2;
          const wy = y * ts + ts / 2;
          const distToStart = Phaser.Math.Distance.Between(wx, wy, startX, startY);
          if (distToStart > 200) {
            empty.push({ x: wx, y: wy });
          }
        }
      }
    }
    return empty;
  }

  pickRandomPositions(emptyTiles, count) {
    const shuffled = [...emptyTiles].sort(() => Math.random() - 0.5);
    return shuffled.slice(0, count);
  }

  createPlayer(level) {
    const savedData = this.registry.get('savedPlayerData');
    const startX = savedData?.position?.x || level.playerStart.x;
    const startY = savedData?.position?.y || level.playerStart.y;
    this.player = new Player(this, startX, startY);
    if (savedData?.hp) {
      this.player.hp = Math.min(savedData.hp, this.player.maxHp);
    }
    // Emit initial HP/MP so UI shows correct values
    this.player.onHpChanged();
  }

  createEnemies(level) {
    const empty = this.getEmptyTiles();
    // Support both array and legacy single-object format
    const groups = Array.isArray(level.enemies) ? level.enemies : [level.enemies];
    groups.forEach(group => {
      const config = itemData.enemies[group.type];
      if (!config) return;
      const positions = this.pickRandomPositions(empty, group.count);
      positions.forEach(pos => {
        this.enemies.push(new Enemy(this, pos.x, pos.y, config));
      });
    });
  }

  createItems(level) {
    const gs = this.registry.get('gameState');
    const collected = gs?.collectedItems || [];
    const empty = this.getEmptyTiles();
    const cfg = level.items;

    const coinPos = this.pickRandomPositions(empty, cfg.coins);
    coinPos.forEach((pos, i) => {
      const id = `L${this.currentLevel}_coin_${i}`;
      if (!collected.includes(id)) {
        this.items.push(new Item(this, pos.x, pos.y, 'coin', {
          id, ...itemData.items.coin,
          onCollect: (item) => {
            const g = this.registry.get('gameState');
            g.score += item.value;
            this.registry.set('gameState', g);
            this.events.emit('scoreChanged', g.score);
          }
        }));
      }
    });

    const remaining = empty.filter(e => !coinPos.includes(e));
    const keyPos = this.pickRandomPositions(remaining, cfg.keys);
    keyPos.forEach((pos, i) => {
      const id = `L${this.currentLevel}_key_${i}`;
      if (!collected.includes(id)) {
        this.items.push(new Item(this, pos.x, pos.y, 'key', {
          id, ...itemData.items.key,
          onCollect: () => {
            const g = this.registry.get('gameState');
            g.keysCollected += 1;
            this.registry.set('gameState', g);
            this.events.emit('keysChanged', g.keysCollected);
          }
        }));
      }
    });

    const potionPos = this.pickRandomPositions(remaining, cfg.potions);
    potionPos.forEach((pos, i) => {
      const id = `L${this.currentLevel}_potion_${i}`;
      if (!collected.includes(id)) {
        this.items.push(new Item(this, pos.x, pos.y, 'potion', {
          id, ...itemData.items.potion,
          onCollect: (item) => this.player.heal(item.value)
        }));
      }
    });

    if (cfg.hasArtifact && !collected.includes(`L${this.currentLevel}_artifact_0`)) {
      const artifactPos = this.pickRandomPositions(remaining, 1)[0];
      if (artifactPos) {
        this.items.push(new Item(this, artifactPos.x, artifactPos.y, 'artifact', {
          id: `L${this.currentLevel}_artifact_0`, ...itemData.items.artifact,
          onCollect: () => {
            const g = this.registry.get('gameState');
            g.hasArtifact = true;
            this.registry.set('gameState', g);
            this.events.emit('artifactCollected');
          }
        }));
      }
    }
  }

  createNPCs(level) {
    level.npcs.forEach(npcData => {
      const npc = new NPC(this, npcData.x, npcData.y, {
        id: npcData.id,
        name: npcData.name,
        dialogues: npcData.dialogues,
        stateCondition: npcData.hasStateCondition
          ? (inv) => inv.some(i => i.type === 'KEY' || i.type === 'key') ? NPCState.READY : NPCState.IDLE
          : null
      });
      this.npcs.push(npc);
    });
  }

  createBreakables() {
    const empty = this.getEmptyTiles();
    const positions = this.pickRandomPositions(empty, 5);
    positions.forEach(pos => {
      const b = this.physics.add.sprite(pos.x, pos.y, TEXTURES.BARREL);
      b.setOrigin(0.5, 0.5).setDepth(pos.y).setDisplaySize(28, 34);
      b.body.setImmovable(true);
      b.body.setAllowGravity(false);
      b.hp = 2;
      b.isBroken = false;
      this.breakables.push(b);
    });
  }

  createTriggerZones() {
    const empty = this.getEmptyTiles();
    const positions = this.pickRandomPositions(empty, 3);
    const messages = ['你发现了新区域...', '前方似乎有危险的气息...', '神器就在不远处...'];
    positions.forEach((pos, i) => {
      const rect = this.add.rectangle(pos.x, pos.y, 100, 100, 0xff00ff, 0);
      this.physics.add.existing(rect, true);
      rect.triggerMessage = messages[i] || messages[0];
      rect.triggered = false;
      this.triggerZones.push(rect);
    });
  }

  createHelpSigns(level) {
    const signs = level.signs || [];
    signs.forEach(s => {
      const signSprite = this.physics.add.staticSprite(s.x, s.y, TEXTURES.SIGN);
      signSprite.setDisplaySize(28, 44);
      signSprite.setOrigin(0.5, 0.7);
      signSprite.setDepth(s.y);
      signSprite.npcInstance = {
        name: '告示牌',
        isDialoguing: false,
        getNextDialogue: () => s.text,
        dialogues: [s.text],
        setTalking: () => {}
      };
      this.npcs.push(signSprite);
    });
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

    // Player can't be pushed by enemies
    this.player.sprite.body.pushable = false;

    this.enemies.forEach(enemy => {
      this.physics.add.collider(this.player.sprite, enemy.sprite, () => this.handleEnemyContact(enemy), null, this);
      this.physics.add.overlap(this.player.attackHitbox, enemy.sprite, () => this.handleAttackHit(enemy), null, this);
    });

    this.npcs.forEach(npc => {
      const sprite = npc.sprite || npc;
      this.physics.add.overlap(this.player.sprite, sprite, () => this.handleNPCProximity(npc), null, this);
    });

    this.breakables.forEach(b => {
      this.physics.add.collider(this.player.sprite, b);
      this.physics.add.overlap(this.player.attackHitbox, b, () => this.handleBreakableHit(b), null, this);
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

    this.events.on('enemyAttack', (enemy, damage) => {
      if (this.player) this.player.takeDamage(damage, enemy.sprite.x, enemy.sprite.y);
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
    this.events.on('screenShake', (i, d) => this.startScreenShake(i, d));

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

  // --- Chest System ---

  handleChestProximity(chest) {
    if (this.dialoguing || chest.opened) return;
    this.player.setInteractTarget(chest.sprite);
    chest.label.setVisible(true);
  }

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
      }
    });

    this.showQuickMessage(`获得 ${chest.reward.score} 分！${chest.reward.healAmount > 0 ? ` 恢复 ${chest.reward.healAmount} HP！` : ''}`);
  }

  // --- Portal System ---

  handlePortalProximity() {
    if (this.dialoguing) return;
    if (this.portalSprite) {
      this.player.setInteractTarget(this.portalSprite);
    }
  }

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
  }

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

  // --- Standard Handlers ---

  startHitStop(duration) {
    this.hitStopTimer = duration;
    this.physics.pause();
  }

  startScreenShake(intensity, duration) {
    this.screenShakeIntensity = intensity;
    this.screenShakeTimer = duration;
  }

  tryLoadSave() {
    if (SaveSystem.hasSave()) {
      SaveSystem.load(this);
    }
  }

  handleItemPickup(item) {
    if (item.isCollected) return;
    const result = item.collect();
    if (result) {
      const qty = item.config?.spawnQuantity || 1;
      this.inventory.addItem(result, qty);

      // Floating text for gold pickup
      if (result.type === 'currency' && this.player) {
        const goldAmount = (result.value || 0) * qty;
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
      if (result.type === 'equipment' && rarityOrder.indexOf(result.rarity) >= 2) {
        const color = result.rarity === 'legendary' ? 0xffaa00 : result.rarity === 'epic' ? 0xaa44aa : 0x4444ff;
        this.showQuickMessage(`获得了 ${result.name}！`, color);
      }
    }
  }

  handleEnemyContact(enemy) {
    if (this.player.isInvulnerable || this.player.state === PlayerState.DEAD) return;
    if (enemy.state === EnemyState.DEAD) return;
    this.player.takeDamage(enemy.getAttack(), enemy.sprite.x, enemy.sprite.y);
  }

  handleAttackHit(enemy) {
    if (!this.player.attackHitbox.body.enable) return;
    if (this.player.attackHitRegistered) return;
    if (enemy.isInvulnerable || enemy.state === EnemyState.DEAD) return;
    enemy.takeDamage(this.player.getAttack(), this.player.sprite.x, this.player.sprite.y);
    this.player.onAttackHit();
    // Disable hitbox immediately after hit to prevent same-frame duplicates
    this.player.attackHitbox.body.enable = false;
  }

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
  }

  handleNPCProximity(npc) {
    if (this.dialoguing) return;
    const sprite = npc.sprite || npc;
    this.player.setInteractTarget(sprite);
  }

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
  }

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
  }

  handleTriggerZone(zone) {
    if (zone.triggered || this.dialoguing) return;
    zone.triggered = true;
    this.showQuickMessage(zone.triggerMessage);
  }

  handleVictoryZone() {
    const gs = this.registry.get('gameState');
    if (gs.hasArtifact) this.handleVictory();
  }

  handleVictory() {
    SaveSystem.save(this);
    this.physics.pause();
    this.time.delayedCall(500, () => this.scene.start('VictoryScene'));
  }

  handleGameOver() {
    this.physics.pause();
    this.time.delayedCall(1000, () => this.scene.start('GameOverScene'));
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
}
