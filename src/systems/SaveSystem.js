import { WorldStateManager } from '../world/WorldStateManager.js';
import { getDefaultWorldSpawn } from '../world/worldConfig.js';
import { THEME_CONFIG } from '../config/themeConfig.js';

/**
 * 存档/读档系统（3 槽位）
 *
 * 槽位 ID 1, 2, 3，存储 key 形如 'pixel_adventure_save_1'。
 * 兼容旧版：迁移老 key 'pixel_adventure_save' 到槽 1。
 *
 * 当前活跃槽位记在 registry.activeSaveSlot（默认 1），auto-save 会写到此槽位。
 */
export class SaveSystem {
  static SAVE_KEY_PREFIX = 'pixel_adventure_save_';
  static OLD_SAVE_KEY = 'pixel_adventure_save';
  static SLOT_COUNT = 3;
  static SAVE_VERSION = '3.0.0';  // v3: 关卡制→开放世界迁移
  static STORY_VERSION = 1;       // v1: 主线链式四幕 + 序章 + 结局（体验弧第一阶段）

  /** 比较语义版本号，返回 -1/0/1 */
  static _compareVersions(a, b) {
    const pa = (a || '0.0.0').split('.').map(Number);
    const pb = (b || '0.0.0').split('.').map(Number);
    for (let i = 0; i < 3; i++) {
      if ((pa[i] || 0) < (pb[i] || 0)) return -1;
      if ((pa[i] || 0) > (pb[i] || 0)) return 1;
    }
    return 0;
  }

  /** 取槽位 key */
  static _key(slotId) {
    return `${SaveSystem.SAVE_KEY_PREFIX}${slotId}`;
  }

  /** 对读出的存档做一次内存态迁移，不直接写回 localStorage。 */
  static _normalizeSaveData(saveData) {
    if (!saveData || !saveData.version) return null;

    // 旧存档迁移：关卡制 → 开放世界 (v3.0.0)
    if (SaveSystem._compareVersions(saveData.version, '3.0.0') < 0) {
      // 旧关卡坐标在开放世界中无意义，重置到城镇中心
      if (saveData.player) {
        saveData.player.position = getDefaultWorldSpawn();
      }
    }

    if ((saveData.themeVersion || 0) < THEME_CONFIG.version) {
      saveData.meta = saveData.meta || {};
      saveData.meta.levelName = '云荒游历';
      saveData.themeVersion = THEME_CONFIG.version;
    }

    if ((saveData.storyVersion || 0) < SaveSystem.STORY_VERSION) {
      SaveSystem._migrateStoryArc(saveData);
      saveData.storyVersion = SaveSystem.STORY_VERSION;
    }

    return saveData;
  }

  /**
   * storyVersion 1 迁移：主线由"四个并列可接"改为"序章 + 链式四幕"。
   * 规则（见 docs/plans/2026-08-19-experience-arc-phase1-design.md 第 7 节）：
   *   - 从未开始主线的老档 → 四幕全部回锁，重新从雷九登记开始（无进度损失）
   *   - 已开始的老档 → 跳过序章；已完成/进行中的幕保留，未触碰的幕回锁；
   *     多幕同时进行的保持 active（stage 机 from 守卫保证不会回退）
   *   - 雷九 stage 按链条进度推导写入 npcMemory
   *   - 已通关老档 → post 状态 + world_calm（未拾印则读档时补生成古印，可补看结局）
   */
  static _migrateStoryArc(saveData) {
    const ACTS = ['ow_first_hunt', 'ow_goblin_threat', 'ow_bone_legion', 'ow_slay_king'];
    const quests = Array.isArray(saveData.quests) ? saveData.quests : null;
    if (!quests) return; // 无任务数据（极老档）：按全新链条走序章

    const byId = Object.fromEntries(quests.map(q => [q.id, q]));
    const acts = ACTS.map(id => byId[id]).filter(Boolean);
    const started = acts.some(q => q.status === 'active' || q.status === 'completed');

    if (!started) {
      // 从未开始：全部回锁，走完整序章（不标 prologue_done）
      acts.forEach(q => { q.status = 'locked'; });
      return;
    }

    // 已开始：跳过序章
    if (!byId.ow_prologue) {
      quests.push({ id: 'ow_prologue', status: 'completed', objectives: [{ id: 'meet_leijou', current: 1 }] });
    } else {
      byId.ow_prologue.status = 'completed';
    }

    // 未触碰的幕（老档默认 available）回锁；active/completed 保留
    acts.forEach(q => { if (q.status === 'available') q.status = 'locked'; });

    // 雷九 stage 推导（取最高进度里程碑）
    const status = (id) => byId[id]?.status;
    let stage = 'act1';
    if (status('ow_slay_king') === 'completed') stage = 'post';
    else if (status('ow_slay_king') === 'active') stage = 'act4';
    else if (status('ow_bone_legion') === 'completed') stage = 'act3_done';
    else if (status('ow_bone_legion') === 'active') stage = 'act3';
    else if (status('ow_goblin_threat') === 'completed') stage = 'act2_done';
    else if (status('ow_goblin_threat') === 'active') stage = 'act2';
    else if (status('ow_first_hunt') === 'completed') stage = 'act1_done';

    // worldState flags：仅在已有 worldState 时写入（凭空造壳会丢失世界种子）。
    // 缺 worldState 的极老档由 ow_prologue=completed 兜底，不会重播序章。
    if (saveData.worldState && Array.isArray(saveData.worldState.permanentFlags)) {
      const flags = new Map(saveData.worldState.permanentFlags);
      flags.set('prologue_done', true);
      if (stage === 'post') {
        flags.set('world_calm', true);
        // ending_done 故意不设：老档通关玩家读档后可拾印补看结局
      }
      saveData.worldState.permanentFlags = [...flags.entries()];
    }

    saveData.npcMemory = saveData.npcMemory || {};
    saveData.npcMemory.bounty_officer = saveData.npcMemory.bounty_officer || {};
    saveData.npcMemory.bounty_officer.stage = stage;
  }

