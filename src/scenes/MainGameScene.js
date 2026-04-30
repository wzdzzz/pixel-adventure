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
import { FocusLight } from '../systems/FocusLight.js';
import itemData from '../data/items.json';

const TILE = {
  EMPTY: 0, WALL: 1, OBSTACLE: 2, END: 3,
  TREE: 4, TREE_PINE: 5, GRASS: 6, GRASS_TALL: 7,
  WATER: 8, STONE: 9, FLOWER: 10, MUSHROOM: 11,
  SIGN: 12, BRIDGE: 13, FENCE: 14, CAMPFIRE: 15
};

export class MainGameScene extends Phaser.Scene {
  constructor() {
    super({ key: 'MainGameScene' });
    this.player = null;
    this.enemies = [];
    this.items = [];
    this.npcs = [];
    this.walls = null;
    this.obstacles = null;
    this.breakables = [];
    this.triggerZones = [];
    this.decorations = null;

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

    this.createMap();
    this.createPlayer();
    this.createEnemies();
    this.createItems();
    this.createNPCs();
    this.createBreakables();
    this.createTriggerZones();
    this.createHelpSigns();
    this.setupCollisions();
    this.setupCamera();
    this.setupEvents();
    this.tryLoadSave();

    this.focusLight = new FocusLight(this, { radius: 200, darknessAlpha: 0.5 });

    this.time.addEvent({
      delay: 30000,
      callback: () => SaveSystem.save(this),
      loop: true
    });
  }

  createMap() {
    const ts = GAME_CONFIG.MAP.TILE_SIZE;
    const mapData = this.generateRichMap();

    this.walls = this.physics.add.staticGroup();
    this.obstacles = this.physics.add.staticGroup();
    this.decorations = this.add.group();

    for (let y = 0; y < mapData.length; y++) {
      for (let x = 0; x < mapData[y].length; x++) {
        const t = mapData[y][x];
        const wx = x * ts + ts / 2;
        const wy = y * ts + ts / 2;

        switch (t) {
          case TILE.WALL: {
            const w = this.walls.create(wx, wy, TEXTURES.WALL);
            w.setOrigin(0.5).refreshBody();
            break;
          }
          case TILE.OBSTACLE: {
            const o = this.obstacles.create(wx, wy, TEXTURES.OBSTACLE);
            o.setOrigin(0.5).refreshBody();
            break;
          }
          case TILE.END:
            this.endZone = this.add.rectangle(wx, wy, ts, ts, 0x00ffff, 0.3);
            this.physics.add.existing(this.endZone, true);
            break;
          case TILE.TREE: {
            const tr = this.physics.add.staticSprite(wx, wy, TEXTURES.TREE);
            tr.setOrigin(0.5, 0.5);
            tr.body.setSize(24, 20);
            tr.body.setOffset(4, 28);
            this.decorations.add(tr);
            break;
          }
          case TILE.TREE_PINE: {
            const tp = this.physics.add.staticSprite(wx, wy, TEXTURES.TREE_PINE);
            tp.setOrigin(0.5, 0.5);
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
            s.setOrigin(0.5, 0.5);
            s.body.setSize(28, 24);
            s.body.setOffset(2, 8);
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
            const b = this.add.image(wx, wy, TEXTURES.BRIDGE).setDepth(0);
            this.decorations.add(b);
            break;
          }
          case TILE.FENCE: {
            const fe = this.physics.add.staticSprite(wx, wy, TEXTURES.FENCE);
            fe.setOrigin(0.5, 0.5);
            fe.body.setSize(32, 16);
            fe.body.setOffset(0, 4);
            fe.refreshBody();
            this.decorations.add(fe);
            break;
          }
          case TILE.CAMPFIRE: {
            const cf = this.add.image(wx, wy, TEXTURES.CAMPFIRE).setDepth(1);
            this.decorations.add(cf);
            this.tweens.add({
              targets: cf,
              scaleX: 1.1, scaleY: 0.9,
              duration: 300, yoyo: true, repeat: -1, ease: 'Sine.easeInOut'
            });
            break;
          }
        }
      }
    }

    this.mapData = mapData;
    const mapWidth = mapData[0].length * ts;
    const mapHeight = mapData.length * ts;
    this.physics.world.setBounds(0, 0, mapWidth, mapHeight);
  }

