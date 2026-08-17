import { questData, BOUNTY_TARGETS, ENEMY_NAMES } from '../data/quests.js';
import SystemRegistry from '../core/SystemRegistry.js';

export class QuestSystem {
  constructor(scene) {
    this.scene = scene;
    this.quests = questData.map(q => ({
      ...q,
      // autoAvailable 的任务进游戏即可接取；否则 locked 由触发器开启
      status: q.autoAvailable ? 'available' : 'locked',
      objectives: q.objectives.map(o => ({ ...o, current: 0 }))
    }));
    this._trackedQuestId = null;
    this._bountySeq = 0;
    this.setupEventListeners();
    // 初始生成一批可重复赏金（新游戏；读档时 fromJSON 会重建已存的）
    this.generateBounties(3);
  }

  setupEventListeners() {
    // Kill tracking
    this.scene.events.on('enemyDeath', (enemy) => {
      this.updateObjectives('kill', enemy.config?.id, 1);
    });

    // Collect tracking (keys)
    this.scene.events.on('keysChanged', (count) => {
      this.setObjectiveProgress('collect', 'key', count);
    });

    // Item pickup tracking (for potions, artifacts, etc.)
    this.scene.events.on('inventoryUpdated', () => {
      // Check potion collection
      const inv = SystemRegistry.get('inventory');
      if (inv) {
        const potionSlot = inv.slots.find(s => s && s.id === 'potion');
        const potionCount = potionSlot ? potionSlot.quantity : 0;
        this.setObjectiveProgress('collect', 'potion', potionCount);
      }
    });

    // Artifact collected
    this.scene.events.on('artifactCollected', () => {
      this.setObjectiveProgress('collect', 'artifact', 1);
    });

    // Interact tracking
    this.scene.events.on('playerInteract', (target) => {
      const npcInst = target?.npcInstance || target;
      const npcId = npcInst?.id;
      if (npcId) {
        this.updateObjectives('interact', npcId, 1);
        this.checkNpcQuestTrigger(npcId);
      }
    });

    // 篝火休息 → 刷新可重复赏金（回城节奏）
    this.scene.events.on('bonfireRest', () => this.refreshBounties(3));
  }

  // ─── 接取 / 赏金 ────────────────────────────────

  /** 接受一个可接取/锁定的任务 → active */
  acceptQuest(id) {
    const q = this.quests.find(x => x.id === id);
    if (!q) return false;
    if (q.status !== 'available' && q.status !== 'locked') return false;
    q.status = 'active';
    this.scene.events.emit('questActivated', q);
    this.scene.events.emit('showMessage', `接受任务：${q.title}`, '#44ff88');
    return true;
  }

  /** 生成 count 个可重复击杀赏金（按玩家等级缩放，避免与现有可接取赏金重复敌人） */
  generateBounties(count = 3) {
    const lvl = (SystemRegistry.get('levelSystem') || this.scene.levelSystem)?.level || 1;
    const existing = new Set(
      this.quests.filter(q => q.type === 'bounty' && q.status === 'available')
        .flatMap(q => q.objectives.map(o => o.target))
    );
    const pool = BOUNTY_TARGETS.filter(t => !existing.has(t.id));
    const added = [];
    for (let i = 0; i < count && pool.length > 0; i++) {
      const t = pool.splice(Math.floor(Math.random() * pool.length), 1)[0];
      const name = ENEMY_NAMES[t.id] || t.id;
      const required = t.count;
      const id = `bounty_${++this._bountySeq}`;
      const q = {
        id,
        title: `赏金：${name}`,
        type: 'bounty',
        description: `讨伐 ${required} 只${name}，回悬赏堂领取报酬。`,
        objectives: [{ id: `${id}_obj`, text: `击败${name}`, type: 'kill', target: t.id, required, current: 0 }],
        rewards: {
          xp: Math.round(required * 16 * (1 + lvl * 0.1)),
          gold: Math.round(required * 12 * (1 + lvl * 0.1)),
        },
        status: 'available',
      };
      this.quests.push(q);
      added.push(q);
    }
    if (added.length) this.scene.events.emit('questProgressUpdated');
    return added;
  }

  /** 清掉未接取的旧赏金并重新生成一批 */
  refreshBounties(count = 3) {
    this.quests = this.quests.filter(q => !(q.type === 'bounty' && q.status === 'available'));
    const added = this.generateBounties(count);
    this.scene.events.emit('showMessage', `任务板已刷新（${added.length} 个新委托）`, '#88ccff');
    return added;
  }

  getAvailableQuests() { return this.quests.filter(q => q.status === 'available'); }

