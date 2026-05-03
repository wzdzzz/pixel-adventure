# Phase A：怪物等级缩放系统 — 实施计划

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** 让怪物等级由关卡推荐等级 + Tier 偏移动态计算，属性双层缩放，伤害受等级压制，装备掉落等级绑定怪物。

**Architecture:** 新建 `monsterScaling.js` 集中所有缩放配置。`LevelBuilder.createEnemies()` 计算最终等级后传入 `Enemy` 构造函数。`Enemy` 用缩放后的 stats 初始化。伤害计算在 `InteractionHandler` 和 `MainGameScene` 中加等级压制修正。

**Tech Stack:** Phaser 3 + vanilla JS ES Modules, 无测试框架（手动验证）

---

## Task 1: 新建 monsterScaling.js 配置文件

**Files:**
- Create: `src/data/monsterScaling.js`

**Step 1: 创建配置文件**

```js
// src/data/monsterScaling.js
/**
 * 怪物等级缩放配置
 *
 * 所有成长系数集中于此，便于后期替换为自定义公式。
 * 计算流程：
 *   1. 基础6维 × (1 + baseStatGrowth × (level-1))
 *   2. Stats引擎派生
 *   3. 派生属性 × (1 + derivedGrowth[key] × (level-1))
 *   4. Tier倍率
 */

// ── Tier 定义 ─────────────────────────────────────────────
export const TIER = {
  MINION: 'minion',
  NORMAL: 'normal',
  ELITE:  'elite',
  BOSS:   'boss',
};

// ── Tier 等级偏移范围 [min, max] ──────────────────────────
export const TIER_LEVEL_OFFSET = {
  [TIER.MINION]: [-1, 0],
  [TIER.NORMAL]: [0, 0],
  [TIER.ELITE]:  [1, 2],
  [TIER.BOSS]:   [3, 5],
};

// ── 缩放配置 ──────────────────────────────────────────────
export const SCALING_CONFIG = {
  // 基础层：6维统一成长率（每级）
  baseStatGrowth: 0.06,

  // 派生层：额外独立成长率（每级）
  derivedGrowth: {
    maxHp:   0.06,   // 合计 ~12%/级
    attack:  0.02,   // 合计 ~8%/级
  },

  // Tier 倍率
  tierMultipliers: {
    [TIER.MINION]: { hp: 0.7,  attack: 0.8, xp: 0.5  },
    [TIER.NORMAL]: { hp: 1.0,  attack: 1.0, xp: 1.0  },
    [TIER.ELITE]:  { hp: 2.5,  attack: 1.5, xp: 3.0  },
    [TIER.BOSS]:   { hp: 8.0,  attack: 2.0, xp: 10.0 },
  },
};

// ── 等级压制配置 ──────────────────────────────────────────
export const LEVEL_SUPPRESS = {
  perLevelPct: 0.05,  // 每差1级 ±5%
  maxPct: 0.30,       // 封顶 ±30%
};

// ── 工具函数 ──────────────────────────────────────────────

/**
 * 计算 Tier 等级偏移
 * @param {string} tier - TIER 常量
 * @returns {number} 偏移值
 */
export function rollTierOffset(tier) {
  const range = TIER_LEVEL_OFFSET[tier] || [0, 0];
  if (range[0] === range[1]) return range[0];
  return range[0] + Math.floor(Math.random() * (range[1] - range[0] + 1));
}

/**
 * 缩放基础6维属性
 * @param {object} baseStats - Lv.1 的 {con, str, int, agi, per, lck}
 * @param {number} level - 最终等级
 * @returns {object} 缩放后的6维（取整）
 */
export function scaleBaseStats(baseStats, level) {
  const growth = SCALING_CONFIG.baseStatGrowth;
  const mult = 1 + growth * (level - 1);
  const scaled = {};
  for (const [key, val] of Object.entries(baseStats)) {
    scaled[key] = Math.round(val * mult);
  }
  return scaled;
}

/**
 * 对派生属性施加额外成长 + Tier 倍率
 * @param {object} derived - Stats引擎派生结果 {maxHp, attack, ...}
 * @param {number} level - 最终等级
 * @param {string} tier - TIER 常量
 * @returns {object} 调整后的派生属性（直接修改并返回）
 */
export function applyDerivedScaling(derived, level, tier) {
  const dg = SCALING_CONFIG.derivedGrowth;
  const tm = SCALING_CONFIG.tierMultipliers[tier] || SCALING_CONFIG.tierMultipliers[TIER.NORMAL];

  // 派生层额外成长
  for (const [key, rate] of Object.entries(dg)) {
    if (derived[key] !== undefined && rate > 0) {
      derived[key] = Math.round(derived[key] * (1 + rate * (level - 1)));
    }
  }

  // Tier 倍率
  if (derived.maxHp !== undefined) {
    derived.maxHp = Math.round(derived.maxHp * tm.hp);
  }
  if (derived.attack !== undefined) {
    derived.attack = Math.round(derived.attack * tm.attack);
  }

  return derived;
}

/**
 * 计算等级压制伤害修正
 * @param {number} attackerLevel
 * @param {number} defenderLevel
 * @returns {number} 伤害倍率（0.7 ~ 1.3）
 */
export function getLevelSuppression(attackerLevel, defenderLevel) {
  const diff = attackerLevel - defenderLevel;
  const raw = 1 + diff * LEVEL_SUPPRESS.perLevelPct;
  return Math.max(1 - LEVEL_SUPPRESS.maxPct, Math.min(1 + LEVEL_SUPPRESS.maxPct, raw));
}
```