  generateRichMap() {
    const W = 50, H = 40;
    const map = Array.from({ length: H }, () => Array(W).fill(TILE.EMPTY));

    for (let x = 0; x < W; x++) { map[0][x] = TILE.WALL; map[H - 1][x] = TILE.WALL; }
    for (let y = 0; y < H; y++) { map[y][0] = TILE.WALL; map[y][W - 1] = TILE.WALL; }

    for (let x = 10; x < 16; x++) map[5][x] = TILE.WALL;
    for (let y = 5; y < 12; y++) map[y][10] = TILE.WALL;
    for (let x = 25; x < 35; x++) map[8][x] = TILE.WALL;
    for (let y = 8; y < 15; y++) map[y][25] = TILE.WALL;
    for (let y = 8; y < 15; y++) map[y][34] = TILE.WALL;
    for (let x = 34; x < 40; x++) map[14][x] = TILE.WALL;
    for (let x = 15; x < 22; x++) map[20][x] = TILE.WALL;
    for (let y = 20; y < 28; y++) map[y][15] = TILE.WALL;
    for (let x = 30; x < 40; x++) map[25][x] = TILE.WALL;
    for (let y = 25; y < 32; y++) map[y][30] = TILE.WALL;
    for (let x = 5; x < 12; x++) map[30][x] = TILE.WALL;
    for (let y = 30; y < 36; y++) map[y][5] = TILE.WALL;

    for (let y = 16; y < 19; y++) for (let x = 20; x < 25; x++) map[y][x] = TILE.WATER;
    map[17][22] = TILE.BRIDGE; map[17][23] = TILE.BRIDGE;

    for (let y = 32; y < 36; y++) for (let x = 35; x < 42; x++) map[y][x] = TILE.WATER;
    map[33][37] = TILE.BRIDGE; map[33][38] = TILE.BRIDGE;
    map[34][37] = TILE.BRIDGE; map[34][38] = TILE.BRIDGE;

    const trees = [
      [3,3],[4,3],[3,4],[6,8],[7,8],[6,9],
      [42,3],[43,3],[44,4],[42,8],[43,9],
      [3,32],[4,33],[3,34],[42,32],[43,33],[44,34],
      [18,10],[19,11],[38,18],[39,19],[40,18],
      [8,22],[9,23],[44,25],[45,26],[43,27],
      [20,35],[21,36],[22,35],[35,6],[36,7],[37,6]
    ];
    trees.forEach(([y, x]) => {
      if (y > 0 && y < H - 1 && x > 0 && x < W - 1 && map[y][x] === TILE.EMPTY)
        map[y][x] = Math.random() < 0.5 ? TILE.TREE : TILE.TREE_PINE;
    });

    const grass = [
      [2,2],[3,5],[5,3],[8,6],[12,4],[15,8],[18,5],
      [2,42],[5,40],[8,44],[12,42],[15,38],
      [22,8],[24,12],[28,6],[32,10],[35,4],
      [22,40],[25,42],[28,38],[32,44],[35,40],
      [10,20],[12,22],[14,18],[16,24],
      [28,20],[30,22],[32,18],[34,24]
    ];
    grass.forEach(([y, x]) => {
      if (y > 0 && y < H - 1 && x > 0 && x < W - 1 && map[y][x] === TILE.EMPTY)
        map[y][x] = Math.random() < 0.4 ? TILE.GRASS_TALL : TILE.GRASS;
    });

    const flowers = [
      [4,7],[6,5],[10,3],[14,7],[20,4],
      [4,40],[8,42],[12,40],[16,44],
      [24,8],[28,12],[34,8],[38,10],
      [24,40],[28,38],[34,42],[38,40]
    ];
    flowers.forEach(([y, x]) => {
      if (y > 0 && y < H - 1 && x > 0 && x < W - 1 && map[y][x] === TILE.EMPTY)
        map[y][x] = TILE.FLOWER;
    });

    const stones = [
      [7,15],[10,25],[16,35],[20,10],[22,28],
      [28,15],[32,25],[36,10],[38,20],
      [12,30],[18,38],[26,42],[34,44]
    ];
    stones.forEach(([y, x]) => {
      if (y > 0 && y < H - 1 && x > 0 && x < W - 1 && map[y][x] === TILE.EMPTY)
        map[y][x] = TILE.STONE;
    });

    const mushrooms = [
      [6,12],[11,18],[14,28],[22,6],[26,10],
      [30,20],[34,30],[38,14],[10,36],[16,42]
    ];
    mushrooms.forEach(([y, x]) => {
      if (y > 0 && y < H - 1 && x > 0 && x < W - 1 && map[y][x] === TILE.EMPTY)
        map[y][x] = TILE.MUSHROOM;
    });

    for (let x = 3; x < 8; x++) map[2][x] = TILE.FENCE;
    for (let x = 40; x < 46; x++) map[2][x] = TILE.FENCE;
    for (let x = 3; x < 8; x++) map[37][x] = TILE.FENCE;

    map[10][20] = TILE.CAMPFIRE;
    map[25][40] = TILE.CAMPFIRE;

    map[38][47] = TILE.END;

    return map;
  }

