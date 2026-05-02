import {
  MATERIALS, DECOMPOSE_TABLE,
  getEnhanceCost, getEnhanceSuccessRate, getEnhanceFailureBehavior
} from '../data/materials.js';
import itemData from '../data/items.json';

/**
 * 强化与分解系统（纯函数 + 副作用集中）
 *
 * 通过 scene 引用拿到 inventory + player 来执行操作。
 */
export class EnhanceSystem {
  constructor(scene) {
    this.scene = scene;
  }

  /** 取强化成本（用于 UI 预览） */
  getCost(currentEnhanceLevel) {
    return getEnhanceCost(currentEnhanceLevel);
  }

  /** 成功率（UI 展示） */
  getSuccessRate(currentEnhanceLevel) {
    return getEnhanceSuccessRate(currentEnhanceLevel);
  }

  /** 检查是否能强化 */
  canEnhance(equipInstance) {
    if (!equipInstance || equipInstance.type !== 'equipment') return { ok: false, reason: 'not_equipment' };
    if ((equipInstance.enhanceLevel || 0) >= 15) return { ok: false, reason: 'maxed' };
    const cost = this.getCost(equipInstance.enhanceLevel || 0);
    if (!cost) return { ok: false, reason: 'maxed' };

    const inv = this.scene.inventory;
    const matCount = this._countMaterial(cost.matId);
    if (matCount < cost.count) return { ok: false, reason: 'no_material', need: cost };
    if ((inv.gold || 0) < cost.gold) return { ok: false, reason: 'no_gold', need: cost };
    return { ok: true, cost };
  }

  /**
   * 强化指定背包格的装备（直接修改 inventory.slots[idx]）
   * @returns {{result: 'success'|'fail_stay'|'fail_downgrade'|'invalid', newLevel?: number, reason?: string}}
   */
  enhance(target) {
    const inv = this.scene.inventory;
    let eq;
    if (typeof target === 'number') {
      eq = inv.slots[target];
    } else {
      eq = target;  // 直接是 instance（来自装备槽）
    }
    const check = this.canEnhance(eq);
    if (!check.ok) return { result: 'invalid', reason: check.reason };

    // 扣材料 + 金币
    this._consumeMaterial(check.cost.matId, check.cost.count);
    inv.gold -= check.cost.gold;
    this.scene.events.emit('goldChanged', inv.gold);

    const cur = eq.enhanceLevel || 0;
    const rate = this.getSuccessRate(cur);
    const success = Math.random() < rate;

    if (success) {
      eq.enhanceLevel = cur + 1;
      this.scene.equipmentSystem._applyBonuses();
      this.scene.events.emit('inventoryUpdated', inv.slots);
      this.scene.events.emit('showMessage', `强化成功！+${eq.enhanceLevel}`, '#66ff88');
      return { result: 'success', newLevel: eq.enhanceLevel };
    }

    // 失败
    const behavior = getEnhanceFailureBehavior(cur);
    if (behavior === 'downgrade' && cur > 0) {
      eq.enhanceLevel = cur - 1;
      this.scene.equipmentSystem._applyBonuses();
      this.scene.events.emit('inventoryUpdated', inv.slots);
      this.scene.events.emit('showMessage', `强化失败，等级 -1`, '#ff8866');
      return { result: 'fail_downgrade', newLevel: eq.enhanceLevel };
    }
    this.scene.events.emit('showMessage', `强化失败，等级保持`, '#ffaa44');
    return { result: 'fail_stay', newLevel: cur };
  }

  /**
   * 分解指定背包格的装备
   * @returns {{result: 'success', drops: Array<{matId, count}>}|{result:'invalid'}}
   */
  decompose(slotIndex) {
    const inv = this.scene.inventory;
    const eq = inv.slots[slotIndex];
    if (!eq || eq.type !== 'equipment') return { result: 'invalid' };

    const drops = (DECOMPOSE_TABLE[eq.rarity] || DECOMPOSE_TABLE.common).map(d => ({ ...d }));
    // 高强化等级额外奖励
    if ((eq.enhanceLevel || 0) >= 5) {
      drops.forEach(d => d.count += 1);
    }

    inv.removeItem(slotIndex);

    const failedDrops = [];
    drops.forEach(d => {
      const matTpl = itemData.items[d.matId];
      if (!matTpl) return;
      const ok = inv.addItem(matTpl, d.count);
      if (!ok) failedDrops.push(d);
    });

    if (failedDrops.length > 0) {
      this.scene.events.emit('showMessage', '背包已满，部分材料丢失', '#ff6666');
    }

    const summary = drops.map(d => `${MATERIALS[d.matId]?.name || d.matId} ×${d.count}`).join(', ');
    this.scene.events.emit('showMessage', `分解：${summary}`, '#aaccff');
    this.scene.events.emit('inventoryUpdated', inv.slots);
    return { result: 'success', drops };
  }

  // ── 内部辅助 ─────────────────────────

  _countMaterial(matId) {
    const inv = this.scene.inventory;
    return inv.slots.reduce((sum, s) => {
      if (s && s.id === matId) return sum + (s.quantity || 0);
      return sum;
    }, 0);
  }

  _consumeMaterial(matId, count) {
    const inv = this.scene.inventory;
    let remaining = count;
    for (let i = 0; i < inv.slots.length && remaining > 0; i++) {
      const s = inv.slots[i];
      if (s && s.id === matId) {
        const take = Math.min(remaining, s.quantity);
        s.quantity -= take;
        remaining -= take;
        if (s.quantity <= 0) inv.slots[i] = null;
      }
    }
    this.scene.events.emit('inventoryUpdated', inv.slots);
  }
}
