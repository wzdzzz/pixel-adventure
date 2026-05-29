/**
 * CompanionManager — 队伍 / 伙伴系统 v2
 *
 * 设计（见 docs/plans/2026-05-29-companion-system-v2-design.md）：
 *   - **可招募多个伙伴**（roster 名册，无上限），但**同时只有 1 个出战**（active）。
 *   - active：活的 CombatNPC，faction='ally'，劫持 AI（只打玩家的敌人）+ followMode 跟随玩家。
 *   - benched（待命）：同样是活实例但**隐藏 + 禁用物理体 + 禁用 AI**（不渲染/不动/不战斗），
 *     标 persistent 不随 chunk 卸载销毁。
 *   - 招募来源 NPC 实例被直接收编（复用其实例），不重复刷出。
 *   - 姿态 stance：follow(跟紧) / hold(原地) / aggressive(激进) / defensive(防守)。
 *
 * 事件：
 *   companionRecruited {npcId,name} / companionDismissed {npcId}
 *   companionDeployed {npcId,npc} / companionBenched {npcId}
 *   companionDied {npcId,npc} / companionRevived {npcId}
 *   companionStanceChanged {npcId,stance} / rosterChanged ()
 */

const FOLLOW_RANGE = 70;     // 距离 > 此值开始跟随
const STOP_RANGE = 44;       // 距离 < 此值停下（滞后阈值，避免边界抖动）
const RUSH_RANGE = 240;      // 距离 > 此值加速追赶
const TELEPORT_RANGE = 1500;
const STUCK_TIMEOUT = 4000;
const ENEMY_SEARCH_RADIUS = 250;

// 姿态 → 索敌半径倍率
const STANCE_DETECTION = {
  follow: 1.0,
  hold: 0.8,
  aggressive: 1.6,
  defensive: 0.6,
};

export class CompanionManager {
  constructor(scene) {
    this.scene = scene;
    /** @type {Map<string, {npcId, name, stance, recruitedAt}>} 名册（无上限） */
    this.roster = new Map();
    this.activeId = null;       // 当前出战的 npcId
    this.activeNpc = null;      // 当前出战实例
    this._lastMoveTime = 0;
    this._lastPos = { x: 0, y: 0 };
  }

  // ─── 招募 / 解雇 ─────────────────────────

  /**
   * 把世界中的候选 CombatNPC 招入名册。
   * 若当前无人出战 → 立即出战；否则进待命。
   */
  recruit(npc) {
    if (!npc || !npc.id) return false;
    if (this.roster.has(npc.id)) {
      this.scene.events.emit('showMessage', `${npc.name} 已在你的队伍中`, '#ffaa44');
      return false;
    }
    npc.persistent = true;
    if (npc.config) npc.config.persistent = true;

    const entry = {
      npcId: npc.id,
      name: npc.name || npc.id,
      stance: 'follow',
      recruitedAt: this.roster.size,
    };
    this.roster.set(npc.id, entry);

    this.scene.events.emit('companionRecruited', { npcId: npc.id, name: entry.name });
    this.scene.events.emit('showMessage', `${entry.name} 加入了你的队伍`, '#44ff88');

    if (!this.activeId) {
      this._activate(npc);
    } else {
      this._benchInstance(npc);
      this.scene.events.emit('showMessage', '（待命中，可在队伍面板让其出战）', '#88cc88');
    }
    this.scene.events.emit('rosterChanged');
    return true;
  }

  /** 彻底解散一个伙伴（移出名册，销毁实例，可再次招募）。 */
  dismiss(npcId = this.activeId) {
    if (!npcId || !this.roster.has(npcId)) return false;
    const entry = this.roster.get(npcId);
    if (this.activeId === npcId) this.bench(npcId);
    const npc = this._getInstance(npcId);
    if (npc) {
      this._restoreAi(npc);
      npc.persistent = false;
      if (npc.config) npc.config.persistent = false;
      try { npc.destroy?.(); } catch (e) { /* 忽略 */ }
      this.scene.npcRegistry?.instances?.delete(npcId);
    }
    // 允许再次招募：重置 stage / 清 recruited flag
    this.scene.npcMemory?.setFlag(npcId, 'recruited', false);
    this.roster.delete(npcId);
    this.scene.events.emit('companionDismissed', { npcId });
    this.scene.events.emit('showMessage', `${entry.name} 离开了你的队伍`, '#ffaa44');
    this.scene.events.emit('rosterChanged');
    return true;
  }

