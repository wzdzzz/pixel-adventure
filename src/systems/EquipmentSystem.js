/**
 * 装备系统 — 8 槽位接口预留
 *
 * 槽位: helmet, armor, weapon, offhand, necklace, ring1, ring2, boots
 * 具体装备数据、掉落表、装备效果后续单独提供
 */

import { AFFIXES } from '../data/affixes.js';
import { RARITY_MULTIPLIERS } from '../data/lootTables.js';
import { GEMS } from '../data/gems.js';
import { SetSystem } from './SetSystem.js';

export const EQUIP_SLOTS = ['helmet', 'armor', 'weapon', 'offhand', 'necklace', 'ring1', 'ring2', 'boots'];

export class EquipmentSystem {
  constructor(scene) {
    this.scene = scene;
    this.slots = {};
    EQUIP_SLOTS.forEach(s => this.slots[s] = null);

    this.setSystem = new SetSystem(scene);

    // Auto-recalculate stats when equipment changes
    this.scene.events.on('equipmentChanged', () => this._applyBonuses());
  }

  /** 暴露给 UI：当前所有激活套装的渲染信息 */
  getActiveSets() {
    return this.setSystem.getActiveSets(this.slots);
  }

  equip(slotName, item) {
    if (!EQUIP_SLOTS.includes(slotName)) return null;

    // Level check
    const levelSystem = this.scene.registry.get('levelSystem');
    if (item.level && levelSystem && levelSystem.level < item.level) {
      console.log(`[Equipment] 等级不足: 需要 Lv.${item.level}`);
      return null;
    }

    const prev = this.slots[slotName];
    this.slots[slotName] = item;
    this.scene.events.emit('equipmentChanged', slotName, item, prev);
    return prev;
  }

  unequip(slotName) {
    const item = this.slots[slotName];
    if (!item) return null;
    this.slots[slotName] = null;
    this.scene.events.emit('equipmentChanged', slotName, null, item);
    return item;
  }

  /**
   * Equip item from inventory slot. Handles swap if slot occupied.
   * Rings: auto-selects ring1 if empty, else ring2.
   */
  equipFromInventory(invSlotIndex) {
    const inv = this.scene.inventory;
    if (!inv) return false;

    const item = inv.getSlot(invSlotIndex);
    if (!item || item.type !== 'equipment' || !item.slot) return false;

    // Determine target slot (rings can go to ring1 or ring2)
    let targetSlot = item.slot;
    if (targetSlot === 'ring1' || targetSlot === 'ring2') {
      targetSlot = this.slots['ring1'] === null ? 'ring1' : 'ring2';
    }

    // Level check
    const levelSystem = this.scene.registry.get('levelSystem');
    if (item.level && levelSystem && levelSystem.level < item.level) {
      this.scene.events.emit('showMessage', `等级不足 (需要 Lv.${item.level})`);
      return false;
    }

    // 职业类型检查（武器：weaponType heavy=warrior / light=archer / magic=mage）
    if (item.weaponType) {
      const playerClass = this.scene.player?.classType;
      const wt = item.weaponType;
      const allowed =
        (wt === 'heavy' && playerClass === 'warrior') ||
        (wt === 'light' && playerClass === 'archer') ||
        (wt === 'magic' && playerClass === 'mage');
      if (!allowed) {
        const classLabel = wt === 'heavy' ? '战士' : wt === 'light' ? '弓箭手' : '法师';
        this.scene.events.emit('showMessage', `职业不符 (限 ${classLabel})`);
        return false;
      }
    }

    // Remove from inventory first
    inv.removeItem(invSlotIndex);

    // Get previous equipment
    const prev = this.slots[targetSlot];
    this.slots[targetSlot] = item;

    // Return previous item to inventory
    if (prev) {
      const added = inv.addItem(prev);
      if (!added) {
        // Inventory full — revert the swap
        this.slots[targetSlot] = prev;
        inv.addItem(item);
        this.scene.events.emit('showMessage', '背包已满，无法替换');
        return false;
      }
    }

    this.scene.events.emit('equipmentChanged', targetSlot, item, prev);
    return true;
  }

  /**
   * Unequip to inventory. Returns true on success.
   */
  unequipToInventory(slotName) {
    const inv = this.scene.inventory;
    if (!inv) return false;

    const item = this.slots[slotName];
    if (!item) return false;

    const added = inv.addItem(item);
    if (!added) {
      this.scene.events.emit('showMessage', '背包已满');
      return false;
    }

    this.slots[slotName] = null;
    this.scene.events.emit('equipmentChanged', slotName, null, item);
    return true;
  }

  getSlot(slotName) {
    return this.slots[slotName];
  }