  /** 读取完整存档数据，供场景在创建世界前取得 seed / 玩家位置。 */
  static readSaveData(slotId) {
    try {
      const saveString = localStorage.getItem(SaveSystem._key(slotId));
      if (!saveString) return null;
      return SaveSystem._normalizeSaveData(JSON.parse(saveString));
    } catch (_) {
      return null;
    }
  }

  /** 老存档迁移到槽 1（仅在槽 1 还没存档时迁） */
  static migrateOldSave() {
    try {
      const old = localStorage.getItem(SaveSystem.OLD_SAVE_KEY);
      if (!old) return;
      const slot1Key = SaveSystem._key(1);
      if (!localStorage.getItem(slot1Key)) {
        localStorage.setItem(slot1Key, old);
        console.log('[SaveSystem] 老存档已迁移到槽 1');
      }
      localStorage.removeItem(SaveSystem.OLD_SAVE_KEY);
    } catch (_) {}
  }

  /** 取/设当前活跃槽位（auto-save 写入此槽） */
  static getActiveSlot(scene) {
    return (scene?.registry?.get('activeSaveSlot')) || 1;
  }

  static setActiveSlot(scene, slotId) {
    if (scene?.registry) scene.registry.set('activeSaveSlot', slotId);
  }

  /**
   * 保存到指定槽位
   * @param {Phaser.Scene} scene
   * @param {number} [slotId] 默认当前活跃槽
   */
  static save(scene, slotId) {
    if (slotId == null) slotId = SaveSystem.getActiveSlot(scene);
    try {
      const gameState = scene.registry.get('gameState') || {};
      // 秘境内存档记录洞口坐标(读档一律回大世界,副本重置)
      const playerPosition = (scene.worldContext?.type === 'site' && scene.worldContext.returnPos)
        ? { ...scene.worldContext.returnPos }
        : (scene.player ? scene.player.getPosition() : null);
      const levelSystem = scene.levelSystem;
      const levelName = (typeof scene.currentLevel === 'number')
        ? (scene.registry.get('levelName') || `第${scene.currentLevel + 1}关`)
        : '云荒游历';

      const saveData = {
        timestamp: Date.now(),
        version: SaveSystem.SAVE_VERSION,
        themeVersion: THEME_CONFIG.version,
        storyVersion: SaveSystem.STORY_VERSION,
        slotId,
        // 简要元数据用于存档列表预览（不参与加载）
        meta: {
          classType: scene.player?.classType || 'warrior',
          gender: scene.player?.gender || 'male',
          level: levelSystem?.level || 1,
          xp: levelSystem?.xp || 0,
          score: gameState.score || 0,
          currentLevel: gameState.currentLevel || 0,
          levelName
        },
        player: {
          position: playerPosition,
          hp: scene.player ? scene.player.hp : 100,
          maxHp: scene.player ? scene.player.maxHp : 100,
          stamina: scene.player ? scene.player.stamina : 140,
          mana: scene.player ? scene.player.mana : 0,
          rage: scene.player ? scene.player.rage : 0,
          classType: scene.player ? scene.player.classType : 'warrior',
          gender: scene.player ? scene.player.gender : 'male',
          stats: scene.player ? scene.player.stats.toJSON() : null,
          statusEffects: scene.player?.statusEffects ? scene.player.statusEffects.toJSON() : [],
          skillSlots: scene.player?.skillSlots ? scene.player.skillSlots.slice() : null,
          itemSlots: scene.player?.itemSlots ? scene.player.itemSlots.slice() : null
        },
        gameState: {
          score: gameState.score,
          keysCollected: gameState.keysCollected,
          hasArtifact: gameState.hasArtifact,
          collectedItems: gameState.collectedItems || [],
          currentLevel: gameState.currentLevel || 0
        },
        inventory: scene.inventory ? scene.inventory.exportData() : [],
        levelSystem: scene.levelSystem ? scene.levelSystem.toJSON() : null,
        equipment: scene.equipmentSystem ? scene.equipmentSystem.toJSON() : null,
        skillTree: scene.skillTreeSystem ? scene.skillTreeSystem.toJSON() : null,
        skillEngine: scene.player?.skillEngine ? scene.player.skillEngine.toJSON() : null,
        quests: scene.questSystem ? scene.questSystem.toJSON() : null,
        worldState: scene.worldState?.serialize() || null,
        // ── NPC 系统 ──
        npcMemory: scene.npcMemory?.serialize() || null,
        factionData: scene.factionSystem?.serialize() || null,
        shopData: scene.shopService?.serialize() || null,
        companion: scene.companionManager?.serialize() || null
      };

      localStorage.setItem(SaveSystem._key(slotId), JSON.stringify(saveData));
      SaveSystem.setActiveSlot(scene, slotId);
      console.log(`[SaveSystem] 已保存到槽 ${slotId}`);
      return true;
    } catch (error) {
      console.error('[SaveSystem] 保存失败:', error);
      return false;
    }
  }