**Step 2: 验证**

运行 `pnpm dev`，确认无导入错误。

**Step 3: 提交**

```bash
git add src/data/monsterScaling.js
git commit -m "feat(monster-level): 新建 monsterScaling.js 缩放配置"
```

---

## Task 2: enemyConfig.js 添加 tier 字段

**Files:**
- Modify: `src/data/enemyConfig.js:12-55`

**Step 1: 添加 tier 字段**

给每个敌人配置添加 `tier` 字段，并导入 TIER 常量：

在文件顶部添加导入：
```js
import { TIER } from './monsterScaling.js';
```

修改 ENEMY_CONFIG，给每个敌人加 `tier`：

```js
export const ENEMY_CONFIG = {
  slime: {
    tier: TIER.MINION,
    skills: ['basic_melee'],
    isBoss: false
  },
  goblin: {
    tier: TIER.NORMAL,
    skills: ['basic_melee'],
    isBoss: false
  },
  spider: {
    tier: TIER.NORMAL,
    skills: ['basic_melee', 'pounce'],
    isBoss: false
  },
  skeleton: {
    tier: TIER.NORMAL,
    skills: ['basic_melee', 'basic_shot'],
    isBoss: false
  },
  bat: {
    tier: TIER.MINION,
    skills: ['basic_shot'],
    isBoss: false
  },
  orc_warrior: {
    tier: TIER.ELITE,
    skills: ['basic_melee', 'pounce'],
    isBoss: false
  },
  fire_mage: {
    tier: TIER.ELITE,
    skills: ['basic_shot', 'ground_pound'],
    isBoss: false
  },
  skeleton_king: {
    tier: TIER.BOSS,
    skills: ['heavy_strike', 'pounce', 'heavy_shot', 'ground_pound'],
    isBoss: true,
    tint: 0xff8888,
    aggroDelay: 0,
    disengageRange: 600,
    disengageTime: 5000
  },
  giant_skeleton: {
    tier: TIER.ELITE,
    skills: ['heavy_strike', 'pounce'],
    isBoss: false
  }
};
```

`getEnemyConfig` 函数不变，fallback 默认 tier 为 NORMAL：

```js
export function getEnemyConfig(typeId) {
  return ENEMY_CONFIG[typeId] || { tier: TIER.NORMAL, skills: ['basic_melee'], isBoss: false };
}
```

**Step 2: 验证**

运行 `pnpm dev`，确认无导入错误、游戏正常加载。

**Step 3: 提交**

```bash
git add src/data/enemyConfig.js
git commit -m "feat(monster-level): enemyConfig 添加 tier 字段"
```

---

