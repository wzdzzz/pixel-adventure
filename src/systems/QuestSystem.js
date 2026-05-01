import { questData } from '../data/quests.js';

export class QuestSystem {
  constructor(scene) {
    this.scene = scene;
    this.quests = questData.map(q => ({
      ...q,
      status: 'locked',
      objectives: q.objectives.map(o => ({ ...o, current: 0 }))
    }));
    this.setupEventListeners();
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
      const inv = this.scene.inventory;
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
  }

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
        const ls = this.scene.registry.get('levelSystem');
        if (ls) ls.addXp(quest.rewards.xp);
      }
      if (quest.rewards.gold && this.scene.inventory) {
        this.scene.inventory.gold += quest.rewards.gold;
        this.scene.events.emit('goldChanged', this.scene.inventory.gold);
      }
    }
  }

  getActiveQuests() { return this.quests.filter(q => q.status === 'active'); }
  getCompletedQuests() { return this.quests.filter(q => q.status === 'completed'); }
  getTrackedQuest() { return this.getActiveQuests()[0] || null; }

  toJSON() {
    return this.quests.map(q => ({
      id: q.id, status: q.status,
      objectives: q.objectives.map(o => ({ id: o.id, current: o.current }))
    }));
  }

  fromJSON(data) {
    if (!data) return;
    data.forEach(saved => {
      const quest = this.quests.find(q => q.id === saved.id);
      if (quest) {
        quest.status = saved.status;
        saved.objectives.forEach(so => {
          const obj = quest.objectives.find(o => o.id === so.id);
          if (obj) obj.current = so.current;
        });
      }
    });
  }
}
