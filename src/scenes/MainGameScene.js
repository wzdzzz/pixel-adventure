import Phaser from 'phaser';
import { GAME_CONFIG } from '../config/gameConfig.js';
import { RARITY_LABELS } from '../config/themeConfig.js';
import { UI_THEME, getRarityTheme } from '../config/uiTheme.js';
import { PlayerState } from '../entities/Player.js';
import { Item } from '../entities/Item.js';
import { InventorySystem } from '../systems/InventorySystem.js';
import { SaveSystem } from '../systems/SaveSystem.js';
import { UIManager } from '../systems/UIManager.js';
import { LevelSystem } from '../systems/LevelSystem.js';
import { EquipmentSystem } from '../systems/EquipmentSystem.js';
import { EnhanceSystem } from '../systems/EnhanceSystem.js';
import { GemSystem } from '../systems/GemSystem.js';
import { ReforgeSystem } from '../systems/ReforgeSystem.js';
import { CraftingSystem } from '../systems/CraftingSystem.js';
import { TriggerSystem } from '../systems/TriggerSystem.js';
import { SkillTreeSystem } from '../systems/SkillTreeSystem.js';
import { QuestSystem } from '../systems/QuestSystem.js';
import { LootEngine } from '../systems/LootEngine.js';
import { WarFog } from '../systems/WarFog.js';
import { FloatingTextManager } from '../systems/FloatingTextManager.js';
import { levelData } from '../data/levels.js';
import itemData from '../data/items.json';
import { LevelBuilder } from '../managers/LevelBuilder.js';
import { InteractionHandler } from '../managers/InteractionHandler.js';
import { getLevelSuppression } from '../data/monsterScaling.js';
import { TEXTURES } from '../assets/AssetManager.js';
import { WorldGenerator } from '../world/WorldGenerator.js';
import { ChunkManager } from '../world/ChunkManager.js';
import { WorldStateManager } from '../world/WorldStateManager.js';
import { BIOMES } from '../world/biomes/biomeConfig.js';
import {
  WORLD_CHUNK_PX,
  WORLD_CONFIG,
  WORLD_HEIGHT_PX,
  WORLD_WIDTH_PX,
  chunkKey,
  getDefaultWorldSpawn,
  worldToChunk,
} from '../world/worldConfig.js';
import { Enemy, EnemyState } from '../entities/Enemy.js';
import { NPC } from '../entities/NPC.js';
import { NPCRegistry } from '../systems/NPCRegistry.js';
import { NPCMemoryStore } from '../systems/NPCMemoryStore.js';
import { FactionSystem } from '../systems/FactionSystem.js';
import { ActionRegistry } from '../systems/ActionRegistry.js';
import { DialogueEngine } from '../systems/DialogueEngine.js';
import { DialoguePanel } from '../ui/DialoguePanel.js';
import { ShopService } from '../systems/ShopService.js';
import { ShopPanel } from '../ui/ShopPanel.js';
import { TrainerService } from '../systems/TrainerService.js';
import { TrainerPanel } from '../ui/TrainerPanel.js';
import { CompanionManager } from '../systems/CompanionManager.js';
import { getDialogueModule } from '../data/dialogues/index.js';
import { getEnemyConfig } from '../data/enemyConfig.js';
import { getLayoutOverride } from '../world/WorldLayout.js';
import { SHRINE_TYPES } from '../data/shrines.js';
import SystemRegistry from '../core/SystemRegistry.js';
import MusicEngine from '../systems/MusicEngine.js';
import SoundManager from '../systems/SoundManager.js';
import { installStoryArc } from '../systems/StoryArc.js';

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
    this.shrines = [];
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

    // 开放世界系统
    this.worldGenerator = null;
    this.chunkManager = null;
    this.worldState = null;
    this.useOpenWorld = false;  // 标记是否使用开放世界模式
  }

  create() {
    this._worldDisposed = false;
    this._pauseReasons = new Set();
    this.gamePaused = false;
    this.events.once(Phaser.Scenes.Events.SHUTDOWN, this._shutdownWorld, this);

    // 清除上一次的注册
    SystemRegistry.clear();

    this.inventory = new InventorySystem(this);
    this.uiManager = new UIManager(this);
    this.floatingText = new FloatingTextManager(this);
    this.levelSystem = new LevelSystem(this);
    this.equipmentSystem = new EquipmentSystem(this);
    this.enhanceSystem = new EnhanceSystem(this);
    this.gemSystem = new GemSystem(this);
    this.reforgeSystem = new ReforgeSystem(this);
    this.craftingSystem = new CraftingSystem(this);
    this.triggerSystem = new TriggerSystem(this);
    this.skillTreeSystem = new SkillTreeSystem(this);
    this.questSystem = new QuestSystem(this);

    // 统一注册到 SystemRegistry
    SystemRegistry.register('inventory', this.inventory);
    SystemRegistry.register('uiManager', this.uiManager);
    SystemRegistry.register('floatingText', this.floatingText);
    SystemRegistry.register('levelSystem', this.levelSystem);
    SystemRegistry.register('equipmentSystem', this.equipmentSystem);
    SystemRegistry.register('enhanceSystem', this.enhanceSystem);
    SystemRegistry.register('gemSystem', this.gemSystem);
    SystemRegistry.register('reforgeSystem', this.reforgeSystem);
    SystemRegistry.register('craftingSystem', this.craftingSystem);
    SystemRegistry.register('triggerSystem', this.triggerSystem);
    SystemRegistry.register('skillTreeSystem', this.skillTreeSystem);
    SystemRegistry.register('questSystem', this.questSystem);

    // 程序化音频：音乐引擎 + 音效管理器（绑定本场景事件）
    this.musicEngine = new MusicEngine();
    this.soundManager = new SoundManager(this, this.musicEngine);
    this.soundManager.bind();
    SystemRegistry.register('musicEngine', this.musicEngine);
    SystemRegistry.register('soundManager', this.soundManager);
    this._currentMusicZone = null; // 'town' | 'wild'，用于切换环境曲
    // 兼容：保留 Phaser registry 供现有 UI 面板使用
    this.registry.set('levelSystem', this.levelSystem);
    this.registry.set('equipmentSystem', this.equipmentSystem);
    this.registry.set('skillTreeSystem', this.skillTreeSystem);
    this.registry.set('questSystem', this.questSystem);

    // 若有待加载存档：先读 meta 决定职业/性别/当前关卡，确保 createPlayer 用正确的职业
    const pendingSlot = this.registry.get('pendingLoadSlot');
    let initialSaveData = null;
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
      if (SaveSystem.hasSave(pendingSlot)) {
        initialSaveData = SaveSystem.readSaveData(pendingSlot);
      }
    }

    if (!initialSaveData) {
      const activeSlot = this.registry.get('activeSaveSlot') || 1;
      if (SaveSystem.hasSave(activeSlot)) {
        initialSaveData = SaveSystem.readSaveData(activeSlot);
      }
    }

    // 使用开放世界模式
    this.enterWorld(initialSaveData);
    this.tryLoadSave();
    this.setupEvents();

    // 体验弧：序章引导 / 情境教学 / 方向指引 / 结局演出（存档就绪后安装）
    installStoryArc(this);

    // 延迟一帧触发全部 UI 刷新，确保 UIScene 已完成事件注册
    this.time.delayedCall(0, () => {
      if (this.player) {
        this.player.onHpChanged();
        if (this.player.onResourceChanged) this.player.onResourceChanged();
        // 技能槽回显（SaveSystem.load 时 UIScene 可能尚未注册 listener）
        if (this.player.skillSlots) {
          this.events.emit('skillSlotsChanged', this.player.skillSlots.slice());
        }
      }
      // 金币回显
      if (this.inventory) {
        this.events.emit('goldChanged', this.inventory.gold || 0);
      }
    });

    // Panel toggle keys
    this.escKey = this.input.keyboard.addKey(Phaser.Input.Keyboard.KeyCodes.ESC);
    this._exitConfirm = null;

    // C=角色, B=背包, X=技能, L=日志 — 再按关闭
    const panelKeys = {
      C: 'character',
      B: 'inventory',
      X: 'skillTree',
      L: 'questLog',
      T: 'party'
    };

    const openPanelTab = (tabName) => {
      if (this.dialoguing) return;
      // 面板已打开时由 PanelScene 自己处理快捷键，这里不重复
      if (this.scene.isActive('PanelScene')) return;
      if (this.gamePaused) return;
      this.pauseGame('panel');
      this.registry.set('panelDefaultTab', tabName);
      this.scene.launch('PanelScene');
      this.scene.bringToTop('PanelScene');
    };

    Object.entries(panelKeys).forEach(([keyChar, tabName]) => {
      const key = this.input.keyboard.addKey(Phaser.Input.Keyboard.KeyCodes[keyChar]);
      key.on('down', () => openPanelTab(tabName));
    });

    // TAB 也可开面板（默认角色页）
    this.tabKey = this.input.keyboard.addKey(Phaser.Input.Keyboard.KeyCodes.TAB);
    this.tabKey.on('down', (event) => {
      if (event.originalEvent) event.originalEvent.preventDefault();
      openPanelTab('character');
    });

    // ESC：关闭面板或显示返回主菜单确认
    this.escKey.on('down', () => {
      if (this.scene.isActive('PanelScene')) return; // 面板自己处理
      if (this.dialoguing) return;
      if (this._exitConfirm) {
        this._closeExitConfirm();
      } else {
        this._showExitConfirm();
      }
    });

    // F：浏览器真全屏切换
    this.fKey = this.input.keyboard.addKey(Phaser.Input.Keyboard.KeyCodes.F);
    this.fKey.on('down', () => {
      if (this.scale.isFullscreen) this.scale.stopFullscreen();
      else this.scale.startFullscreen();
    });

    // M：打开世界地图
    this.mKey = this.input.keyboard.addKey(Phaser.Input.Keyboard.KeyCodes.M);
    this.mKey.on('down', () => {
      if (this._worldMapInputLockUntil && this.time.now < this._worldMapInputLockUntil) return;
      if (this.dialoguing || this.gamePaused) return;
      if (!this.useOpenWorld) return;
      if (this.scene.isActive('WorldMapScene')) return;
      this._worldMapInputLockUntil = this.time.now + 250;
      this.pauseGame('world-map');
      this.scene.launch('WorldMapScene');
      this.scene.bringToTop('WorldMapScene');
    });

    // F1-F4：物品快捷栏
    const fKeys = [
      Phaser.Input.Keyboard.KeyCodes.F1,
      Phaser.Input.Keyboard.KeyCodes.F2,
      Phaser.Input.Keyboard.KeyCodes.F3,
      Phaser.Input.Keyboard.KeyCodes.F4
    ];
    fKeys.forEach((keyCode, i) => {
      const key = this.input.keyboard.addKey(keyCode);
      key.on('down', (event) => {
        if (event.originalEvent) event.originalEvent.preventDefault();
        this.useItemSlot(i);
      });
    });

    this.time.addEvent({
      delay: 30000,
      callback: () => SaveSystem.save(this),
      loop: true
    });
  }

  // ═══════════════════════════════════════════════════════════════
  //  开放世界入口
  // ═══════════════════════════════════════════════════════════════

  /**
   * 初始化开放世界系统：WorldGenerator + ChunkManager + 玩家
   * 替代原来的 loadLevel()
   */
  enterWorld(saveData = null) {
    this.useOpenWorld = true;

    // 1. 初始化世界状态
    if (saveData?.worldState) {
      this.worldState = WorldStateManager.deserialize(saveData.worldState);
    } else {
      this.worldState = new WorldStateManager();
    }

    // 2. 创建世界生成器（种子化，确定性）
    this.worldGenerator = new WorldGenerator(this.worldState.seed);

    // 3. 创建 Chunk 管理器
    this.chunkManager = new ChunkManager(this, this.worldGenerator, this.worldState);

    // 4.1 NPC 系统三件套（FactionSystem / NPCMemoryStore / NPCRegistry）
    this.factionSystem = FactionSystem.deserialize(this, saveData?.factionData);
    this.npcMemory = NPCMemoryStore.deserialize(this, saveData?.npcMemory);
    this.npcRegistry = new NPCRegistry(this);
    SystemRegistry.register('factionSystem', this.factionSystem);
    SystemRegistry.register('npcMemory', this.npcMemory);
    SystemRegistry.register('npcRegistry', this.npcRegistry);

    // 4.2 对话系统（ActionRegistry + DialogueEngine + DialoguePanel）
    this.actionRegistry = new ActionRegistry(this);
    this.dialogueEngine = new DialogueEngine(this, {
      memory: this.npcMemory,
      factions: this.factionSystem,
      actionRegistry: this.actionRegistry,
      dialogueLoader: getDialogueModule
    });
    SystemRegistry.register('actionRegistry', this.actionRegistry);
    SystemRegistry.register('dialogueEngine', this.dialogueEngine);

    // 4.3 商店系统（ShopService）
    this.shopService = ShopService.deserialize(this, saveData?.shopData);
    SystemRegistry.register('shopService', this.shopService);

    // 4.4 训练师系统（TrainerService）
    this.trainerService = new TrainerService(this);
    SystemRegistry.register('trainerService', this.trainerService);

    // 面板渲染挂到 UIScene 上（保证在 HUD/技能栏之上），事件仍订阅 MainGameScene
    // 延迟到 UIScene 完成 create 后再实例化
    const _createNpcPanels = () => {
      if (this._worldDisposed) return;
      const ui = this.scene.get('UIScene');
      this.dialoguePanel = new DialoguePanel(this, this.dialogueEngine, ui);
      this.shopPanel = new ShopPanel(this, this.shopService, ui);
      this.trainerPanel = new TrainerPanel(this, this.trainerService, ui);
    };
    const ui = this.scene.get('UIScene');
    this._createNpcPanels = _createNpcPanels;
    this._npcPanelUi = ui;
    if (ui && ui.sys?.settings?.status >= Phaser.Scenes.CREATING) {
      _createNpcPanels();
    } else if (ui) {
      ui.events.once('create', _createNpcPanels);
    } else {
      // UIScene 尚未实例化，下一帧再试
      this.time.delayedCall(0, _createNpcPanels);
    }

    // 4.5 同伴系统
    this.companionManager = new CompanionManager(this);
    SystemRegistry.register('companionManager', this.companionManager);

    // chunk → gameObjects 映射（独立于 chunkData，因为卸载时 chunkData 先被删除）
    this._chunkGameObjects = new Map();

    // 5. 设置物理世界边界
    // 必须在创建玩家之前，因为 Actor 构造函数调用 setCollideWorldBounds(true)
    this.physics.world.setBounds(0, 0, WORLD_WIDTH_PX, WORLD_HEIGHT_PX);

    // 5.1. 创建玩家（生成在城镇中心）
    const defaultSpawn = getDefaultWorldSpawn();
    const savedPos = saveData?.player?.position;
    const halfTile = WORLD_CONFIG.tileSize / 2;
    const spawnX = Number.isFinite(savedPos?.x)
      ? Phaser.Math.Clamp(savedPos.x, halfTile, WORLD_WIDTH_PX - halfTile)
      : defaultSpawn.x;
    const spawnY = Number.isFinite(savedPos?.y)
      ? Phaser.Math.Clamp(savedPos.y, halfTile, WORLD_HEIGHT_PX - halfTile)
      : defaultSpawn.y;
    if (saveData?.player) {
      this.registry.set('savedPlayerData', saveData.player);
    } else {
      this.registry.remove('savedPlayerData');
    }
    this._createWorldPlayer(spawnX, spawnY);

    // 5.5. 注册基础碰撞
    this.setupWorldCollisions();

    // 6. 摄像机跟随玩家（不设边界）
    this.startPlayerCameraFollow();
    // 不 setBounds — 世界由 Chunk 流式加载

    // 7. 注册 chunk 事件（必须在首次 update 之前）
    if (this._onWorldChunkLoaded) this.events.off('chunk-loaded', this._onWorldChunkLoaded);
    if (this._onWorldChunkUnloaded) this.events.off('chunk-unloaded', this._onWorldChunkUnloaded);
    if (this._onPlayerChunkChanged) this.events.off('player-chunk-changed', this._onPlayerChunkChanged);

    this._onWorldChunkLoaded = (data) => {
      this._registerChunkCollisions(data.chunkX, data.chunkY);
      this._spawnChunkEntities(data.chunkX, data.chunkY);
      // NPC: chunk 加载时生成该 chunk 配置的 NPC
      if (this.npcRegistry) this.npcRegistry.spawnChunk(data.chunkX, data.chunkY);
    };

    // chunk 卸载时清理实体
    this._onWorldChunkUnloaded = (data) => {
      this._despawnChunkEntities(data.chunkX, data.chunkY);
      // NPC: chunk 卸载时销毁非 persistent NPC
      if (this.npcRegistry) this.npcRegistry.despawnChunk(chunkKey(data.chunkX, data.chunkY));
    };
    this._onPlayerChunkChanged = ({ chunkX, chunkY }) => {
      this._checkLocationDiscovery(chunkX, chunkY);
      const biome = this.worldGenerator.getBiome(chunkX, chunkY);
      this.events.emit('levelChanged', BIOMES[biome]?.name || biome, 0);
    };
    this.events.on('chunk-loaded', this._onWorldChunkLoaded);
    this.events.on('chunk-unloaded', this._onWorldChunkUnloaded);
    this.events.on('player-chunk-changed', this._onPlayerChunkChanged);

    // 8. 首次触发 Chunk 加载（会发射 chunk-loaded 事件）
    this.chunkManager.update(spawnX, spawnY);

    console.log(`[MainGameScene] 开放世界已初始化 seed=${this.worldState.seed}`);
  }

  replaceWorldState(worldState) {
    if (!worldState) return;
    const seedChanged = this.worldState && this.worldState.seed !== worldState.seed;

    this.worldState = worldState;

    if (seedChanged || !this.worldGenerator) {
      this.worldGenerator = new WorldGenerator(this.worldState.seed);
    }

    if (this.chunkManager) {
      this.chunkManager.worldState = this.worldState;
      this.chunkManager.generator = this.worldGenerator;
    }
  }

  _shutdownWorld() {
    if (this._worldDisposed) return;
    this._worldDisposed = true;

    if (this._npcPanelUi && this._createNpcPanels) {
      this._npcPanelUi.events.off('create', this._createNpcPanels);
    }

    if (this._onWorldChunkLoaded) this.events.off('chunk-loaded', this._onWorldChunkLoaded);
    if (this._onWorldChunkUnloaded) this.events.off('chunk-unloaded', this._onWorldChunkUnloaded);
    if (this._onPlayerChunkChanged) this.events.off('player-chunk-changed', this._onPlayerChunkChanged);

    if (this.scene.isActive('WorldMapScene')) this.scene.stop('WorldMapScene');
    if (this.scene.isActive('PanelScene')) this.scene.stop('PanelScene');

    this.dialoguePanel?.destroy?.();
    this.shopPanel?.destroy?.();
    this.trainerPanel?.destroy?.();
    this._despawnAllWorldEntities?.();
    this.npcRegistry?.destroyAll?.();
    this.chunkManager?.destroy?.();
    this.soundManager?.destroy?.();
    this.musicEngine?.destroy?.();

    this._pauseReasons?.clear();
    this.gamePaused = false;
    this._chunkGameObjects?.clear();
    SystemRegistry.clear();

    this.chunkManager = null;
    this.npcRegistry = null;
    this.dialoguePanel = null;
    this.shopPanel = null;
    this.trainerPanel = null;
    this.soundManager = null;
    this.musicEngine = null;
  }

  /**
   * 创建开放世界中的玩家
   * 复用 LevelBuilder.createPlayer()，传入一个具有 playerStart 的虚拟 level 对象
   */
  _createWorldPlayer(x, y) {
    // 创建必要的空 physics groups（开放世界不使用 walls/obstacles groups）
    this.walls = this.physics.add.staticGroup();
    this.obstacles = this.physics.add.staticGroup();
    this.decorations = this.add.group();
    this.groundTiles = this.add.group();
    this.enemies = [];
    this.items = [];
    this.npcs = [];
    this.breakables = [];
    this.triggerZones = [];
    this.chests = [];
    this.shrines = [];
    this.enemyProjectiles = [];
    this.enemyHitboxes = [];
    this._enemySprites = this.physics.add.group();
    // Members already own configured bodies; the group is only a spatial index.
    this._enemySprites.internalCreateCallback = null;
    this._enemySprites.internalRemoveCallback = null;
    this._enemyGroupsByChunk = new Map();

    // 创建一个虚拟 level 对象来复用 LevelBuilder.createPlayer()
    // createPlayer 使用 level.playerStart.x/y 作为像素坐标
    const dummyLevel = {
      playerStart: { x, y }
    };
    this.mapData = [[0]]; // dummy — 开放世界不使用 mapData
    this.createPlayer(dummyLevel);
  }

  /**
   * 注册新加载 Chunk 的墙壁碰撞
   */
  _registerChunkCollisions(chunkX, chunkY) {
    const wallLayer = this.chunkManager.getWallLayer(chunkX, chunkY);
    if (!wallLayer || !this.player?.sprite) return;

    const chunkData = this.chunkManager.getChunk(chunkX, chunkY);
    if (!chunkData) return;

    // 初始化碰撞器数组（卸载时需要逐个销毁）
    if (!chunkData.colliders) chunkData.colliders = [];

    // 玩家 vs 墙壁层
    const playerCollider = this.physics.add.collider(this.player.sprite, wallLayer);
    chunkData.colliders.push(playerCollider);

    // One collider per spawn-chunk group replaces one collider per enemy.
    for (const [enemyChunkKey, enemyGroup] of this._enemyGroupsByChunk) {
      const [enemyChunkX, enemyChunkY] = enemyChunkKey.split(',').map(Number);
      if (Math.abs(enemyChunkX - chunkX) > 1 || Math.abs(enemyChunkY - chunkY) > 1) continue;
      this._registerEnemyGroupWallCollision(enemyGroup, wallLayer, chunkData);
    }

    console.log(`[MainGameScene] 注册碰撞 chunk(${chunkX},${chunkY})`);
  }

  /**
   * 开放世界碰撞设置（一次性注册）
   * Chunk 墙壁碰撞在 chunk-loaded 事件中动态注册
   */
  setupWorldCollisions() {
    if (!this.player?.sprite) return;

    // 玩家 vs 静态障碍物（虽然开放世界不使用这些 groups，但保持兼容）
    this.physics.add.collider(this.player.sprite, this.walls);
    this.physics.add.collider(this.player.sprite, this.obstacles);

    this._sharedEnemyColliders = [
      this.physics.add.collider(
        this.player.sprite,
        this._enemySprites,
        (playerSprite, enemySprite) => this.handleEnemyContact(enemySprite.enemyInstance),
        (playerSprite, enemySprite) => {
          const enemy = enemySprite.enemyInstance;
          if (!enemy || enemy._isDestroyed) return false;
          if (this.player.state === PlayerState.SKILL_CASTING) {
            const activeSkill = this.player.skillEngine.getActiveSkill();
            if (activeSkill?.effect.type === 'dash') return false;
          }
          enemySprite.body.pushable = false;
          return true;
        },
        this
      ),
      this.physics.add.overlap(
        this.player.attackHitbox,
        this._enemySprites,
        (hitbox, enemySprite) => this.handleAttackHit(enemySprite.enemyInstance),
        null,
        this
      ),
      this.physics.add.overlap(
        this.player.skillHitbox,
        this._enemySprites,
        (hitbox, enemySprite) => this.handleSkillHit(enemySprite.enemyInstance),
        null,
        this
      ),
    ];
  }

  _registerEnemyGroupWallCollision(enemyGroup, wallLayer, chunkData) {
    const collider = this.physics.add.collider(enemyGroup, wallLayer);
    chunkData.colliders ??= [];
    chunkData.colliders.push(collider);
    enemyGroup._worldColliders ??= [];
    enemyGroup._worldColliders.push(collider);
  }

  _destroyOwnedColliders(owner) {
    if (!owner?._worldColliders) return;
    for (const collider of owner._worldColliders) {
      if (collider?.world) collider.destroy();
    }
    owner._worldColliders.length = 0;
    for (const chunkData of this.chunkManager?.activeChunks?.values?.() || []) {
      if (chunkData.colliders) chunkData.colliders = chunkData.colliders.filter(collider => collider?.world);
    }
  }

  _destroyEnemyChunkGroup(chunkX, chunkY) {
    const key = chunkKey(chunkX, chunkY);
    const group = this._enemyGroupsByChunk?.get(key);
    if (!group) return;

    for (const collider of group._worldColliders || []) {
      if (collider?.world) collider.destroy();
    }
    group._worldColliders = [];
    for (const chunkData of this.chunkManager?.activeChunks?.values?.() || []) {
      if (chunkData.colliders) {
        chunkData.colliders = chunkData.colliders.filter(collider => collider?.world);
      }
    }
    if (group.scene && group.children) group.destroy(false);
    this._enemyGroupsByChunk.delete(key);
  }

  _removeWorldEntityEntry(ref) {
    if (!this._chunkGameObjects) return;
    for (const entries of this._chunkGameObjects.values()) {
      const index = entries.findIndex(entry => entry.ref === ref);
      if (index !== -1) {
        entries.splice(index, 1);
        return;
      }
    }
  }

  // ═════════���══════════════════════════════��══════════════════════
  //  Chunk 实体生成 / 回收
  // ═════════════════��═════════════════════════════════════════════

  /**
   * 将 chunk 的实体描述符实例化为真实 Phaser GameObjects
   */
  _spawnChunkEntities(chunkX, chunkY) {
    const chunkData = this.chunkManager.getChunk(chunkX, chunkY);
    if (!chunkData || !chunkData.entities) return;

    const key = chunkKey(chunkX, chunkY);
    const worldOffsetX = chunkX * WORLD_CHUNK_PX;
    const worldOffsetY = chunkY * WORLD_CHUNK_PX;

    // 初始化 gameObjects 列表
    const gameObjects = [];
    this._chunkGameObjects.set(key, gameObjects);

    for (const spawn of chunkData.entities) {
      const wx = worldOffsetX + spawn.localX * WORLD_CONFIG.tileSize + WORLD_CONFIG.tileSize / 2;
      const wy = worldOffsetY + spawn.localY * WORLD_CONFIG.tileSize + WORLD_CONFIG.tileSize / 2;

      if (spawn.type === 'chest') {
        this._spawnChest(wx, wy, spawn, gameObjects);
      } else if (spawn.type === 'shrine') {
        this._spawnShrine(wx, wy, spawn, gameObjects);
      } else if (spawn.type === 'bonfire') {
        this._spawnBonfire(wx, wy, spawn, gameObjects);
      } else if (spawn.type === 'npc') {
        this._spawnNPC(wx, wy, spawn, gameObjects);
      } else {
        // 敌人类型
        this._spawnEnemy(wx, wy, spawn, gameObjects);
      }
    }

    console.log(`[MainGameScene] 生成 chunk(${chunkX},${chunkY}) 实体: ${gameObjects.length} 个`);
  }

  /**
   * 检查 chunk 是否为特殊地点，首次发现时通知玩家
   */
  _checkLocationDiscovery(chunkX, chunkY) {
    const override = getLayoutOverride(chunkX, chunkY);
    if (!override) return;

    const flagKey = `discovered_${chunkX}_${chunkY}`;
    if (this.worldState?.hasFlag(flagKey)) return;

    // 首次发现，打标记
    this.worldState?.setFlag(flagKey, true);

    let msg = '';
    if (override.template === 'town_center') {
      msg = '发现城镇中心！传送点已解锁';
    } else if (override.template === 'camp_small') {
      msg = '发现营地！传送点已解锁';
    } else if (override.template === 'boss_arena') {
      msg = '发现 Boss 区域！传送点已解锁';
    }

    if (msg) {
      this.events.emit('showMessage', msg);
    }
  }

  /** 生成敌人 */
  _spawnEnemy(x, y, spawn, gameObjects) {
    const config = itemData.enemies?.[spawn.type];
    if (!config) return;

    const enemyCfg = getEnemyConfig(spawn.type);
    const tier = spawn.isBoss ? 'boss' : (enemyCfg.tier || 'normal');
    const finalLevel = spawn.level || 1;

    const enemy = new Enemy(this, x, y, {
      ...config,
      finalLevel,
      tier,
    });
    enemy.entityId = spawn.id;

    // 标记 Boss
    if (spawn.isBoss || enemyCfg.isBoss) {
      enemy.isBoss = true;
    }

    // 栓绳半径 — 不超出出生点太远（约半个 chunk），防止走出已加载区域
    enemy._leashRadius = 450;

    this.enemies.push(enemy);
    gameObjects.push({ ref: enemy, type: 'enemy', spawnId: spawn.id, colliders: [] });

    // 注册碰撞
    this._registerEnemyCollisions(enemy);
  }

  /** 为单个敌人注册所有碰撞 */
  _registerEnemyCollisions(enemy) {
    const enemyChunk = worldToChunk(enemy.spawnX, enemy.spawnY);
    const key = chunkKey(enemyChunk.chunkX, enemyChunk.chunkY);

    this._enemySprites.add(enemy.sprite);

    let enemyGroup = this._enemyGroupsByChunk.get(key);
    if (!enemyGroup) {
      enemyGroup = this.add.group();
      enemyGroup._worldColliders = [];
      this._enemyGroupsByChunk.set(key, enemyGroup);

      for (const [wallChunkKey, chunkData] of this.chunkManager.activeChunks) {
        const [wallChunkX, wallChunkY] = wallChunkKey.split(',').map(Number);
        if (Math.abs(enemyChunk.chunkX - wallChunkX) > 1 || Math.abs(enemyChunk.chunkY - wallChunkY) > 1) continue;
        if (chunkData.wallLayer) {
          this._registerEnemyGroupWallCollision(enemyGroup, chunkData.wallLayer, chunkData);
        }
      }
    }
    enemyGroup.add(enemy.sprite);
  }

  /** 生成宝箱 */
  _spawnChest(x, y, spawn, gameObjects) {
    const rare = spawn.rare || spawn.locked || false; // 兼容旧 locked 字段
    const sprite = this.physics.add.sprite(x, y,
      rare ? TEXTURES.CHEST_LOCKED : TEXTURES.CHEST_CLOSED);
    sprite.setOrigin(0.5, 0.5).setDepth(y);
    sprite.setDisplaySize(32, 28);
    sprite.body.setImmovable(true);
    sprite.body.setAllowGravity(false);

    const label = this.add.text(x, y - 24,
      rare ? '✦ 灵蕴宝匣 [E]' : '按 E 打开', {
        fontSize: '10px', fill: rare ? UI_THEME.text.brass : UI_THEME.text.muted,
        fontFamily: UI_THEME.font.body
      }).setOrigin(0.5).setDepth(y + 1).setVisible(false);

    const chest = {
      sprite, label, locked: false, opened: false,
      isRare: rare,
      lootTable: rare ? 'treasure_rare' : 'treasure_common',
      reward: { score: rare ? 50 : 20, healAmount: rare ? 25 : 0 },
      entityId: spawn.id
    };

    sprite.chestInstance = chest;
    this.chests.push(chest);
    // 玩家接近检测
    const overlap = this.physics.add.overlap(this.player.sprite, sprite,
      () => this.handleChestProximity(chest), null, this);
    gameObjects.push({ ref: chest, type: 'chest', spawnId: spawn.id, colliders: [overlap] });
  }

  /** 生成地标 POI（神殿/祭坛/石碑） */
  _spawnShrine(x, y, spawn, gameObjects) {
    const def = SHRINE_TYPES[spawn.shrineType] || SHRINE_TYPES.might;
    const used = !!this.worldState?.getFlag(`${spawn.id}_used`);

    const sprite = this.physics.add.sprite(x, y, TEXTURES.ARTIFACT);
    sprite.setOrigin(0.5, 0.5).setDepth(y);
    sprite.setDisplaySize(30, 30);
    sprite.setTint(used ? 0x555555 : def.glow);
    sprite.body.setImmovable(true);
    sprite.body.setAllowGravity(false);

    // 脉冲光环（未使用时）
    let glow = null;
    if (!used) {
      glow = this.add.circle(x, y, 22, def.glow, 0.22).setDepth(y - 1);
      this.tweens.add({ targets: glow, scale: 1.3, alpha: 0.08, duration: 900, yoyo: true, repeat: -1 });
    }

    const label = this.add.text(x, y - 26, used ? `${def.name}（已枯竭）` : `${def.icon} ${def.name} [E]`, {
      fontSize: '10px', fill: used ? UI_THEME.text.disabled : UI_THEME.text.brass, fontFamily: UI_THEME.font.body
    }).setOrigin(0.5).setDepth(y + 1).setVisible(false);

    const shrine = { sprite, glow, label, def, used, entityId: spawn.id };
    sprite.shrineInstance = shrine;
    this.shrines = this.shrines || [];
    this.shrines.push(shrine);
    const overlap = this.physics.add.overlap(
      this.player.sprite, sprite, () => this.handleShrineProximity(shrine), null, this
    );
    gameObjects.push({ ref: shrine, type: 'shrine', spawnId: spawn.id, colliders: [overlap] });
  }

  /** 生成篝火 */
  _spawnBonfire(x, y, spawn, gameObjects) {
    const sprite = this.physics.add.sprite(x, y, 'campfire');
    sprite.setOrigin(0.5, 0.5).setDepth(y);
    sprite.setDisplaySize(28, 28);
    sprite.body.setImmovable(true);
    sprite.body.setAllowGravity(false);

    // 标记为篝火（InteractionHandler 识别）
    sprite.bonfireInstance = { id: spawn.id, x, y };

    const label = this.add.text(x, y - 24, '按 E 休息', {
      fontSize: '10px', fill: UI_THEME.text.cinnabarBright, fontFamily: UI_THEME.font.body
    }).setOrigin(0.5).setDepth(y + 1).setVisible(false);

    // 火焰闪烁动画
    this.tweens.add({
      targets: sprite, alpha: 0.7,
      duration: 400, yoyo: true, repeat: -1
    });

    const bonfire = { sprite, label, id: spawn.id };

    // 玩家接近检测
    const overlap = this.physics.add.overlap(this.player.sprite, sprite, () => {
      if (this.dialoguing) return;
      this.player.setInteractTarget(sprite);
      label.setVisible(true);
    }, null, this);
    gameObjects.push({ ref: bonfire, type: 'bonfire', spawnId: spawn.id, colliders: [overlap] });
  }

  /** 生�� NPC */
  _spawnNPC(x, y, spawn, gameObjects) {
    // 根据 subtype 决定 NPC 配置
    const npcConfigs = {
      shop:     { name: '坊市掌柜', dialogues: ['道友请看。', '需要添置些什么？'] },
      smith:    { name: '炼器师', dialogues: ['要淬炼法器吗？', '火候与灵材，缺一不可。'] },
      quest:    { name: '悬赏堂', dialogues: ['堂中有新的悬赏。', '此行多加小心。'] },
      merchant: { name: '云游行商', dialogues: ['沿商路带来一些山外货。', '道友不妨看看。'] },
    };
    const cfg = npcConfigs[spawn.subtype] || { name: 'NPC', dialogues: ['...'] };

    const npc = new NPC(this, x, y, {
      id: spawn.id,
      name: cfg.name,
      dialogues: cfg.dialogues,
    });

    this.npcs.push(npc);
    // 玩家接近检测
    const overlap = this.physics.add.overlap(this.player.sprite, npc.sprite,
      () => this.handleNPCProximity(npc), null, this);
    gameObjects.push({ ref: npc, type: 'npc', spawnId: spawn.id, colliders: [overlap] });
  }

  /**
   * 卸载 chunk 时销毁所有关联的 GameObjects
   */
  _despawnChunkEntities(chunkX, chunkY) {
    const key = chunkKey(chunkX, chunkY);
    // chunkData 可能已被 destroyChunk 删除，用临时缓存
    const objs = this._chunkGameObjects?.get(key);
    if (!objs) return;

    for (const entry of objs) {
      if (entry.colliders) {
        for (const collider of entry.colliders) {
          if (collider?.world) collider.destroy();
        }
        entry.colliders.length = 0;
      }
      if (entry.type === 'enemy') {
        const enemy = entry.ref;
        const idx = this.enemies.indexOf(enemy);
        if (idx > -1) this.enemies.splice(idx, 1);
        // destroy() 内部有 _isDestroyed 防重入
        this._destroyOwnedColliders(enemy);
        if (enemy.destroy) enemy.destroy();
        // 确保血条一定被清理
        if (enemy.destroyHealthBar) enemy.destroyHealthBar();
      } else if (entry.type === 'chest') {
        const chest = entry.ref;
        const idx = this.chests.indexOf(chest);
        if (idx > -1) this.chests.splice(idx, 1);
        if (chest.sprite) chest.sprite.destroy();
        if (chest.label) chest.label.destroy();
      } else if (entry.type === 'shrine') {
        const shrine = entry.ref;
        const idx = this.shrines.indexOf(shrine);
        if (idx > -1) this.shrines.splice(idx, 1);
        if (shrine.sprite) shrine.sprite.destroy();
        if (shrine.glow) shrine.glow.destroy();
        if (shrine.label) shrine.label.destroy();
      } else if (entry.type === 'bonfire') {
        const bonfire = entry.ref;
        if (bonfire.sprite) bonfire.sprite.destroy();
        if (bonfire.label) bonfire.label.destroy();
      } else if (entry.type === 'npc') {
        const npc = entry.ref;
        const idx = this.npcs.indexOf(npc);
        if (idx > -1) this.npcs.splice(idx, 1);
        if (npc.destroy) npc.destroy();
        else if (npc.sprite) npc.sprite.destroy();
      }
    }

    this._destroyEnemyChunkGroup(chunkX, chunkY);
    this._chunkGameObjects.delete(key);
  }

  /**
   * 清理所有开放世界实体 GameObjects（篝火休息时调用）
   */
  _despawnAllWorldEntities() {
    if (!this._chunkGameObjects) return;
    const keys = [...this._chunkGameObjects.keys()];
    for (const key of keys) {
      const [cx, cy] = key.split(',').map(Number);
      this._despawnChunkEntities(cx, cy);
    }
    // 确保数组也清空
    this.enemies = [];
    this.chests = [];
    this.shrines = [];
    if (this._enemySprites?.scene && this._enemySprites.children) this._enemySprites.clear();
    for (const group of this._enemyGroupsByChunk?.values?.() || []) {
      if (group.scene && group.children) group.destroy(false);
    }
    this._enemyGroupsByChunk?.clear?.();
    // 不清空 npcs — NPC 在篝火休息后仍应存在，但上面已经逐个销毁了
    this.npcs = [];
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
    this.shrines = [];

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
    this.startPlayerCameraFollow();
    this.cameras.main.setBounds(0, 0, mapWidth, mapHeight);
  }

  startPlayerCameraFollow() {
    const camera = this.cameras.main;
    camera.setDeadzone();
    // roundPixels=false：滚动保持亚像素连续，避免取整造成的 3/4px 步进抖动
    camera.startFollow(this.player.sprite, false, 1, 1);
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

      // Check if it's a shrine / landmark
      if (target.shrineInstance) {
        this.handleShrineInteract(target.shrineInstance);
        return;
      }

      // Check if it's a portal
      if (target.portalInstance) {
        this.handlePortalInteract();
        return;
      }

      // Check if it's a bonfire
      if (target.bonfireInstance) {
        this.handleBonfireInteraction(target.bonfireInstance);
        return;
      }

      if (npcInst && typeof npcInst.getNextDialogue === 'function') {
        this.handleNPCDialogue(npcInst);
      }
    });

    // 技能 hitbox 生成 → 按 owner 派系注册 overlap
    //   友方（出战伙伴）hitbox → 伤害敌人
    //   敌人 hitbox → 伤害玩家 + 出战伙伴
    this.events.off('enemyHitboxSpawned');
    this.events.on('enemyHitboxSpawned', (hitbox, lifetime) => {
      if (!hitbox || !this.player) return;
      this.enemyHitboxes = this.enemyHitboxes || [];
      this.enemyHitboxes.push(hitbox);
      const owner = hitbox._enemyOwner;
      const baseDmg = hitbox._enemySkillDamage || 0;
      const isAlly = owner?.faction === 'ally';
      const hitSet = new Set(); // 单次 hitbox 每个目标只命中一次
      let overlap;

      if (isAlly) {
        // 友方伙伴 → 敌人
        const enemySprites = this.enemies.map(e => e.sprite).filter(s => s && s.active);
        overlap = this.physics.add.overlap(hitbox, enemySprites, (hb, eSprite) => {
          const e = eSprite.enemyInstance;
          if (!e || hitSet.has(e) || e.state === EnemyState.DEAD || e.isInvulnerable) return;
          if (e.faction === 'ally' || e.faction === 'player') return;
          hitSet.add(e);
          const dmg = Math.max(1, Math.round(baseDmg * getLevelSuppression(owner.finalLevel || 1, e.finalLevel || 1)));
          e.takeDamage(dmg, owner.sprite?.x, owner.sprite?.y);
        });
      } else {
        // 敌人 → 玩家 + 出战伙伴
        const comp = this.companionManager?.getActiveNpc();
        const targets = [this.player.sprite];
        if (comp?.sprite?.active && comp.state !== EnemyState.DEAD && comp.hp > 0) targets.push(comp.sprite);
        overlap = this.physics.add.overlap(hitbox, targets, (hb, tSprite) => {
          if (baseDmg <= 0) return;
          const isPlayerT = tSprite === this.player.sprite;
          const targetActor = isPlayerT ? this.player : tSprite.combatNpcInstance;
          if (!targetActor || hitSet.has(targetActor) || targetActor.isInvulnerable) return;
          hitSet.add(targetActor);
          const lvlT = isPlayerT ? (this.levelSystem?.level || 1) : (targetActor.finalLevel || 1);
          const dmg = Math.round(baseDmg * getLevelSuppression(owner?.finalLevel || 1, lvlT));
          targetActor.takeDamage(dmg, owner?.sprite?.x, owner?.sprite?.y);
        });
      }

      this.time.delayedCall(lifetime || 200, () => {
        if (overlap) this.physics.world.removeCollider(overlap);
        const idx = this.enemyHitboxes?.indexOf(hitbox);
        if (idx >= 0) this.enemyHitboxes.splice(idx, 1);
        if (hitbox.active) hitbox.destroy();
      });
    });

    // 弹道生成 → 同样按 owner 派系注册 overlap
    this.events.off('enemyProjectileSpawned');
    this.enemyProjectiles = this.enemyProjectiles || [];
    this.events.on('enemyProjectileSpawned', (proj) => {
      if (!proj || !this.player) return;
      this.enemyProjectiles.push(proj);
      const isAlly = proj.owner?.faction === 'ally';
      if (isAlly) {
        const enemySprites = this.enemies.map(e => e.sprite).filter(s => s && s.active);
        this.physics.add.overlap(proj.sprite, enemySprites, (ps, eSprite) => {
          const e = eSprite.enemyInstance;
          if (!e || e.state === EnemyState.DEAD || e.faction === 'ally' || e.faction === 'player') return;
          proj.onHit(e);
        });
      } else {
        const comp = this.companionManager?.getActiveNpc();
        const targets = [this.player.sprite];
        if (comp?.sprite?.active && comp.state !== EnemyState.DEAD && comp.hp > 0) targets.push(comp.sprite);
        this.physics.add.overlap(proj.sprite, targets, (ps, tSprite) => {
          const isPlayerT = tSprite === this.player.sprite;
          const targetActor = isPlayerT ? this.player : tSprite.combatNpcInstance;
          if (!targetActor) return;
          if (isPlayerT && this.player.isInvulnerable) return;
          proj.onHit(targetActor);
        });
      }
    });

    this.events.on('enemyDeath', (enemy) => {
      this._destroyOwnedColliders(enemy);
      this._removeWorldEntityEntry(enemy);
      const idx = this.enemies.indexOf(enemy);
      if (idx > -1) this.enemies.splice(idx, 1);
      const g = this.registry.get('gameState');
      g.score += 20;
      this.registry.set('gameState', g);
      this.events.emit('scoreChanged', g.score);

      // 标记击杀到世界状态
      if (this.worldState && enemy.entityId) {
        this.worldState.markEntityKilled(enemy.entityId);
        // Boss 永久击杀标记
        if (enemy.isBoss) {
          this.worldState.setFlag(`${enemy.entityId}_defeated`, true);
        }
      }

      // Grant XP for kill
      let xpAmount = 0;
      if (this.levelSystem) {
        xpAmount = this.levelSystem.getEnemyXp(enemy.finalLevel || 1, enemy.tier);
        this.levelSystem.addXp(xpAmount, enemy.finalLevel || 1);
      }

      // Show cultivation progress floating text
      if (enemy.sprite && xpAmount > 0) {
        const xpText = this.add.text(
          enemy.sprite.x, enemy.sprite.y - 20,
          `修为 +${xpAmount}`, {
            fontSize: '12px', fill: UI_THEME.text.jadeBright, fontFamily: UI_THEME.font.body, fontStyle: 'bold'
          }
        ).setOrigin(0.5).setDepth(100);

        this.tweens.add({
          targets: xpText, y: xpText.y - 30, alpha: 0,
          duration: 1200,
          onComplete: () => xpText.destroy()
        });
      }
    });

    this.events.on('enemyDropLoot', (enemyId, x, y, enemyLevel, isBoss, tier) => {
      const dropBonus = this.player ? this.player.stats.getDerived().dropBonus : 0;
      const drops = LootEngine.roll(enemyId, dropBonus, enemyLevel, isBoss, tier);

      drops.forEach((drop, i) => {
        // Scatter drops in a circle to prevent stacking
        const angle = (Math.PI * 2 / Math.max(drops.length, 1)) * i + Math.random() * 0.5;
        const dist = 20 + Math.random() * 15;
        const dx = x + Math.cos(angle) * dist;
        const dy = y + Math.sin(angle) * dist;

        // 装备实例用 templateId 做贴图查找，并传递完整实例数据
        const spawnType = drop.itemData.templateId || drop.itemData.id;
        this.events.emit('spawnItem', spawnType, dx, dy, drop.quantity, drop.itemData.type === 'equipment' ? drop.itemData : null);

        // Rarity glow for equipment drops
        if (drop.itemData.type === 'equipment') {
          const rarityGlowColors = {
            uncommon: 0x44aa44, rare: 0x4444ff, epic: 0xaa44aa, legendary: 0xffaa00, mythic: 0xff4444
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

        // Legendary / Mythic drop notification
        if (drop.itemData.rarity === 'legendary' || drop.itemData.rarity === 'mythic') {
          const rarityTheme = getRarityTheme(drop.itemData.rarity);
          const msg = this.add.text(
            this.cameras.main.width / 2, 60,
            `${RARITY_LABELS[drop.itemData.rarity]}器物掉落: ${drop.itemData.name}`,
            {
              fontSize: '16px', fill: rarityTheme.text, fontFamily: UI_THEME.font.body,
              fontStyle: 'bold', stroke: UI_THEME.text.shadow, strokeThickness: 3
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

    this.events.on('spawnItem', (type, x, y, quantity = 1, equipmentInstance = null) => {
      const config = itemData.items[type];
      if (config || equipmentInstance) {
        const displayConfig = config || { name: equipmentInstance.name, texture: 'weapon_icon' };
        const item = new Item(this, x, y, type, {
          id: `${type}_${Date.now()}_${Math.random().toString(36).substr(2, 4)}`,
          ...displayConfig,
          spawnQuantity: quantity,
          pickupDelay: 500,  // 掉落物 0.5 秒后才可拾取，让玩家能看到
          onCollect: (item) => {
            if (type === 'coin') {
              const g = this.registry.get('gameState');
              g.score += item.value * quantity;
              this.registry.set('gameState', g);
              this.events.emit('scoreChanged', g.score);
            }
          }
        });
        // 装备实例数据挂载到 Item 上，拾取时用于入背包
        if (equipmentInstance) {
          item.equipmentInstance = equipmentInstance;
        }
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
        color: UI_THEME.text.jadeBright,
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
        // 重算装备加成（让装备 maxHp 重新合并到 flatBonuses，避免被上一行覆盖）
        if (this.equipmentSystem) this.equipmentSystem.applyBonuses();
        this.player.stats.invalidate();
        this.player.refreshStats();

        // Full HP/MP restore
        this.player.hp = this.player.maxHp;
        this.player.mana = this.player.maxMana;
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

      // Realm breakthrough floating text
      const lvlText = this.add.text(
        this.cameras.main.width / 2, this.cameras.main.height / 2 - 50,
        `境界突破 · ${level}重`, {
          fontSize: '28px', fill: UI_THEME.text.brass, fontFamily: UI_THEME.font.display, fontStyle: 'bold'
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
          case 'restore_mana':
            if (this.player) {
              this.player.mana = Math.min(this.player.maxMana, this.player.mana + itemData.effect.amount);
              this.player.onResourceChanged();
            }
            break;
        }
      }
    });
  }

  showQuickMessage(text, color = UI_THEME.text.paper) {
    const msg = this.add.text(
      this.cameras.main.width / 2,
      this.cameras.main.height / 2 - 60,
      text,
      {
        fontSize: '14px',
        fill: color,
        backgroundColor: '#0d1714ee',
        padding: { x: 8, y: 4 },
        fontFamily: UI_THEME.font.body,
      }
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
      this._restoreCompanionIfReady();
      return;
    }
    // 否则按当前活跃槽（兜底：找第一个有数据的槽）
    const active = this.registry.get('activeSaveSlot') || 1;
    if (SaveSystem.hasSave(active)) {
      SaveSystem.load(this, active);
    }
    this._restoreCompanionIfReady();
  }

  /** 存档加载后：补齐名册中所有伙伴实例并部署出战者 */
  _restoreCompanionIfReady() {
    if (!this.companionManager) return;
    this.companionManager.restoreInstances();
  }

  /** 敌人目标：玩家与出战伙伴中更近的一个（伙伴会分担仇恨） */
  _enemyTarget(enemy) {
    const playerSprite = this.player?.sprite;
    const comp = this.companionManager?.getActiveNpc();
    const compSprite = (comp && comp.sprite?.active && comp.state !== EnemyState.DEAD && comp.hp > 0)
      ? comp.sprite : null;
    if (!compSprite) return playerSprite;
    if (!playerSprite || !enemy?.sprite) return playerSprite || compSprite;
    const dpl = Phaser.Math.Distance.Between(enemy.sprite.x, enemy.sprite.y, playerSprite.x, playerSprite.y);
    const dco = Phaser.Math.Distance.Between(enemy.sprite.x, enemy.sprite.y, compSprite.x, compSprite.y);
    return dco < dpl ? compSprite : playerSprite;
  }

  pauseGame(reason = 'legacy') {
    this._pauseReasons ??= new Set();
    this._pauseReasons.add(reason);
    this.physics.pause();
    this.gamePaused = true;
  }

  resumeGame(reason = 'legacy') {
    this._pauseReasons?.delete(reason);
    this.gamePaused = (this._pauseReasons?.size || 0) > 0;
    if (!this.gamePaused && this.hitStopTimer <= 0 && !this._worldDisposed) {
      this.physics.resume();
    }
  }

  /** 使用物品快捷栏第 i 个槽位（按物品 id 查找背包） */
  useItemSlot(i) {
    const player = this.player;
    if (!player || !this.inventory) return;
    const itemId = player.itemSlots?.[i];
    if (!itemId) return;
    const slotIdx = this.inventory.slots.findIndex(
      s => s && s.id === itemId && s.type === 'consumable'
    );
    if (slotIdx === -1) return;
    this.inventory.useItem(slotIdx);
    this.events.emit('itemSlotsChanged');
  }

  getInteractionPriority(target) {
    if (target.npcInstance && target.npcInstance.dialogues) return 10;
    if (target.bonfireInstance) return 9;
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

    // ─── 音频：音乐状态机 + 城镇/野外环境曲切换 ───
    if (this.soundManager) {
      this.soundManager.update(time, delta);
      if (this.player?.sprite) {
        const town = getDefaultWorldSpawn();
        const dx = this.player.sprite.x - town.x;
        const dy = this.player.sprite.y - town.y;
        const townRadius = WORLD_CHUNK_PX * 1.2;
        const zone = (dx * dx + dy * dy) < (townRadius * townRadius) ? 'town' : 'wild';
        if (zone !== this._currentMusicZone) {
          this._currentMusicZone = zone;
          this.soundManager.setAmbient(zone === 'town' ? 'town' : 'explore');
        }
      }
    }

    // ─── 开放世界系统更新 ─────────────────────────
    if (this.useOpenWorld && this.chunkManager && this.player?.sprite) {
      // Chunk 流式加载/卸载
      this.chunkManager.update(this.player.sprite.x, this.player.sprite.y);
    }

    // NPC 注册表逐帧更新（位置同步、巡逻、可视化）
    if (this.npcRegistry) this.npcRegistry.update(delta);

    // 同伴跟随更新
    if (this.companionManager) this.companionManager.update(delta);

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
      if (!this.useOpenWorld) {
        // 关卡制模式：更新所有敌人
        this.enemies.forEach(e => {
          e.update(this._enemyTarget(e), delta);
          if (e.sprite) e.sprite.setDepth(e.sprite.y + e.sprite.x * 0.001);
        });
      } else {
        // 开放世界：只更新镜头附近的活跃敌人
        const cam = this.cameras.main;
        const camCX = cam.scrollX + cam.width / 2;
        const camCY = cam.scrollY + cam.height / 2;
        const activeRadius2 = 1200 * 1200;

        for (let i = this.enemies.length - 1; i >= 0; i--) {
          const e = this.enemies[i];
          if (!e.sprite?.active || e._isDestroyed) {
            // 已死亡/已销毁：清理残留血条并移除
            if (e._isDestroyed || !e.sprite?.active) {
              e.destroyHealthBar();
              this.enemies.splice(i, 1);
            }
            continue;
          }
          // 检测敌人是否走进了未加载的 chunk 区域
          const { chunkX: ecx, chunkY: ecy } = worldToChunk(e.sprite.x, e.sprite.y);
          const enemyChunkKey = chunkKey(ecx, ecy);
          if (!this.chunkManager.activeChunks.has(enemyChunkKey)) {
            // 敌人走出已加载区域，拉回出生点并重置巡逻
            e.sprite.setPosition(e.spawnX, e.spawnY);
            e.sprite.setVelocity(0, 0);
            if (e.state !== EnemyState.DEAD) {
              e.inCombat = false;
              e.startPatrol();
            }
            continue;
          }
          const dx = e.sprite.x - camCX;
          const dy = e.sprite.y - camCY;
          const isNearCamera = dx * dx + dy * dy < activeRadius2;
          const shouldSimulate = isNearCamera && e.state !== EnemyState.DEAD;
          if (shouldSimulate && !e.sprite.body.enable) {
            this.physics.world.enable(e.sprite);
          } else if (!shouldSimulate && e.sprite.body.enable) {
            e.sprite.setVelocity(0, 0);
            this.physics.world.disable(e.sprite);
          }
          if (isNearCamera) {
            e.update(this._enemyTarget(e), delta);
          }
          if (e.sprite) e.sprite.setDepth(e.sprite.y + e.sprite.x * 0.001);
        }
      }
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

    // 地标 POI 标签按距离显隐
    if (this.shrines) {
      this.shrines.forEach(shrine => {
        if (shrine.used) { if (shrine.label) shrine.label.setVisible(false); return; }
        if (this.player?.sprite && shrine.label) {
          const dist = Phaser.Math.Distance.Between(
            this.player.sprite.x, this.player.sprite.y, shrine.sprite.x, shrine.sprite.y
          );
          shrine.label.setVisible(dist < 60);
        }
      });
    }

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
    // sprite 用 y 坐标作 depth (Y 排序)，弹窗需高于世界最大 Y。
    const container = this.add.container(0, 0).setDepth(30000).setScrollFactor(0);

    // 背景遮罩
    const overlay = this.add.rectangle(w / 2, h / 2, w, h, UI_THEME.colors.shadow, 0.68)
      .setScrollFactor(0).setInteractive();
    container.add(overlay);

    // 主面板
    const pw = 360, ph = 220;
    const panel = this.add.rectangle(w / 2, h / 2, pw, ph, UI_THEME.colors.panel, 0.98)
      .setScrollFactor(0).setStrokeStyle(2, UI_THEME.colors.border);
    container.add(panel);

    const title = this.add.text(w / 2, h / 2 - 80, '游戏菜单', {
      fontSize: '18px', fill: UI_THEME.text.brass, fontFamily: UI_THEME.font.display, fontStyle: 'bold'
    }).setOrigin(0.5).setScrollFactor(0);
    container.add(title);

    // 按钮工厂
    const mkBtn = (y, label, color, onClick) => {
      const bg = this.add.rectangle(w / 2, y, 240, 36, UI_THEME.colors.panelRaised)
        .setScrollFactor(0).setStrokeStyle(1, color)
        .setInteractive({ useHandCursor: true });
      const txt = this.add.text(w / 2, y, label, {
        fontSize: '14px', fill: UI_THEME.text.paper, fontFamily: UI_THEME.font.body, fontStyle: 'bold'
      }).setOrigin(0.5).setScrollFactor(0);
      container.add([bg, txt]);
      bg.on('pointerover', () => bg.setFillStyle(UI_THEME.colors.panelHover));
      bg.on('pointerout', () => bg.setFillStyle(UI_THEME.colors.panelRaised));
      bg.on('pointerdown', onClick);
    };

    mkBtn(h / 2 - 35, '保存进度...', UI_THEME.colors.jade, () => {
      this._closeExitConfirm();
      // 暂停游戏，打开存档选择
      this.pauseGame('save-select');
      this.scene.launch('SaveSelectScene', {
        mode: 'save',
        returnTo: 'MainGameScene'
      });
      this.scene.bringToTop('SaveSelectScene');
    });

    mkBtn(h / 2 + 5, '返回主菜单', UI_THEME.colors.brass, () => {
      try { SaveSystem.save(this); } catch (e) {}
      this._closeExitConfirm();
      this.scene.stop('UIScene');
      this.scene.stop('PanelScene');
      this.scene.start('MainMenuScene');
    });

    mkBtn(h / 2 + 45, '继续游戏', UI_THEME.colors.border, () => this._closeExitConfirm());

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
