/**
 * StatusEffectSystem — Buff/Debuff 引擎
 *
 * 每个 Actor 持有一个实例，在 update 循环中逐帧 tick。
 *
 * 效果配置 (StatusEffectConfig):
 * {
 *   id:           string,         // 'bleed', 'armorBreak', 'warCryBuff' ...
 *   type:         'dot'|'buff'|'debuff'|'control',
 *   duration:     number,         // ms
 *   tickInterval: number|null,    // ms, DoT 每 tick 间隔
 *   maxStacks:    number,         // 最大叠加层数（默认 1）
 *   refreshable:  boolean,        // 重复施加是否刷新持续时间
 *   modifiers:    Object|null,    // { attack: 0.20, defense: -0.30 } 百分比修正
 *   flatMods:     Object|null,    // { maxHp: 50 } 固定值修正
 *   onApply:      fn(actor, stacks)|null,
 *   onTick:       fn(actor, stacks)|null,
 *   onExpire:     fn(actor)|null,
 *   source:       Actor|null      // 施加者（伤害归属）
 * }
 */
export class StatusEffectSystem {
  constructor(scene, actor) {
    this.scene = scene;
    this.actor = actor;
    /** @type {ActiveEffect[]} */
    this.active = [];
  }

  /**
   * 施加一个状态效果。
   * - 已存在 & refreshable → 刷新持续时间
   * - 已存在 & stackable → 增加层数（不超过 maxStacks）
   * - 不存在 → 新增
   */
  apply(effectId, config) {
    const existing = this.active.find(e => e.id === effectId);
    const maxStacks = config.maxStacks || 1;

    if (existing) {
      if (config.refreshable !== false) {
        existing.remaining = config.duration;
      }
      if (maxStacks > 1 && existing.stacks < maxStacks) {
        existing.stacks++;
      }
      // Update source
      if (config.source) existing.source = config.source;
      return;
    }

    const effect = {
      id: effectId,
      type: config.type || 'buff',
      duration: config.duration,
      remaining: config.duration,
      tickInterval: config.tickInterval || 0,
      tickTimer: 0,
      maxStacks: maxStacks,
      stacks: 1,
      refreshable: config.refreshable !== false,
      modifiers: config.modifiers || null,
      flatMods: config.flatMods || null,
      onApply: config.onApply || null,
      onTick: config.onTick || null,
      onExpire: config.onExpire || null,
      source: config.source || null,
      // UI 显示用
      icon: config.icon || '✨',
      name: config.name || effectId,
      description: config.description || ''
    };

    this.active.push(effect);

    if (effect.onApply) {
      effect.onApply(this.actor, effect.stacks);
    }
  }

  /** 移除指定效果的所有层数 */
  remove(effectId) {
    const idx = this.active.findIndex(e => e.id === effectId);
    if (idx === -1) return;
    const effect = this.active[idx];
    if (effect.onExpire) {
      effect.onExpire(this.actor);
    }
    this.active.splice(idx, 1);
  }

  /** 是否存在某效果 */
  has(effectId) {
    return this.active.some(e => e.id === effectId);
  }

  /** 获取某效果当前层数 */
  getStacks(effectId) {
    const e = this.active.find(e => e.id === effectId);
    return e ? e.stacks : 0;
  }

  /**
   * 获取所有活跃效果的百分比修正合计。
   * 返回 { attack: 1.2, defense: 0.7, ... }（乘法系数）
   */
  getModifiers() {
    const result = {};
    for (const effect of this.active) {
      if (!effect.modifiers) continue;
      for (const [stat, value] of Object.entries(effect.modifiers)) {
        if (result[stat] === undefined) result[stat] = 1;
        result[stat] += value * effect.stacks;
      }
    }
    return result;
  }

  /**
   * 获取所有活跃效果的固定值修正合计。
   * 返回 { maxHp: 50, ... }（加法）
   */
  getFlatModifiers() {
    const result = {};
    for (const effect of this.active) {
      if (!effect.flatMods) continue;
      for (const [stat, value] of Object.entries(effect.flatMods)) {
        result[stat] = (result[stat] || 0) + value * effect.stacks;
      }
    }
    return result;
  }

  /** 每帧调用 */
  update(delta) {
    for (let i = this.active.length - 1; i >= 0; i--) {
      const effect = this.active[i];
      effect.remaining -= delta;

      // DoT tick
      if (effect.tickInterval > 0 && effect.onTick) {
        effect.tickTimer += delta;
        while (effect.tickTimer >= effect.tickInterval) {
          effect.tickTimer -= effect.tickInterval;
          effect.onTick(this.actor, effect.stacks);
        }
      }

      // 过期移除
      if (effect.remaining <= 0) {
        if (effect.onExpire) {
          effect.onExpire(this.actor);
        }
        this.active.splice(i, 1);
      }
    }
  }

  /** 获取所有活跃效果摘要（用于 UI 显示） */
  getActiveSummary() {
    return this.active.map(e => ({
      id: e.id,
      type: e.type,
      stacks: e.stacks,
      remaining: e.remaining,
      duration: e.duration,
      icon: e.icon,
      name: e.name,
      description: e.description
    }));
  }

  /** 清除所有效果 */
  clearAll() {
    for (const effect of this.active) {
      if (effect.onExpire) effect.onExpire(this.actor);
    }
    this.active = [];
  }

  toJSON() {
    // 只保存 id、剩余时间、层数（回调不可序列化）
    return this.active.map(e => ({
      id: e.id,
      remaining: e.remaining,
      stacks: e.stacks
    }));
  }

  fromJSON(data) {
    // 效果需要在加载后由技能系统重新施加
    // 简单效果可通过 id 恢复
  }
}
