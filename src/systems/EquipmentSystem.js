/**
 * 装备系统 — 8 槽位接口预留
 *
 * 槽位: helmet, armor, weapon, offhand, necklace, ring1, ring2, boots
 * 具体装备数据、掉落表、装备效果后续单独提供
 */

import { LootEngine } from './LootEngine.js';

export const EQUIP_SLOTS = ['helmet', 'armor', 'weapon', 'offhand', 'necklace', 'ring1', 'ring2', 'boots'];

export class EquipmentSystem {
  constructor(scene) {
    this.scene = scene;
    this.slots = {};
    EQUIP_SLOTS.forEach(s => this.slots[s] = null);

    // Auto-recalculate stats when equipment changes
    this.scene.events.on('equipmentChanged', () => this._applyBonuses());
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
   * Sum all equipped items' stat contributions using LootEngine.getScaledStats().
   */
  getStatBonuses() {
    const bonuses = { con: 0, str: 0, int: 0, agi: 0, per: 0, lck: 0 };
    const flatBonuses = {};

    EQUIP_SLOTS.forEach(slotName => {
      const item = this.slots[slotName];
      if (!item) return;

      const scaled = LootEngine.getScaledStats(item);

      // Sum base stat bonuses (con, str, etc.)
      for (const [stat, val] of Object.entries(scaled.statBonuses)) {
        if (bonuses[stat] !== undefined) bonuses[stat] += val;
      }

      // Sum flat derived stat bonuses (attack, defense, maxHp, etc.)
      for (const [stat, val] of Object.entries(scaled.flatBonuses)) {
        flatBonuses[stat] = (flatBonuses[stat] || 0) + val;
      }
    });

    return { bonuses, flatBonuses };
  }

  /**
   * Apply equipment bonuses to the player's Stats engine.
   * Merges with level-based flatBonuses (maxHp from leveling).
   */
  _applyBonuses() {
    const player = this.scene.player;
    if (!player) return;

    const { bonuses, flatBonuses } = this.getStatBonuses();

    // Set equipment base stat bonuses
    for (const [stat, val] of Object.entries(bonuses)) {
      player.stats.setBonus(stat, val);
    }

    // Merge equipment flat bonuses with level flat bonuses
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