  activateQuestsForLevel(levelIndex) {
    this.quests.forEach(q => {
      if (q.triggerLevel === levelIndex && q.status === 'locked' && !q.triggerNpc) {
        q.status = 'active';
        this.scene.events.emit('questActivated', q);
      }
    });
  }

  checkNpcQuestTrigger(npcId) {
    this.quests.forEach(q => {
      if (q.triggerNpc === npcId && q.status === 'locked') {
        q.status = 'active';
        this.scene.events.emit('questActivated', q);
      }
    });
  }

  updateObjectives(type, target, amount) {
    let changed = false;
    this.quests.filter(q => q.status === 'active').forEach(q => {
      q.objectives.filter(o => o.type === type && o.target === target).forEach(o => {
        const prev = o.current;
        o.current = Math.min(o.required, o.current + amount);
        if (o.current !== prev) changed = true;
      });
      this.checkQuestCompletion(q);
    });
    if (changed) this.scene.events.emit('questProgressUpdated');
  }

  setObjectiveProgress(type, target, value) {
    let changed = false;
    this.quests.filter(q => q.status === 'active').forEach(q => {
      q.objectives.filter(o => o.type === type && o.target === target).forEach(o => {
        const prev = o.current;
        o.current = Math.min(o.required, value);
        if (o.current !== prev) changed = true;
      });
      this.checkQuestCompletion(q);
    });
    if (changed) this.scene.events.emit('questProgressUpdated');
  }

  checkQuestCompletion(quest) {
    if (quest.status !== 'active') return;
    if (quest.objectives.every(o => o.current >= o.required)) {
      quest.status = 'completed';
      this.scene.events.emit('questCompleted', quest);
      // Award rewards
      if (quest.rewards.xp) {
        const ls = SystemRegistry.get('levelSystem');
        if (ls) ls.addXp(quest.rewards.xp);
      }
      const inv = SystemRegistry.get('inventory');
      if (quest.rewards.gold && inv) {
        inv.gold += quest.rewards.gold;
        this.scene.events.emit('goldChanged', inv.gold);
      }
    }
  }

  getActiveQuests() { return this.quests.filter(q => q.status === 'active'); }
  getCompletedQuests() { return this.quests.filter(q => q.status === 'completed'); }
  getTrackedQuest() {
    if (this._trackedQuestId) {
      const q = this.quests.find(q => q.id === this._trackedQuestId && q.status === 'active');
      if (q) return q;
    }
    return this.getActiveQuests()[0] || null;
  }

  setTrackedQuest(questId) {
    this._trackedQuestId = questId;
    this.scene.events.emit('questTrackChanged', questId);
  }

  toJSON() {
    return this.quests.map(q => {
      const base = {
        id: q.id, status: q.status,
        objectives: q.objectives.map(o => ({ id: o.id, current: o.current }))
      };
      // 动态赏金不在静态 data 中，需存完整定义以便重建
      if (q.type === 'bounty') {
        base.dynamic = {
          title: q.title, description: q.description, type: q.type, rewards: q.rewards,
          objectives: q.objectives.map(o => ({ id: o.id, text: o.text, type: o.type, target: o.target, required: o.required }))
        };
      }
      return base;
    });
  }

  fromJSON(data) {
    if (!data) return;
    // 移除构造时生成的动态赏金（将由存档定义重建，避免重复）
    this.quests = this.quests.filter(q => q.type !== 'bounty');
    let maxSeq = 0;
    data.forEach(saved => {
      let quest = this.quests.find(q => q.id === saved.id);
      if (!quest && saved.dynamic) {
        const objectives = saved.dynamic.objectives.map(o => ({
          ...o,
          text: o.type === 'kill' && ENEMY_NAMES[o.target]
            ? `击败${ENEMY_NAMES[o.target]}`
            : o.text,
          current: 0,
        }));
        const primary = objectives.find(o => o.type === 'kill' && ENEMY_NAMES[o.target]);
        const enemyName = primary ? ENEMY_NAMES[primary.target] : null;
        quest = {
          id: saved.id, ...saved.dynamic,
          ...(enemyName ? {
            title: `赏金：${enemyName}`,
            description: `讨伐 ${primary.required} 只${enemyName}，回悬赏堂领取报酬。`,
          } : {}),
          objectives,
          status: 'available',
        };
        this.quests.push(quest);
        const m = /^bounty_(\d+)$/.exec(saved.id);
        if (m) maxSeq = Math.max(maxSeq, parseInt(m[1], 10));
      }
      if (quest) {
        quest.status = saved.status;
        saved.objectives.forEach(so => {
          const obj = quest.objectives.find(o => o.id === so.id);
          if (obj) obj.current = so.current;
        });
      }
    });
    this._bountySeq = Math.max(this._bountySeq, maxSeq);
    this.scene.events.emit('questProgressUpdated');
  }
}
