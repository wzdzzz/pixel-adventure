/**
 * 存档/读档系统
 *
 * 使用 localStorage 保存和加载游戏状态
 * 包括玩家位置、已拾取的道具、HP等
 */
export class SaveSystem {
  static SAVE_KEY = 'pixel_adventure_save';

  /**
   * 保存游戏状态
   * @param {Phaser.Scene} scene - 场景实例
   */
  static save(scene) {
    try {
      const gameState = scene.registry.get('gameState');
      const playerPosition = scene.player ? scene.player.getPosition() : null;

      const saveData = {
        timestamp: Date.now(),
        version: '2.0.0',
        player: {
          position: playerPosition,
          hp: scene.player ? scene.player.hp : 100,
          maxHp: scene.player ? scene.player.maxHp : 100,
          stats: scene.player ? scene.player.stats.toJSON() : null
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
        quests: scene.questSystem ? scene.questSystem.toJSON() : null
      };

      localStorage.setItem(SaveSystem.SAVE_KEY, JSON.stringify(saveData));
      console.log('[SaveSystem] 游戏已保存');
      return true;
    } catch (error) {
      console.error('[SaveSystem] 保存失败:', error);
      return false;
    }
  }

  /**
   * 加载游戏状态
   * @param {Phaser.Scene} scene - 场景实例
   * @returns {boolean} 是否成功加载
   */
  static load(scene) {
    try {
      const saveString = localStorage.getItem(SaveSystem.SAVE_KEY);
      if (!saveString) {
        console.log('[SaveSystem] 没有找到存档');
        return false;
      }

      const saveData = JSON.parse(saveString);

      // 验证存档版本
      if (!saveData.version) {
        console.log('[SaveSystem] 存档格式无效');
        return false;
      }

      // 恢复游戏状态
      scene.registry.set('gameState', {
        ...scene.registry.get('gameState'),
        score: saveData.gameState.score,
        keysCollected: saveData.gameState.keysCollected,
        hasArtifact: saveData.gameState.hasArtifact,
        collectedItems: saveData.gameState.collectedItems || [],
        currentLevel: saveData.gameState.currentLevel || 0
      });

      // 恢复背包
      if (scene.inventory && saveData.inventory) {
        scene.inventory.importData(saveData.inventory);
      }

      // Restore level system
      if (scene.levelSystem && saveData.levelSystem) {
        scene.levelSystem.fromJSON(saveData.levelSystem);
        // Re-apply level bonus to maxHp
        if (scene.player) {
          scene.player.stats.setFlatBonus('maxHp', (scene.levelSystem.level - 1) * 5);
          scene.player.stats.invalidate();
          scene.player.refreshStats();
        }
      }

      // Restore equipment system
      if (scene.equipmentSystem && saveData.equipment) {
        scene.equipmentSystem.fromJSON(saveData.equipment);
        scene.equipmentSystem._applyBonuses();
      }

      // Restore skill tree
      if (scene.skillTreeSystem && saveData.skillTree) {
        scene.skillTreeSystem.fromJSON(saveData.skillTree);
      }

      // Restore quest progress
      if (scene.questSystem && saveData.quests) {
        scene.questSystem.fromJSON(saveData.quests);
      }

      // Restore player base stats (bonuses/flatBonuses are reconstructed by equipment + level systems)
      if (scene.player && saveData.player?.stats?.base) {
        Object.keys(saveData.player.stats.base).forEach(key => {
          scene.player.stats.setBase(key, saveData.player.stats.base[key]);
        });
        scene.player.stats.invalidate();
        scene.player.refreshStats();
      }

      // Re-apply equipment bonuses after base stats are restored
      if (scene.equipmentSystem) {
        scene.equipmentSystem._applyBonuses();
      }

      // 恢复玩家位置（在 MainGameScene 中处理）
      scene.registry.set('savedPlayerData', saveData.player);

      console.log('[SaveSystem] 存档已加载');
      return true;
    } catch (error) {
      console.error('[SaveSystem] 加载失败:', error);
      return false;
    }
  }

  /**
   * 检查是否有存档
   * @returns {boolean}
   */
  static hasSave() {
    return localStorage.getItem(SaveSystem.SAVE_KEY) !== null;
  }

  /**
   * 删除存档
   * @returns {boolean}
   */
  static deleteSave() {
    try {
      localStorage.removeItem(SaveSystem.SAVE_KEY);
      console.log('[SaveSystem] 存档已删除');
      return true;
    } catch (error) {
      console.error('[SaveSystem] 删除存档失败:', error);
      return false;
    }
  }

  /**
   * 获取存档信息
   * @returns {object|null}
   */
  static getSaveInfo() {
    try {
      const saveString = localStorage.getItem(SaveSystem.SAVE_KEY);
      if (!saveString) return null;

      const saveData = JSON.parse(saveString);
      return {
        timestamp: new Date(saveData.timestamp).toLocaleString(),
        score: saveData.gameState.score,
        hasArtifact: saveData.gameState.hasArtifact
      };
    } catch (error) {
      return null;
    }
  }
}