  // ─── 出战 / 待命 ─────────────────────────

  /** 让名册中的某伙伴出战（换下当前出战者）。 */
  deploy(npcId) {
    if (!this.roster.has(npcId)) return false;
    if (this.activeId === npcId) return true;

    // 死亡伙伴需先复活
    const existing = this._getInstance(npcId);
    if (existing && (existing.state === 'DEAD' || existing.hp <= 0)) {
      this.scene.events.emit('showMessage', `${this.roster.get(npcId).name} 已倒下，需在篝火恢复`, '#ff8888');
      return false;
    }

    if (this.activeId) this.bench(this.activeId);

    const npc = this._ensureInstance(npcId);
    if (!npc) {
      this.scene.events.emit('showMessage', '出战失败：无法生成伙伴实例', '#ff8888');
      return false;
    }
    this._activate(npc);
    this.scene.events.emit('rosterChanged');
    return true;
  }

  /** 把当前出战者收回待命（数据保留，实例隐藏禁用）。 */
  bench(npcId = this.activeId) {
    if (!npcId || this.activeId !== npcId) return false;
    const npc = this._getInstance(npcId);
    if (npc) this._benchInstance(npc);
    this.activeId = null;
    this.activeNpc = null;
    this.scene.events.emit('companionBenched', { npcId });
    this.scene.events.emit('rosterChanged');
    return true;
  }

  /** 设置姿态（active 立即生效，benched 记录待出战生效）。 */
  setStance(npcId, stance) {
    const entry = this.roster.get(npcId);
    if (!entry || !STANCE_DETECTION[stance]) return false;
    entry.stance = stance;
    if (this.activeId === npcId && this.activeNpc?.ai) {
      this.activeNpc.ai.detectionRange = ENEMY_SEARCH_RADIUS * STANCE_DETECTION[stance];
    }
    this.scene.events.emit('companionStanceChanged', { npcId, stance });
    this.scene.events.emit('rosterChanged');
    return true;
  }

  // ─── 查询 ────────────────────────────────

  getRoster() { return [...this.roster.values()]; }
  getActiveId() { return this.activeId; }
  getActiveNpc() { return this.activeNpc; }
  /** 兼容旧调用：返回当前出战实例 */
  getCurrent() { return this.activeNpc; }
  isRecruited(npcId) { return this.roster.has(npcId); }

  /** 伙伴展示数据（UI 用） */
  getInfo(npcId) {
    const entry = this.roster.get(npcId);
    if (!entry) return null;
    const npc = this._getInstance(npcId);
    const cfg = npc?.config?.combatStats || {};
    return {
      npcId,
      name: entry.name,
      stance: entry.stance,
      active: this.activeId === npcId,
      level: cfg.level ?? 1,
      hp: npc ? Math.max(0, Math.round(npc.hp)) : (cfg.hp ?? 0),
      hpMax: npc ? Math.round(npc.maxHp) : (cfg.hp ?? 0),
      dead: npc ? (npc.state === 'DEAD' || npc.hp <= 0) : false,
      skills: cfg.skills || [],
    };
  }

  // ─── 内部：激活 / 待命 实现 ──────────────

  _activate(npc) {
    if (!npc) return;
    npc.persistent = true;
    if (npc.config) npc.config.persistent = true;

    // 显示 + 启用
    if (npc.sprite) {
      npc.sprite.setActive(true).setVisible(true);
      if (npc.sprite.body) npc.sprite.body.enable = true;
      npc.sprite.alpha = 1;
    }

    // 派系切 ally
    if (npc.faction !== 'ally') {
      npc._originalFaction = npc.faction;
      npc.faction = 'ally';
    }
    if (npc.sprite) npc.sprite.faction = 'ally';

    // 劫持 AI：只打玩家的敌人 + 跟随模式
    if (npc.ai) {
      npc.ai.enabled = true;
      if (!('_origGetTarget' in npc.ai)) {
        npc.ai._origGetTarget = npc.ai.getTarget;
        npc.ai._origCanEngage = npc.ai.canEngage;
        npc.ai._origDetectionRange = npc.ai.detectionRange;
      }
      npc.ai.getTarget = () => this._pickEnemyFor(npc);
      npc.ai.canEngage = (t) => this._isEnemyOfPlayer(t);
      const stance = this.roster.get(npc.id)?.stance || 'follow';
      npc.ai.detectionRange = ENEMY_SEARCH_RADIUS * (STANCE_DETECTION[stance] || 1);
      npc.ai.followMode = true;
    }

    // 瞬移到玩家身旁
    const p = this.scene.player;
    if (p?.sprite && npc.sprite) {
      npc.sprite.setPosition(p.sprite.x + 24, p.sprite.y + 24);
    }

    this.activeId = npc.id;
    this.activeNpc = npc;
    this._lastMoveTime = this.scene.time.now;
    if (npc.sprite) this._lastPos = { x: npc.sprite.x, y: npc.sprite.y };

    this.scene.events.emit('companionDeployed', { npcId: npc.id, npc });
  }