  /**
   * 从指定槽位加载
   */
  static load(scene, slotId) {
    if (slotId == null) slotId = SaveSystem.getActiveSlot(scene);
    try {
      const saveString = localStorage.getItem(SaveSystem._key(slotId));
      if (!saveString) {
        console.log(`[SaveSystem] 槽 ${slotId} 没有存档`);
        return false;
      }

      const saveData = SaveSystem._normalizeSaveData(JSON.parse(saveString));

      if (!saveData) {
        console.log('[SaveSystem] 存档格式无效');
        return false;
      }

      scene.registry.set('gameState', {
        ...scene.registry.get('gameState'),
        score: saveData.gameState.score,
        keysCollected: saveData.gameState.keysCollected,
        hasArtifact: saveData.gameState.hasArtifact,
        collectedItems: saveData.gameState.collectedItems || [],
        currentLevel: saveData.gameState.currentLevel || 0
      });

      if (scene.inventory && saveData.inventory) {
        scene.inventory.importData(saveData.inventory);
      }

      if (scene.levelSystem && saveData.levelSystem) {
        scene.levelSystem.fromJSON(saveData.levelSystem);
        if (scene.player) {
          scene.player.stats.setFlatBonus('maxHp', (scene.levelSystem.level - 1) * 5);
          scene.player.stats.invalidate();
          scene.player.refreshStats();
        }
      }

      if (scene.equipmentSystem && saveData.equipment) {
        scene.equipmentSystem.fromJSON(saveData.equipment);
        scene.equipmentSystem.applyBonuses();
      }

      // 兼容老存档：装备 instance 字段补全（Task 4 之前的存档没有 instanceId/affixes/enhanceLevel）
      if (scene.equipmentSystem && scene.equipmentSystem.slots) {
        const slots = scene.equipmentSystem.slots;
        for (const k of Object.keys(slots)) {
          const it = slots[k];
          if (!it) continue;
          if (!it.instanceId) it.instanceId = `eq_legacy_${k}_${Date.now()}_${Math.random().toString(36).slice(2, 5)}`;
          if (!Array.isArray(it.affixes)) it.affixes = [];
          if (typeof it.enhanceLevel !== 'number') it.enhanceLevel = 0;
          // 兼容老存档：装备 instance 缺 sockets 时默认空数组（0 孔）
          if (!Array.isArray(it.sockets)) it.sockets = [];
          // 兼容老存档：洗练保底计数缺省 0
          if (typeof it.reforgePity !== 'number') it.reforgePity = 0;
        }
        // 重算装备贡献以反映补全字段（虽然空 affixes/0 enhance 不改变结果，但保险）
        if (typeof scene.equipmentSystem.applyBonuses === 'function') {
          scene.equipmentSystem.applyBonuses();
        }
      }

      if (scene.inventory && Array.isArray(scene.inventory.slots)) {
        for (const it of scene.inventory.slots) {
          if (!it || it.type !== 'equipment') continue;
          if (!it.instanceId) {
            it.instanceId = `eq_legacy_inv_${Date.now()}_${Math.random().toString(36).slice(2, 5)}`;
          }
          if (!Array.isArray(it.affixes)) it.affixes = [];
          if (typeof it.enhanceLevel !== 'number') it.enhanceLevel = 0;
          // 兼容老存档：装备 instance 缺 sockets 时默认空数组（0 孔）
          if (!Array.isArray(it.sockets)) it.sockets = [];
          // 兼容老存档：洗练保底计数缺省 0
          if (typeof it.reforgePity !== 'number') it.reforgePity = 0;
        }
      }

      if (scene.skillTreeSystem && saveData.skillTree) {
        scene.skillTreeSystem.fromJSON(saveData.skillTree);
      }

      if (scene.player?.skillEngine && saveData.skillEngine) {
        scene.player.skillEngine.fromJSON(saveData.skillEngine);
      }

      if (scene.questSystem && saveData.quests) {
        scene.questSystem.fromJSON(saveData.quests);
      }

      // ── NPC 系统数据 ──
      if (scene.npcMemory && saveData.npcMemory) {
        for (const [npcId, entry] of Object.entries(saveData.npcMemory)) {
          if (!entry) continue;
          if (entry.stage != null) scene.npcMemory.setStage(npcId, entry.stage);
          if (entry.flags) for (const [k, v] of Object.entries(entry.flags)) scene.npcMemory.setFlag(npcId, k, v);
          if (entry.vars) for (const [k, v] of Object.entries(entry.vars)) scene.npcMemory.setVar(npcId, k, v);
          if (entry.dead) scene.npcMemory.markDead(npcId);
        }
      }

      if (scene.factionSystem && saveData.factionData?.reputation) {
        for (const [faction, value] of Object.entries(saveData.factionData.reputation)) {
          scene.factionSystem.setReputation(faction, value);
        }
      }

      if (scene.shopService && saveData.shopData?.stocks) {
        for (const [shopId, stock] of Object.entries(saveData.shopData.stocks)) {
          scene.shopService.stocks.set(shopId, stock.map(s => ({ ...s })));
        }
      }

      // 伙伴名册：deserialize（兼容老档单 companion {companionId}），
      // 实例补齐 + 出战由 MainGameScene._restoreCompanionIfReady → restoreInstances 完成
      if (saveData.companion && scene.companionManager) {
        scene.companionManager.deserialize(saveData.companion);
      }

      // 恢复世界状态
      const canReuseWorldState = saveData.worldState &&
        scene.worldState?.seed === saveData.worldState.seed;
      const loadedWorldState = canReuseWorldState
        ? scene.worldState
        : saveData.worldState
          ? WorldStateManager.deserialize(saveData.worldState)
          : (scene.worldState || new WorldStateManager());
      if (typeof scene.replaceWorldState === 'function') {
        scene.replaceWorldState(loadedWorldState);
      } else {
        scene.worldState = loadedWorldState;
      }

      if (scene.player && saveData.player?.stats?.base) {
        Object.keys(saveData.player.stats.base).forEach(key => {
          scene.player.stats.setBase(key, saveData.player.stats.base[key]);
        });
        scene.player.stats.invalidate();
        scene.player.refreshStats();
      }

      if (scene.equipmentSystem) {
        scene.equipmentSystem.applyBonuses();
      }

      if (scene.player?.statusEffects && saveData.player?.statusEffects) {
        scene.player.statusEffects.fromJSON(saveData.player.statusEffects);
      }

      if (scene.player && Array.isArray(saveData.player?.skillSlots)) {
        for (let i = 0; i < scene.player.skillSlots.length && i < saveData.player.skillSlots.length; i++) {
          scene.player.skillSlots[i] = saveData.player.skillSlots[i] || null;
        }
        scene.events.emit('skillSlotsChanged', scene.player.skillSlots.slice());
      }

      if (scene.player && Array.isArray(saveData.player?.itemSlots)) {
        for (let i = 0; i < scene.player.itemSlots.length && i < saveData.player.itemSlots.length; i++) {
          let v = saveData.player.itemSlots[i] ?? null;
          // 兼容旧存档：数字索引 → 物品 id
          if (typeof v === 'number' && scene.inventory) {
            const slot = scene.inventory.getSlot(v);
            v = (slot && slot.id) ? slot.id : null;
          }
          scene.player.itemSlots[i] = v;
        }
        scene.events.emit('itemSlotsChanged');
      }

      if (scene.player && saveData.player) {
        // 恢复 HP（必须在 refreshStats 之后才知道最终 maxHp）
        if (saveData.player.hp !== undefined) {
          scene.player.hp = Math.min(saveData.player.hp, scene.player.maxHp);
        }
        if (saveData.player.stamina !== undefined) {
          scene.player.stamina = Math.min(saveData.player.stamina, scene.player.maxStamina);
        }
        if (saveData.player.mana !== undefined) {
          scene.player.mana = Math.min(saveData.player.mana, scene.player.maxMana);
        }
        if (saveData.player.rage !== undefined) {
          scene.player.rage = Math.min(saveData.player.rage, scene.player.maxRage);
        }
        // UI 刷新由 MainGameScene.create() 在 tryLoadSave() 之后统一触发，
        // 避免加载过程中多次闪烁。
      }

      scene.registry.set('savedPlayerData', saveData.player);
      SaveSystem.setActiveSlot(scene, slotId);
      console.log(`[SaveSystem] 槽 ${slotId} 已加载`);
      return true;
    } catch (error) {
      console.error('[SaveSystem] 加载失败:', error);
      return false;
    }
  }

