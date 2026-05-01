/**
 * 技能树系统 — 3分支结构，按职业初始化
 *
 * 节点效果类型:
 *   stat_bonus     — 固定属性加成 { stat, value }
 *   skill_enhance  — 强化技能参数 { skill, param, value }
 *   passive_unlock — 解锁被动技能 { passive }
 */
export class SkillTreeSystem {
  constructor(scene, classType = 'warrior') {
    this.scene = scene;
    this.classType = classType;
    this.nodes = [];
    this.unlockedNodes = new Set();
    this.initTree(classType);
  }

  initTree(classType) {
    switch (classType) {
      case 'warrior': this.initWarriorTree(); break;
      case 'archer':  this.initArcherTree(); break;
      case 'mage':    this.initMageTree(); break;
      default:        this.initWarriorTree(); break;
    }
  }

  initWarriorTree() {
    this.nodes = [
      // ─── ROOT ───
      { id: 'root', name: '战士之心', branch: 'core', tier: 0, x: 0, y: 0,
        prerequisites: [], requiredLevel: 1, cost: 0, maxRank: 1, currentRank: 1,
        effects: [], description: '战士的起点' },

      // ─── 狂战分支 (Berserker / DPS) ───
      { id: 'ber_1', name: '凶猛打击', branch: 'berserker', tier: 1, x: -2, y: 1,
        prerequisites: ['root'], requiredLevel: 2, cost: 1, maxRank: 3, currentRank: 0,
        effects: [{ type: 'stat_bonus', stat: 'critRate', value: 5 }],
        description: '暴击率+5%（每级）' },

      { id: 'ber_2', name: '嗜血本能', branch: 'berserker', tier: 1, x: -2.5, y: 2,
        prerequisites: ['ber_1'], requiredLevel: 3, cost: 1, maxRank: 3, currentRank: 0,
        effects: [{ type: 'skill_enhance', skill: 'heavyStrike', param: 'damageMultiplier', value: 0.1 }],
        description: '重击伤害+10%（每级）' },

      { id: 'ber_3', name: '吸血打击', branch: 'berserker', tier: 2, x: -2, y: 3,
        prerequisites: ['ber_2'], requiredLevel: 5, cost: 1, maxRank: 3, currentRank: 0,
        effects: [{ type: 'passive_unlock', passive: 'bloodlust' }],
        description: '解锁被动：击杀回复10%HP' },

      { id: 'ber_4', name: '旋风强化', branch: 'berserker', tier: 2, x: -1.5, y: 4,
        prerequisites: ['ber_3'], requiredLevel: 7, cost: 1, maxRank: 3, currentRank: 0,
        effects: [{ type: 'skill_enhance', skill: 'whirlwind', param: 'damageMultiplier', value: 0.05 }],
        description: '旋风斩伤害+5%（每级）' },

      { id: 'ber_5', name: '狂怒强化', branch: 'berserker', tier: 3, x: -2, y: 5,
        prerequisites: ['ber_4'], requiredLevel: 10, cost: 2, maxRank: 1, currentRank: 0,
        effects: [{ type: 'skill_enhance', skill: 'berserkerRage', param: 'duration', value: 2000 }],
        description: '狂怒爆发持续时间+2秒' },

      // ─── 防御分支 (Guardian / Tank) ───
      { id: 'grd_1', name: '铁壁', branch: 'guardian', tier: 1, x: 0, y: 1,
        prerequisites: ['root'], requiredLevel: 2, cost: 1, maxRank: 3, currentRank: 0,
        effects: [{ type: 'stat_bonus', stat: 'maxHp', value: 20 }],
        description: '最大HP+20（每级）' },

      { id: 'grd_2', name: '厚甲强化', branch: 'guardian', tier: 1, x: 0, y: 2,
        prerequisites: ['grd_1'], requiredLevel: 3, cost: 1, maxRank: 3, currentRank: 0,
        effects: [{ type: 'passive_unlock', passive: 'heavyArmor' }],
        description: '解锁被动：防御+15%' },

      { id: 'grd_3', name: '不屈之志', branch: 'guardian', tier: 2, x: 0, y: 3,
        prerequisites: ['grd_2'], requiredLevel: 5, cost: 1, maxRank: 3, currentRank: 0,
        effects: [{ type: 'passive_unlock', passive: 'unyielding' }],
        description: '解锁被动：HP<30%减伤20%' },

      { id: 'grd_4', name: '防御强化', branch: 'guardian', tier: 2, x: 0.5, y: 4,
        prerequisites: ['grd_3'], requiredLevel: 7, cost: 1, maxRank: 3, currentRank: 0,
        effects: [{ type: 'skill_enhance', skill: 'defensiveStance', param: 'duration', value: 1000 }],
        description: '防御姿态持续+1秒（每级）' },

      { id: 'grd_5', name: '坚不可摧', branch: 'guardian', tier: 3, x: 0, y: 5,
        prerequisites: ['grd_4'], requiredLevel: 10, cost: 2, maxRank: 1, currentRank: 0,
        effects: [{ type: 'stat_bonus', stat: 'defense', value: 10 }],
        description: '防御+10' },

      // ─── 控制分支 (Warlord / Control) ───
      { id: 'wld_1', name: '震慑之力', branch: 'warlord', tier: 1, x: 2, y: 1,
        prerequisites: ['root'], requiredLevel: 2, cost: 1, maxRank: 3, currentRank: 0,
        effects: [{ type: 'passive_unlock', passive: 'concussiveStrikes' }],
        description: '解锁被动：攻击10%概率眩晕' },

      { id: 'wld_2', name: '冲锋强化', branch: 'warlord', tier: 1, x: 2.5, y: 2,
        prerequisites: ['wld_1'], requiredLevel: 3, cost: 1, maxRank: 3, currentRank: 0,
        effects: [{ type: 'skill_enhance', skill: 'charge', param: 'stun', value: 200 }],
        description: '冲锋眩晕+0.2秒（每级）' },

      { id: 'wld_3', name: '地裂强化', branch: 'warlord', tier: 2, x: 2, y: 3,
        prerequisites: ['wld_2'], requiredLevel: 5, cost: 1, maxRank: 3, currentRank: 0,
        effects: [{ type: 'skill_enhance', skill: 'groundSplitter', param: 'damageMultiplier', value: 0.1 }],
        description: '地裂斩伤害+10%（每级）' },

      { id: 'wld_4', name: '减速强化', branch: 'warlord', tier: 2, x: 1.5, y: 4,
        prerequisites: ['wld_3'], requiredLevel: 7, cost: 1, maxRank: 3, currentRank: 0,
        effects: [{ type: 'stat_bonus', stat: 'slowDuration', value: 500 }],
        description: '减速效果+0.5秒（每级）' },

      { id: 'wld_5', name: '挑衅强化', branch: 'warlord', tier: 3, x: 2, y: 5,
        prerequisites: ['wld_4'], requiredLevel: 10, cost: 2, maxRank: 1, currentRank: 0,
        effects: [{ type: 'skill_enhance', skill: 'taunt', param: 'duration', value: 1000 }],
        description: '挑衅持续+1秒' }
    ];
    this.unlockedNodes.add('root');
  }

