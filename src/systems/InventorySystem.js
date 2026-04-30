export class InventorySystem {
  constructor(scene) {
    this.scene = scene;
    this.items = [];
    this.maxSlots = 20;
  }

  addItem(item) {
    if (this.items.length >= this.maxSlots) {
      console.log('[Inventory] 背包已满');
      return false;
    }

    const isConsumable = item.type === 'consumable' || item.type === 'HEAL';
    const isCurrency = item.type === 'currency' || item.type === 'COIN';

    if (!isConsumable && !isCurrency) {
      this.items.push({
        id: item.id,
        name: item.name,
        type: item.type,
        value: item.value
      });
    }

    this.scene.events.emit('inventoryUpdated', this.items);
    return true;
  }

  hasItem(itemId) {
    return this.items.some(item => item.id === itemId);
  }

  hasItemType(type) {
    return this.items.some(item => item.type === type);
  }

  removeItem(itemId) {
    const index = this.items.findIndex(item => item.id === itemId);
    if (index !== -1) {
      this.items.splice(index, 1);
      this.scene.events.emit('inventoryUpdated', this.items);
      return true;
    }
    return false;
  }

  getItems() {
    return [...this.items];
  }

  clear() {
    this.items = [];
    this.scene.events.emit('inventoryUpdated', this.items);
  }

  exportData() {
    return this.items.map(item => ({ ...item }));
  }

  importData(data) {
    this.items = data || [];
    this.scene.events.emit('inventoryUpdated', this.items);
  }
}