## Task 3: levels.js 添加 recommendedLevel

**Files:**
- Modify: `src/data/levels.js`

**Step 1: 给两个关卡添加 recommendedLevel**

在第一关和第二关的配置对象中各加一个字段。

第一关（搜索 `name: '第一关`）添加：
```js
recommendedLevel: 3,
```

第二关（搜索 `name: '第二关`）添加：
```js
recommendedLevel: 5,
```

**Step 2: 验证**

运行 `pnpm dev`，确认关卡正常加载。

**Step 3: 提交**

```bash
git add src/data/levels.js
git commit -m "feat(monster-level): levels.js 添加 recommendedLevel"
```

---

## Task 4: Enemy 构造函数支持 finalLevel 缩放

**Files:**
- Modify: `src/entities/Enemy.js:1-5` (导入)
- Modify: `src/entities/Enemy.js:18-46` (构造函数)
- Modify: `src/entities/Enemy.js:470-473` (dropLoot)

**Step 1: 添加导入**

在 `Enemy.js` 文件顶部现有导入后添加：
```js
import { scaleBaseStats, applyDerivedScaling } from '../data/monsterScaling.js';
```

**Step 2: 修改构造函数，接收 finalLevel 和 tier**

修改 `constructor` 方法。在 `const statsConfig = ...` 之后、`super(...)` 调用之前，插入缩放逻辑：

```js
constructor(scene, x, y, config = {}) {
    const mergedConfig = {
      hp: config.hp || 30,
      damage: config.damage || 10,
      speed: config.speed || 60,
      patrolRange: config.patrolRange || 120,
      detectionRange: config.detectionRange || 150,
      ...config
    };

    // 基础6维（Lv.1 模板值）
    const baseStats = mergedConfig.stats || {
      con: Math.ceil(mergedConfig.hp / 10),
      str: Math.ceil(mergedConfig.damage / 2),
      int: 1,
      agi: Math.ceil(mergedConfig.speed / 10),
      per: 1,
      lck: 1
    };

    // ── 等级缩放 ──
    // finalLevel 和 tier 由 LevelBuilder 计算后传入 config
    const finalLevel = mergedConfig.finalLevel || mergedConfig.level || 1;
    const tier = mergedConfig.tier || 'normal';
    const scaledStats = scaleBaseStats(baseStats, finalLevel);

    const characterType = mergedConfig.id || null;
    const charConfig = characterType ? CHARACTERS[characterType] : null;
    const textureKey = charConfig
      ? `${charConfig.prefix}_${String(charConfig.frames[0]).padStart(2, '0')}`
      : TEXTURES.ENEMY;

    super(scene, x, y, textureKey, scaledStats, characterType);

    this.config = mergedConfig;
    this.finalLevel = finalLevel;
    this.tier = tier;

    // ── 派生属性缩放（Tier 倍率 + 派生成长）──
    // Stats 引擎已在 super() 中用 scaledStats 计算了派生值
    // 现在对 maxHp 和 attack 施加额外成长 + Tier 倍率
    const derived = this.stats.getDerived();
    applyDerivedScaling(derived, finalLevel, tier);
    // 将缩放结果写回 Stats 的 flatBonuses，使后续 getDerived() 保持一致
    const baseDerived = this.stats._computeDerived();  // 未缩放的原始派生
    if (derived.maxHp !== baseDerived.maxHp) {
      this.stats.flatBonuses.maxHp = (this.stats.flatBonuses.maxHp || 0) + (derived.maxHp - baseDerived.maxHp);
    }
    if (derived.attack !== baseDerived.attack) {
      this.stats.flatBonuses.attack = (this.stats.flatBonuses.attack || 0) + (derived.attack - baseDerived.attack);
    }
    this.stats.invalidate();

    // 用缩放后的 maxHp 重置 HP
    this.maxHp = this.stats.getDerived().maxHp;
    this.hp = this.maxHp;
    // ... 后续代码不变 ...
```

注意：需要确认 `Stats` 类是否有 `_computeDerived()` 方法。如果没有，改用以下替代方案——直接用 `flatBonuses` 通道注入差值：

