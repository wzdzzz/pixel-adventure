import { RECIPES } from '../data/recipes.js';
import { EquipmentGenerator } from './EquipmentGenerator.js';

/**
 * 装备制作系统：用材料 + 金币按配方生成装备实例
 */
export class CraftingSystem {
  constructor(scene) {
    this.scene = scene;
  }

  listRecipes() {
    return Object.values(RECIPES);
  }

  canCraft(recipeId) {
    const rcp = RECIPES[recipeId];
    if (!rcp) return { ok:false, reason:'unknown_recipe' };

    const lvl = this.scene.levelSystem?.level || 1;
    if (rcp.requiredLevel && lvl < rcp.requiredLevel)
      return { ok:false, reason:'low_level', need: rcp.requiredLevel };

    const inv = this.scene.inventory;
    if ((inv.gold || 0) < rcp.gold) return { ok:false, reason:'no_gold' };
    for (const m of rcp.materials) {
      if (this._countMat(m.matId) < m.count) return { ok:false, reason:'no_material', missing: m };
    }
    return { ok:true };
  }

  craft(recipeId) {
    const check = this.canCraft(recipeId);
    if (!check.ok) return { result:'invalid', reason: check.reason };

    const rcp = RECIPES[recipeId];
    const inv = this.scene.inventory;
    rcp.materials.forEach(m => this._consumeMat(m.matId, m.count));
    inv.gold -= rcp.gold;
    this.scene.events.emit('goldChanged', inv.gold);

    const instance = EquipmentGenerator.generate(rcp.resultId, rcp.resultRarity, rcp.resultLevel);
    if (!instance) return { result:'invalid', reason:'gen_fail' };

    inv.addItem(instance, 1);
    this.scene.events.emit('inventoryUpdated', inv.slots);
    this.scene.events.emit('showMessage', `制作成功：${instance.name}`, '#66ff88');
    return { result:'success', instance };
  }

  _countMat(matId) {
    return this.scene.inventory.slots.reduce((sum, s) =>
      s && s.id === matId ? sum + (s.quantity || 0) : sum, 0);
  }

  _consumeMat(matId, count) {
    const inv = this.scene.inventory;
    let r = count;
    for (let i = 0; i < inv.slots.length && r > 0; i++) {
      const s = inv.slots[i];
      if (s && s.id === matId) {
        const take = Math.min(r, s.quantity);
        s.quantity -= take;
        r -= take;
        if (s.quantity <= 0) inv.slots[i] = null;
      }
    }
  }
}
