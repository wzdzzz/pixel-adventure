# 数据格式参考

> 文件：`src/data/*.js`、`items.json`

## classConfig.js

```js
CLASS_CONFIG = {
  warrior: {
    id, name, description,
    baseStats: { con: 10, str: 8, int: 5, agi: 8, per: 5, lck: 3 },
    resource: 'rage',
    texturePrefix: 'hero',
    attackType: 'melee',
    primaryAttackStat: 'str',           // ★ Player.getAttack 读此
    levelUpBonus: { str: 1, ... }       // 预留
  },
  archer: { ..., primaryAttackStat: 'agi' },
  mage:   { ..., primaryAttackStat: 'int' }
}
```

## items.json

### 装备
```json
{
  "id": "iron_sword",
  "name": "铁剑",
  "type": "equipment",
  "slot": "weapon",
  "rarity": "common",
  "weaponType": "heavy",
  "level": 1,
  "icon": "⚔️",
  "baseStats": {
    "flatBonus": { "attack": 5 },
    "bonus": { "str": 0.05 }
  }
}
```

| 字段 | 取值 |
|------|------|
| `slot` | `weapon / armor / helmet / boots / ring1 / ring2 / necklace / accessory` |
| `rarity` | `common / uncommon / rare / epic / legendary` |
| `weaponType` | `heavy(战士) / light(弓箭手) / magic(法师)` |
| `level` | 装备所需等级 |

### 消耗品
```json
{
  "id": "hp_potion",
  "type": "consumable",
  "stackable": true,
  "maxStack": 99,
  "effect": { "type": "heal", "amount": 50 }
}
```

### 货币
```json
{ "id": "coin", "type": "currency", "stackable": true, "value": 10 }
```

## levels.js

```js
levelData = [
  {
    name: '第一关 - 迷雾森林',
    generateMap: generateLevel1Map,    // 函数返回 2D 瓦片数组
    playerStart: { x: 150, y: 150 },
    enemies: [
      { type: 'slime', count: 5 },
      { type: 'skeleton_king', count: 1 }   // 引用 enemyConfig.js 的 key
    ],
    items: { coins: 20, keys: 3, potions: 8, hasArtifact: false },
    npcs: [{ id, name, x, y, dialogues: [...], hasStateCondition }],
    signs: [{ x, y, text }],
    portalRequiredKeys: 3
  }
]
```

### 瓦片类型（`TILE` 常量）
| 值 | 含义 |
|---|------|
| 0 | EMPTY |
| 1 | WALL |
| 2 | BRIDGE |
| 3 | WATER |
| 4 | DECORATION |

## enemyConfig.js

```js
ENEMY_CONFIG = {
  slime: { skills: ['basic_melee'], isBoss: false },
  skeleton: { skills: ['basic_melee', 'basic_shot'], isBoss: false },
  bat: { skills: ['basic_shot'] },
  spider: { skills: ['basic_melee', 'pounce'] },
  orc_warrior: { skills: ['basic_melee', 'pounce'] },
  fire_mage: { skills: ['basic_shot', 'ground_pound'] },
  giant_skeleton: { skills: ['heavy_strike', 'pounce'] },

  skeleton_king: {
    skills: ['heavy_strike', 'pounce', 'heavy_shot', 'ground_pound'],
    isBoss: true,
    tint: 0xff8888,
    aggroDelay: 0,
    disengageRange: 600,
    disengageTime: 5000
  }
};
```

| 字段 | 默认 | 作用 |
|------|------|------|
| `skills` | `['basic_melee']` | 技能 ID 列表 |
| `isBoss` | false | 抗 stagger + 立即仇恨 |
| `tint` | - | 染色 |
| `displayScale` | 1 | 显示缩放 |
| `aggroDelay` | 500 | 进入仇恨延迟 |
| `disengageRange` | detectionRange*2.5 | 脱战距离 |
| `disengageTime` | 3000 | 脱战时长 |

## enemySkills.js