  _benchInstance(npc) {
    if (!npc) return;
    this._restoreAi(npc);
    if (npc.ai) npc.ai.enabled = false;
    if (npc.sprite) {
      if (npc.sprite.body) {
        npc.sprite.body.setVelocity(0, 0);
        npc.sprite.body.enable = false;
      }
      npc.sprite.setVisible(false);
    }
  }

  /** 还原被劫持的 AI 配置（保留 faction='ally' 以免误伤判定失效）。 */
  _restoreAi(npc) {
    if (npc?.ai && '_origGetTarget' in npc.ai) {
      npc.ai.getTarget = npc.ai._origGetTarget;
      npc.ai.canEngage = npc.ai._origCanEngage;
      npc.ai.detectionRange = npc.ai._origDetectionRange;
      npc.ai.followMode = false;
      delete npc.ai._origGetTarget;
      delete npc.ai._origCanEngage;
      delete npc.ai._origDetectionRange;
    }
  }

  _getInstance(npcId) {
    return this.scene.npcRegistry?.get?.(npcId) || null;
  }

  /** 取实例；不存在则按 config 重新 spawn（出战时用）。 */
  _ensureInstance(npcId) {
    let npc = this._getInstance(npcId);
    if (!npc && this.scene.npcRegistry) {
      npc = this.scene.npcRegistry.spawn(npcId, null);
    }
    return npc;
  }

  // ─── 跟随 + 卡墙瞬移（仅出战者） ──────────

  update(_delta) {
    const c = this.activeNpc;
    if (!c || c._isDestroyed) return;
    if (c.state === 'DEAD' || c.hp <= 0) return;

    const player = this.scene.player;
    if (!player?.sprite || !c.sprite) return;

    const stance = this.roster.get(c.id)?.stance || 'follow';

    const dx = player.sprite.x - c.sprite.x;
    const dy = player.sprite.y - c.sprite.y;
    const dist = Math.sqrt(dx * dx + dy * dy);

    // 超远瞬移（hold 姿态也瞬移，避免掉队太远）
    if (dist > TELEPORT_RANGE) {
      c.sprite.setPosition(player.sprite.x + 20, player.sprite.y + 20);
      this._lastMoveTime = this.scene.time.now;
      this._lastPos = { x: c.sprite.x, y: c.sprite.y };
      return;
    }

    // hold（原地待命）：不主动跟随
    if (stance === 'hold') return;

    // 卡住检测
    const moved = Math.hypot(c.sprite.x - this._lastPos.x, c.sprite.y - this._lastPos.y);
    if (moved > 2) {
      this._lastMoveTime = this.scene.time.now;
      this._lastPos = { x: c.sprite.x, y: c.sprite.y };
    } else if (dist > FOLLOW_RANGE && this.scene.time.now - this._lastMoveTime > STUCK_TIMEOUT) {
      c.sprite.setPosition(player.sprite.x + 20, player.sprite.y + 20);
      this._lastMoveTime = this.scene.time.now;
      return;
    }

    // 战斗中不打断
    if (c.ai?.inCombat) return;

    // 实时跟随（滞后阈值：>FOLLOW_RANGE 开始走，<STOP_RANGE 才停，避免边界抖动）
    if (dist > FOLLOW_RANGE) this._following = true;
    else if (dist < STOP_RANGE) this._following = false;

    if (this._following && dist > 1) {
      const baseSpeed = c.stats?.getDerived()?.moveSpeed || 90;
      const speed = dist > RUSH_RANGE ? baseSpeed * 1.6 : baseSpeed;
      c.sprite.setVelocity((dx / dist) * speed, (dy / dist) * speed);
    } else {
      c.sprite.setVelocity(0, 0);
    }
  }

  // ─── 目标选择 / 敌对判定 ───────────────