  /** 检查指定槽位是否有存档 */
  static hasSave(slotId) {
    if (slotId == null) {
      // 兼容旧调用：检查任意槽位
      for (let i = 1; i <= SaveSystem.SLOT_COUNT; i++) {
        if (localStorage.getItem(SaveSystem._key(i))) return true;
      }
      return false;
    }
    return localStorage.getItem(SaveSystem._key(slotId)) !== null;
  }

  /** 删除指定槽位 */
  static deleteSave(slotId) {
    try {
      localStorage.removeItem(SaveSystem._key(slotId));
      console.log(`[SaveSystem] 槽 ${slotId} 已删除`);
      return true;
    } catch (error) {
      console.error('[SaveSystem] 删除失败:', error);
      return false;
    }
  }

  /**
   * 取槽位预览信息（用于列表显示），找不到时返回 null
   * @returns {{slotId, timestamp, dateText, classType, gender, level, score, currentLevel, levelName}|null}
   */
  static getSaveInfo(slotId) {
    try {
      const raw = localStorage.getItem(SaveSystem._key(slotId));
      if (!raw) return null;
      const data = JSON.parse(raw);
      const meta = data.meta || {};
      const ts = data.timestamp ? new Date(data.timestamp) : null;
      // 兼容旧版 meta 缺失：从其他字段兜底
      const classType = meta.classType || data.player?.classType || 'warrior';
      const gender = meta.gender || data.player?.gender || 'male';
      const level = meta.level || data.levelSystem?.level || 1;
      const score = meta.score ?? data.gameState?.score ?? 0;
      const currentLevel = meta.currentLevel ?? data.gameState?.currentLevel ?? 0;
      const levelName = (data.themeVersion || 0) < THEME_CONFIG.version
        ? '云荒游历'
        : (meta.levelName || '云荒游历');
      return {
        slotId,
        timestamp: data.timestamp,
        dateText: ts ? ts.toLocaleString() : '',
        classType,
        gender,
        level,
        score,
        currentLevel,
        levelName,
        worldSeed: data.worldState?.seed || null,
        exploredCount: data.worldState?.exploredChunks?.length || 0
      };
    } catch (_) {
      return null;
    }
  }

  /** 列出所有槽位（已迁移老存档），返回长度 SLOT_COUNT 的数组（空槽为 null） */
  static listAllSaves() {
    SaveSystem.migrateOldSave();
    const list = [];
    for (let i = 1; i <= SaveSystem.SLOT_COUNT; i++) {
      list.push(SaveSystem.getSaveInfo(i));
    }
    return list;
  }
}
