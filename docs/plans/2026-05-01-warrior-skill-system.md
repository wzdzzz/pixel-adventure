# Warrior Skill System Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Implement a Phase 1 Warrior Skill System that replaces the unused MP resource with a dual Stamina/Rage system, adds a data-driven Skill Engine, and delivers two combat skills (Charge and Whirlwind) with full visual/audio feedback. Phase 2 (Heavy Slam, Parry, Dodge) and Phase 3 (Leap, Shockwave, Skill Bar VFX) are scoped as future work.

**Architecture:** Skill definitions live in a standalone data module (`warriorSkills.js`). A new `SkillEngine` system manages cooldowns, resource checks, phase transitions, and hitbox lifecycle. The Player state machine gains `SKILL_CASTING` and `DODGE` states. The HUD replaces the MP bar with Stamina (yellow) and adds a Rage bar (red). Number keys 1-4 bind to skill slots. All combat events (damage dealt, damage taken, kills) feed Rage generation. Stamina replaces the existing `mp`/`maxMp` fields in `Actor`.

**Tech Stack:** Phaser 3.80.1, vanilla JS ES Modules, Vite 5.4.0

---

## Context for Implementers

### Existing Systems You Must Know

1. **Actor** (`src/entities/Actor.js`): Base class for Player and Enemy. Owns a `Stats` instance, `hp`/`maxHp`/`mp`/`maxMp` fields, `useMp(amount)` method, `takeDamage()` with defense/knockback/I-frames, `updateActor(delta)` ticks I-frames and HP regen. The `onHpChanged()` callback fires to notify the UI.

2. **Player** (`src/entities/Player.js`): Extends Actor. State machine with 7 states: `IDLE`, `WALK`, `ATTACK_STARTUP`, `ATTACK_ACTIVE`, `ATTACK_RECOVERY`, `HURT`, `DEAD`. Attack is a 3-phase cycle (100ms startup, 100ms active, 150ms recovery) using a `40x36` invisible rectangle hitbox. Facing direction stored as `this.facing` (1 = right, -1 = left). Input: WASD movement, left-click attack, E interact, Tab panel. Player overrides `applyKnockback()` to no-op. Player emits `'playerHpChanged'` with `(hp, maxHp, mp, maxMp)` on HP/MP change.

3. **Stats Engine** (`src/systems/Stats.js`): 6 base attributes (CON/STR/INT/AGI/PER/LCK) compute 14 derived stats. Key formulas: `maxHp = CON*10`, `maxMp = INT*15`, `attack = STR*2`, `moveSpeed = AGI*20 + 40`, `hpRegen = CON*0.5`. Has `bonuses` (base stat adds), `flatBonuses` (derived stat adds), `invalidate()` to clear cache, `getDerived()` to compute.

4. **SkillTreeSystem** (`src/systems/SkillTreeSystem.js`): Stub with 8 placeholder nodes (1 root + 4 tier-1 + 2 tier-2 + 1 tier-3). Has `canUnlock()`, `unlock()`, `getNodeState()`. All node `effects` arrays are empty. Serializable via `toJSON()`/`fromJSON()`.

5. **MainGameScene** (`src/scenes/MainGameScene.js`): Orchestrates all systems. Calls `this.player.update(delta)` and `enemy.update(player, delta)` each frame. Collision: `physics.add.overlap(player.attackHitbox, enemy.sprite, handleAttackHit)`. `handleAttackHit()` checks `attackHitbox.body.enable`, applies damage via `enemy.takeDamage(player.getAttack(), ...)`, then disables hitbox. Events: `'hitStop'`, `'screenShake'`, `'enemyDeath'`, `'enemyAttack'`. Hit-stop pauses physics for N ms.

6. **UIScene** (`src/scenes/UIScene.js`): Top HUD bar (60px). HP bar (green, 148px wide) at y=18. MP bar (blue, 148px wide) at y=35. XP bar at y=48. Listens to `'playerHpChanged'` event for `(hp, maxHp, mp, maxMp)`. `updateMpBar(mp, maxMp)` scales bar width.

7. **Enemy** (`src/entities/Enemy.js`): Extends Actor. States: PATROL, CHASE, ATTACK_STARTUP, ATTACK_ACTIVE, HURT, DEAD. Has `stateTimer`, `attackCooldown`, patrol AI. `takeDamage()` enters HURT state with 600ms stagger. Emits `'enemyAttack'` event with damage.

8. **SaveSystem** (`src/systems/SaveSystem.js`): Serializes `player.stats.toJSON()`, `skillTree.toJSON()`, etc. to localStorage. The plan must integrate new resource fields into save/load.

### Key Constants & Patterns

- Player base stats: `{ con: 10, str: 8, int: 5, agi: 8, per: 5, lck: 3 }`
- Derived from these: `maxHp=100`, `attack=16`, `moveSpeed=200`, `maxMp=75`
- Attack hitbox offset: `22px` from sprite center in facing direction
- I-frames: Player 800ms, Enemy 600ms
- All timings in milliseconds; `delta` from Phaser is in ms
- Camera shake: `this.scene.events.emit('screenShake', intensity, duration)`
- Hit-stop: `this.scene.events.emit('hitStop', durationMs)`
- `PlayerState` enum exported from `Player.js`
- Event bridge pattern: Player emits events on its `this.scene.events`, MainGameScene listens

### File Tree (relevant files)

```
src/
  config/gameConfig.js          -- game constants
  data/
    items.json                  -- item definitions
    warriorSkills.js            -- NEW: skill data definitions
  entities/
    Actor.js                    -- base class (mp -> stamina rename)
    Player.js                   -- state machine, input, attack
    Enemy.js                    -- AI, combat
  systems/
    Stats.js                    -- stat engine
    SkillEngine.js              -- NEW: skill execution engine
    SkillTreeSystem.js           -- stub skill tree
    SaveSystem.js               -- save/load
  scenes/
    MainGameScene.js            -- game loop, collisions
    UIScene.js                  -- HUD bars
    PanelScene.js               -- character panel
```

---

## Task 1: Dual Resource System (Stamina + Rage)

**Files:**
- Modify: `src/entities/Actor.js`
- Modify: `src/entities/Player.js`
- Modify: `src/scenes/UIScene.js`
- Modify: `src/scenes/MainGameScene.js`
- Modify: `src/systems/SaveSystem.js`
- Modify: `src/scenes/PanelScene.js`

**Goal:** Replace the unused MP system with Stamina (replaces MP, yellow bar) and add a Rage meter (new, red bar). Wire up resource regeneration, combat-driven Rage generation, and HUD display.

