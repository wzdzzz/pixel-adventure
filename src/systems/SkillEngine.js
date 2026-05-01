import { WARRIOR_SKILLS, SKILL_SLOTS, getSkillAtLevel } from '../data/warriorSkills.js';

/**
 * SkillEngine — manages skill cooldowns, resource checks, levels, and phase execution.
 *
 * Lifecycle of a skill:
 *   1. canUse(skillId) → checks cooldown, resource, player state
 *   2. execute(skillId) → deducts resource, starts cooldown, returns phase config
 *   3. update(delta) → ticks cooldowns
 *
 * The Player is responsible for the actual phase transitions and hitbox management.
 * SkillEngine only manages the bookkeeping.
 */
export class SkillEngine {
  constructor(scene, actor) {
    this.scene = scene;
    this.actor = actor;

    /** Map<skillId, remainingCooldownMs> */
    this.cooldowns = {};

    /** Map<skillId, currentLevel> */
    this.skillLevels = {};

    /** Currently active skill ID, or null */
    this.activeSkillId = null;

    /** Current phase of active skill: 'startup' | 'active' | 'recovery' | null */
    this.activePhase = null;

    /** Timer for current phase in ms */
    this.phaseTimer = 0;

    /** Tick timer for multi-hit skills (whirlwind) */
    this.tickTimer = 0;

    /** Track enemies hit per skill activation (for single-hit skills like charge) */
    this.hitTargets = new Set();

    /** Cached scaled skill data for active skill */
    this._activeSkillData = null;

    // Initialize cooldowns and levels
    Object.keys(WARRIOR_SKILLS).forEach(id => {
      this.cooldowns[id] = 0;
      this.skillLevels[id] = 1;
    });
  }

  /** Get skill level */
  getSkillLevel(skillId) {
    return this.skillLevels[skillId] || 0;
  }

  /** Get scaled skill data for current level */
  getScaledSkill(skillId) {
    const level = this.skillLevels[skillId] || 1;
    return getSkillAtLevel(skillId, level);
  }

  /**
   * Upgrade a skill by 1 level. Costs skill points from LevelSystem.
   * @returns {boolean} whether upgrade succeeded
   */
  upgradeSkill(skillId) {
    const base = WARRIOR_SKILLS[skillId];
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
   * @param {string} skillId
   * @returns {{ canUse: boolean, reason: string }}
   */
  canUse(skillId) {
    const skill = WARRIOR_SKILLS[skillId];
    if (!skill) return { canUse: false, reason: 'unknown_skill' };

    if (this.activeSkillId !== null) return { canUse: false, reason: 'already_casting' };

    if (this.cooldowns[skillId] > 0) return { canUse: false, reason: 'on_cooldown' };

    // Use scaled cost
    const scaled = this.getScaledSkill(skillId);
    if (skill.resource === 'stamina' && this.actor.stamina < scaled.cost) {
      return { canUse: false, reason: 'no_stamina' };
    }
    if (skill.resource === 'rage' && this.actor.rage < scaled.cost) {
      return { canUse: false, reason: 'no_rage' };
    }

    return { canUse: true, reason: 'ok' };
  }

  /**
   * Execute a skill: deduct resource, start cooldown, begin startup phase.
   * @param {string} skillId
   * @returns {object|null} The scaled skill data object, or null if cannot use
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
    }

    // Apply CDR (cooldown reduction) from stats
    const cdr = this.actor.stats.getDerived().cdr || 0;
    const effectiveCooldown = scaled.cooldown * (1 - cdr / 100);

    // Start cooldown
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
   * @param {number} delta - ms since last frame
   * @returns {{ event: string, skill: object }|null} Phase transition event or null
   */
  update(delta) {
    // Tick all cooldowns
    for (const id in this.cooldowns) {
      if (this.cooldowns[id] > 0) {
        this.cooldowns[id] = Math.max(0, this.cooldowns[id] - delta);
      }
    }

    // Tick active skill phase
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

    // For multi-hit skills, tick the hit timer during active phase
    if (this.activePhase === 'active' && skill.effect.tickInterval) {
      this.tickTimer += delta;
      if (this.tickTimer >= skill.effect.tickInterval) {
        this.tickTimer -= skill.effect.tickInterval;
        return { event: 'skill_tick', skill };
      }
    }

    return null;
  }

  /** Check if an enemy has already been hit by the current skill activation. */
  hasHitTarget(enemy) {
    return this.hitTargets.has(enemy);
  }

  /** Mark an enemy as hit by current skill activation. */
  markTargetHit(enemy) {
    this.hitTargets.add(enemy);
  }

  /** Force-cancel the active skill (e.g., on death or stun). */
  cancelActiveSkill() {
    this.activeSkillId = null;
    this.activePhase = null;
    this.phaseTimer = 0;
    this.tickTimer = 0;
    this.hitTargets.clear();
    this._activeSkillData = null;
  }

  /**
   * Get cooldown remaining for a skill (for UI).
   * @returns {{ remaining: number, total: number, fraction: number }}
   */
  getCooldownInfo(skillId) {
    const base = WARRIOR_SKILLS[skillId];
    if (!base) return { remaining: 0, total: 0, fraction: 0 };
    const remaining = this.cooldowns[skillId] || 0;
    const scaled = this.getScaledSkill(skillId);
    const cdr = this.actor.stats.getDerived().cdr || 0;
    const total = scaled.cooldown * (1 - cdr / 100);
    return { remaining, total, fraction: total > 0 ? remaining / total : 0 };
  }

  /** Get the currently active skill data (scaled), or null */
  getActiveSkill() {
    if (!this.activeSkillId) return null;
    return this._activeSkillData;
  }

  /** Serialization */
  toJSON() {
    return {
      cooldowns: { ...this.cooldowns },
      skillLevels: { ...this.skillLevels }
    };
  }

  fromJSON(data) {
    if (!data) return;
    if (data.cooldowns) {
      Object.assign(this.cooldowns, data.cooldowns);
    }
    if (data.skillLevels) {
      Object.assign(this.skillLevels, data.skillLevels);
    }
  }
}