  initArcherTree() {
    this.nodes = [
      // ─── ROOT ───
      { id: 'root', name: '猎手之心', branch: 'core', tier: 0, x: 0, y: 0,
        prerequisites: [], requiredLevel: 1, cost: 0, maxRank: 1, currentRank: 1,
        effects: [], description: '弓箭手的起点' },

      // ─── 精准分支 (Sharpshooter / DPS) ───
      { id: 'shr_1', name: '精准射击', branch: 'sharpshooter', tier: 1, x: -2, y: 1,
        prerequisites: ['root'], requiredLevel: 2, cost: 1, maxRank: 3, currentRank: 0,
        effects: [{ type: 'stat_bonus', stat: 'critRate', value: 5 }],
        description: '暴击率+5%（每级）' },

      { id: 'shr_2', name: '蓄力强化', branch: 'sharpshooter', tier: 1, x: -2.5, y: 2,
        prerequisites: ['shr_1'], requiredLevel: 3, cost: 1, maxRank: 3, currentRank: 0,
        effects: [{ type: 'skill_enhance', skill: 'chargedShot', param: 'damageMultiplier', value: 0.1 }],
        description: '蓄力射击伤害+10%（每级）' },

      { id: 'shr_3', name: '致命弱点', branch: 'sharpshooter', tier: 2, x: -2, y: 3,
        prerequisites: ['shr_2'], requiredLevel: 5, cost: 1, maxRank: 3, currentRank: 0,
        effects: [{ type: 'stat_bonus', stat: 'critDamage', value: 10 }],
        description: '暴击伤害+10%（每级）' },

      { id: 'shr_4', name: '穿透强化', branch: 'sharpshooter', tier: 2, x: -1.5, y: 4,
        prerequisites: ['shr_3'], requiredLevel: 7, cost: 1, maxRank: 3, currentRank: 0,
        effects: [{ type: 'skill_enhance', skill: 'piercingShot', param: 'damageMultiplier', value: 0.1 }],
        description: '穿透射击伤害+10%（每级）' },

      { id: 'shr_5', name: '箭雨强化', branch: 'sharpshooter', tier: 3, x: -2, y: 5,
        prerequisites: ['shr_4'], requiredLevel: 10, cost: 2, maxRank: 1, currentRank: 0,
        effects: [{ type: 'skill_enhance', skill: 'arrowRain', param: 'damageMultiplier', value: 0.15 }],
        description: '箭雨伤害+15%' },

      // ─── 游侠分支 (Scout / Mobility) ───
      { id: 'sct_1', name: '轻捷步伐', branch: 'scout', tier: 1, x: 0, y: 1,
        prerequisites: ['root'], requiredLevel: 2, cost: 1, maxRank: 3, currentRank: 0,
        effects: [{ type: 'stat_bonus', stat: 'moveSpeed', value: 8 }],
        description: '移动速度+8（每级）' },

      { id: 'sct_2', name: '闪避翻滚强化', branch: 'scout', tier: 1, x: 0, y: 2,
        prerequisites: ['sct_1'], requiredLevel: 3, cost: 1, maxRank: 3, currentRank: 0,
        effects: [{ type: 'passive_unlock', passive: 'nimbleFeet' }],
        description: '解锁被动：移速提升10%' },

      { id: 'sct_3', name: '风之跑者', branch: 'scout', tier: 2, x: 0, y: 3,
        prerequisites: ['sct_2'], requiredLevel: 5, cost: 1, maxRank: 3, currentRank: 0,
        effects: [{ type: 'passive_unlock', passive: 'windRunner' }],
        description: '解锁被动：翻滚后攻速+20%' },

      { id: 'sct_4', name: '求生本能', branch: 'scout', tier: 2, x: 0.5, y: 4,
        prerequisites: ['sct_3'], requiredLevel: 7, cost: 1, maxRank: 3, currentRank: 0,
        effects: [{ type: 'passive_unlock', passive: 'evasion' }],
        description: '解锁被动：10%闪避概率' },

      { id: 'sct_5', name: '影步大师', branch: 'scout', tier: 3, x: 0, y: 5,
        prerequisites: ['sct_4'], requiredLevel: 10, cost: 2, maxRank: 1, currentRank: 0,
        effects: [{ type: 'skill_enhance', skill: 'shadowStep', param: 'duration', value: 2000 }],
        description: '影遁持续+2秒' },

      // ─── 猎人分支 (Trapper / Control) ───
      { id: 'trp_1', name: '毒素涂层', branch: 'trapper', tier: 1, x: 2, y: 1,
        prerequisites: ['root'], requiredLevel: 2, cost: 1, maxRank: 3, currentRank: 0,
        effects: [{ type: 'passive_unlock', passive: 'poisonMastery' }],
        description: '解锁被动：毒素伤害+20%' },

      { id: 'trp_2', name: '毒箭强化', branch: 'trapper', tier: 1, x: 2.5, y: 2,
        prerequisites: ['trp_1'], requiredLevel: 3, cost: 1, maxRank: 3, currentRank: 0,
        effects: [{ type: 'skill_enhance', skill: 'poisonArrow', param: 'damageMultiplier', value: 0.1 }],
        description: '毒箭伤害+10%（每级）' },

      { id: 'trp_3', name: '猎人印记强化', branch: 'trapper', tier: 2, x: 2, y: 3,
        prerequisites: ['trp_2'], requiredLevel: 5, cost: 1, maxRank: 3, currentRank: 0,
        effects: [{ type: 'skill_enhance', skill: 'huntersMark', param: 'duration', value: 1000 }],
        description: '猎人印记持续+1秒（每级）' },

      { id: 'trp_4', name: '减速强化', branch: 'trapper', tier: 2, x: 1.5, y: 4,
        prerequisites: ['trp_3'], requiredLevel: 7, cost: 1, maxRank: 3, currentRank: 0,
        effects: [{ type: 'stat_bonus', stat: 'slowDuration', value: 500 }],
        description: '减速效果+0.5秒（每级）' },

      { id: 'trp_5', name: '致命猎手', branch: 'trapper', tier: 3, x: 2, y: 5,
        prerequisites: ['trp_4'], requiredLevel: 10, cost: 2, maxRank: 1, currentRank: 0,
        effects: [{ type: 'skill_enhance', skill: 'deadlyShot', param: 'damageMultiplier', value: 0.2 }],
        description: '致命射击伤害+20%' }
    ];
    this.unlockedNodes.add('root');
  }