### Step 1.1: Rename mp/maxMp to stamina/maxStamina in Actor

In `src/entities/Actor.js`:

1. Replace the MP initialization block (lines 21-22) with Stamina + Rage:

```js
// Replace these lines:
this.mp = derived.maxMp;
this.maxMp = derived.maxMp;

// With:
// Stamina (replaces MP) — based on CON
this.stamina = this.getMaxStamina();
this.maxStamina = this.getMaxStamina();

// Rage — combat resource, 0-100
this.rage = 0;
this.maxRage = 100;
this.rageCombatTimer = 0;   // time since last combat action (for decay)
this.staminaIdleTimer = 0;  // time since last stamina use (for regen delay)
```

2. Add resource calculation methods after `getMoveSpeed()`:

```js
/** Max stamina based on CON */
getMaxStamina() {
  const con = this.stats.getEffective('con');
  return con * 8 + 60;
}

/** Stamina regen rate per second based on CON */
getStaminaRegenRate() {
  const con = this.stats.getEffective('con');
  return con * 0.8;
}

/** Use stamina. Returns true if enough, false otherwise. */
useStamina(amount) {
  if (this.stamina < amount) return false;
  this.stamina -= amount;
  this.staminaIdleTimer = 0; // reset regen delay
  this.onResourceChanged();
  return true;
}

/** Add rage (clamped to 0-100) */
addRage(amount) {
  this.rage = Math.min(this.maxRage, this.rage + amount);
  this.rageCombatTimer = 0; // reset decay timer
  this.onResourceChanged();
}

/** Use rage. Returns true if enough, false otherwise. */
useRage(amount) {
  if (this.rage < amount) return false;
  this.rage -= amount;
  this.rageCombatTimer = 0;
  this.onResourceChanged();
  return true;
}

/** Subclass override for resource change notification */
onResourceChanged() {}
```

3. Update `refreshStats()` to use stamina:

```js
refreshStats() {
  const derived = this.stats.getDerived();
  this.maxHp = derived.maxHp;
  this.maxStamina = this.getMaxStamina();
  if (this.hp > this.maxHp) this.hp = this.maxHp;
  if (this.stamina > this.maxStamina) this.stamina = this.maxStamina;
}
```

4. Replace `useMp()` method entirely -- delete it. The `useStamina()` method above replaces it.

5. Update `updateRegen(delta)` to handle stamina regen + rage decay:

```js
updateRegen(delta) {
  if (this.hp <= 0) return;

  // HP regen (unchanged)
  const hpRegen = this.stats.getDerived().hpRegen;
  if (hpRegen > 0) {
    this.regenTimer += delta;
    if (this.regenTimer >= 1000) {
      this.regenTimer -= 1000;
      if (this.hp < this.maxHp) {
        this.hp = Math.min(this.maxHp, this.hp + hpRegen);
        this.onHpChanged();
      }
    }
  }

  // Stamina regen (after 1s idle)
  this.staminaIdleTimer += delta;
  if (this.staminaIdleTimer >= 1000 && this.stamina < this.maxStamina) {
    const regenPerFrame = this.getStaminaRegenRate() * (delta / 1000);
    this.stamina = Math.min(this.maxStamina, this.stamina + regenPerFrame);
    this.onResourceChanged();
  }

  // Rage decay (5/sec after 3s of no combat)
  this.rageCombatTimer += delta;
  if (this.rageCombatTimer >= 3000 && this.rage > 0) {
    const decayPerFrame = 5 * (delta / 1000);
    this.rage = Math.max(0, this.rage - decayPerFrame);
    this.onResourceChanged();
  }
}
```

### Step 1.2: Update Player to use Stamina/Rage and emit events

In `src/entities/Player.js`:

1. Update `onHpChanged()` to emit stamina instead of mp:

```js
onHpChanged() {
  this.scene.events.emit('playerHpChanged', this.hp, this.maxHp);
  this.scene.events.emit('playerResourceChanged', this.stamina, this.maxStamina, this.rage, this.maxRage);
}
```

2. Add `onResourceChanged()` override:

```js
onResourceChanged() {
  this.scene.events.emit('playerResourceChanged', this.stamina, this.maxStamina, this.rage, this.maxRage);
}
```

3. In `takeDamage()`, add Rage generation after `super.takeDamage()`:

```js
takeDamage(damage, attackerX, attackerY) {
  if (this.isInvulnerable || this.state === PlayerState.DEAD || this.state === PlayerState.HURT) return;

  this.attackHitbox.body.enable = false;
  this.scene.events.emit('screenShake', 3, 80);
  this.setState(PlayerState.HURT);
  this.playAnim('hurt', false);

  super.takeDamage(damage, attackerX, attackerY);

  // Rage gain on taking damage
  this.addRage(12);

  this.scene.time.delayedCall(200, () => {
    if (this.state === PlayerState.HURT && this.hp > 0) {
      this.setState(PlayerState.IDLE);
    }
  });
}
```

4. In `onAttackHit()`, add Rage generation:

```js
onAttackHit() {
  if (this.attackHitRegistered) return;
  this.attackHitRegistered = true;

  // Rage gain on dealing damage
  this.addRage(8);
}
```

### Step 1.3: Update UIScene -- replace MP bar with Stamina, add Rage bar

In `src/scenes/UIScene.js`:

1. In `createHealthBar()`, replace the MP bar section (lines 60-68) with Stamina bar (yellow) and Rage bar (red):

```js
// Stamina bar (replaces MP bar) - yellow
this.staminaBarBg = this.add.rectangle(50, 35, 150, 10, 0x333333).setOrigin(0, 0.5).setDepth(2);
this.staminaBarBg.setStrokeStyle(1, 0x444433);
this.staminaBar = this.add.rectangle(51, 35, 148, 8, 0xddcc00).setOrigin(0, 0.5).setDepth(3);
this.staminaText = this.add.text(210, 35, '140/140', {
  fontSize: '11px',
  fill: '#ddcc44',
  fontFamily: 'Courier New'
}).setOrigin(0, 0.5).setDepth(3);

// Rage bar - red, below stamina
this.rageBarBg = this.add.rectangle(50, 48, 150, 8, 0x333333).setOrigin(0, 0.5).setDepth(2);
this.rageBarBg.setStrokeStyle(1, 0x443333);
this.rageBar = this.add.rectangle(51, 48, 0, 6, 0xff3333).setOrigin(0, 0.5).setDepth(3);
this.rageText = this.add.text(210, 48, '0/100', {
  fontSize: '9px',
  fill: '#ff6644',
  fontFamily: 'Courier New'
}).setOrigin(0, 0.5).setDepth(3);
```

