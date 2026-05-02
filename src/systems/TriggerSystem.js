import { AFFIXES } from '../data/affixes.js';

const TRIGGER_EFFECTS = {
  spawn_fireball: (player, ctx, power) => {
    if (ctx.enemy && typeof ctx.enemy.takeDamage === 'function') {
      const dmg = Math.floor((player.getAttack?.() || 1) * power);
      ctx.enemy.takeDamage(dmg, player.sprite.x, player.sprite.y);
      if (player.scene?.floatingText && ctx.enemy.sprite) {
        player.scene.floatingText.spawn(
          ctx.enemy.sprite.x, ctx.enemy.sprite.y - 20,
          `🔥${dmg}`, { color:'#ff7733', fontSize:13 }
        );
      }
    }
  },
  heal_pct: (player, ctx, power) => {
    const amt = Math.floor((player.maxHp || 100) * power);
    if (amt > 0 && player.heal) player.heal(amt);
  },
  reduce_cd: (player, ctx, power) => {
    const eng = player.skillEngine;
    if (!eng?.cooldowns) return;
    for (const k in eng.cooldowns) eng.cooldowns[k] = Math.max(0, eng.cooldowns[k] - power);
  },
  lifesteal_pct: (player, ctx, power) => {
    if (ctx.damage > 0 && player.heal) player.heal(Math.floor(ctx.damage * power));
  }
};

/**
 * 触发型词条系统：在战斗触发点收集装备词条触发器并按概率执行
 */
export class TriggerSystem {
  constructor(scene) {
    this.scene = scene;
  }

  _collectTriggers() {
    const triggers = [];
    const eqSys = this.scene.equipmentSystem;
    if (!eqSys?.slots) return triggers;
    for (const k in eqSys.slots) {
      const it = eqSys.slots[k];
      if (!it?.affixes) continue;
      for (const a of it.affixes) {
        const def = AFFIXES[a.id];
        if (def?.trigger) triggers.push(def.trigger);
      }
    }
    return triggers;
  }

  fire(event, ctx = {}) {
    const triggers = this._collectTriggers();
    const player = this.scene.player;
    if (!player) return;
    for (const t of triggers) {
      if (t.event !== event) continue;
      if (Math.random() >= (t.chance ?? 1)) continue;
      const fn = TRIGGER_EFFECTS[t.effect];
      if (fn) fn(player, ctx, t.power);
    }
  }
}
