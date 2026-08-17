/**
 * 技能树系统 — 3分支结构，按职业初始化
 *
 * 节点效果类型:
 *   stat_bonus     — 固定属性加成 { stat, value }
 *   skill_enhance  — 强化技能参数 { skill, param, value }
 *   passive_unlock — 解锁被动技能 { passive }
 */
import SystemRegistry from '../core/SystemRegistry.js';

export class SkillTreeSystem {
  constructor(scene, classType = 'warrior') {
    this.scene = scene;
    this.classType = classType;
    this.nodes = [];
    this.unlockedNodes = new Set();
    /** 技能增强表：{ skillId: { param: totalValue } } */
    this.skillEnhancements = {};
    /** 已解锁被动集合 */
    this.passives = new Set();
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
      { id: 'root', name: '体修要诀', branch: 'core', tier: 0, x: 0, y: 0,
        prerequisites: [], requiredLevel: 1, cost: 0, maxRank: 1, currentRank: 1,
        effects: [], description: '体修传承的起点' },

      // ─── 狂战分支 (Berserker / DPS) ───
      { id: 'ber_1', name: '破阵劲', branch: 'berserker', tier: 1, x: -2, y: 1,
        prerequisites: ['root'], requiredLevel: 2, cost: 1, maxRank: 3, currentRank: 0,
        effects: [{ type: 'stat_bonus', stat: 'critRate', value: 5 }],
        description: '暴击率+5%（每级）' },

      { id: 'ber_2', name: '撼山精要', branch: 'berserker', tier: 1, x: -2.5, y: 2,
        prerequisites: ['ber_1'], requiredLevel: 3, cost: 1, maxRank: 3, currentRank: 0,
        effects: [{ type: 'skill_enhance', skill: 'heavyStrike', param: 'damageMultiplier', value: 0.1 }],
        description: '撼山击伤害+10%（每级）' },

      { id: 'ber_3', name: '血炼法', branch: 'berserker', tier: 2, x: -2, y: 3,
        prerequisites: ['ber_2'], requiredLevel: 5, cost: 1, maxRank: 3, currentRank: 0,
        effects: [{ type: 'passive_unlock', passive: 'bloodlust' }],
        description: '解锁被动：血炼，击杀后恢复10%最大气血' },

      { id: 'ber_4', name: '罡风精要', branch: 'berserker', tier: 2, x: -1.5, y: 4,
        prerequisites: ['ber_3'], requiredLevel: 7, cost: 1, maxRank: 3, currentRank: 0,
        effects: [{ type: 'skill_enhance', skill: 'whirlwind', param: 'damageMultiplier', value: 0.05 }],
        description: '罡风轮伤害+5%（每级）' },

      { id: 'ber_5', name: '怒相精要', branch: 'berserker', tier: 3, x: -2, y: 5,
        prerequisites: ['ber_4'], requiredLevel: 10, cost: 2, maxRank: 1, currentRank: 0,
        effects: [{ type: 'skill_enhance', skill: 'berserkerRage', param: 'duration', value: 2000 }],
        description: '金刚怒相持续时间+2秒' },

      // ─── 防御分支 (Guardian / Tank) ───
      { id: 'grd_1', name: '玄龟桩', branch: 'guardian', tier: 1, x: 0, y: 1,
        prerequisites: ['root'], requiredLevel: 2, cost: 1, maxRank: 3, currentRank: 0,
        effects: [{ type: 'stat_bonus', stat: 'maxHp', value: 20 }],
        description: '最大气血+20（每级）' },

      { id: 'grd_2', name: '铁骨锻体', branch: 'guardian', tier: 1, x: 0, y: 2,
        prerequisites: ['grd_1'], requiredLevel: 3, cost: 1, maxRank: 3, currentRank: 0,
        effects: [{ type: 'passive_unlock', passive: 'heavyArmor' }],
        description: '解锁被动：铁骨，防御+15%' },

      { id: 'grd_3', name: '不动心法', branch: 'guardian', tier: 2, x: 0, y: 3,
        prerequisites: ['grd_2'], requiredLevel: 5, cost: 1, maxRank: 3, currentRank: 0,
        effects: [{ type: 'passive_unlock', passive: 'unyielding' }],
        description: '解锁被动：不动心，气血低于30%时减伤20%' },

      { id: 'grd_4', name: '玄龟精要', branch: 'guardian', tier: 2, x: 0.5, y: 4,
        prerequisites: ['grd_3'], requiredLevel: 7, cost: 1, maxRank: 3, currentRank: 0,
        effects: [{ type: 'skill_enhance', skill: 'defensiveStance', param: 'duration', value: 1000 }],
        description: '玄龟架持续+1秒（每级）' },

      { id: 'grd_5', name: '金身不坏', branch: 'guardian', tier: 3, x: 0, y: 5,
        prerequisites: ['grd_4'], requiredLevel: 10, cost: 2, maxRank: 1, currentRank: 0,
        effects: [{ type: 'stat_bonus', stat: 'defense', value: 10 }],
        description: '防御+10' },

      // ─── 控制分支 (Warlord / Control) ───
      { id: 'wld_1', name: '透劲入骨', branch: 'warlord', tier: 1, x: 2, y: 1,
        prerequisites: ['root'], requiredLevel: 2, cost: 1, maxRank: 3, currentRank: 0,
        effects: [{ type: 'passive_unlock', passive: 'concussiveStrikes' }],
        description: '解锁被动：透劲，攻击有10%概率眩晕' },

      { id: 'wld_2', name: '铁山精要', branch: 'warlord', tier: 1, x: 2.5, y: 2,
        prerequisites: ['wld_1'], requiredLevel: 3, cost: 1, maxRank: 3, currentRank: 0,
        effects: [{ type: 'skill_enhance', skill: 'charge', param: 'stun', value: 200 }],
        description: '铁山靠眩晕+0.2秒（每级）' },

      { id: 'wld_3', name: '开山精要', branch: 'warlord', tier: 2, x: 2, y: 3,
        prerequisites: ['wld_2'], requiredLevel: 5, cost: 1, maxRank: 3, currentRank: 0,
        effects: [{ type: 'skill_enhance', skill: 'groundSplitter', param: 'damageMultiplier', value: 0.1 }],
        description: '开山式伤害+10%（每级）' },

      { id: 'wld_4', name: '凝势阻敌', branch: 'warlord', tier: 2, x: 1.5, y: 4,
        prerequisites: ['wld_3'], requiredLevel: 7, cost: 1, maxRank: 3, currentRank: 0,
        effects: [{ type: 'stat_bonus', stat: 'slowDuration', value: 500 }],
        description: '迟滞效果+0.5秒（每级）' },

      { id: 'wld_5', name: '镇魂精要', branch: 'warlord', tier: 3, x: 2, y: 5,
        prerequisites: ['wld_4'], requiredLevel: 10, cost: 2, maxRank: 1, currentRank: 0,
        effects: [{ type: 'skill_enhance', skill: 'taunt', param: 'duration', value: 1000 }],
        description: '镇魂喝持续+1秒' }
    ];
    this.unlockedNodes.add('root');
  }

  initArcherTree() {
    this.nodes = [
      // ─── ROOT ───
      { id: 'root', name: '剑修要诀', branch: 'core', tier: 0, x: 0, y: 0,
        prerequisites: [], requiredLevel: 1, cost: 0, maxRank: 1, currentRank: 1,
        effects: [], description: '剑修传承的起点' },

      // ─── 精准分支 (Sharpshooter / DPS) ───
      { id: 'shr_1', name: '剑心初明', branch: 'sharpshooter', tier: 1, x: -2, y: 1,
        prerequisites: ['root'], requiredLevel: 2, cost: 1, maxRank: 3, currentRank: 0,
        effects: [{ type: 'stat_bonus', stat: 'critRate', value: 5 }],
        description: '暴击率+5%（每级）' },

      { id: 'shr_2', name: '蓄势精要', branch: 'sharpshooter', tier: 1, x: -2.5, y: 2,
        prerequisites: ['shr_1'], requiredLevel: 3, cost: 1, maxRank: 3, currentRank: 0,
        effects: [{ type: 'skill_enhance', skill: 'chargedShot', param: 'damageMultiplier', value: 0.1 }],
        description: '蓄势飞剑伤害+10%（每级）' },

      { id: 'shr_3', name: '洞察破绽', branch: 'sharpshooter', tier: 2, x: -2, y: 3,
        prerequisites: ['shr_2'], requiredLevel: 5, cost: 1, maxRank: 3, currentRank: 0,
        effects: [{ type: 'stat_bonus', stat: 'critDmg', value: 0.1 }],
        description: '暴击伤害+10%（每级）' },

      { id: 'shr_4', name: '贯虹精要', branch: 'sharpshooter', tier: 2, x: -1.5, y: 4,
        prerequisites: ['shr_3'], requiredLevel: 7, cost: 1, maxRank: 3, currentRank: 0,
        effects: [{ type: 'skill_enhance', skill: 'piercingShot', param: 'damageMultiplier', value: 0.1 }],
        description: '贯虹剑伤害+10%（每级）' },

      { id: 'shr_5', name: '剑雨精要', branch: 'sharpshooter', tier: 3, x: -2, y: 5,
        prerequisites: ['shr_4'], requiredLevel: 10, cost: 2, maxRank: 1, currentRank: 0,
        effects: [{ type: 'skill_enhance', skill: 'arrowRain', param: 'damageMultiplier', value: 0.15 }],
        description: '万剑归雨伤害+15%' },

      // ─── 游侠分支 (Scout / Mobility) ───
      { id: 'sct_1', name: '踏风入门', branch: 'scout', tier: 1, x: 0, y: 1,
        prerequisites: ['root'], requiredLevel: 2, cost: 1, maxRank: 3, currentRank: 0,
        effects: [{ type: 'stat_bonus', stat: 'moveSpeed', value: 8 }],
        description: '移动速度+8（每级）' },

      { id: 'sct_2', name: '踏风精要', branch: 'scout', tier: 1, x: 0, y: 2,
        prerequisites: ['sct_1'], requiredLevel: 3, cost: 1, maxRank: 3, currentRank: 0,
        effects: [{ type: 'passive_unlock', passive: 'nimbleFeet' }],
        description: '解锁被动：踏风，移动速度提升10%' },

      { id: 'sct_3', name: '乘风而行', branch: 'scout', tier: 2, x: 0, y: 3,
        prerequisites: ['sct_2'], requiredLevel: 5, cost: 1, maxRank: 3, currentRank: 0,
        effects: [{ type: 'passive_unlock', passive: 'windRunner' }],
        description: '解锁被动：乘风诀，施展流云步后攻击速度+20%' },

      { id: 'sct_4', name: '御风护身', branch: 'scout', tier: 2, x: 0.5, y: 4,
        prerequisites: ['sct_3'], requiredLevel: 7, cost: 1, maxRank: 3, currentRank: 0,
        effects: [{ type: 'passive_unlock', passive: 'evasion' }],
        description: '解锁被动：御风，10%概率闪避攻击' },

      { id: 'sct_5', name: '无影精要', branch: 'scout', tier: 3, x: 0, y: 5,
        prerequisites: ['sct_4'], requiredLevel: 10, cost: 2, maxRank: 1, currentRank: 0,
        effects: [{ type: 'skill_enhance', skill: 'shadowStep', param: 'duration', value: 2000 }],
        description: '无影遁持续+2秒' },

      // ─── 猎人分支 (Trapper / Control) ───
      { id: 'trp_1', name: '淬毒入门', branch: 'trapper', tier: 1, x: 2, y: 1,
        prerequisites: ['root'], requiredLevel: 2, cost: 1, maxRank: 3, currentRank: 0,
        effects: [{ type: 'passive_unlock', passive: 'poisonMastery' }],
        description: '解锁被动：淬毒术，毒素伤害+20%' },

      { id: 'trp_2', name: '青瘴精要', branch: 'trapper', tier: 1, x: 2.5, y: 2,
        prerequisites: ['trp_1'], requiredLevel: 3, cost: 1, maxRank: 3, currentRank: 0,
        effects: [{ type: 'skill_enhance', skill: 'poisonArrow', param: 'damageMultiplier', value: 0.1 }],
        description: '青瘴剑伤害+10%（每级）' },

      { id: 'trp_3', name: '锁魂精要', branch: 'trapper', tier: 2, x: 2, y: 3,
        prerequisites: ['trp_2'], requiredLevel: 5, cost: 1, maxRank: 3, currentRank: 0,
        effects: [{ type: 'skill_enhance', skill: 'huntersMark', param: 'duration', value: 1000 }],
        description: '锁魂剑印持续+1秒（每级）' },

      { id: 'trp_4', name: '滞敌剑意', branch: 'trapper', tier: 2, x: 1.5, y: 4,
        prerequisites: ['trp_3'], requiredLevel: 7, cost: 1, maxRank: 3, currentRank: 0,
        effects: [{ type: 'stat_bonus', stat: 'slowDuration', value: 500 }],
        description: '迟滞效果+0.5秒（每级）' },

      { id: 'trp_5', name: '绝命剑意', branch: 'trapper', tier: 3, x: 2, y: 5,
        prerequisites: ['trp_4'], requiredLevel: 10, cost: 2, maxRank: 1, currentRank: 0,
        effects: [{ type: 'skill_enhance', skill: 'deadlyShot', param: 'damageMultiplier', value: 0.2 }],
        description: '绝命一剑伤害+20%' }
    ];
    this.unlockedNodes.add('root');
  }

  initMageTree() {
    this.nodes = [
      // ─── ROOT ───
      { id: 'root', name: '术修要诀', branch: 'core', tier: 0, x: 0, y: 0,
        prerequisites: [], requiredLevel: 1, cost: 0, maxRank: 1, currentRank: 1,
        effects: [], description: '术修传承的起点' },

      // ─── 火焰分支 (Fire / DPS) ───
      { id: 'fir_1', name: '离火入门', branch: 'fire', tier: 1, x: -2, y: 1,
        prerequisites: ['root'], requiredLevel: 2, cost: 1, maxRank: 3, currentRank: 0,
        effects: [{ type: 'stat_bonus', stat: 'spellPower', value: 5 }],
        description: '术法强度+5（每级）' },

      { id: 'fir_2', name: '离火精要', branch: 'fire', tier: 1, x: -2.5, y: 2,
        prerequisites: ['fir_1'], requiredLevel: 3, cost: 1, maxRank: 3, currentRank: 0,
        effects: [{ type: 'skill_enhance', skill: 'fireball', param: 'damageMultiplier', value: 0.1 }],
        description: '离火咒伤害+10%（每级）' },

      { id: 'fir_3', name: '离火亲和', branch: 'fire', tier: 2, x: -2, y: 3,
        prerequisites: ['fir_2'], requiredLevel: 5, cost: 1, maxRank: 3, currentRank: 0,
        effects: [{ type: 'passive_unlock', passive: 'pyromaniac' }],
        description: '解锁被动：离火亲和，灼烧伤害+25%' },

      { id: 'fir_4', name: '焚风精要', branch: 'fire', tier: 2, x: -1.5, y: 4,
        prerequisites: ['fir_3'], requiredLevel: 7, cost: 1, maxRank: 3, currentRank: 0,
        effects: [{ type: 'skill_enhance', skill: 'flameStorm', param: 'damageMultiplier', value: 0.08 }],
        description: '焚风阵伤害+8%（每级）' },

      { id: 'fir_5', name: '天火精要', branch: 'fire', tier: 3, x: -2, y: 5,
        prerequisites: ['fir_4'], requiredLevel: 10, cost: 2, maxRank: 1, currentRank: 0,
        effects: [{ type: 'skill_enhance', skill: 'meteor', param: 'damageMultiplier', value: 0.2 }],
        description: '天火坠伤害+20%' },

      // ─── 冰霜分支 (Ice / Control) ───
      { id: 'ice_1', name: '玄阴纳气', branch: 'ice', tier: 1, x: 0, y: 1,
        prerequisites: ['root'], requiredLevel: 2, cost: 1, maxRank: 3, currentRank: 0,
        effects: [{ type: 'stat_bonus', stat: 'maxMp', value: 15 }],
        description: '最大灵力+15（每级）' },

      { id: 'ice_2', name: '玄冰精要', branch: 'ice', tier: 1, x: 0, y: 2,
        prerequisites: ['ice_1'], requiredLevel: 3, cost: 1, maxRank: 3, currentRank: 0,
        effects: [{ type: 'skill_enhance', skill: 'iceBolt', param: 'damageMultiplier', value: 0.1 }],
        description: '玄冰刺伤害+10%（每级）' },

      { id: 'ice_3', name: '玄阴通脉', branch: 'ice', tier: 2, x: 0, y: 3,
        prerequisites: ['ice_2'], requiredLevel: 5, cost: 1, maxRank: 3, currentRank: 0,
        effects: [{ type: 'passive_unlock', passive: 'icyVeins' }],
        description: '解锁被动：玄阴脉，冰系迟滞效果增强20%' },

      { id: 'ice_4', name: '凝冰精要', branch: 'ice', tier: 2, x: 0.5, y: 4,
        prerequisites: ['ice_3'], requiredLevel: 7, cost: 1, maxRank: 3, currentRank: 0,
        effects: [{ type: 'skill_enhance', skill: 'freeze', param: 'stun', value: 300 }],
        description: '凝冰诀眩晕+0.3秒（每级）' },

      { id: 'ice_5', name: '封山精要', branch: 'ice', tier: 3, x: 0, y: 5,
        prerequisites: ['ice_4'], requiredLevel: 10, cost: 2, maxRank: 1, currentRank: 0,
        effects: [{ type: 'skill_enhance', skill: 'blizzard', param: 'damageMultiplier', value: 0.15 }],
        description: '风雪封山伤害+15%' },

      // ─── 奥术分支 (Arcane / Utility) ───
      { id: 'arc_1', name: '灵息相合', branch: 'arcane', tier: 1, x: 2, y: 1,
        prerequisites: ['root'], requiredLevel: 2, cost: 1, maxRank: 3, currentRank: 0,
        effects: [{ type: 'stat_bonus', stat: 'cdr', value: 3 }],
        description: '术法冷却-3%（每级）' },

      { id: 'arc_2', name: '灵光精要', branch: 'arcane', tier: 1, x: 2.5, y: 2,
        prerequisites: ['arc_1'], requiredLevel: 3, cost: 1, maxRank: 3, currentRank: 0,
        effects: [{ type: 'skill_enhance', skill: 'arcaneMissile', param: 'damageMultiplier', value: 0.1 }],
        description: '灵光指伤害+10%（每级）' },

      { id: 'arc_3', name: '凝神守一', branch: 'arcane', tier: 2, x: 2, y: 3,
        prerequisites: ['arc_2'], requiredLevel: 5, cost: 1, maxRank: 3, currentRank: 0,
        effects: [{ type: 'passive_unlock', passive: 'arcaneFocus' }],
        description: '解锁被动：凝神，施展术法时减伤10%' },

      { id: 'arc_4', name: '灵力护体', branch: 'arcane', tier: 2, x: 1.5, y: 4,
        prerequisites: ['arc_3'], requiredLevel: 7, cost: 1, maxRank: 3, currentRank: 0,
        effects: [{ type: 'passive_unlock', passive: 'manaShield' }],
        description: '解锁被动：灵力护体，灵力抵消20%伤害' },

      { id: 'arc_5', name: '五行精要', branch: 'arcane', tier: 3, x: 2, y: 5,
        prerequisites: ['arc_4'], requiredLevel: 10, cost: 2, maxRank: 1, currentRank: 0,
        effects: [{ type: 'skill_enhance', skill: 'elementalBurst', param: 'duration', value: 2000 }],
        description: '五行迸发持续+2秒' }
    ];
    this.unlockedNodes.add('root');
  }

  canUnlock(nodeId) {
    const node = this.getNode(nodeId);
    if (!node || node.currentRank >= node.maxRank) return false;
    const levelSystem = SystemRegistry.get('levelSystem');
    if (!levelSystem || levelSystem.level < node.requiredLevel) return false;
    if (levelSystem.skillPoints < node.cost) return false;
    return node.prerequisites.every(p => this.unlockedNodes.has(p));
  }

  unlock(nodeId) {
    if (!this.canUnlock(nodeId)) return false;
    const node = this.getNode(nodeId);
    const levelSystem = SystemRegistry.get('levelSystem');
    levelSystem.skillPoints -= node.cost;
    node.currentRank++;
    if (node.currentRank >= 1) this.unlockedNodes.add(nodeId);
    // 应用该等级的效果
    this._applyNodeEffects(node, 1);
    this.scene.events.emit('skillUnlocked', nodeId, node);
    return true;
  }

  /** 应用单个节点的效果（增量，rankDelta 通常为 1） */
  _applyNodeEffects(node, rankDelta) {
    for (const eff of node.effects) {
      if (eff.type === 'stat_bonus') {
        // stat_bonus 由 EquipmentSystem.applyBonuses 统一收集，此处不直接写 Stats
      } else if (eff.type === 'skill_enhance') {
        if (!this.skillEnhancements[eff.skill]) this.skillEnhancements[eff.skill] = {};
        const entry = this.skillEnhancements[eff.skill];
        entry[eff.param] = (entry[eff.param] || 0) + eff.value * rankDelta;
      } else if (eff.type === 'passive_unlock') {
        this.passives.add(eff.passive);
      }
    }
    // 触发装备系统重算（会包含技能树 stat_bonus）
    const eqSys = SystemRegistry.get('equipmentSystem');
    if (eqSys) eqSys.applyBonuses();
  }

  /** 重放所有已解锁节点的效果（存档加载后调用） */
  applyAllEffects() {
    this.skillEnhancements = {};
    this.passives = new Set();
    for (const node of this.nodes) {
      if (node.currentRank > 0) {
        // 直接构建表，不逐个触发 applyBonuses
        for (const eff of node.effects) {
          if (eff.type === 'skill_enhance') {
            if (!this.skillEnhancements[eff.skill]) this.skillEnhancements[eff.skill] = {};
            const entry = this.skillEnhancements[eff.skill];
            entry[eff.param] = (entry[eff.param] || 0) + eff.value * node.currentRank;
          } else if (eff.type === 'passive_unlock') {
            this.passives.add(eff.passive);
          }
        }
      }
    }
    // stat_bonus 统一由 EquipmentSystem.applyBonuses 收集
    const eqSys = SystemRegistry.get('equipmentSystem');
    if (eqSys) eqSys.applyBonuses();
  }

  /** 查询技能增强值 */
  getSkillEnhancement(skillId, param) {
    return this.skillEnhancements[skillId]?.[param] || 0;
  }

  /** 检查被动是否已解锁 */
  hasPassive(passiveId) {
    return this.passives.has(passiveId);
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
    // 重放所有已解锁节点的效果到 Stats / SkillEngine
    this.applyAllEffects();
  }
}