2. Move the XP bar down to accommodate Rage bar (change y from 48 to 58):

```js
// XP bar (moved down)
this.xpBarBg = this.add.rectangle(50, 58, 150, 6, 0x222233).setOrigin(0, 0.5).setDepth(2);
this.xpBarBg.setStrokeStyle(1, 0x333344);
this.xpBar = this.add.rectangle(51, 58, 0, 4, 0x9966ff).setOrigin(0, 0.5).setDepth(3);
this.xpText = this.add.text(210, 58, 'XP: 0/40', {
  fontSize: '9px', fill: '#9988cc', fontFamily: 'Courier New'
}).setOrigin(0, 0.5).setDepth(3);
```

3. Increase top HUD height from 60 to 70 to fit the extra bar:

```js
this.hudBg = this.add.rectangle(0, 0, width, 70, 0x000000, 0.7).setOrigin(0, 0);
```

Also update `onResize()`:

```js
this.hudBg.setSize(width, 70);
```

4. Replace `updateMpBar()` with `updateStaminaBar()` and add `updateRageBar()`:

```js
updateStaminaBar(stamina, maxStamina) {
  if (!maxStamina || maxStamina <= 0) return;
  const percentage = stamina / maxStamina;
  this.staminaBar.width = Math.max(0, 148 * percentage);
  this.staminaText.setText(`${Math.floor(stamina)}/${maxStamina}`);
}

updateRageBar(rage, maxRage) {
  const percentage = rage / maxRage;
  this.rageBar.width = Math.max(0, 148 * percentage);
  this.rageText.setText(`${Math.floor(rage)}/${maxRage}`);

  // Rage bar pulses when full
  if (rage >= maxRage && !this._ragePulsing) {
    this._ragePulsing = true;
    this._ragePulseTween = this.tweens.add({
      targets: this.rageBar, alpha: 0.6,
      duration: 400, yoyo: true, repeat: -1
    });
  } else if (rage < maxRage && this._ragePulsing) {
    this._ragePulsing = false;
    if (this._ragePulseTween) this._ragePulseTween.stop();
    this.rageBar.setAlpha(1);
  }
}
```

5. In `setupEvents()`, replace the `'playerHpChanged'` listener to decouple HP from resources. Add a new `'playerResourceChanged'` listener:

```js
this.gameScene.events.on('playerHpChanged', (hp, maxHp) => {
  this.updateHealthBar(hp, maxHp);
});

this.gameScene.events.on('playerResourceChanged', (stamina, maxStamina, rage, maxRage) => {
  this.updateStaminaBar(stamina, maxStamina);
  this.updateRageBar(rage, maxRage);
});
```

### Step 1.4: Update MainGameScene for Rage-on-hit

In `src/scenes/MainGameScene.js`, inside `handleAttackHit()` (around line 1051):

The `player.onAttackHit()` call already handles Rage gain (via the updated method in Step 1.2). No additional changes needed here.

### Step 1.5: Update SaveSystem for Stamina/Rage

In `src/systems/SaveSystem.js`:

1. In `save()`, update the player block to include stamina and rage:

```js
player: {
  position: playerPosition,
  hp: scene.player ? scene.player.hp : 100,
  maxHp: scene.player ? scene.player.maxHp : 100,
  stamina: scene.player ? scene.player.stamina : 140,
  rage: scene.player ? scene.player.rage : 0,
  stats: scene.player ? scene.player.stats.toJSON() : null
},
```

2. In `load()`, restore stamina and rage when applying saved player data (after restoring HP):

```js
if (scene.player && saveData.player.stamina !== undefined) {
  scene.player.stamina = saveData.player.stamina;
}
// Rage is not restored -- it resets to 0 on load (design choice: rage is session-only)
```

### Step 1.6: Update PanelScene character tab

In `src/scenes/PanelScene.js`, find where MP is displayed in the character tab stats and replace "MP" with "Stamina". Search for any reference to `mp` or `maxMp` and replace with `stamina`/`maxStamina`.

### Verification

After implementing this task:
- Start the game. The HUD should show:
  - HP bar (green) at top
  - Stamina bar (yellow) below HP
  - Rage bar (red, empty) below Stamina
  - XP bar (purple) below Rage
- Hit an enemy with left-click: Rage bar should increase by 8
- Get hit by an enemy: Rage bar should increase by 12
- Wait 3 seconds with no combat: Rage should decay at 5/sec
- Use stamina (will be testable after Task 2): After spending stamina, wait 1s, then it regens at `CON*0.8/sec`
- Save and reload: Stamina should persist, Rage should reset to 0

**Commit:** `feat: replace MP with Stamina/Rage dual resource system`

---

## Task 2: Skill Data & Engine

**Files:**
- Create: `src/data/warriorSkills.js`
- Create: `src/systems/SkillEngine.js`
- Modify: `src/entities/Player.js`
- Modify: `src/scenes/MainGameScene.js`

**Goal:** Build the data-driven skill infrastructure. Define skill data format, implement the SkillEngine that manages cooldowns/phases/resources, add `SKILL_CASTING` state to the Player, and bind number keys 1-4 to skill slots.

### Step 2.1: Create Skill Data File

Create `src/data/warriorSkills.js`:

```js
/**
 * Warrior skill definitions.
 *
 * Each skill has:
 *   id          - unique identifier
 *   name        - display name (Chinese)
 *   description - tooltip text
 *   icon        - texture key (placeholder for now)
 *   resource    - "stamina" | "rage" | "none"
 *   cost        - resource cost
 *   cooldown    - cooldown in ms
 *   phases      - { startup, active, recovery } in ms
 *   effect      - skill-specific behavior data
 *   unlockNode  - SkillTree node ID required (null = always available)
 */

export const WARRIOR_SKILLS = {
  charge: {
    id: 'charge',
    name: '野蛮冲锋',
    description: '向前方冲锋，命中第一个敌人造成120%攻击力伤害并击晕1秒',
    icon: null,
    resource: 'stamina',
    cost: 25,
    cooldown: 5000,
    phases: { startup: 100, active: 300, recovery: 200 },
    effect: {
      type: 'dash',
      distance: 120,
      speed: 400,
      hitbox: { w: 36, h: 36 },
      damageMultiplier: 1.2,
      stun: 1000,
      knockback: 50,
      cameraShake: { intensity: 5, duration: 100 }
    }
  },

  whirlwind: {
    id: 'whirlwind',
    name: '旋风斩',
    description: '原地旋转攻击1.2秒，对周围敌人每0.2秒造成60%攻击力伤害',
    icon: null,
    resource: 'stamina',
    cost: 35,
    cooldown: 8000,
    phases: { startup: 100, active: 1200, recovery: 300 },
    effect: {
      type: 'spin',
      radius: 50,
      tickInterval: 200,
      damageMultiplier: 0.6,
      moveSpeedMod: -0.3,
      superArmor: true
    }
  }
};

/** Ordered skill slot assignments (keys 1-4) */
export const SKILL_SLOTS = [
  'charge',     // key 1
  'whirlwind',  // key 2
  null,         // key 3 (Phase 2: heavy_slam)
  null          // key 4 (Phase 2: parry or Phase 3)
];
```

