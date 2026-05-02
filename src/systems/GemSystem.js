import { GEMS, getGemValue, makeGemInstance, MAX_GEM_LEVEL } from '../data/gems.js';
import itemData from '../data/items.json';

/**
 * 宝石系统：镶嵌 / 拆卸 / 合成
 *
 * 装备 instance 的 sockets 字段是 [{ gemId, gemLevel }] 数组，
 * 由 EquipmentGenerator 按品质生成（rare 1, epic 2, ..., mythic 4）。
 */
export class GemSystem {
  constructor(scene) {
    this.scene = scene;
  }

  /** 镶嵌：从背包取宝石（gemSlotIndex），放到装备 sockets[socketIdx] */
  socket(equipInstance, socketIdx, gemSlotIndex) {
    if (!equipInstance || !equipInstance.sockets) return { ok:false, reason:'no_sockets' };
    if (socketIdx < 0 || socketIdx >= equipInstance.sockets.length)
      return { ok:false, reason:'invalid_socket' };
    if (equipInstance.sockets[socketIdx].gemId) return { ok:false, reason:'socket_occupied' };

    const inv = this.scene.inventory;
    const gem = inv.slots[gemSlotIndex];
    if (!gem || gem.type !== 'gem') return { ok:false, reason:'not_gem' };

    // 扣 1 颗宝石
    if (gem.quantity > 1) gem.quantity -= 1;
    else inv.slots[gemSlotIndex] = null;

    equipInstance.sockets[socketIdx] = { gemId: gem.id, gemLevel: gem.level };
    this.scene.equipmentSystem._applyBonuses();
    this.scene.events.emit('inventoryUpdated', inv.slots);
    this.scene.events.emit('showMessage', `已镶嵌 ${gem.name}`, '#66ccff');
    return { ok:true };
  }

  /** 拆卸：把宝石还回背包 */
  unsocket(equipInstance, socketIdx) {
    if (!equipInstance || !equipInstance.sockets) return { ok:false, reason:'no_sockets' };
    const slot = equipInstance.sockets[socketIdx];
    if (!slot || !slot.gemId) return { ok:false, reason:'empty_socket' };

    const inv = this.scene.inventory;
    const gemTpl = makeGemInstance(slot.gemId, slot.gemLevel);
    if (!gemTpl) return { ok:false, reason:'invalid_gem' };

    if (!inv.addItem(gemTpl, 1)) return { ok:false, reason:'inv_full' };

    equipInstance.sockets[socketIdx] = { gemId: null, gemLevel: 0 };
    this.scene.equipmentSystem._applyBonuses();
    this.scene.events.emit('inventoryUpdated', inv.slots);
    this.scene.events.emit('showMessage', `已拆卸 ${gemTpl.name}`, '#aaccff');
    return { ok:true };
  }

  /** 合成：3 颗同色同级 → 1 颗高 1 级 */
  fuse(gemSlotIndices) {
    if (!Array.isArray(gemSlotIndices) || gemSlotIndices.length !== 3)
      return { ok:false, reason:'need_3' };

    const inv = this.scene.inventory;
    const gems = gemSlotIndices.map(i => inv.slots[i]);
    if (gems.some(g => !g || g.type !== 'gem')) return { ok:false, reason:'not_gem' };

    const first = gems[0];
    if (first.level >= MAX_GEM_LEVEL) return { ok:false, reason:'maxed' };
    if (!gems.every(g => g.id === first.id && g.level === first.level))
      return { ok:false, reason:'mismatch' };

    // 扣 3 颗
    gemSlotIndices.forEach(i => {
      const g = inv.slots[i];
      if (g.quantity > 1) g.quantity -= 1;
      else inv.slots[i] = null;
    });

    // 加 1 颗高级宝石
    const newGem = makeGemInstance(first.id, first.level + 1);
    inv.addItem(newGem, 1);

    this.scene.events.emit('inventoryUpdated', inv.slots);
    this.scene.events.emit('showMessage', `合成成功：${newGem.name}`, '#66ff88');
    return { ok:true, result: newGem };
  }
}
