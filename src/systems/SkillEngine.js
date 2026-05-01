/**
 * SkillEngine — 管理技能冷却、资源检查、等级和阶段执行。
 *
 * 与职业无关：技能数据和缩放函数由构造函数注入。
 *
 * 技能生命周期:
 *   1. canUse(skillId) → 检查冷却/资源/状态
 *   2. execute(skillId) → 扣除资源、启动冷却、返回阶段配置
 *   3. update(delta) → tick 冷却和阶段
 *
 * Player 负责实际的阶段转换和 hitbox 管理。
 */
export class SkillEngine {
  /**
   * @param {Phaser.Scene} scene
   * @param {Actor} actor
   * @param {Object} skillDefs - WARRIOR_SKILLS / ARCHER_SKILLS / MAGE_SKILLS
   * @param {Function} getAtLevel - getSkillAtLevel(skillId, level) 缩放函数
   */
  constructor(scene, actor, skillDefs, getAtLevel) {
    this.scene = scene;
    this.actor = actor;
    this.skillDefs = skillDefs;
    this.getAtLevel = getAtLevel;

    /** Map<skillId, remainingCooldownMs> */
    this.cooldowns = {};

    /** Map<skillId, currentLevel> */
    this.skillLevels = {};

    /** Currently active skill ID, or null */
    this.activeSkillId = null;

    /** Current phase: 'startup' | 'active' | 'recovery' | null */
    this.activePhase = null;

    /** Timer for current phase in ms */
    this.phaseTimer = 0;

    /** Tick timer for multi-hit skills */
    this.tickTimer = 0;

    /** Track enemies hit per skill activation */
    this.hitTargets = new Set();

    /** Cached scaled skill data for active skill */
    this._activeSkillData = null;

    // Initialize cooldowns and levels for all skills
    Object.keys(this.skillDefs).forEach(id => {
      this.cooldowns[id] = 0;
      this.skillLevels[id] = 1;
    });
  }

  /** Get skill definitions (for UI enumeration) */
  getSkillDefs() {
    return this.skillDefs;
  }

  /** Get skill level */
  getSkillLevel(skillId) {
    return this.skillLevels[skillId] || 0;
  }

  /** Get scaled skill data for current level */
  getScaledSkill(skillId) {
    const level = this.skillLevels[skillId] || 1;
    return this.getAtLevel(skillId, level);
  }

  /**
   * Upgrade a skill by 1 level.
   * @returns {boolean}
   */
  upgradeSkill(skillId) {
    const base = this.skillDefs[skillId];
    if (!base) return false;

    const currentLevel = this.skillLevels[skillId] || 1;
    if (currentLevel >= base.maxLevel) return false;

    const levelSystem = this.scene.registry?.get('levelSystem');
    if (!levelSystem || levelSystem.skillPoints < base.upgradeCost) return false;

    levelSystem.skillPoints -= base.upgradeCost;
    this.skillLevels[skillId] = currentLevel + 1;
    this.scene.events.emit('skillUpgraded', skillId, this.skillLevels[skillId]);
    return true;
  }

  /**
   * Check if a skill can be used right now.
   * @returns {{ canUse: boolean, reason: string }}
   */
  canUse(skillId) {
    const skill = this.skillDefs[skillId];
    if (!skill) return { canUse: false, reason: 'unknown_skill' };

    if (this.activeSkillId !== null) return { canUse: false, reason: 'already_casting' };

    if (this.cooldowns[skillId] > 0) return { canUse: false, reason: 'on_cooldown' };

    const scaled = this.getScaledSkill(skillId);
    if (skill.resource === 'stamina' && this.actor.stamina < scaled.cost) {
      return { canUse: false, reason: 'no_stamina' };
    }
    if (skill.resource === 'rage' && this.actor.rage < scaled.cost) {
      return { canUse: false, reason: 'no_rage' };
    }
    if (skill.resource === 'mana' && this.actor.mana < scaled.cost) {
      return { canUse: false, reason: 'no_mana' };
    }

    return { canUse: true, reason: 'ok' };
  }