```js
ENEMY_SKILLS = {
  basic_melee: {
    type: 'melee_strike',
    range: 50, cooldown: 1500,
    telegraph: 300, activeWindow: 100,
    damage: 1.0,
    hitbox: { w: 36, h: 32 },
    telegraphTint: 0xff8800,
    priority: 0
  },

  basic_shot: {
    type: 'ranged_shot',
    range: 280, minRange: 60, cooldown: 2500,
    telegraph: 400, activeWindow: 0,
    damage: 0.8,
    projectileSpeed: 220, projectileSize: 8,
    projectileLifetime: 2000, color: 0xff8844
  },

  pounce: {
    type: 'charge_attack',
    range: 220, minRange: 40, cooldown: 4000,
    telegraph: 500, activeWindow: 400,
    damage: 1.2, speed: 280,
    hitbox: { w: 40, h: 36 }
  },

  ground_pound: {
    type: 'aoe_burst',
    range: 100, cooldown: 6000,
    telegraph: 800, activeWindow: 200,
    damage: 1.8, radius: 80, color: 0xff4422
  }
};
```

详见 `docs/modules/enemies-ai.md`。

## statusEffects.js

合并三职业 `EFFECTS` + emoji 图标：

```js
STATUS_EFFECTS = { ...MAGE_EFFECTS, ...ARCHER_EFFECTS, ...WARRIOR_EFFECTS }

EFFECT_ICONS = {
  bleed: '🩸', poison: '☠️', burn: '🔥',
  armorBreak: '🛡️', slow: '🐌', frostSlow: '❄️',
  huntersMark: '🎯', arcaneWeakness: '🌀',
  rageBoost: '💢', manaBoost: '💧'
};

getEffectTemplate(effectId)  // 返回模板（含 icon）
```

效果模板格式：
```js
{
  id, name, type: 'dot' | 'debuff' | 'buff',
  duration, tickInterval, maxStacks, refreshable,
  damagePerTick,                       // DoT 用，× source.getAttack() × stacks
  modifiers: { defense: -0.30, ... }   // debuff/buff 用
}
```

被 `InteractionHandler.applySkillEffects` 自动消费 — DoT 自动绑 `onTick`。

## *Skills.js（玩家技能）

通用结构：
```js
export const WARRIOR_SKILLS = { ... };
export const WARRIOR_EFFECTS = { ... };  // 状态效果模板
export const SKILL_SLOTS = ['charge', 'whirlwind', 'warCry', 'execute'];  // 默认绑定

export function getSkillAtLevel(skillId, level) { ... }    // 缩放
export function getSkillDescription(skillId, level) { ... } // 替换占位符
```

技能 effect 字段详见 `docs/modules/skills.md`。

## lootTables.js

```js
LOOT_TABLES = {
  slime: {
    drops: [
      { itemId: 'coin', weight: 50, minCount: 1, maxCount: 3 },
      { itemId: 'hp_potion', weight: 20 },
      { itemId: 'iron_sword', weight: 5 }
    ],
    dropChance: 0.8,
    maxDrops: 2
  }
};

RARITY_MULTIPLIERS = {
  common:    { chance: 0.60, statMul: 1.0 },
  uncommon:  { chance: 0.25, statMul: 1.2 },
  rare:      { chance: 0.10, statMul: 1.5 },
  epic:      { chance: 0.04, statMul: 2.0 },
  legendary: { chance: 0.01, statMul: 3.0 }
};
```

## quests.js

```js
QUESTS = {
  kill_slimes: {
    id, title, description, giver,
    level: 0,                          // 哪一关激活
    objectives: [
      { type: 'kill', target: 'slime', text: '消灭史莱姆', current: 0, required: 5 }
    ],
    rewards: { xp: 100, gold: 50, items: [...] }
  }
};
```

### objective.type
| 类型 | target | 触发事件 |
|------|--------|----------|
| `kill` | 怪物 ID | `enemyDeath` |
| `collect` | 道具 ID | 拾取 / `keysChanged` |
| `interact` | NPC ID | `playerInteract` |
| `artifact` | - | 获取神器 |

## AssetManager.CHARACTERS

```js
slime: {
  prefix: 'slime',           // 纹理前缀
  frames: [0, 1, 2, 3, 4],
  display: { w: 40, h: 34 },
  anims: {
    idle: { frames: [0, 1, 2], rate: 4, repeat: -1 },
    walk: { frames: [0, 1, 2, 3], rate: 6, repeat: -1 },
    hurt: { frames: [4], rate: 1, repeat: 0 },
    die:  { frames: [4, 3], rate: 3, repeat: 0 }
  }
}
```

帧索引指向 BootScene 生成的纹理 key（如 `slime_00`）。