**替代方案（更简洁，推荐）：** 不调用 `_computeDerived`，直接在 super() 之后计算增量：

```js
    super(scene, x, y, textureKey, scaledStats, characterType);

    this.config = mergedConfig;
    this.finalLevel = finalLevel;
    this.tier = tier;

    // ── 派生属性缩放 ──
    this._applyLevelScaling(finalLevel, tier);
```

新增方法到 Enemy 类：

```js
  /** 应用等级派生缩放 + Tier 倍率 */
  _applyLevelScaling(level, tier) {
    const derived = this.stats.getDerived();
    const scaledDerived = applyDerivedScaling({ ...derived }, level, tier);

    // 将差值注入 flatBonuses
    const hpDiff = scaledDerived.maxHp - derived.maxHp;
    const atkDiff = scaledDerived.attack - derived.attack;

    if (hpDiff !== 0) {
      this.stats.flatBonuses.maxHp = (this.stats.flatBonuses.maxHp || 0) + hpDiff;
    }
    if (atkDiff !== 0) {
      this.stats.flatBonuses.attack = (this.stats.flatBonuses.attack || 0) + atkDiff;
    }
    this.stats.invalidate();

    // 重置 HP 到新的 maxHp
    this.maxHp = this.stats.getDerived().maxHp;
    this.hp = this.maxHp;
  }
```

**Step 3: 修改 dropLoot 传递 finalLevel**

修改 `dropLoot()` 方法（`Enemy.js:471-473`），把 `finalLevel` 传出去：

```js
  dropLoot() {
    this.scene.events.emit('enemyDropLoot', this.config.id, this.sprite.x, this.sprite.y, this.finalLevel);
  }
```

**Step 4: 验证**

运行 `pnpm dev`，进入游戏。此时 LevelBuilder 尚未传 `finalLevel`，敌人应按 `config.level || 1` 回退，行为不变。

**Step 5: 提交**

```bash
git add src/entities/Enemy.js
git commit -m "feat(monster-level): Enemy 支持 finalLevel 缩放"
```

---

## Task 5: LevelBuilder 计算最终等级并传入 Enemy

**Files:**
- Modify: `src/managers/LevelBuilder.js:1-8` (导入)
- Modify: `src/managers/LevelBuilder.js:270-282` (createEnemies)

**Step 1: 添加导入**

在 `LevelBuilder.js` 顶部添加：
```js
import { rollTierOffset } from '../data/monsterScaling.js';
import { getEnemyConfig } from '../data/enemyConfig.js';
```

**Step 2: 修改 createEnemies**

修改 `createEnemies` 方法（原第 270-282 行）：

```js
  createEnemies(level) {
    const empty = this.getEmptyTiles();
    const recommendedLevel = level.recommendedLevel || 1;
    const groups = Array.isArray(level.enemies) ? level.enemies : [level.enemies];
    groups.forEach(group => {
      const config = itemData.enemies[group.type];
      if (!config) return;

      // 从 enemyConfig 读取 tier
      const enemyCfg = getEnemyConfig(group.type);
      const tier = enemyCfg.tier || 'normal';

      const positions = this.pickRandomPositions(empty, group.count);
      positions.forEach(pos => {
        // 最终等级 = 推荐等级 + Tier偏移，最低1级
        const offset = rollTierOffset(tier);
        const finalLevel = Math.max(1, recommendedLevel + offset);

        this.enemies.push(new Enemy(this, pos.x, pos.y, {
          ...config,
          finalLevel,
          tier,
        }));
      });
    });
  },
```

**Step 3: 验证**

运行 `pnpm dev`，进入第一关（推荐等级 3）。观察：
- slime（minion）应为 Lv.2~3，HP 较低
- skeleton（normal）应为 Lv.3，HP 适中
- orc_warrior（elite）应为 Lv.4~5，HP 很高
- skeleton_king（boss）应为 Lv.6~8，HP 极高

可在 `Enemy._applyLevelScaling` 末尾临时加 `console.log` 验证：
```js
console.log(`${this.config.id} Lv.${level} (${tier}): HP=${this.maxHp} ATK=${this.stats.getDerived().attack}`);
```