  /**
   * Execute a skill: deduct resource, start cooldown, begin startup phase.
   * @returns {object|null} Scaled skill data, or null if cannot use
   */
  execute(skillId) {
    const check = this.canUse(skillId);
    if (!check.canUse) return null;

    const scaled = this.getScaledSkill(skillId);

    // Deduct resource
    if (scaled.resource === 'stamina') {
      this.actor.useStamina(scaled.cost);
    } else if (scaled.resource === 'rage') {
      this.actor.useRage(scaled.cost);
    } else if (scaled.resource === 'mana') {
      this.actor.useMana(scaled.cost);
    }

    // Apply CDR
    const cdr = this.actor.stats.getDerived().cdr || 0;
    const effectiveCooldown = scaled.cooldown * (1 - cdr / 100);

    this.cooldowns[skillId] = effectiveCooldown;

    // Enter startup phase
    this.activeSkillId = skillId;
    this.activePhase = 'startup';
    this.phaseTimer = 0;
    this.tickTimer = 0;
    this.hitTargets.clear();
    this._activeSkillData = scaled;

    return scaled;
  }

  /**
   * Tick cooldowns and active skill phases.
   * @returns {{ event: string, skill: object }|null}
   */
  update(delta) {
    // Tick all cooldowns
    for (const id in this.cooldowns) {
      if (this.cooldowns[id] > 0) {
        this.cooldowns[id] = Math.max(0, this.cooldowns[id] - delta);
      }
    }

    if (this.activeSkillId === null) return null;

    const skill = this._activeSkillData;
    if (!skill) return null;

    this.phaseTimer += delta;
    const phaseDuration = skill.phases[this.activePhase];

    if (this.phaseTimer >= phaseDuration) {
      if (this.activePhase === 'startup') {
        this.activePhase = 'active';
        this.phaseTimer = 0;
        this.tickTimer = 0;
        return { event: 'phase_active', skill };
      } else if (this.activePhase === 'active') {
        this.activePhase = 'recovery';
        this.phaseTimer = 0;
        return { event: 'phase_recovery', skill };
      } else if (this.activePhase === 'recovery') {
        const finishedSkill = skill;
        this.activeSkillId = null;
        this.activePhase = null;
        this.phaseTimer = 0;
        this.hitTargets.clear();
        this._activeSkillData = null;
        return { event: 'skill_complete', skill: finishedSkill };
      }
    }

    // Multi-hit tick during active phase
    if (this.activePhase === 'active' && skill.effect.tickInterval) {
      this.tickTimer += delta;
      if (this.tickTimer >= skill.effect.tickInterval) {
        this.tickTimer -= skill.effect.tickInterval;
        return { event: 'skill_tick', skill };
      }
    }

    return null;
  }

  hasHitTarget(enemy) { return this.hitTargets.has(enemy); }
  markTargetHit(enemy) { this.hitTargets.add(enemy); }

  cancelActiveSkill() {
    this.activeSkillId = null;
    this.activePhase = null;
    this.phaseTimer = 0;
    this.tickTimer = 0;
    this.hitTargets.clear();
    this._activeSkillData = null;
  }

  getCooldownInfo(skillId) {
    const base = this.skillDefs[skillId];
    if (!base) return { remaining: 0, total: 0, fraction: 0 };
    const remaining = this.cooldowns[skillId] || 0;
    const scaled = this.getScaledSkill(skillId);
    const cdr = this.actor.stats.getDerived().cdr || 0;
    const total = scaled.cooldown * (1 - cdr / 100);
    return { remaining, total, fraction: total > 0 ? remaining / total : 0 };
  }

  getActiveSkill() {
    if (!this.activeSkillId) return null;
    return this._activeSkillData;
  }

  toJSON() {
    return {
      cooldowns: { ...this.cooldowns },
      skillLevels: { ...this.skillLevels }
    };
  }

  fromJSON(data) {
    if (!data) return;
    if (data.cooldowns) Object.assign(this.cooldowns, data.cooldowns);
    if (data.skillLevels) Object.assign(this.skillLevels, data.skillLevels);
  }
}