  initMageTree() {
    this.nodes = [
      // ─── ROOT ───
      { id: 'root', name: '奥术之心', branch: 'core', tier: 0, x: 0, y: 0,
        prerequisites: [], requiredLevel: 1, cost: 0, maxRank: 1, currentRank: 1,
        effects: [], description: '法师的起点' },

      // ─── 火焰分支 (Fire / DPS) ───
      { id: 'fir_1', name: '灼热火焰', branch: 'fire', tier: 1, x: -2, y: 1,
        prerequisites: ['root'], requiredLevel: 2, cost: 1, maxRank: 3, currentRank: 0,
        effects: [{ type: 'stat_bonus', stat: 'spellDamage', value: 5 }],
        description: '法术伤害+5%（每级）' },

      { id: 'fir_2', name: '火球强化', branch: 'fire', tier: 1, x: -2.5, y: 2,
        prerequisites: ['fir_1'], requiredLevel: 3, cost: 1, maxRank: 3, currentRank: 0,
        effects: [{ type: 'skill_enhance', skill: 'fireball', param: 'damageMultiplier', value: 0.1 }],
        description: '火球术伤害+10%（每级）' },

      { id: 'fir_3', name: '纵火专家', branch: 'fire', tier: 2, x: -2, y: 3,
        prerequisites: ['fir_2'], requiredLevel: 5, cost: 1, maxRank: 3, currentRank: 0,
        effects: [{ type: 'passive_unlock', passive: 'pyromaniac' }],
        description: '解锁被动：灼烧伤害+25%' },

      { id: 'fir_4', name: '火焰风暴强化', branch: 'fire', tier: 2, x: -1.5, y: 4,
        prerequisites: ['fir_3'], requiredLevel: 7, cost: 1, maxRank: 3, currentRank: 0,
        effects: [{ type: 'skill_enhance', skill: 'flameStorm', param: 'damageMultiplier', value: 0.08 }],
        description: '火焰风暴伤害+8%（每级）' },

      { id: 'fir_5', name: '陨石强化', branch: 'fire', tier: 3, x: -2, y: 5,
        prerequisites: ['fir_4'], requiredLevel: 10, cost: 2, maxRank: 1, currentRank: 0,
        effects: [{ type: 'skill_enhance', skill: 'meteor', param: 'damageMultiplier', value: 0.2 }],
        description: '陨石术伤害+20%' },

      // ─── 冰霜分支 (Ice / Control) ───
      { id: 'ice_1', name: '寒冰之力', branch: 'ice', tier: 1, x: 0, y: 1,
        prerequisites: ['root'], requiredLevel: 2, cost: 1, maxRank: 3, currentRank: 0,
        effects: [{ type: 'stat_bonus', stat: 'maxMana', value: 15 }],
        description: '最大法力+15（每级）' },

      { id: 'ice_2', name: '冰箭强化', branch: 'ice', tier: 1, x: 0, y: 2,
        prerequisites: ['ice_1'], requiredLevel: 3, cost: 1, maxRank: 3, currentRank: 0,
        effects: [{ type: 'skill_enhance', skill: 'iceBolt', param: 'damageMultiplier', value: 0.1 }],
        description: '寒冰箭伤害+10%（每级）' },

      { id: 'ice_3', name: '寒冰之血', branch: 'ice', tier: 2, x: 0, y: 3,
        prerequisites: ['ice_2'], requiredLevel: 5, cost: 1, maxRank: 3, currentRank: 0,
        effects: [{ type: 'passive_unlock', passive: 'icyVeins' }],
        description: '解锁被动：冰系减速增强20%' },

      { id: 'ice_4', name: '冰冻强化', branch: 'ice', tier: 2, x: 0.5, y: 4,
        prerequisites: ['ice_3'], requiredLevel: 7, cost: 1, maxRank: 3, currentRank: 0,
        effects: [{ type: 'skill_enhance', skill: 'freeze', param: 'stun', value: 300 }],
        description: '冰冻术眩晕+0.3秒（每级）' },

      { id: 'ice_5', name: '暴风雪强化', branch: 'ice', tier: 3, x: 0, y: 5,
        prerequisites: ['ice_4'], requiredLevel: 10, cost: 2, maxRank: 1, currentRank: 0,
        effects: [{ type: 'skill_enhance', skill: 'blizzard', param: 'damageMultiplier', value: 0.15 }],
        description: '暴风雪伤害+15%' },

      // ─── 奥术分支 (Arcane / Utility) ───
      { id: 'arc_1', name: '奥术亲和', branch: 'arcane', tier: 1, x: 2, y: 1,
        prerequisites: ['root'], requiredLevel: 2, cost: 1, maxRank: 3, currentRank: 0,
        effects: [{ type: 'stat_bonus', stat: 'cdr', value: 3 }],
        description: '技能冷却-3%（每级）' },

      { id: 'arc_2', name: '飞弹强化', branch: 'arcane', tier: 1, x: 2.5, y: 2,
        prerequisites: ['arc_1'], requiredLevel: 3, cost: 1, maxRank: 3, currentRank: 0,
        effects: [{ type: 'skill_enhance', skill: 'arcaneMissile', param: 'damageMultiplier', value: 0.1 }],
        description: '奥术飞弹伤害+10%（每级）' },

      { id: 'arc_3', name: '奥术专注', branch: 'arcane', tier: 2, x: 2, y: 3,
        prerequisites: ['arc_2'], requiredLevel: 5, cost: 1, maxRank: 3, currentRank: 0,
        effects: [{ type: 'passive_unlock', passive: 'arcaneFocus' }],
        description: '解锁被动：施法减伤10%' },

      { id: 'arc_4', name: '法力护盾', branch: 'arcane', tier: 2, x: 1.5, y: 4,
        prerequisites: ['arc_3'], requiredLevel: 7, cost: 1, maxRank: 3, currentRank: 0,
        effects: [{ type: 'passive_unlock', passive: 'manaShield' }],
        description: '解锁被动：法力抵消20%伤害' },

      { id: 'arc_5', name: '元素爆发强化', branch: 'arcane', tier: 3, x: 2, y: 5,
        prerequisites: ['arc_4'], requiredLevel: 10, cost: 2, maxRank: 1, currentRank: 0,
        effects: [{ type: 'skill_enhance', skill: 'elementalBurst', param: 'duration', value: 2000 }],
        description: '元素爆发持续+2秒' }
    ];
    this.unlockedNodes.add('root');
  }

