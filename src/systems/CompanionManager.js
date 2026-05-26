/**
 * CompanionManager — 同伴管理
 *
 * 设计：
 *   - 最多 1 个同伴
 *   - 同伴是个 CombatNPC，由 faction='ally' 标记
 *   - 跟随：距离 > FOLLOW_RANGE → 朝玩家追，超 TELEPORT_RANGE → 瞬移
 *   - 战斗：劫持 CombatAI 的 getTarget — 玩家最近敌人优先 / 否则 250 内最近
 *   - canEngage：永远与 hostile to player 的派系开战
 *   - 死亡：HP=0 时 active=false，篝火休息时 reviveAtBonfire 重置
 *
 * 事件：
 *   companionRecruited:  { companionId, npc }
 *   companionDismissed:  { companionId }
 *   companionDied:       { companionId, npc }
 *   companionRevived:    { companionId, npc }
 */
const FOLLOW_RANGE = 250;
const RUSH_RANGE = 350;
const TELEPORT_RANGE = 1500;
const STUCK_TIMEOUT = 5000;
const ENEMY_SEARCH_RADIUS = 250;

export class CompanionManager {
  constructor(scene) {
    this.scene = scene;
    this.current = null;
    this._lastMoveTime = 0;
    this._lastPos = { x: 0, y: 0 };
  }

  // ─── 招募/解雇 ─────────────────────────

  /** 把现有 CombatNPC（或 NPC 升级）招为同伴 */
  recruit(npc) {
    if (!npc) return false;
    if (this.current) {
      this.scene.events.emit('showMessage', '你已有一个同伴', '#ffaa44');
      return false;
    }
    // 标记 persistent，避免 chunk 卸载销毁
    npc.persistent = true;
    if (npc.config) npc.config.persistent = true;

    // 派系切到 ally（如果原本不是）
    if (npc.faction !== 'ally') {
      npc._originalFaction = npc.faction;
      npc.faction = 'ally';
      if (npc.sprite) npc.sprite.faction = 'ally';
    }

    // 劫持 AI 的目标 & 敌人判定
    if (npc.ai) {
      npc.ai.config.getTarget = () => this._pickEnemyFor(npc);
      npc.ai.config.canEngage = (t) => this._isEnemyOfPlayer(t);
      npc.ai.config.detectionRange = ENEMY_SEARCH_RADIUS;
    }

    this.current = npc;
    this._lastMoveTime = this.scene.time.now;
    if (npc.sprite) this._lastPos = { x: npc.sprite.x, y: npc.sprite.y };

    this.scene.events.emit('companionRecruited', { companionId: npc.id, npc });
    this.scene.events.emit('showMessage', `${npc.name} 加入了你的队伍`, '#44ff88');
    return true;
  }

  dismiss() {
    if (!this.current) return false;
    const npc = this.current;
    if (npc._originalFaction) {
      npc.faction = npc._originalFaction;
      if (npc.sprite) npc.sprite.faction = npc._originalFaction;
    }
    npc.persistent = false;
    if (npc.config) npc.config.persistent = false;
    this.current = null;
    this.scene.events.emit('companionDismissed', { companionId: npc.id });
    this.scene.events.emit('showMessage', `${npc.name} 离开了你的队伍`, '#ffaa44');
    return true;
  }

  getCurrent() {
    return this.current;
  }

  // ─── 跟随 + 卡墙瞬移 ────────────────────

  update(_delta) {
    const c = this.current;
    if (!c || c._isDestroyed) return;
    if (c.state === 'DEAD' || c.hp <= 0) return;

    const player = this.scene.player;
    if (!player?.sprite || !c.sprite) return;

    const dx = player.sprite.x - c.sprite.x;
    const dy = player.sprite.y - c.sprite.y;
    const dist = Math.sqrt(dx * dx + dy * dy);

    // 超远直接瞬移
    if (dist > TELEPORT_RANGE) {
      c.sprite.setPosition(player.sprite.x + 20, player.sprite.y + 20);
      this._lastMoveTime = this.scene.time.now;
      this._lastPos = { x: c.sprite.x, y: c.sprite.y };
      return;
    }

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

    // 跟随
    if (dist > FOLLOW_RANGE) {
      const baseSpeed = c.stats?.getDerived()?.moveSpeed || 80;
      const speed = dist > RUSH_RANGE ? baseSpeed * 1.5 : baseSpeed;
      c.sprite.setVelocity((dx / dist) * speed, (dy / dist) * speed);
    } else {
      c.sprite.setVelocity(0, 0);
    }
  }

  // ─── 目标选择 / 敌对判定 ───────────────

  _pickEnemyFor(companion) {
    // 优先：玩家最近的敌人
    const player = this.scene.player;
    const enemies = this.scene.enemies?.getChildren?.() || [];
    let best = null;
    let bestDist = Infinity;
    const sx = companion.sprite.x, sy = companion.sprite.y;
    for (const eSprite of enemies) {
      const e = eSprite.enemyInstance || eSprite;
      if (!e || e.state === 'DEAD' || e._isDestroyed) continue;
      // 跳过非敌对（含其他 ally / townfolk）
      if (e.faction === 'ally' || e.faction === 'townfolk') continue;
      const dx = eSprite.x - sx;
      const dy = eSprite.y - sy;
      const d = Math.sqrt(dx * dx + dy * dy);
      if (d > ENEMY_SEARCH_RADIUS) continue;
      // 玩家最近敌人加权
      if (player?.sprite) {
        const pd = Math.hypot(eSprite.x - player.sprite.x, eSprite.y - player.sprite.y);
        if (pd < 200) {
          if (pd < bestDist) { bestDist = pd; best = e; continue; }
        }
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
    // 对玩家敌对 = 同伴的敌人
    return fs.isHostile(target.faction || 'monster', 'player');
  }

  // ─── 篝火复活 ──────────────────────────

  reviveAtBonfire() {
    if (!this.current) return;
    const c = this.current;
    c.hp = c.maxHp;
    c._isSurrendered = false;
    if (c.state === 'DEAD') {
      c.state = 'PATROL';
      if (c.sprite) {
        c.sprite.setActive(true).setVisible(true);
        c.sprite.body.enable = true;
        c.sprite.alpha = 1;
      }
      // 瞬移到玩家身旁
      const p = this.scene.player;
      if (p?.sprite && c.sprite) {
        c.sprite.setPosition(p.sprite.x + 20, p.sprite.y + 20);
      }
    }
    if (c.ai) {
      c.ai.resume();
    }
    c.onHpChanged?.();
    this.scene.events.emit('companionRevived', { companionId: c.id, npc: c });
  }

  // ─── 序列化 ────────────────────────────

  serialize() {
    return this.current ? { companionId: this.current.id } : null;
  }

  // 注意：deserialize 由 SaveSystem/NPCRegistry 协作 — 加载时找到那个 NPC 实例后调 recruit
}