  getEmptyTiles() {
    const ts = GAME_CONFIG.MAP.TILE_SIZE;
    const empty = [];
    for (let y = 2; y < this.mapData.length - 2; y++) {
      for (let x = 2; x < this.mapData[0].length - 2; x++) {
        if (this.mapData[y][x] === TILE.EMPTY) {
          const distToStart = Phaser.Math.Distance.Between(x * ts, y * ts, 150, 150);
          if (distToStart > 200) {
            empty.push({ x: x * ts + ts / 2, y: y * ts + ts / 2 });
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

  createPlayer() {
    const savedData = this.registry.get('savedPlayerData');
    const startX = savedData?.position?.x || 150;
    const startY = savedData?.position?.y || 150;
    this.player = new Player(this, startX, startY);
    if (savedData?.hp) {
      this.player.hp = savedData.hp;
      this.player.maxHp = savedData.maxHp || 100;
    }
  }

  createEnemies() {
    const empty = this.getEmptyTiles();
    const positions = this.pickRandomPositions(empty, 8);
    positions.forEach(pos => {
      this.enemies.push(new Enemy(this, pos.x, pos.y, itemData.enemies.slime));
    });
  }

  createItems() {
    const gs = this.registry.get('gameState');
    const collected = gs?.collectedItems || [];
    const empty = this.getEmptyTiles();

    const coinPos = this.pickRandomPositions(empty, 12);
    coinPos.forEach((pos, i) => {
      const id = `coin_${i}`;
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

    const keyPos = this.pickRandomPositions(empty.filter((_, i) => !coinPos.includes(empty[i])), 2);
    keyPos.forEach((pos, i) => {
      const id = `key_${i}`;
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

    const potionPos = this.pickRandomPositions(empty, 4);
    potionPos.forEach((pos, i) => {
      const id = `potion_${i}`;
      if (!collected.includes(id)) {
        this.items.push(new Item(this, pos.x, pos.y, 'potion', {
          id, ...itemData.items.potion,
          onCollect: (item) => this.player.heal(item.value)
        }));
      }
    });

    if (!collected.includes('artifact_0')) {
      const artifactPos = this.pickRandomPositions(empty, 1)[0];
      this.items.push(new Item(this, artifactPos.x, artifactPos.y, 'artifact', {
        id: 'artifact_0', ...itemData.items.artifact,
        onCollect: () => {
          const g = this.registry.get('gameState');
          g.hasArtifact = true;
          this.registry.set('gameState', g);
          this.events.emit('artifactCollected');
        }
      }));
    }
  }

  createNPCs() {
    const elder = new NPC(this, 200, 400, {
      id: 'elder',
      name: '村长',
      dialogues: itemData.npcs.elder.dialogues,
      stateCondition: (inv) => inv.some(i => i.type === 'KEY' || i.type === 'key') ? NPCState.READY : NPCState.IDLE
    });
    this.npcs.push(elder);

    const merchant = new NPC(this, 600, 200, {
      id: 'merchant',
      name: '旅行商人',
      dialogues: [
        '欢迎！这里到处都是危险的史莱姆。',
        '鼠标左键挥剑攻击，击败它们可以获得金币。',
        '收集钥匙可以开启宝箱，找到神器就能逃出这片森林！'
      ]
    });
    this.npcs.push(merchant);
  }

  createBreakables() {
    const empty = this.getEmptyTiles();
    const positions = this.pickRandomPositions(empty, 5);
    positions.forEach(pos => {
      const b = this.physics.add.sprite(pos.x, pos.y, TEXTURES.OBSTACLE);
      b.setOrigin(0.5, 0.5);
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

  createHelpSigns() {
    const signs = [
      { x: 120, y: 120, text: '--- 像素冒险 ---\n\n操作:\nWASD/方向键 移动\n鼠标左键 攻击\nE 交互/对话\n\n目标:收集神器到达终点!' },
      { x: 120, y: 300, text: '--- 道具说明 ---\n\n金币(黄):+10分\n钥匙(粉):开启宝箱\n药水(绿):恢复25HP\n生命之心(红):恢复50HP\n神器(紫):胜利关键物品' },
      { x: 120, y: 500, text: '--- 战斗提示 ---\n\n鼠标左键挥剑攻击\n角色自动转向鼠标方向\n攻击有前摇和后摇\n命中敌人造成定格冻结\n可破坏木桶获取道具' },
      { x: 800, y: 120, text: '--- 探索提示 ---\n\n与NPC按E对话\n黄色感叹号=有新对话\n探索每个角落寻找道具\n水池和树木是障碍物\n击败史莱姆获得金币' }
    ];

    signs.forEach(s => {
      const signSprite = this.physics.add.staticSprite(s.x, s.y, TEXTURES.SIGN);
      signSprite.setDepth(2);
      signSprite.npcInstance = {
        name: '告示牌',
        isDialoguing: false,
        getNextDialogue: () => s.text,
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
    });

    this.items.forEach(item => {
      this.physics.add.overlap(this.player.sprite, item.sprite, () => this.handleItemPickup(item), null, this);
    });

    this.enemies.forEach(enemy => {
      this.physics.add.overlap(this.player.sprite, enemy.sprite, () => this.handleEnemyContact(enemy), null, this);
      this.physics.add.overlap(this.player.attackHitbox, enemy.sprite, () => this.handleAttackHit(enemy), null, this);
    });

    this.npcs.forEach(npc => {
      const sprite = npc.sprite || npc;
      this.physics.add.overlap(
        this.player.sprite, sprite,
        () => this.handleNPCProximity(npc),
        () => this.handleNPCLeave(npc),
        this
      );
    });

    this.breakables.forEach(b => {
      this.physics.add.collider(this.player.sprite, b);
      this.physics.add.overlap(this.player.attackHitbox, b, () => this.handleBreakableHit(b), null, this);
    });

    this.triggerZones.forEach(zone => {
      this.physics.add.overlap(this.player.sprite, zone, () => this.handleTriggerZone(zone), null, this);
    });

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
      if (this.dialoguing) return;
      const npcInst = target.npcInstance || target;
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
    });

    this.events.on('spawnItem', (type, x, y) => {
      const config = itemData.items[type];
      if (config) {
        const item = new Item(this, x, y, type, {
          id: `${type}_${Date.now()}`, ...config,
          onCollect: (item) => {
            if (type === 'coin') {
              const g = this.registry.get('gameState');
              g.score += item.value;
              this.registry.set('gameState', g);
              this.events.emit('scoreChanged', g.score);
            } else if (type === 'potion') {
              this.player.heal(item.value);
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
    if (SaveSystem.hasSave()) {
      SaveSystem.load(this);
    }
  }

  handleItemPickup(item) {
    if (item.isCollected) return;
    const result = item.collect();
    if (result) {
      this.inventory.addItem(result);
      const gs = this.registry.get('gameState');
      if (item.id) {
        gs.collectedItems.push(item.id);
        this.registry.set('gameState', gs);
      }
      const idx = this.items.indexOf(item);
      if (idx > -1) this.items.splice(idx, 1);
    }
  }

  handleEnemyContact(enemy) {
    if (this.player.isInvulnerable || this.player.state === PlayerState.DEAD) return;
    if (enemy.state === EnemyState.DEAD) return;
    this.player.takeDamage(enemy.config.damage, enemy.sprite.x, enemy.sprite.y);
  }

  handleAttackHit(enemy) {
    if (!this.player.attackHitbox.body.enable) return;
    if (this.player.attackHitRegistered) return;
    enemy.takeDamage(20, this.player.sprite.x, this.player.sprite.y);
    this.player.onAttackHit();
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
          this.events.emit('spawnItem', Math.random() < 0.6 ? 'coin' : 'potion', b.x, b.y);
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

  handleNPCLeave(npc) {
    const sprite = npc.sprite || npc;
    this.player.clearInteractTarget(sprite);

    if (this.dialoguing && this.activeDialogueNpc === npc) {
      this.closeCurrentDialogue();
    }
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

  handleNPCDialogue(npc) {
    if (this.dialoguing) return;
    if (npc.isDialoguing) return;

    const dialogue = npc.getNextDialogue();
    if (npc.setTalking) npc.setTalking(true);
    this.dialoguing = true;
    this.activeDialogueNpc = npc;

    const windowObj = this.uiManager.createDialogueWindow();
    this.activeDialogueWindow = windowObj;

    this.uiManager.openWindow(windowObj, npc.name || '???', dialogue, () => {
      const closeHandler = () => {
        this.uiManager.closeWindow(windowObj);
        if (npc.setTalking) npc.setTalking(false);
        this.dialoguing = false;
        this.activeDialogueWindow = null;
        this.activeDialogueNpc = null;
        this.input.keyboard.removeListener('keydown-E', closeHandler);
        this.input.keyboard.removeListener('keydown-SPACE', closeHandler);
      };
      this.input.keyboard.on('keydown-E', closeHandler);
      this.input.keyboard.on('keydown-SPACE', closeHandler);
    });
  }

  handleTriggerZone(zone) {
    if (zone.triggered || this.dialoguing) return;
    zone.triggered = true;
    this.events.emit('triggerZoneEntered', zone);
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

  update(time, delta) {
    if (this.hitStopTimer > 0) {
      this.hitStopTimer -= delta;
      if (this.hitStopTimer <= 0) {
        this.hitStopTimer = 0;
        this.physics.resume();
      }
      return;
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

    if (this.player && this.player.sprite) {
      this.enemies.forEach(e => e.update(this.player.sprite, delta));
      this.npcs.forEach(n => {
        if (n.updateState) n.updateState(this.inventory.getItems());
      });
    }

    if (this.focusLight && this.player) {
      this.focusLight.update(this.player.sprite.x, this.player.sprite.y, delta);
    }

    if (this.player) {
      const gs = this.registry.get('gameState');
      gs.playerPosition = this.player.getPosition();
      this.registry.set('gameState', gs);
    }
  }
}
