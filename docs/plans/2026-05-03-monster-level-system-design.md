# 怪物等级系统设计文档

> 日期：2026-05-03
> 分支：feature/ui-panel-system
> 状态：已确认，待实施

## 目标

1. 控制难度曲线 — 怪物强度随关卡递进
2. 控制掉落区间 — 装备等级与怪物等级绑定
3. 控制成长节奏 — 等级压制防止碾压/被碾压

## 三阶段规划

| Phase | 内容 | 前置 |
|-------|------|------|
| **A** | 等级缩放底层系统 | 无 |
| **B** | 新怪物类型 + 精英词缀 | A |
| **C** | Boss 多阶段 + 战斗组合 + 10 关内容 | B |

---

## Phase A：等级缩放底层系统

### A1. 等级来源

```
怪物最终等级 = 关卡推荐等级 + Tier 偏移
```

**关卡配置（levels.js 新增字段）：**

```js
{ recommendedLevel: 3, ... }
```

**Tier 分类与偏移：**

| Tier | 偏移范围 | 归属怪物 |
|------|---------|---------|
| minion | random(-1, 0) | slime, bat |
| normal | 0 | goblin, spider, skeleton |
| elite | random(+1, +2) | orc_warrior, fire_mage, giant_skeleton |
| boss | random(+3, +5) | skeleton_king |

Tier 字段写在 `enemyConfig.js` 每种敌人配置中。

### A2. 双层属性缩放

所有成长系数集中在配置对象中，便于后期替换为自定义公式。

**配置文件：`src/data/monsterScaling.js`（新建）**

```js
export const SCALING_CONFIG = {
  // ── 基础层：6 维统一成长 ──
  baseStatGrowth: 0.06,           // +6%/级

  // ── 派生层：额外独立成长 ──
  derivedGrowth: {
    maxHp:   0.06,                // 额外 +6%（合计 ~12%）
    attack:  0.02,                // 额外 +2%（合计 ~8%）
    // defense: 0,                // 纯靠基础层 ~6%
    // moveSpeed: 0,              // 纯靠基础层
    // critRate: 0,               // 纯靠基础层
  },

  // ── Tier 倍率 ──
  tierMultipliers: {
    minion: { hp: 0.7,  attack: 0.8, xp: 0.5  },
    normal: { hp: 1.0,  attack: 1.0, xp: 1.0  },
    elite:  { hp: 2.5,  attack: 1.5, xp: 3.0  },
    boss:   { hp: 8.0,  attack: 2.0, xp: 10.0 },
  },
};
```

**计算流程（5 步）：**

```
1. 读 Lv.1 基础 6 维（items.json 现有 stats）
2. 基础缩放：stat × (1 + baseStatGrowth × (level - 1))
3. 送入 Stats 引擎 → 派生属性（maxHp, attack, defense ...）
4. 派生加成：derived × (1 + derivedGrowth[key] × (level - 1))
5. Tier 倍率：hp × tierMult.hp, attack × tierMult.attack
```

**示例 — Lv.5 normal 骷髅兵（base con:5, str:7）：**

```
步骤 2: con = 5 × (1 + 0.06×4) = 6.2 → 取整 6
         str = 7 × (1 + 0.06×4) = 8.68 → 取整 9
步骤 3: maxHp = 6×10 = 60,  attack = 9×2 = 18
步骤 4: maxHp = 60 × (1 + 0.06×4) = 74.4 → 74
         attack = 18 × (1 + 0.02×4) = 19.4 → 19
步骤 5: normal 倍率 ×1.0 → maxHp = 74, attack = 19
```

### A3. 等级压制

```js
export const LEVEL_SUPPRESS = {
  perLevelPct: 0.05,   // 每差 1 级 ±5%
  maxPct: 0.30,        // 封顶 ±30%（6 级差）
};
```

**公式：**

```
damageMult = clamp(1 + (attackerLevel - defenderLevel) × perLevelPct, 1 - maxPct, 1 + maxPct)
```

- 双向生效：玩家打怪 & 怪打玩家
- 玩家等级取 `LevelSystem.level`
- 怪物等级取 `enemy.finalLevel`

### A4. 装备等级绑定

```js
// LootEngine._rollItem() 改造
// 不再读模板固定 level，改为根据怪物最终等级 ±1 随机
const equipLevel = Math.max(1, enemyFinalLevel + Phaser.Math.Between(-1, 1));
const instance = EquipmentGenerator.generate(templateId, rarity, equipLevel);
```

### A5. 经验公式调整

```js
baseXp = enemyFinalLevel × 15 × tierMult.xp
// 等级差惩罚/奖励保持现有 LevelSystem 逻辑不变
```

### A6. 需要改动的文件