**Step 4: 提交**

```bash
git add src/managers/LevelBuilder.js
git commit -m "feat(monster-level): LevelBuilder 计算最终等级传入 Enemy"
```

---

## Task 6: 等级压制 — 玩家打怪

**Files:**
- Modify: `src/managers/InteractionHandler.js:197-209` (handleAttackHit)
- Modify: `src/managers/InteractionHandler.js:220-260` (handleSkillHit)
- Modify: `src/managers/InteractionHandler.js:285-310` (spin 分支)

**Step 1: 添加导入**

在 `InteractionHandler.js` 顶部添加：
```js
import { getLevelSuppression } from '../data/monsterScaling.js';
```

**Step 2: 修改 handleAttackHit（普攻）**

在 `handleAttackHit` 方法中（原第 201 行），把伤害乘以等级压制：

找到:
```js
    enemy.takeDamage(this.player.getAttack(), this.player.sprite.x, this.player.sprite.y);
```

替换为:
```js
    const baseDmg = this.player.getAttack();
    const playerLevel = this.player.levelSystem?.level || 1;
    const suppressMult = getLevelSuppression(playerLevel, enemy.finalLevel || 1);
    const finalDmg = Math.round(baseDmg * suppressMult);
    enemy.takeDamage(finalDmg, this.player.sprite.x, this.player.sprite.y);
```

同时修改 triggerSystem 传递的 damage（第 203 行）：
```js
    if (this.triggerSystem) {
      this.triggerSystem.fire('onHit', { enemy, damage: finalDmg });
      if (enemy.hp <= 0) this.triggerSystem.fire('onKill', { enemy });
    }
```

**Step 3: 修改 handleSkillHit（技能伤害）**

在 `handleSkillHit` 中找到技能伤害计算处（约第 237 行之前），给 `damage` 施加压制：

找到计算 damage 的行（`const damage = Math.floor(attackStat * skill.effect.damageMultiplier);`），在其后添加：
```js
      const playerLevel = this.player.levelSystem?.level || 1;
      const suppressMult = getLevelSuppression(playerLevel, enemy.finalLevel || 1);
      damage = Math.round(damage * suppressMult);
```

**Step 4: 修改 spin 分支**

找到 spin 分支中的 damage 计算（约第 293 行），同样添加压制：

```js
      let damage = Math.floor(this.player.getAttack() * skill.effect.damageMultiplier);
      const playerLevel = this.player.levelSystem?.level || 1;
      const suppressMult = getLevelSuppression(playerLevel, enemy.finalLevel || 1);
      damage = Math.round(damage * suppressMult);
```

**Step 5: 验证**

运行 `pnpm dev`。打低等级怪应感受到伤害略高，打高等级怪伤害略低。

**Step 6: 提交**

```bash
git add src/managers/InteractionHandler.js
git commit -m "feat(monster-level): 玩家打怪等级压制"
```

---

## Task 7: 等级压制 — 怪打玩家

**Files:**
- Modify: `src/scenes/MainGameScene.js:342-355` (hitbox overlap)
- Modify: `src/entities/EnemyProjectile.js:70-75` (弹道命中)

**Step 1: MainGameScene — hitbox 伤害压制**

在 `MainGameScene.js` 导入区添加：
```js
import { getLevelSuppression } from '../data/monsterScaling.js';
```

修改 hitbox overlap 回调（原第 348-354 行）：

```js
      this.physics.add.overlap(this.player.sprite, hitbox, () => {
        const baseDmg = hitbox._enemySkillDamage || 0;
        const owner = hitbox._enemyOwner;
        if (this.player && baseDmg > 0 && !this.player.isInvulnerable) {
          const enemyLevel = owner?.finalLevel || 1;
          const playerLevel = this.levelSystem?.level || 1;
          const suppressMult = getLevelSuppression(enemyLevel, playerLevel);
          const finalDmg = Math.round(baseDmg * suppressMult);
          this.player.takeDamage(finalDmg, owner?.sprite?.x, owner?.sprite?.y);
        }
        hitbox.body.enable = false;
      });
```

**Step 2: EnemyProjectile — 弹道伤害压制**