### Step 2.2: Create SkillEngine

Create `src/systems/SkillEngine.js`:

```js
import { WARRIOR_SKILLS, SKILL_SLOTS } from '../data/warriorSkills.js';

/**
 * SkillEngine — manages skill cooldowns, resource checks, and phase execution.
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

    // Initialize cooldowns to 0
    Object.keys(WARRIOR_SKILLS).forEach(id => {
      this.cooldowns[id] = 0;
    });
  }

  /**
   * Check if a skill can be used right now.
   * @param {string} skillId
   * @returns {{ canUse: boolean, reason: string }}
   */
  canUse(skillId) {
    const skill = WARRIOR_SKILLS[skillId];
    if (!skill) return { canUse: false, reason: 'unknown_skill' };

    // Already casting a skill
    if (this.activeSkillId !== null) return { canUse: false, reason: 'already_casting' };

    // On cooldown
    if (this.cooldowns[skillId] > 0) return { canUse: false, reason: 'on_cooldown' };

    // Resource check
    if (skill.resource === 'stamina' && this.actor.stamina < skill.cost) {
      return { canUse: false, reason: 'no_stamina' };
    }
    if (skill.resource === 'rage' && this.actor.rage < skill.cost) {
      return { canUse: false, reason: 'no_rage' };
    }

    // Player must not be dead or hurt
    // (Player checks state before calling execute, but double-check here)

    return { canUse: true, reason: 'ok' };
  }

  /**
   * Execute a skill: deduct resource, start cooldown, begin startup phase.
   * @param {string} skillId
   * @returns {object|null} The skill data object, or null if cannot use
   */
  execute(skillId) {
    const check = this.canUse(skillId);
    if (!check.canUse) return null;

    const skill = WARRIOR_SKILLS[skillId];

    // Deduct resource
    if (skill.resource === 'stamina') {
      this.actor.useStamina(skill.cost);
    } else if (skill.resource === 'rage') {
      this.actor.useRage(skill.cost);
    }

    // Apply CDR (cooldown reduction) from stats
    const cdr = this.actor.stats.getDerived().cdr || 0;
    const effectiveCooldown = skill.cooldown * (1 - cdr / 100);

    // Start cooldown
    this.cooldowns[skillId] = effectiveCooldown;

    // Enter startup phase
    this.activeSkillId = skillId;
    this.activePhase = 'startup';
    this.phaseTimer = 0;
    this.tickTimer = 0;
    this.hitTargets.clear();

    return skill;
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

    const skill = WARRIOR_SKILLS[this.activeSkillId];
    if (!skill) return null;

    this.phaseTimer += delta;

    const phaseDuration = skill.phases[this.activePhase];

    if (this.phaseTimer >= phaseDuration) {
      // Transition to next phase
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

  /**
   * Check if an enemy has already been hit by the current skill activation.
   * Used for single-hit skills like Charge.
   */
  hasHitTarget(enemy) {
    return this.hitTargets.has(enemy);
  }

  /** Mark an enemy as hit by current skill activation. */
  markTargetHit(enemy) {
    this.hitTargets.add(enemy);
  }

  /**
   * Force-cancel the active skill (e.g., on death or stun).
   */
  cancelActiveSkill() {
    this.activeSkillId = null;
    this.activePhase = null;
    this.phaseTimer = 0;
    this.tickTimer = 0;
    this.hitTargets.clear();
  }

  /**
   * Get cooldown remaining for a skill (for UI).
   * @returns {{ remaining: number, total: number, fraction: number }}
   */
  getCooldownInfo(skillId) {
    const skill = WARRIOR_SKILLS[skillId];
    if (!skill) return { remaining: 0, total: 0, fraction: 0 };
    const remaining = this.cooldowns[skillId] || 0;
    const cdr = this.actor.stats.getDerived().cdr || 0;
    const total = skill.cooldown * (1 - cdr / 100);
    return { remaining, total, fraction: total > 0 ? remaining / total : 0 };
  }

  /** Get the currently active skill data, or null */
  getActiveSkill() {
    if (!this.activeSkillId) return null;
    return WARRIOR_SKILLS[this.activeSkillId];
  }

  /** Serialization */
  toJSON() {
    return {
      cooldowns: { ...this.cooldowns }
    };
  }

  fromJSON(data) {
    if (data && data.cooldowns) {
      Object.assign(this.cooldowns, data.cooldowns);
    }
  }
}
```

### Step 2.3: Add SKILL_CASTING state and input bindings to Player

In `src/entities/Player.js`:

1. Add new states to `PlayerState`:

```js
export const PlayerState = {
  IDLE: 'IDLE',
  WALK: 'WALK',
  ATTACK_STARTUP: 'ATTACK_STARTUP',
  ATTACK_ACTIVE: 'ATTACK_ACTIVE',
  ATTACK_RECOVERY: 'ATTACK_RECOVERY',
  SKILL_CASTING: 'SKILL_CASTING',
  DODGE: 'DODGE',
  HURT: 'HURT',
  DEAD: 'DEAD'
};
```

2. Import SkillEngine and SKILL_SLOTS at the top of Player.js:

```js
import { SkillEngine } from '../systems/SkillEngine.js';
import { SKILL_SLOTS } from '../data/warriorSkills.js';
```

3. In the Player constructor, after the input setup, create the SkillEngine and bind number keys:

```js
// Skill system
this.skillEngine = new SkillEngine(scene, this);

// Skill hitbox (reusable, separate from attackHitbox)
this.skillHitbox = scene.add.rectangle(0, 0, 10, 10, 0xff0000, 0);
scene.physics.add.existing(this.skillHitbox, false);
this.skillHitbox.body.enable = false;

// Bind number keys 1-4 to skill slots
this.skillKeys = [
  scene.input.keyboard.addKey(Phaser.Input.Keyboard.KeyCodes.ONE),
  scene.input.keyboard.addKey(Phaser.Input.Keyboard.KeyCodes.TWO),
  scene.input.keyboard.addKey(Phaser.Input.Keyboard.KeyCodes.THREE),
  scene.input.keyboard.addKey(Phaser.Input.Keyboard.KeyCodes.FOUR)
];

this._onSkillKeyDown = [];
this.skillKeys.forEach((key, index) => {
  const handler = () => this.trySkill(index);
  this._onSkillKeyDown.push(handler);
  key.on('down', handler);
});

// Charge skill dash state
this._chargeDashVelocity = null;
this._chargeHitRegistered = false;

// Whirlwind skill state
this._whirlwindSuperArmor = false;
```

4. Add skill activation and state handling methods:

```js
/** Try to activate a skill by slot index (0-3). */
trySkill(slotIndex) {
  if (this.state === PlayerState.DEAD || this.state === PlayerState.HURT) return;
  if (this.state === PlayerState.SKILL_CASTING) return;
  if (this.scene.gamePaused) return;

  const skillId = SKILL_SLOTS[slotIndex];
  if (!skillId) return;

  const skill = this.skillEngine.execute(skillId);
  if (!skill) return;

  // Stop movement, enter casting state
  this.sprite.setVelocity(0, 0);
  this.attackHitbox.body.enable = false;
  this.setState(PlayerState.SKILL_CASTING);
  this.playAnim('attack', false); // reuse attack anim for now
}

/** Handle SKILL_CASTING state each frame. */
handleSkillCasting(delta) {
  const result = this.skillEngine.update(delta);
  if (!result) return;

  const skill = result.skill;

  switch (result.event) {
    case 'phase_active':
      this.onSkillActive(skill);
      break;

    case 'skill_tick':
      this.onSkillTick(skill);
      break;

    case 'phase_recovery':
      this.onSkillRecovery(skill);
      break;

    case 'skill_complete':
      this.onSkillComplete(skill);
      break;
  }
}

/** Called when skill enters active phase. */
onSkillActive(skill) {
  if (skill.effect.type === 'dash') {
    this.startChargeDash(skill);
  } else if (skill.effect.type === 'spin') {
    this.startWhirlwind(skill);
  }
}

/** Called on each tick of a multi-hit skill. */
onSkillTick(skill) {
  if (skill.effect.type === 'spin') {
    this.whirlwindTick(skill);
  }
}

/** Called when skill enters recovery phase. */
onSkillRecovery(skill) {
  this.skillHitbox.body.enable = false;
  this._whirlwindSuperArmor = false;
}

/** Called when skill fully completes. */
onSkillComplete(skill) {
  this.skillHitbox.body.enable = false;
  this._whirlwindSuperArmor = false;
  this._chargeDashVelocity = null;
  this.setState(PlayerState.IDLE);
}
```

5. Update the `update(delta)` method's switch to include SKILL_CASTING:

```js
case PlayerState.SKILL_CASTING:
  this.handleSkillCasting(delta);
  break;
```

Also make sure SkillEngine cooldowns tick even when NOT casting (add after the switch):

```js
// Tick skill cooldowns even when not casting
if (this.state !== PlayerState.SKILL_CASTING) {
  this.skillEngine.update(delta);
}
```

6. Update `takeDamage()` to check for super armor:

```js
takeDamage(damage, attackerX, attackerY) {
  // Super armor: take damage but don't stagger
  if (this._whirlwindSuperArmor) {
    const defense = this.stats.getDerived().defense;
    const finalDamage = Math.max(1, damage - defense);
    this.hp = Math.max(0, this.hp - finalDamage);
    this.isInvulnerable = true;
    this.iFramesTimer = this.iFramesDuration;
    this.flashDamage();
    this.onHpChanged();
    this.addRage(12);
    if (this.hp <= 0) {
      this.skillEngine.cancelActiveSkill();
      this._whirlwindSuperArmor = false;
      this.scene.time.delayedCall(300, () => this.die());
    }
    return;
  }

  if (this.isInvulnerable || this.state === PlayerState.DEAD || this.state === PlayerState.HURT) return;

  // Cancel any active skill on hit
  if (this.state === PlayerState.SKILL_CASTING) {
    this.skillEngine.cancelActiveSkill();
    this.skillHitbox.body.enable = false;
    this._chargeDashVelocity = null;
  }

  this.attackHitbox.body.enable = false;
  this.scene.events.emit('screenShake', 3, 80);
  this.setState(PlayerState.HURT);
  this.playAnim('hurt', false);

  super.takeDamage(damage, attackerX, attackerY);
  this.addRage(12);

  this.scene.time.delayedCall(200, () => {
    if (this.state === PlayerState.HURT && this.hp > 0) {
      this.setState(PlayerState.IDLE);
    }
  });
}
```

7. Update `isAttacking()` to include skill casting:

```js
isAttacking() {
  return this.state === PlayerState.ATTACK_STARTUP ||
         this.state === PlayerState.ATTACK_ACTIVE ||
         this.state === PlayerState.ATTACK_RECOVERY ||
         this.state === PlayerState.SKILL_CASTING;
}
```

8. Update `destroy()` to clean up skill keys and skill hitbox:

```js
destroy() {
  if (this._onPointerDown) this.scene.input.off('pointerdown', this._onPointerDown);
  if (this._onEKeyDown && this.eKey) this.eKey.off('down', this._onEKeyDown);
  if (this.attackHitbox) this.attackHitbox.destroy();
  if (this.skillHitbox) this.skillHitbox.destroy();
  if (this.interactText) this.interactText.destroy();

  // Clean up skill key listeners
  if (this.skillKeys && this._onSkillKeyDown) {
    this.skillKeys.forEach((key, i) => {
      if (this._onSkillKeyDown[i]) key.off('down', this._onSkillKeyDown[i]);
    });
  }

  this.destroyActor();
}
```

### Step 2.4: Wire SkillEngine into MainGameScene

In `src/scenes/MainGameScene.js`:

1. In `setupCollisions()`, after the existing enemy overlap setup, add skill hitbox overlaps:

```js
// Skill hitbox overlaps (for both charge and whirlwind)
this.enemies.forEach(enemy => {
  this.physics.add.overlap(this.player.skillHitbox, enemy.sprite, () => {
    this.handleSkillHit(enemy);
  }, null, this);
});
```

2. Add the `handleSkillHit()` method:

```js
handleSkillHit(enemy) {
  if (!this.player.skillHitbox.body.enable) return;
  if (enemy.isInvulnerable || enemy.state === EnemyState.DEAD) return;

  const skillEngine = this.player.skillEngine;
  const skill = skillEngine.getActiveSkill();
  if (!skill) return;

  if (skill.effect.type === 'dash') {
    // Charge: single-hit per enemy
    if (skillEngine.hasHitTarget(enemy)) return;
    skillEngine.markTargetHit(enemy);

    const damage = Math.floor(this.player.getAttack() * skill.effect.damageMultiplier);
    enemy.takeDamage(damage, this.player.sprite.x, this.player.sprite.y);

    // Stun: enemy stays in HURT for stun duration
    if (skill.effect.stun) {
      enemy.setState(EnemyState.HURT);
      enemy.sprite.setVelocity(0, 0);
      enemy.attackCooldown = skill.effect.stun;
      this.scene?.time?.delayedCall?.(skill.effect.stun, () => {
        if (enemy.hp > 0 && enemy.state === EnemyState.HURT) {
          enemy.setState(EnemyState.CHASE);
        }
      });
      // Use scene from this context since we're in MainGameScene
      this.time.delayedCall(skill.effect.stun, () => {
        if (enemy.hp > 0 && enemy.state === EnemyState.HURT) {
          enemy.setState(EnemyState.CHASE);
        }
      });
    }

    // Extra knockback
    if (skill.effect.knockback) {
      enemy.applyKnockback(this.player.sprite.x, this.player.sprite.y, skill.effect.knockback);
    }

    // Camera shake on hit
    if (skill.effect.cameraShake) {
      this.events.emit('screenShake', skill.effect.cameraShake.intensity, skill.effect.cameraShake.duration);
    }

    // Hit-stop
    this.events.emit('hitStop', 50);

    // Rage gain
    this.player.addRage(8);

  } else if (skill.effect.type === 'spin') {
    // Whirlwind: multi-hit, enemy i-frames prevent double-hits per tick
    // (enemy.isInvulnerable check at top handles this)
    const damage = Math.floor(this.player.getAttack() * skill.effect.damageMultiplier);
    enemy.takeDamage(damage, this.player.sprite.x, this.player.sprite.y);

    // Camera shake on each hit (lighter)
    this.events.emit('screenShake', 2, 50);

    // Rage gain per hit
    this.player.addRage(4);
  }
}
```

**Important:** In the `handleSkillHit` method above, fix the stun implementation. Remove the duplicate `delayedCall`. Replace the block with:

```js
if (skill.effect.stun) {
  enemy.setState(EnemyState.HURT);
  enemy.sprite.setVelocity(0, 0);
  enemy.attackCooldown = skill.effect.stun;
  this.time.delayedCall(skill.effect.stun, () => {
    if (enemy.hp > 0 && enemy.state === EnemyState.HURT) {
      enemy.setState(EnemyState.CHASE);
    }
  });
}
```

3. When new enemies spawn at runtime (e.g., on level change), the skill hitbox overlaps must also be set up. Find the section in `setupCollisions()` or the dynamic enemy spawning code and ensure the overlap is registered.

4. Update the controls hint in UIScene to mention skill keys:

In `src/scenes/UIScene.js`, update `createControlsHint()`:

```js
this.controlsText = this.add.text(width / 2, height - 15,
  'WASD:移动 | 左键:攻击 | 1-4:技能 | E:交互 | TAB:面板', {
  fontSize: '12px',
  fill: '#888888',
  fontFamily: 'Courier New'
}).setOrigin(0.5).setDepth(2);
```

### Verification

After implementing this task:
- Press 1 with enough stamina (>=25): Player should enter SKILL_CASTING state, stamina decreases by 25, and after 600ms total (100+300+200) return to IDLE
- Press 2 with enough stamina (>=35): Player should enter SKILL_CASTING state, stamina decreases by 35, 1600ms total duration
- Press 1 while on cooldown: Nothing happens
- Press 1 while already casting: Nothing happens
- Press 1 while dead or hurt: Nothing happens
- Skill cooldowns should tick down even when not casting
- Number keys 1-4 should be registered, 3-4 do nothing (null slots)

**Commit:** `feat: add SkillEngine with data-driven skill definitions and SKILL_CASTING state`

---

## Task 3: Charge Skill (Wild Charge)

**Files:**
- Modify: `src/entities/Player.js`

**Goal:** Implement the Charge (野蛮冲锋) skill behavior -- a forward dash that hits the first enemy for 120% ATK damage with stun and knockback.

### Step 3.1: Implement the Charge dash movement

Add these methods to the Player class:

```js
/**
 * Begin the Charge dash: set velocity in facing direction.
 * Called when charge enters active phase.
 */
startChargeDash(skill) {
  const effect = skill.effect;

  // Activate skill hitbox in front of player
  const hx = this.sprite.x + this.facing * 22;
  const hy = this.sprite.y;
  this.skillHitbox.setSize(effect.hitbox.w, effect.hitbox.h);
  this.skillHitbox.setPosition(hx, hy);
  this.skillHitbox.body.enable = true;

  // Set dash velocity
  this._chargeDashVelocity = {
    vx: this.facing * effect.speed,
    vy: 0
  };
  this._chargeHitRegistered = false;

  this.sprite.setVelocity(this._chargeDashVelocity.vx, this._chargeDashVelocity.vy);
}
```

### Step 3.2: Update the skill hitbox position during dash

In `handleSkillCasting(delta)`, before the SkillEngine update, add hitbox tracking logic:

```js
handleSkillCasting(delta) {
  // Update active skill hitbox position
  const activeSkill = this.skillEngine.getActiveSkill();
  if (activeSkill && this.skillEngine.activePhase === 'active') {
    if (activeSkill.effect.type === 'dash') {
      // Keep charge hitbox in front of player during dash
      this.skillHitbox.setPosition(
        this.sprite.x + this.facing * 22,
        this.sprite.y
      );
      // Maintain dash velocity (physics drag may slow it)
      if (this._chargeDashVelocity) {
        this.sprite.setVelocity(this._chargeDashVelocity.vx, this._chargeDashVelocity.vy);
      }
    } else if (activeSkill.effect.type === 'spin') {
      // Keep spin hitbox centered on player
      this.skillHitbox.setPosition(this.sprite.x, this.sprite.y);
    }
  }

  // Tick the skill engine
  const result = this.skillEngine.update(delta);
  if (!result) return;

  // ... rest of method unchanged
}
```

### Step 3.3: Stop movement on recovery/complete

The `onSkillRecovery()` and `onSkillComplete()` methods already disable the hitbox. Add velocity stop in `onSkillRecovery`:

```js
onSkillRecovery(skill) {
  this.skillHitbox.body.enable = false;
  this._whirlwindSuperArmor = false;
  this._chargeDashVelocity = null;
  this.sprite.setVelocity(0, 0); // Stop dash movement
}
```

### Step 3.4: Add charge hit visual feedback

In `MainGameScene.handleSkillHit()`, the charge hit section already handles camera shake and hit-stop. Add a visual feedback for the player -- a brief flash:

In the `'dash'` branch of `handleSkillHit()`, after the camera shake, add:

```js
// Flash the player sprite white on successful charge hit
this.player.sprite.setTint(0xffffff);
this.time.delayedCall(100, () => {
  if (this.player.sprite) this.player.sprite.clearTint();
});
```

### Verification

After implementing this task:
- Press 1 facing right: Player dashes right ~120px over 300ms
- If an enemy is in the dash path: Enemy takes ~120% ATK damage, gets stunned for 1s, knocked back
- Camera shakes on hit, brief hit-stop
- Player stops moving during recovery phase (200ms)
- Hitbox is disabled after active phase
- Dash velocity is maintained throughout the active phase regardless of drag
- After hitting one enemy, subsequent enemies in the path are NOT hit (single-target)

**Commit:** `feat: implement Charge (野蛮冲锋) dash skill with stun and knockback`

---

## Task 4: Whirlwind Skill (Whirlwind Slash)

**Files:**
- Modify: `src/entities/Player.js`
- Modify: `src/scenes/MainGameScene.js`

**Goal:** Implement the Whirlwind (旋风斩) skill -- a 360-degree AOE spin that hits all nearby enemies every 200ms for 1.2 seconds. Player can move slowly during spin and has super armor.

### Step 4.1: Implement the Whirlwind start

Add to Player class:

```js
/**
 * Begin Whirlwind: create circular hitbox, enable super armor.
 * Called when whirlwind enters active phase.
 */
startWhirlwind(skill) {
  const effect = skill.effect;

  // Circular hitbox centered on player (using a square approximation)
  const size = effect.radius * 2;
  this.skillHitbox.setSize(size, size);
  this.skillHitbox.setPosition(this.sprite.x, this.sprite.y);
  this.skillHitbox.body.enable = true;

  // Enable super armor
  this._whirlwindSuperArmor = true;

  // Store the move speed modifier
  this._whirlwindMoveSpeedMod = effect.moveSpeedMod;
}
```

### Step 4.2: Implement the Whirlwind tick

Add to Player class:

```js
/**
 * Process a whirlwind damage tick.
 * The actual damage is handled by MainGameScene.handleSkillHit(),
 * which is triggered by the physics overlap. We just need to
 * re-enable the hitbox each tick so enemies that regained their
 * i-frames can be hit again.
 */
whirlwindTick(skill) {
  // The hitbox stays active throughout; enemy i-frames handle multi-hit gating
  // Re-center hitbox on player
  this.skillHitbox.setPosition(this.sprite.x, this.sprite.y);
}
```

### Step 4.3: Allow slow movement during Whirlwind

In `handleSkillCasting(delta)`, before the skill engine tick, allow movement input during spin:

Update the `handleSkillCasting` method to add movement during whirlwind:

```js
handleSkillCasting(delta) {
  const activeSkill = this.skillEngine.getActiveSkill();

  // Allow movement during whirlwind active phase
  if (activeSkill && this.skillEngine.activePhase === 'active' && activeSkill.effect.type === 'spin') {
    const input = this.getInputDirection();
    if (input.x !== 0 || input.y !== 0) {
      this.updateFacing(input);
      const baseSpeed = this.getMoveSpeed();
      const modifiedSpeed = baseSpeed * (1 + this._whirlwindMoveSpeedMod);
      const len = Math.sqrt(input.x * input.x + input.y * input.y) || 1;
      this.sprite.setVelocity(
        (input.x / len) * modifiedSpeed,
        (input.y / len) * modifiedSpeed
      );
    } else {
      this.sprite.setVelocity(0, 0);
    }
  }

  // Update active skill hitbox position
  if (activeSkill && this.skillEngine.activePhase === 'active') {
    if (activeSkill.effect.type === 'dash') {
      this.skillHitbox.setPosition(
        this.sprite.x + this.facing * 22,
        this.sprite.y
      );
      if (this._chargeDashVelocity) {
        this.sprite.setVelocity(this._chargeDashVelocity.vx, this._chargeDashVelocity.vy);
      }
    } else if (activeSkill.effect.type === 'spin') {
      this.skillHitbox.setPosition(this.sprite.x, this.sprite.y);
    }
  }

  // Tick the skill engine
  const result = this.skillEngine.update(delta);
  if (!result) return;

  const skill = result.skill;

  switch (result.event) {
    case 'phase_active':
      this.onSkillActive(skill);
      break;
    case 'skill_tick':
      this.onSkillTick(skill);
      break;
    case 'phase_recovery':
      this.onSkillRecovery(skill);
      break;
    case 'skill_complete':
      this.onSkillComplete(skill);
      break;
  }
}
```

### Step 4.4: Add whirlwind visual rotation

During the whirlwind active phase, rotate the player sprite to sell the spinning effect. Add a tween when whirlwind starts:

In `startWhirlwind(skill)`, after enabling super armor:

```js
// Visual spin effect -- rotate sprite
const spinDuration = skill.phases.active; // 1200ms
const rotations = 4; // number of full rotations
this._whirlwindTween = this.scene.tweens.add({
  targets: this.sprite,
  angle: 360 * rotations,
  duration: spinDuration,
  ease: 'Linear',
  onComplete: () => {
    this.sprite.setAngle(0);
  }
});
```

In `onSkillRecovery()` and `onSkillComplete()`, ensure the tween is stopped and angle reset:

```js
onSkillRecovery(skill) {
  this.skillHitbox.body.enable = false;
  this._whirlwindSuperArmor = false;
  this._chargeDashVelocity = null;
  this.sprite.setVelocity(0, 0);
  if (this._whirlwindTween) {
    this._whirlwindTween.stop();
    this._whirlwindTween = null;
  }
  this.sprite.setAngle(0);
}

onSkillComplete(skill) {
  this.skillHitbox.body.enable = false;
  this._whirlwindSuperArmor = false;
  this._chargeDashVelocity = null;
  if (this._whirlwindTween) {
    this._whirlwindTween.stop();
    this._whirlwindTween = null;
  }
  this.sprite.setAngle(0);
  this.setState(PlayerState.IDLE);
}
```