| 文件 | 改动类型 | 说明 |
|------|---------|------|
| `src/data/monsterScaling.js` | **新建** | 成长系数 + Tier 倍率 + 等级压制配置 |
| `src/data/enemyConfig.js` | 修改 | 每种敌人加 `tier` 字段 |
| `src/data/levels.js` | 修改 | 每关加 `recommendedLevel` |
| `src/data/items.json` | 修改 | enemies.level 降为参考值，不再驱动运行时 |
| `src/entities/Enemy.js` | 修改 | 构造函数接收 `finalLevel`，用缩放后 stats 初始化 |
| `src/systems/LootEngine.js` | 修改 | `_rollItem()` 用怪物等级算装备等级 |
| `src/systems/LevelSystem.js` | 修改 | 经验计算用 `finalLevel × tierMult.xp` |
| `src/managers/LevelBuilder.js` | 修改 | `createEnemies()` 计算最终等级并传入 |
| `src/scenes/MainGameScene.js` | 修改 | 伤害计算加等级压制修正 |

---

## Phase B：新怪物 + 精英词缀

> 前置：Phase A 完成

### B1. 新怪物类型

**哥布林阵营（5 种，含 1 种改造）：**

| 怪物 ID | 中文名 | 定位 | Tier | 关键技能 |
|---------|--------|------|------|---------|
| goblin | 哥布林 | 基础近战 | normal | 普攻 |
| goblin_archer | 哥布林弓手 | 远程骚扰 | normal | 箭射 + 后跳拉距 |
| goblin_guard | 哥布林护卫 | 小坦克 | elite | 重击(1.5×, 慢) + 举盾(减伤 50%, 2s) |
| goblin_shaman | 哥布林萨满 | 辅助控制 | elite | 治疗队友 20%HP + 诅咒(玩家攻击-20%) |
| goblin_bomber | 哥布林投手 | AOE 威胁 | normal | 投掷炸弹(延迟 1s 爆炸, 2.0×ATK) |

**野兽阵营（3 种，含 1 种改造）：**

| 怪物 ID | 中文名 | 定位 | Tier | 关键技能 |
|---------|--------|------|------|---------|
| wolf | 野狼 | 高速近战 | normal | 撕咬(1.2×) + 扑击突进 |
| elite_wolf | 狂暴狼 | 高压精英 | elite | 3连击 + 狂暴(攻速+50%) |
| spider | 蜘蛛 | Debuff | normal | 毒液 DOT(0.3×/s) + 减速缠绕(50%) |

### B2. 新增技能类型

在现有 4 种（melee_strike / ranged_shot / charge_attack / aoe_burst）基础上新增：

| 类型 | 说明 | 用于 |
|------|------|------|
| `heal_ally` | 治疗范围内血最少的队友 | goblin_shaman |
| `buff_self` | 自我增益（举盾/狂暴） | goblin_guard, elite_wolf |
| `debuff_target` | 对玩家施加减益 | goblin_shaman, spider |
| `delayed_aoe` | 投掷物落地延迟爆炸 | goblin_bomber |
| `dodge_back` | 后跳拉距 | goblin_archer |

### B3. 精英词缀系统

```js
// src/data/eliteAffixes.js（新建）
export const ELITE_AFFIXES = {
  rage:    { name: '狂暴', attackSpeedMult: 1.30 },
  poison:  { name: '剧毒', onHit: 'dot', dotDmgPct: 0.3, dotDuration: 3000 },
  shield:  { name: '护盾', damageReduction: 0.25 },
  vampire: { name: '吸血', lifestealPct: 0.15 },
  explode: { name: '爆炸', onDeath: 'aoe', radius: 60, dmgPct: 1.0 },
};
```

**规则：**
- 仅 `elite` 和 `boss` Tier 可拥有词缀
- elite 生成时随机附加 1~2 个词缀
- boss 可配置固定词缀
- 名字前缀显示：`【狂暴·剧毒】兽人战士`
- 视觉提示：对应 tint 或粒子特效

### B4. 需要改动的文件

| 文件 | 改动类型 | 说明 |
|------|---------|------|
| `src/data/eliteAffixes.js` | **新建** | 词缀定义 |
| `src/data/enemyConfig.js` | 修改 | 新增怪物配置 |
| `src/data/enemySkills.js` | 修改 | 新增技能定义 |
| `src/data/items.json` | 修改 | enemies 新增条目（基础属性） |
| `src/data/lootTables.js` | 修改 | 新增掉落表 |
| `src/entities/Enemy.js` | 修改 | 支持词缀 buff 应用 + 视觉效果 |
| `src/systems/EnemySkillSystem.js` | 修改 | 新技能类型执行逻辑 |
| `src/systems/StatusEffectSystem.js` | 修改 | DOT/减速/减攻等状态效果 |

---