在 `EnemyProjectile.js` 导入区添加：
```js
import { getLevelSuppression } from '../data/monsterScaling.js';
```

修改 `onHit` 方法（原第 70-75 行）：

```js
  onHit(target) {
    if (!this.alive) return;
    if (target && typeof target.takeDamage === 'function' && this.damage > 0) {
      const enemyLevel = this.owner?.finalLevel || 1;
      const playerLevel = target.levelSystem?.level || target.scene?.levelSystem?.level || 1;
      const suppressMult = getLevelSuppression(enemyLevel, playerLevel);
      const finalDmg = Math.round(this.damage * suppressMult);
      target.takeDamage(finalDmg, this.sprite.x, this.sprite.y);
    }
    // ... 后续爆点代码不变
```

注意：需确认 `this.owner` 是否存在。检查 `EnemyProjectile` 构造函数是否有 `owner` 引用。如果没有，需在 `EnemySkillSystem` 创建弹道时传入 owner 引用。

**Step 3: 验证**

运行 `pnpm dev`。被高等级怪技能命中时伤害应略高于面板值，被低等级怪命中伤害略低。

**Step 4: 提交**

```bash
git add src/scenes/MainGameScene.js src/entities/EnemyProjectile.js
git commit -m "feat(monster-level): 怪打玩家等级压制"
```

---

## Task 8: 装备掉落等级绑定怪物等级

**Files:**
- Modify: `src/systems/LootEngine.js:96-141` (_rollItem)
- Modify: `src/scenes/MainGameScene.js:410-412` (enemyDropLoot handler)

**Step 1: enemyDropLoot 事件传递 finalLevel**

修改 `MainGameScene.js` 中的 `enemyDropLoot` 监听（原第 410 行）：

Task 4 已让 Enemy.dropLoot() 传出 finalLevel，这里接收它：

```js
    this.events.on('enemyDropLoot', (enemyId, x, y, enemyLevel) => {
      const dropBonus = this.player ? this.player.stats.getDerived().dropBonus : 0;
      const drops = LootEngine.roll(enemyId, dropBonus, enemyLevel);
```

**Step 2: LootEngine.roll 接收 enemyLevel**

修改 `LootEngine.roll` 签名（原第 25 行）：

```js
  static roll(enemyId, dropBonus = 0, enemyLevel = 1) {
```

将 enemyLevel 注入到 equipment pool（原第 33 行附近）：

```js
    table.pools.forEach(p => {
      if (p.name === 'equipment') {
        p._dropBonus = dropBonus;
        p._enemyLevel = enemyLevel;
      }
    });
```

**Step 3: _rollItem 用怪物等级算装备等级**

修改 `_rollItem` 中的装备生成逻辑（原第 130-137 行）：

找到:
```js
      const enemyLevel = baseData.level || 1;
```

替换为:
```js
      const enemyLevel = pool._enemyLevel || baseData.level || 1;
      // 装备等级 = 怪物等级 ±1，最低1
      const equipLevel = Math.max(1, enemyLevel + Phaser.Math.Between(-1, 1));
```

然后把 `EquipmentGenerator.generate(selected.id, rarity, enemyLevel)` 改为：
```js
      const instance = EquipmentGenerator.generate(selected.id, rarity, equipLevel);
```

同时将 boss 标记也传入品质 roll（原第 134 行）：

```js
      const rarity = EquipmentGenerator.rollRarity({ isBoss: pool._isBoss || false, dropBonus });
```

**Step 4: 验证**

运行 `pnpm dev`。杀怪查看掉落装备，装备等级应在怪物等级 ±1 范围内浮动，而非固定模板值。

**Step 5: 提交**

```bash
git add src/systems/LootEngine.js src/scenes/MainGameScene.js
git commit -m "feat(monster-level): 装备掉落等级绑定怪物等级"
```

---

## Task 9: 经验公式调整

**Files:**
- Modify: `src/systems/LevelSystem.js:55-58` (getEnemyXp)
- Modify: `src/scenes/MainGameScene.js:386-391` (XP grant)

**Step 1: 修改 getEnemyXp 支持 Tier 倍率**