  /**
   * 汇总所有装备槽的属性贡献。
   *
   * 输出三类：
   *  - bonuses     ：基础属性加成（con/str/int 等，来自模板 statBonuses + 词条 _base_xxx）
   *  - flatBonuses ：派生属性的固定加成（attack/defense 等的固定值；含装备 baseStats 缩放后的值 + 词条 isFlat:true）
   *  - bonusPct    ：派生属性的百分比加成（attack 等的 +X%；来自词条 isFlat:false）
   *
   * 装备 baseStats 缩放公式：rarityMult × (1 + 0.1×level) × (1 + 0.05×enhanceLevel)
   */
  getStatBonuses() {
    const bonuses = { con: 0, str: 0, int: 0, agi: 0, per: 0, lck: 0 };
    const flatBonuses = {};
    const bonusPct = {};

    EQUIP_SLOTS.forEach(slotName => {
      const item = this.slots[slotName];
      if (!item) return;

      // 1) baseStats 按 rarity × (1+0.1×level) × (1+0.05×enhanceLevel) 缩放
      const rarityMult = RARITY_MULTIPLIERS[item.rarity] || 1.0;
      const lvlMult = 1 + 0.1 * (item.level || 1);
      const enhMult = 1 + 0.05 * (item.enhanceLevel || 0);
      const totalMult = rarityMult * lvlMult * enhMult;

      if (item.baseStats) {
        for (const [stat, val] of Object.entries(item.baseStats)) {
          flatBonuses[stat] = (flatBonuses[stat] || 0) + val * totalMult;
        }
      }
      if (item.statBonuses) {
        for (const [stat, val] of Object.entries(item.statBonuses)) {
          if (bonuses[stat] !== undefined) bonuses[stat] += val;
        }
      }

      // 2) 词条贡献
      if (Array.isArray(item.affixes)) {
        for (const a of item.affixes) {
          const def = AFFIXES[a.id];
          if (!def) continue;
          const stat = def.stat;
          // _trigger 词条是触发型（如吸血、反伤），不进任何属性通道
          if (stat === '_trigger') continue;
          // _base_xxx 是基础属性词条
          if (stat.startsWith('_base_')) {
            const baseStat = stat.replace('_base_', '');
            if (bonuses[baseStat] !== undefined) {
              bonuses[baseStat] += a.value;
            }
          } else if (def.isFlat) {
            flatBonuses[stat] = (flatBonuses[stat] || 0) + a.value;
          } else {
            bonusPct[stat] = (bonusPct[stat] || 0) + a.value;
          }
        }
      }

      // 宝石贡献：sockets 已镶嵌的宝石按 stat 累加
      if (Array.isArray(item.sockets)) {
        for (const s of item.sockets) {
          if (!s.gemId) continue;
          const gemDef = GEMS[s.gemId];
          if (!gemDef) continue;
          const value = gemDef.baseValue * (s.gemLevel || 1);
          if (gemDef.isFlat) {
            flatBonuses[gemDef.stat] = (flatBonuses[gemDef.stat] || 0) + value;
          } else {
            bonusPct[gemDef.stat] = (bonusPct[gemDef.stat] || 0) + value;
          }
        }
      }
    });

    // 套装加成（合并三通道）
    const setBonus = this.setSystem.computeActiveBonuses(this.slots);
    for (const [s, v] of Object.entries(setBonus.flatBonuses)) {
      flatBonuses[s] = (flatBonuses[s] || 0) + v;
    }
    for (const [s, v] of Object.entries(setBonus.bonusPct)) {
      bonusPct[s] = (bonusPct[s] || 0) + v;
    }
    for (const [s, v] of Object.entries(setBonus.baseBonuses)) {
      if (bonuses[s] !== undefined) bonuses[s] += v;
    }

    // 四舍五入 flatBonuses 到 0.1
    for (const k in flatBonuses) flatBonuses[k] = Math.round(flatBonuses[k] * 10) / 10;

    return { bonuses, flatBonuses, bonusPct };
  }

  /**
   * Apply equipment bonuses to the player's Stats engine.
   * 完整覆盖三类通道（bonuses / flatBonuses / bonusPct），避免脱装备残留。
   * level-based maxHp 加成在这里合并进 flatBonuses.maxHp。
   */
  _applyBonuses() {
    const player = this.scene.player;
    if (!player) return;

    const { bonuses, flatBonuses, bonusPct } = this.getStatBonuses();

    // 1) 基础属性加成（con/str/...）— 完整覆盖
    for (const [stat, val] of Object.entries(player.stats.bonuses)) {
      player.stats.setBonus(stat, bonuses[stat] || 0);
    }

    // 2) flatBonuses — 完整覆盖；maxHp 合并 level HP 加成
    const levelSystem = this.scene.registry.get('levelSystem');
    const levelHpBonus = levelSystem ? (levelSystem.level - 1) * 5 : 0;

    const fb = player.stats.flatBonuses;
    for (const key of Object.keys(fb)) {
      if (key === 'maxHp') {
        fb[key] = levelHpBonus + (flatBonuses[key] || 0);
      } else {
        fb[key] = flatBonuses[key] || 0;
      }
    }

    // 3) bonusPct — 完整覆盖（含 0 值），避免脱装备残留
    const fullPct = { ...player.stats.bonusPct };
    for (const k in fullPct) fullPct[k] = 0;
    Object.assign(fullPct, bonusPct);
    player.stats.setBonusPct(fullPct);

    player.stats.invalidate();
    player.refreshStats();
  }

  toJSON() {
    return { slots: { ...this.slots } };
  }

  fromJSON(data) {
    if (data?.slots) {
      EQUIP_SLOTS.forEach(s => {
        this.slots[s] = data.slots[s] || null;
      });
    }
  }
}