  canUnlock(nodeId) {
    const node = this.getNode(nodeId);
    if (!node || node.currentRank >= node.maxRank) return false;
    const levelSystem = this.scene.registry.get('levelSystem');
    if (!levelSystem || levelSystem.level < node.requiredLevel) return false;
    if (levelSystem.skillPoints < node.cost) return false;
    return node.prerequisites.every(p => this.unlockedNodes.has(p));
  }

  unlock(nodeId) {
    if (!this.canUnlock(nodeId)) return false;
    const node = this.getNode(nodeId);
    const levelSystem = this.scene.registry.get('levelSystem');
    levelSystem.skillPoints -= node.cost;
    node.currentRank++;
    if (node.currentRank >= 1) this.unlockedNodes.add(nodeId);
    this.scene.events.emit('skillUnlocked', nodeId, node);
    return true;
  }

  getNode(id) {
    return this.nodes.find(n => n.id === id);
  }

  getNodeState(nodeId) {
    const node = this.getNode(nodeId);
    if (!node) return 'unknown';
    if (this.unlockedNodes.has(nodeId) && node.currentRank >= node.maxRank) return 'maxed';
    if (this.unlockedNodes.has(nodeId)) return 'unlocked';
    if (this.canUnlock(nodeId)) return 'available';
    return 'locked';
  }

  /** 获取分支列表 */
  getBranches() {
    const branches = new Set();
    this.nodes.forEach(n => branches.add(n.branch));
    return [...branches];
  }

  /** 获取某分支的所有节点 */
  getNodesByBranch(branch) {
    return this.nodes.filter(n => n.branch === branch);
  }

  toJSON() {
    return {
      classType: this.classType,
      unlockedNodes: [...this.unlockedNodes],
      nodes: this.nodes.map(n => ({ id: n.id, currentRank: n.currentRank }))
    };
  }

  fromJSON(data) {
    if (!data) return;
    if (data.unlockedNodes) {
      this.unlockedNodes = new Set(data.unlockedNodes);
    }
    if (data.nodes) {
      data.nodes.forEach(saved => {
        const node = this.getNode(saved.id);
        if (node) node.currentRank = saved.currentRank;
      });
    }
  }
}
