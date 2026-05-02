import masterItemData from '../data/items.json';

export class InventorySystem {
  constructor(scene) {
    this.scene = scene;
    this.slots = new Array(32).fill(null); // 8x4 grid
    this.gold = 0;
  }

  addItem(itemData, quantity = 1) {
    // 装备实例：每件独立，不堆叠；保留完整 instance 字段
    if (itemData.type === 'equipment') {
      const emptyIdx = this.slots.findIndex(s => s === null);
      if (emptyIdx === -1) {
        console.log('[Inventory] 背包已满');
        return false;
      }
      // 装备 instance 直接整体存入（已含 instanceId / affixes / enhanceLevel 等）
      this.slots[emptyIdx] = { ...itemData, quantity: 1 };
      this.scene.events.emit('inventoryUpdated', this.slots);
      return true;
    }

    // If currency (gold/coin), add to gold counter
    if (itemData.type === 'currency') {
      this.gold += (itemData.value || 0) * quantity;
      this.scene.events.emit('goldChanged', this.gold);
      return true;
    }

    // Try stacking first if item is stackable
    if (itemData.stackable) {
      const existingIdx = this.slots.findIndex(
        s => s && s.id === itemData.id && s.quantity < (itemData.maxStack || 99)
      );
      if (existingIdx !== -1) {
        const slot = this.slots[existingIdx];
        const maxStack = itemData.maxStack || 99;
        const canAdd = maxStack - slot.quantity;
        const toAdd = Math.min(quantity, canAdd);
        slot.quantity += toAdd;
        this.scene.events.emit('inventoryUpdated', this.slots);
        // If there's remaining quantity, recursively add
        if (quantity > toAdd) {
          return this.addItem(itemData, quantity - toAdd);
        }
        return true;
      }
    }

    // Find empty slot
    const emptyIdx = this.slots.findIndex(s => s === null);
    if (emptyIdx === -1) {
      console.log('[Inventory] 背包已满');
      return false;
    }

    this.slots[emptyIdx] = {
      id: itemData.id,
      name: itemData.name,
      type: itemData.type,
      texture: itemData.texture,
      rarity: itemData.rarity || 'common',
      stackable: itemData.stackable || false,
      maxStack: itemData.maxStack || 1,
      level: itemData.level || 1,
      value: itemData.value || 0,
      sellPrice: itemData.sellPrice || 0,
      description: itemData.description || '',
      effect: itemData.effect || null,
      quantity: quantity,
      // Equipment-specific fields
      slot: itemData.slot || null,
      baseStats: itemData.baseStats || null,
      statBonuses: itemData.statBonuses || null,
      weaponType: itemData.weaponType || null
    };
    this.scene.events.emit('inventoryUpdated', this.slots);
    return true;
  }

  removeItem(slotIndex, quantity = 1) {
    const slot = this.slots[slotIndex];
    if (!slot) return null;

    if (slot.quantity <= quantity) {
      this.slots[slotIndex] = null;
    } else {
      slot.quantity -= quantity;
    }
    this.scene.events.emit('inventoryUpdated', this.slots);
    return slot;
  }

  useItem(slotIndex) {
    const slot = this.slots[slotIndex];
    if (!slot) return false;
    if (slot.type !== 'consumable') return false;

    // Apply effect
    if (slot.effect) {
      this.scene.events.emit('useItem', slot);
    }

    this.removeItem(slotIndex, 1);
    return true;
  }

  swapSlots(fromIndex, toIndex) {
    if (fromIndex < 0 || fromIndex >= 32 || toIndex < 0 || toIndex >= 32) return;
    const temp = this.slots[fromIndex];
    this.slots[fromIndex] = this.slots[toIndex];
    this.slots[toIndex] = temp;
    this.scene.events.emit('inventoryUpdated', this.slots);
  }

  sortBy(criteria = 'level') {
    const items = this.slots.filter(s => s !== null);
    const rarityOrder = { common: 0, uncommon: 1, rare: 2, epic: 3, legendary: 4 };

    items.sort((a, b) => {
      switch (criteria) {
        case 'level': return (b.level || 0) - (a.level || 0);
        case 'type': return (a.type || '').localeCompare(b.type || '');
        case 'rarity': return (rarityOrder[b.rarity] || 0) - (rarityOrder[a.rarity] || 0);
        default: return 0;
      }
    });

    this.slots.fill(null);
    items.forEach((item, i) => { this.slots[i] = item; });
    this.scene.events.emit('inventoryUpdated', this.slots);
  }

  filterBy(type = 'all') {
    if (type === 'all') return this.slots;
    return this.slots.map(s => (s && s.type === type) ? s : null);
  }

  getSlot(index) {
    return this.slots[index];
  }

  hasItem(itemId) {
    return this.slots.some(s => s && s.id === itemId);
  }

  hasItemType(type) {
    return this.slots.some(s => s && s.type === type);
  }

  getItems() {
    return this.slots.filter(s => s !== null);
  }

  clear() {
    this.slots.fill(null);
    this.gold = 0;
    this.scene.events.emit('inventoryUpdated', this.slots);
    this.scene.events.emit('goldChanged', this.gold);
  }

  exportData() {
    return {
      slots: this.slots.map(s => s ? { ...s } : null),
      gold: this.gold
    };
  }

  importData(data) {
    if (!data) return;
    // Support both old array format and new object format
    if (Array.isArray(data)) {
      // Legacy format: array of items
      this.slots = new Array(32).fill(null);
      data.forEach((item, i) => {
        if (item && i < 32) this.slots[i] = { ...item, quantity: item.quantity || 1 };
      });
      this.gold = 0;
    } else {
      // New format: { slots, gold }
      this.slots = new Array(32).fill(null);
      if (data.slots) {
        data.slots.forEach((s, i) => {
          if (s && i < 32) this.slots[i] = { ...s };
        });
      }
      this.gold = data.gold || 0;
    }
    // Fix up item properties from master data and merge stackables
    this._fixupAndMerge();
    this.scene.events.emit('inventoryUpdated', this.slots);
    this.scene.events.emit('goldChanged', this.gold);
  }

  /**
   * Fix stackable/maxStack from master data and merge duplicate stackable items.
   * Handles old saves where items were stored without stackable flag.
   */
  _fixupAndMerge() {
    // Phase 1: Fix up properties from master item data
    this.slots.forEach(slot => {
      if (!slot) return;
      const master = masterItemData.items?.[slot.id];
      if (master) {
        slot.stackable = master.stackable ?? slot.stackable ?? false;
        slot.maxStack = master.maxStack ?? slot.maxStack ?? 1;
      }
    });

    // Phase 2: Merge duplicate stackable items
    const merged = new Map();
    const result = [];

    this.slots.forEach(slot => {
      if (!slot) return;
      if (slot.stackable && merged.has(slot.id)) {
        merged.get(slot.id).quantity += slot.quantity;
      } else if (slot.stackable) {
        const copy = { ...slot };
        merged.set(slot.id, copy);
        result.push(copy);
      } else {
        result.push(slot);
      }
    });

    this.slots.fill(null);
    result.forEach((item, i) => {
      if (i < 32) this.slots[i] = item;
    });
  }
}
