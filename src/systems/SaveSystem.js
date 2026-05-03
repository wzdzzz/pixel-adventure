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

  /** 取槽位 key */
  static _key(slotId) {
    return `${SaveSystem.SAVE_KEY_PREFIX}${slotId}`;
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
      const playerPosition = scene.player ? scene.player.getPosition() : null;
      const levelSystem = scene.levelSystem;
      const levelName = (typeof scene.currentLevel === 'number')
        ? (scene.registry.get('levelName') || `第${scene.currentLevel + 1}关`)
        : '';

      const saveData = {
        timestamp: Date.now(),
        version: '2.2.0',
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
          skillSlots: scene.player?.skillSlots ? scene.player.skillSlots.slice() : null
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
        quests: scene.questSystem ? scene.questSystem.toJSON() : null
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

      const saveData = JSON.parse(saveString);

      if (!saveData.version) {
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
        scene.equipmentSystem._applyBonuses();
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
        if (typeof scene.equipmentSystem._applyBonuses === 'function') {
          scene.equipmentSystem._applyBonuses();
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

      if (scene.player && saveData.player?.stats?.base) {
        Object.keys(saveData.player.stats.base).forEach(key => {
          scene.player.stats.setBase(key, saveData.player.stats.base[key]);
        });
        scene.player.stats.invalidate();
        scene.player.refreshStats();
      }

      if (scene.equipmentSystem) {
        scene.equipmentSystem._applyBonuses();
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
      const levelName = meta.levelName || `第 ${currentLevel + 1} 关`;
      return {
        slotId,
        timestamp: data.timestamp,
        dateText: ts ? ts.toLocaleString() : '',
        classType,
        gender,
        level,
        score,
        currentLevel,
        levelName
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