## Phase C：Boss 多阶段 + 战斗组合

> 前置：Phase B 完成

### C1. Boss 多阶段系统

**新建 `src/systems/BossPhaseSystem.js`：**

```js
export const BOSS_PHASES = {
  goblin_king: {
    phases: [
      {
        hpPct: [1.0, 0.6],
        skills: ['basic_melee', 'summon_minions'],
        onEnter: null,
      },
      {
        hpPct: [0.6, 0.3],
        skills: ['jump_slam', 'war_cry'],
        onEnter: 'flash',  // 阶段切换特效
      },
      {
        hpPct: [0.3, 0.0],
        skills: ['frenzy', 'chain_charge'],
        onEnter: 'enrage', // 怒吼 + 短暂无敌
      },
    ],
  },
};
```

**机制：**
- 每帧检查当前 HP 百分比，到阈值自动切换阶段
- 切换时更新 `skillSystem.skillIds` 为新阶段技能组
- `onEnter` 触发阶段切换特效（闪光/怒吼/短暂无敌 1s）
- Boss 血条显示阶段分界线

### C2. Boss 专属技能

| 技能 | 类型 | 说明 |
|------|------|------|
| summon_minions | 新增 | 召唤 2~3 只哥布林（30s 冷却） |
| jump_slam | aoe_burst 变体 | 跳向玩家 + 落地 AOE（1.8×ATK, r=80） |
| war_cry | buff_self | 怒吼提升自身+场上小怪攻击 30%（10s） |
| frenzy | buff_self | 狂暴：攻速+50%，持续至死 |
| chain_charge | charge_attack 变体 | 连续冲锋 3 次（每次间隔 0.5s） |

### C3. 战斗组合系统

**新建 `src/data/encounterGroups.js`：**

```js
export const ENCOUNTER_GROUPS = {
  // 教学组合
  basic:     [{ type: 'goblin', count: 3 }, { type: 'goblin_archer', count: 1 }],
  // 前后排压力
  pressure:  [{ type: 'goblin_guard', count: 1 }, { type: 'goblin_archer', count: 2 }],
  // 优先级判断
  danger:    [{ type: 'goblin_shaman', count: 1 }, { type: 'goblin', count: 3 }],
  // 走位 + 躲技能
  chaos:     [{ type: 'goblin_bomber', count: 1 }, { type: 'wolf', count: 2 }],
  // 纯兽群
  wolfpack:  [{ type: 'wolf', count: 3 }, { type: 'elite_wolf', count: 1 }],
};
```

关卡可直接引用组合 ID，也可自定义 enemies 数组。

### C4. 第一章 10 关等级分布

| 关卡 | 推荐等级 | 普通怪等级 | 精英怪等级 | Boss 等级 | 主要怪物 |
|------|---------|-----------|-----------|----------|---------|
| 1 | 1 | 1 | — | — | slime, goblin |
| 2 | 2 | 2 | — | — | goblin, goblin_archer, wolf |
| 3 | 3 | 2-3 | 4 | 6（小 Boss） | 哥布林系 + spider |
| 4 | 4 | 3-4 | 5 | — | 混合 |
| 5 | 5 | 4-5 | 6 | — | 野兽系为主 |
| 6 | 6 | 5-6 | 7 | — | 混合 + 词缀精英 |
| 7 | 7 | 6-7 | 8 | — | 哥布林全系 |
| 8 | 8 | 7-8 | 9 | — | 野兽 + 高级哥布林 |
| 9 | 9 | 8-9 | 10 | — | 混合高压 |
| 10 | 10 | 9-10 | 11 | 13-15 | 哥布林王（3 阶段） |

### C5. 需要改动的文件

| 文件 | 改动类型 | 说明 |
|------|---------|------|
| `src/systems/BossPhaseSystem.js` | **新建** | Boss 阶段管理 |
| `src/data/encounterGroups.js` | **新建** | 战斗组合定义 |
| `src/data/enemySkills.js` | 修改 | Boss 专属技能 |
| `src/data/enemyConfig.js` | 修改 | 哥布林王配置 |
| `src/data/levels.js` | 修改 | 10 关完整配置 |
| `src/entities/Enemy.js` | 修改 | Boss 阶段切换集成 |
| `src/managers/LevelBuilder.js` | 修改 | 支持 encounterGroups 引用 |

---

## 设计约束

1. **所有数值可配置** — 成长系数、Tier 倍率、压制参数全部集中在 `monsterScaling.js`，后期可替换为自定义公式
2. **向后兼容** — items.json 现有 enemies.level 保留为参考值，不影响存档
3. **无循环依赖** — 新模块遵循 Data ← Systems ← Entities ← Scenes 方向
4. **现有怪物复用** — Phase A 不新增怪物，仅改造现有 9 种的等级计算