在 `LevelSystem.js` 顶部添加导入：
```js
import { SCALING_CONFIG, TIER } from '../data/monsterScaling.js';
```

修改 `getEnemyXp` 方法（原第 55-58 行）：

```js
  getEnemyXp(enemyLevel, tier = TIER.NORMAL) {
    const tm = SCALING_CONFIG.tierMultipliers[tier] || SCALING_CONFIG.tierMultipliers[TIER.NORMAL];
    return Math.round(enemyLevel * 15 * tm.xp);
  }
```

**Step 2: 修改 MainGameScene 调用处**

修改 enemyDeath 处理中的 XP 计算（原第 386-391 行）：

```js
      // Grant XP for kill
      let xpAmount = 0;
      if (this.levelSystem) {
        xpAmount = this.levelSystem.getEnemyXp(enemy.finalLevel || 1, enemy.tier);
        this.levelSystem.addXp(xpAmount, enemy.finalLevel || 1);
      }
```

**Step 3: 验证**

运行 `pnpm dev`。杀不同 Tier 怪物观察经验：
- minion 应给 ~0.5x 经验
- elite 应给 ~3x 经验
- boss 应给 ~10x 经验

**Step 4: 提交**

```bash
git add src/systems/LevelSystem.js src/scenes/MainGameScene.js
git commit -m "feat(monster-level): 经验公式支持等级和Tier倍率"
```

---

## Task 10: 怪物头顶显示等级

**Files:**
- Modify: `src/entities/Enemy.js:115-133` (createHealthBar)
- Modify: `src/entities/Enemy.js:135-158` (updateHealthBar, destroyHealthBar)

**Step 1: 在血条旁添加等级文本**

修改 `createHealthBar` 方法，在血条左侧显示 `Lv.X`：

在 `this.hbFill` 创建之后添加：

```js
    // 等级文本
    this.hbLevelText = this.scene.add.text(
      this.sprite.x, this.sprite.y,
      `Lv.${this.finalLevel}`,
      { fontSize: '8px', fill: '#ffffff', fontFamily: 'Courier New' }
    ).setOrigin(1, 0.5).setDepth(902);
```

**Step 2: 修改 updateHealthBar 更新等级文本位置**

在 `updateHealthBar` 中（`this.hbBg.setPosition` 之后）添加：

```js
    if (this.hbLevelText) {
      this.hbLevelText.setPosition(this.sprite.x - this.hbWidth / 2 - 4, topY);
    }
```

**Step 3: 修改 destroyHealthBar 清理等级文本**

在 `destroyHealthBar` 中添加：

```js
    if (this.hbLevelText) { this.hbLevelText.destroy(); this.hbLevelText = null; }
```

**Step 4: 验证**

运行 `pnpm dev`。每个怪物头顶血条左侧应显示 `Lv.X`，X 随 Tier 和关卡推荐等级变化。

**Step 5: 提交**

```bash
git add src/entities/Enemy.js
git commit -m "feat(monster-level): 怪物头顶显示等级"
```

---

## Task 11: 最终集成验证 + 清理调试代码

**Step 1: 全流程验证**

运行 `pnpm dev`，完整测试：

1. **等级计算**：进入第一关，观察各类怪等级是否符合预期
   - slime: Lv.2~3, skeleton: Lv.3, orc_warrior: Lv.4~5, skeleton_king: Lv.6~8
2. **属性缩放**：同类型怪不同等级，HP 和攻击应有明显差异
3. **等级压制**：玩家 Lv.1 打 Lv.6+ boss 应明显感受到伤害降低
4. **装备掉落**：杀怪掉的装备等级应在怪物等级 ±1
5. **经验**：boss 给的经验应远高于 slime
6. **等级显示**：每个怪头顶都有 `Lv.X`

**Step 2: 清理临时 console.log**

移除 Task 5 验证时可能添加的 console.log。

**Step 3: 进入第二关验证**

第二关推荐等级 5，怪物等级应整体更高。

**Step 4: 提交**

```bash
git add -A
git commit -m "feat(monster-level): Phase A 完成 — 怪物等级缩放系统"
```
