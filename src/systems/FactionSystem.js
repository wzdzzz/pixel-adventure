import {
  FACTIONS,
  INITIAL_REPUTATION,
  REPUTATION_DELTAS,
  getRelationByValue
} from '../data/factions.js';

/**
 * 阵营系统：管理玩家对各阵营的 reputation、NPC 个体偏移、阵营间敌对关系。
 *
 * 事件：
 *   - reputationChanged: { factionId, oldVal, newVal, delta, source }
 *   - relationChanged:   { factionId, oldRelation, newRelation }
 */
export class FactionSystem {
  constructor(scene, initial = null) {
    this.scene = scene;
    this.reputation = new Map();
    this.npcOverrides = new Map();
    this.dynamicHostility = new Map();  // factionId -> Set<hostileFactionId>

    const initRep = initial?.reputation || INITIAL_REPUTATION;
    for (const [k, v] of Object.entries(initRep)) this.reputation.set(k, v);

    for (const [k, v] of Object.entries(initial?.npcOverrides || {})) {
      this.npcOverrides.set(k, v);
    }

    for (const [k, v] of Object.entries(initial?.dynamicHostility || {})) {
      this.dynamicHostility.set(k, new Set(v));
    }
  }

  // ===== 查询 =====

  getReputation(factionId, npcId = null) {
    const base = this.reputation.get(factionId) ?? 0;
    const override = npcId ? (this.npcOverrides.get(npcId) ?? 0) : 0;
    return Math.max(-100, Math.min(100, base + override));
  }

  getRelation(factionId, npcId = null) {
    return getRelationByValue(this.getReputation(factionId, npcId));
  }

  isHostile(factionA, factionB) {
    if (!factionA || !factionB || factionA === factionB) return false;
    if (this.dynamicHostility.has(factionA)) {
      return this.dynamicHostility.get(factionA).has(factionB);
    }
    const def = FACTIONS[factionA];
    return def ? def.hostileTo.includes(factionB) : false;
  }

  /** 玩家对某阵营是否敌对（双向：派系定义 + reputation < -20） */
  isPlayerHostileWith(factionId) {
    if (this.isHostile('player', factionId) || this.isHostile(factionId, 'player')) return true;
    return this.getReputation(factionId) <= -20;
  }

  // ===== 变更 =====

  addReputation(factionId, delta, source = '') {
    const oldVal = this.reputation.get(factionId) ?? 0;
    const newVal = Math.max(-100, Math.min(100, oldVal + delta));
    if (oldVal === newVal) return;
    this.reputation.set(factionId, newVal);

    const oldRelation = getRelationByValue(oldVal);
    const newRelation = getRelationByValue(newVal);

    this.scene?.events?.emit('reputationChanged', { factionId, oldVal, newVal, delta, source });
    if (oldRelation.name !== newRelation.name) {
      this.scene?.events?.emit('relationChanged', { factionId, oldRelation, newRelation });
    }
  }

  setReputation(factionId, value) {
    const clamped = Math.max(-100, Math.min(100, value));
    const oldVal = this.reputation.get(factionId) ?? 0;
    if (oldVal === clamped) return;
    this.reputation.set(factionId, clamped);

    const oldRelation = getRelationByValue(oldVal);
    const newRelation = getRelationByValue(clamped);
    this.scene?.events?.emit('reputationChanged', {
      factionId, oldVal, newVal: clamped, delta: clamped - oldVal, source: 'set'
    });
    if (oldRelation.name !== newRelation.name) {
      this.scene?.events?.emit('relationChanged', { factionId, oldRelation, newRelation });
    }
  }

  addNpcOverride(npcId, delta) {
    const cur = this.npcOverrides.get(npcId) ?? 0;
    this.npcOverrides.set(npcId, Math.max(-100, Math.min(100, cur + delta)));
  }

  setNpcOverride(npcId, value) {
    this.npcOverrides.set(npcId, Math.max(-100, Math.min(100, value)));
  }

  /** 应用预定义 delta */
  applyDelta(factionId, deltaKey, source = '') {
    const delta = REPUTATION_DELTAS[deltaKey] ?? 0;
    if (delta !== 0) this.addReputation(factionId, delta, source || deltaKey);
  }

  /** 动态修改阵营敌对：让 factionA 与 factionB 互敌（双向） */
  setHostility(factionA, factionB, hostile) {
    this._setOneWayHostility(factionA, factionB, hostile);
    this._setOneWayHostility(factionB, factionA, hostile);
  }

  _setOneWayHostility(factionA, factionB, hostile) {
    if (!this.dynamicHostility.has(factionA)) {
      const base = FACTIONS[factionA]?.hostileTo || [];
      this.dynamicHostility.set(factionA, new Set(base));
    }
    const s = this.dynamicHostility.get(factionA);
    if (hostile) s.add(factionB); else s.delete(factionB);
  }

  /** 触发整个阵营对玩家敌对（误伤超阈值时调用） */
  triggerHostility(factionId, reason = '') {
    this.setHostility('player', factionId, true);
    this.setReputation(factionId, Math.min(this.getReputation(factionId), -30));
    this.scene?.events?.emit('factionHostile', { factionId, reason });
  }

  /** 从候选 actor 列表中过滤出对 myFaction 敌对的 */
  findHostileTargets(myFaction, candidates) {
    const out = [];
    for (const c of candidates) {
      const targetFaction = c?.faction || (c === this.scene?.player ? 'player' : null);
      if (!targetFaction) continue;
      if (this.isHostile(myFaction, targetFaction)) out.push(c);
    }
    return out;
  }

  // ===== 序列化 =====

  serialize() {
    return {
      reputation: Object.fromEntries(this.reputation),
      npcOverrides: Object.fromEntries(this.npcOverrides),
      dynamicHostility: Object.fromEntries(
        [...this.dynamicHostility.entries()].map(([k, v]) => [k, [...v]])
      )
    };
  }

  static deserialize(scene, data) {
    return new FactionSystem(scene, data || null);
  }
}
