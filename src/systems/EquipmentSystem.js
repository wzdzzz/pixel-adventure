/**
 * 装备系统 — 8 槽位接口预留
 *
 * 槽位: helmet, armor, weapon, offhand, necklace, ring1, ring2, boots
 * 具体装备数据、掉落表、装备效果后续单独提供
 */

export const EQUIP_SLOTS = ['helmet', 'armor', 'weapon', 'offhand', 'necklace', 'ring1', 'ring2', 'boots'];

export class EquipmentSystem {
  constructor(scene) {
    this.scene = scene;
    this.slots = {};
    EQUIP_SLOTS.forEach(s => this.slots[s] = null);
  }

  equip(slotName, item) {
    if (!EQUIP_SLOTS.includes(slotName)) return null;
    const prev = this.slots[slotName];
    this.slots[slotName] = item;
    this.scene.events.emit('equipmentChanged', slotName, item, prev);
    return prev;
  }

  unequip(slotName) {
    const item = this.slots[slotName];
    this.slots[slotName] = null;
    this.scene.events.emit('equipmentChanged', slotName, null, item);
    return item;
  }

  getSlot(slotName) {
    return this.slots[slotName];
  }

  getStatBonuses() {
    const bonuses = { con: 0, str: 0, int: 0, agi: 0, per: 0, lck: 0 };
    const flatBonuses = { maxHp: 0, maxMp: 0, attack: 0, defense: 0 };
    // When equipment items exist, iterate slots and sum their stat contributions
    return { bonuses, flatBonuses };
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
