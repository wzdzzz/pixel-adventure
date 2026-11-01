/**
 * NPC 记忆存储：每个 NPC 的 stage / flag / var / 死亡标记
 *
 * 事件：
 *   - npcStageChanged: { npcId, oldStage, newStage }
 *   - npcFlagChanged:  { npcId, key, value }
 *   - npcDied:         { npcId }
 */
export class NPCMemoryStore {
  constructor(scene, initial = null) {
    this.scene = scene;
    this.memory = new Map();

    if (initial) {
      for (const [k, v] of Object.entries(initial)) {
        this.memory.set(k, {
          stage: v.stage ?? null,
          flags: { ...(v.flags || {}) },
          vars: { ...(v.vars || {}) },
          dead: !!v.dead
        });
      }
    }
  }

  _ensure(npcId) {
    if (!this.memory.has(npcId)) {
      this.memory.set(npcId, { stage: null, flags: {}, vars: {}, dead: false });
    }
    return this.memory.get(npcId);
  }

  // ===== Stage =====

  getStage(npcId, fallback = null) {
    return this.memory.get(npcId)?.stage ?? fallback;
  }

  setStage(npcId, stage) {
    const m = this._ensure(npcId);
    const old = m.stage;
    if (old === stage) return;
    m.stage = stage;
    this.scene?.events?.emit('npcStageChanged', { npcId, oldStage: old, newStage: stage });
  }

  // ===== Flags =====

  getFlag(npcId, key, fallback = false) {
    return this.memory.get(npcId)?.flags[key] ?? fallback;
  }

  setFlag(npcId, key, value = true) {
    const m = this._ensure(npcId);
    m.flags[key] = value;
    this.scene?.events?.emit('npcFlagChanged', { npcId, key, value });
  }

  // ===== Vars =====

  getVar(npcId, key, fallback = 0) {
    return this.memory.get(npcId)?.vars[key] ?? fallback;
  }

  setVar(npcId, key, value) {
    const m = this._ensure(npcId);
    m.vars[key] = value;
  }

  addVar(npcId, key, delta) {
    const cur = this.getVar(npcId, key, 0);
    const next = cur + delta;
    this.setVar(npcId, key, next);
    return next;
  }

  // ===== Death =====

  markDead(npcId) {
    const m = this._ensure(npcId);
    if (m.dead) return;
    m.dead = true;
    this.scene?.events?.emit('npcDied', { npcId });
  }

  isDead(npcId) {
    return this.memory.get(npcId)?.dead === true;
  }

  // ===== Iteration =====

  getAll() { return this.memory; }

  // ===== 序列化 =====

  serialize() {
    const out = {};
    for (const [k, v] of this.memory.entries()) {
      out[k] = { stage: v.stage, flags: v.flags, vars: v.vars, dead: v.dead };
    }
    return out;
  }

  static deserialize(scene, data) {
    return new NPCMemoryStore(scene, data || null);
  }
}