  _pickEnemyFor(companion) {
    const player = this.scene.player;
    const enemies = this.scene.enemies?.getChildren?.() || this.scene.enemies || [];
    let best = null;
    let bestDist = Infinity;
    const sx = companion.sprite.x, sy = companion.sprite.y;
    const radius = companion.ai?.detectionRange || ENEMY_SEARCH_RADIUS;
    for (const eSprite of enemies) {
      const e = eSprite.enemyInstance || eSprite;
      if (!e || e.state === 'DEAD' || e._isDestroyed) continue;
      if (e.faction === 'ally' || e.faction === 'townfolk' || e.faction === 'player') continue;
      const ex = eSprite.x ?? e.sprite?.x, ey = eSprite.y ?? e.sprite?.y;
      if (ex == null) continue;
      const d = Math.hypot(ex - sx, ey - sy);
      if (d > radius) continue;
      if (player?.sprite) {
        const pd = Math.hypot(ex - player.sprite.x, ey - player.sprite.y);
        if (pd < 200 && pd < bestDist) { bestDist = pd; best = e; continue; }
      }
      if (d < bestDist) { bestDist = d; best = e; }
    }
    return best;
  }

  _isEnemyOfPlayer(target) {
    if (!target) return false;
    if (target === this.scene.player) return false;
    if (target.faction === 'ally' || target.faction === 'player') return false;
    const fs = this.scene.factionSystem;
    if (!fs) return target.faction === 'monster' || target.faction === 'undead';
    return fs.isHostile(target.faction || 'monster', 'player');
  }

  // ─── 篝火复活（全员） ─────────────────────

  reviveAll() {
    for (const npcId of this.roster.keys()) {
      const c = this._getInstance(npcId);
      if (!c) continue;
      c.hp = c.maxHp;
      c._isSurrendered = false;
      if (c.state === 'DEAD') {
        c.state = 'PATROL';
        if (c.sprite) {
          c.sprite.setActive(true);
          if (c.sprite.body) c.sprite.body.enable = (npcId === this.activeId);
          c.sprite.alpha = 1;
          c.sprite.setVisible(npcId === this.activeId);
        }
        if (npcId === this.activeId) {
          const p = this.scene.player;
          if (p?.sprite && c.sprite) c.sprite.setPosition(p.sprite.x + 20, p.sprite.y + 20);
        }
      }
      if (npcId === this.activeId && c.ai) c.ai.resume?.();
      c.onHpChanged?.();
      this.scene.events.emit('companionRevived', { npcId });
    }
    this.scene.events.emit('rosterChanged');
  }

  /** 兼容旧调用名 */
  reviveAtBonfire() { this.reviveAll(); }

  // ─── 序列化 ────────────────────────────────

  serialize() {
    return {
      roster: this.getRoster().map(e => ({ npcId: e.npcId, name: e.name, stance: e.stance, recruitedAt: e.recruitedAt })),
      activeId: this.activeId,
    };
  }

  /**
   * 从存档恢复名册（实例由 NPCRegistry spawn 流程或此处 ensure 提供）。
   * 出战实例的实际激活由 MainGameScene._restoreCompanionIfReady 在玩家就绪后调用 deploy。
   */
  deserialize(data) {
    this.roster.clear();
    this.activeId = null;
    this.activeNpc = null;
    if (!data) return;
    // 兼容老档：单 companion {companionId}
    if (data.companionId && !data.roster) {
      this.roster.set(data.companionId, { npcId: data.companionId, name: data.companionId, stance: 'follow', recruitedAt: 0 });
      this._pendingActiveId = data.companionId;
      return;
    }
    for (const e of (data.roster || [])) {
      if (!e?.npcId) continue;
      this.roster.set(e.npcId, {
        npcId: e.npcId, name: e.name || e.npcId,
        stance: STANCE_DETECTION[e.stance] ? e.stance : 'follow',
        recruitedAt: e.recruitedAt ?? this.roster.size,
      });
    }
    this._pendingActiveId = data.activeId || null;
  }

  /** 存档恢复后调用：把名册中的实例补齐并部署出战者。 */
  restoreInstances() {
    if (this.roster.size === 0) return;
    for (const npcId of this.roster.keys()) {
      const npc = this._ensureInstance(npcId);
      if (!npc) continue;
      npc.persistent = true;
      if (npc.config) npc.config.persistent = true;
      // 默认先待命；出战者随后 deploy
      this._benchInstance(npc);
    }
    const activeId = this._pendingActiveId;
    this._pendingActiveId = null;
    if (activeId && this.roster.has(activeId)) {
      this.deploy(activeId);
    }
  }
}