### Step 4.5: Whirlwind enemy i-frames interaction

The whirlwind multi-hit system relies on enemy i-frames (600ms) to gate damage. Since the whirlwind ticks every 200ms but enemy i-frames last 600ms, each enemy will be hit approximately every 3 ticks (600ms), which results in roughly 2 hits per enemy over the full 1200ms active phase.

To make this feel better, temporarily reduce enemy i-frames during whirlwind hits. In `MainGameScene.handleSkillHit()`, in the `'spin'` branch:

```js
} else if (skill.effect.type === 'spin') {
  // Whirlwind: multi-hit with reduced enemy i-frames
  const damage = Math.floor(this.player.getAttack() * skill.effect.damageMultiplier);

  // Temporarily reduce enemy i-frames for whirlwind hits so they get hit more often
  const originalIFrames = enemy.iFramesDuration;
  enemy.iFramesDuration = 180; // Slightly less than tickInterval (200ms)
  enemy.takeDamage(damage, this.player.sprite.x, this.player.sprite.y);
  enemy.iFramesDuration = originalIFrames; // Restore after damage applied

  this.events.emit('screenShake', 2, 50);
  this.player.addRage(4);
}
```

### Step 4.6: Ensure super armor works during whirlwind

This is already handled in Step 2.3's `takeDamage()` override. The `_whirlwindSuperArmor` flag prevents stagger (HURT state) while still applying damage, I-frames, and rage gain.

### Verification

After implementing this task:
- Press 2 with >=35 stamina: Player spins in place for 1.2 seconds
- Sprite visually rotates during spin
- Nearby enemies take damage every ~200ms (gated by reduced i-frames)
- Player can move at 70% speed during spin using WASD
- Player takes damage during spin but does NOT stagger (super armor)
- If player dies during spin, the skill is cancelled and death plays normally
- Hitbox is circular (square approximation, 100x100 for radius 50)
- Stamina decreases by 35, cooldown starts at 8 seconds
- Camera shakes lightly on each hit
- After spin ends, player returns to IDLE, sprite angle resets to 0

**Commit:** `feat: implement Whirlwind (旋风斩) AOE spin skill with super armor`

---

## Phase 2 (Future Work): Advanced Combat

These tasks are scoped but not implemented in Phase 1. Implementation follows the same pattern: add skill data to `warriorSkills.js`, handle behavior in Player methods, wire collisions in MainGameScene.

### Task 5: Heavy Slam
- New skill data entry with `type: 'slam'`
- 500ms charge-up (startup), frontal 60x40 hitbox, 200% ATK damage
- Ground crack visual using `scene.add.rectangle()` + fade tween
- Dust particle emitter (`scene.add.particles()`)
- Costs 30 stamina

### Task 6: Parry/Block
- New PlayerState.BLOCK
- Hold E during combat (rebind E when enemies nearby): block stance, reduce damage by 70%
- Perfect Parry window: first 100ms of block press → 0 damage, reflect, 1.5s stun
- Costs 15 stamina/sec to hold block
- Requires reworking E key behavior (context: interact vs. block)

### Task 7: Dodge Roll
- New skill, Spacebar activation
- 200ms roll with full I-frames, directional based on input or facing
- Costs 20 stamina
- Can cancel ATTACK_RECOVERY phase (animation cancel mechanic)
- Uses PlayerState.DODGE

### Task 8: Passive Skills
- Wire SkillTreeSystem node effects to gameplay:
  - Bloodlust: Listen for `'enemyDeath'` event, heal 2% maxHP
  - Armor Mastery: Count equipped heavy armor, apply damage reduction via flatBonuses
  - Weapon Master: Track consecutive hits on same target, stack +5% damage (max 5 stacks)

---

## Phase 3 (Future Work): Polish

### Task 9: Heroic Leap
- Click to target position, player jumps in arc (tween `y` with gravity curve)
- AOE damage on landing, ground slam VFX

### Task 10: Shockwave
- Forward cone knockback wave, expanding hitbox over time
- Knockback scales with Rage consumed

### Task 11: Skill Bar UI
- Bottom HUD row showing 4 skill slots with icons
- Cooldown overlay (radial sweep or dimming)
- Key binding label on each slot
- Highlight when skill is available, gray when on cooldown or insufficient resource

### Task 12: Combat VFX
- Weapon swing trail (use `scene.add.graphics()` with fading arc)
- Impact particles on enemy hit (colored based on damage type)
- Hit-lag refinement (variable duration based on damage dealt)
- Screen flash on critical hits

---

## Architecture Decision Records

### ADR-1: Stamina replaces MP (not coexist)
**Decision:** Rename `mp`/`maxMp` to `stamina`/`maxStamina` rather than adding stamina alongside MP.
**Rationale:** MP is unused in the codebase. Having two unused systems adds confusion. The warrior archetype has no use for MP (INT-based). If a mage class is added later, MP can be re-introduced as a class-specific resource.

### ADR-2: SkillEngine is separate from SkillTreeSystem
**Decision:** Create a new `SkillEngine` for runtime skill execution. Keep `SkillTreeSystem` for unlock/progression.
**Rationale:** Separation of concerns. SkillTreeSystem manages which skills are available (progression). SkillEngine manages when/how skills execute (combat). They interface through skill IDs: SkillTreeSystem unlocks a node, which enables a skill ID in SkillEngine.

### ADR-3: Skill hitbox is separate from attack hitbox
**Decision:** Add a `skillHitbox` rectangle separate from the existing `attackHitbox`.
**Rationale:** Normal attacks and skills can have different hitbox sizes, positions, and lifecycles. The attack hitbox is disabled after one hit per attack; skill hitboxes may persist (whirlwind) or have different single-hit tracking (charge). Keeping them separate avoids complex state management.

### ADR-4: Super armor via flag, not new state
**Decision:** Whirlwind super armor is a boolean flag (`_whirlwindSuperArmor`) checked in `takeDamage()`, not a separate player state.
**Rationale:** The player is already in `SKILL_CASTING` state during whirlwind. Adding another state would complicate the state machine. A flag that modifies damage behavior is simpler and composable (future skills can also set super armor).

### ADR-5: Enemy stun reuses HURT state
**Decision:** Stun from Charge sets enemy to `EnemyState.HURT` with an extended timer, rather than adding a new STUNNED state.
**Rationale:** HURT already prevents the enemy from acting. The stun duration is achieved by using a longer `delayedCall` before transitioning back to CHASE. This avoids modifying the Enemy state machine for Phase 1. Phase 2 may introduce a proper STUNNED state if needed.
