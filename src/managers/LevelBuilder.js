import { GAME_CONFIG } from '../config/gameConfig.js';
import { TEXTURES } from '../assets/AssetManager.js';
import { Player } from '../entities/Player.js';
import { Enemy } from '../entities/Enemy.js';
import { Item } from '../entities/Item.js';
import { NPC, NPCState } from '../entities/NPC.js';
import { levelData, LEVEL_TILE } from '../data/levels.js';
import itemData from '../data/items.json';
import { rollTierOffset } from '../data/monsterScaling.js';
import { getEnemyConfig } from '../data/enemyConfig.js';

const TILE = LEVEL_TILE;

export const LevelBuilder = {
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
  },

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
  },

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
  },

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
  },

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
  },

  pickRandomPositions(emptyTiles, count) {
    const shuffled = [...emptyTiles].sort(() => Math.random() - 0.5);
    return shuffled.slice(0, count);
  },

  createPlayer(level) {
    const savedData = this.registry.get('savedPlayerData');
    const startX = savedData?.position?.x || level.playerStart.x;
    const startY = savedData?.position?.y || level.playerStart.y;
    const classType = savedData?.classType || this.registry.get('classType') || 'warrior';
    const gender = savedData?.gender || this.registry.get('gender') || 'male';
    this.player = new Player(this, startX, startY, classType, gender);
    if (savedData?.hp) {
      this.player.hp = Math.min(savedData.hp, this.player.maxHp);
    }
    if (savedData?.stamina !== undefined) {
      this.player.stamina = Math.min(savedData.stamina, this.player.maxStamina);
    }
    if (savedData?.mana !== undefined) {
      this.player.mana = Math.min(savedData.mana, this.player.maxMana);
    }
    if (savedData?.rage !== undefined) {
      this.player.rage = Math.min(savedData.rage, this.player.maxRage);
    }
    // 注意：不在这里调用 onHpChanged()，而是在 tryLoadSave() 之后统一触发，
    // 避免存档加载时先闪一下 base HP 再跳到存档值。
  },

  createEnemies(level) {
    const empty = this.getEmptyTiles();
    const recommendedLevel = level.recommendedLevel || 1;
    // Support both array and legacy single-object format
    const groups = Array.isArray(level.enemies) ? level.enemies : [level.enemies];
    groups.forEach(group => {
      const config = itemData.enemies[group.type];
      if (!config) return;

      // 从 enemyConfig 读取 tier
      const enemyCfg = getEnemyConfig(group.type);
      const tier = enemyCfg.tier || 'normal';

      const positions = this.pickRandomPositions(empty, group.count);
      positions.forEach(pos => {
        // 最终等级 = 推荐等级 + Tier偏移，最低1级
        const offset = rollTierOffset(tier);
        const finalLevel = Math.max(1, recommendedLevel + offset);

        this.enemies.push(new Enemy(this, pos.x, pos.y, {
          ...config,
          finalLevel,
          tier,
        }));
      });
    });
  },

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
  },

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
  },

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
  },

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
  },

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
};
