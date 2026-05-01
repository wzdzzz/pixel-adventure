# 数据格式参考

> 文件：`src/data/items.json`, `levels.js`, `lootTables.js`, `warriorSkills.js`, `quests.js`

## items.json

道具/装备/消耗品主数据库。

### 装备类型
```json
{
  "id": "steel_armor",
  "name": "钢铁胸甲",
  "type": "equipment",
  "slot": "armor",
  "rarity": "rare",
  "icon": "🛡️",
  "description": "坚固的钢铁护甲",
  "baseStats": {
    "flatBonus": { "maxHp": 30, "defense": 8 },
    "bonus": { "con": 0.08 }
  }
}
```

### 消耗品类型
```json
{
  "id": "hp_potion",
  "name": "生命药水",
  "type": "consumable",
  "stackable": true,
  "maxStack": 99,
  "icon": "🧪",
  "effect": { "type": "heal", "amount": 50 }
}
```

### 货币/收集类型
```json
{
  "id": "gold_coin",
  "name": "金币",
  "type": "currency",
  "stackable": true,
  "value": 10
}
```

### slot 可选值
`weapon`, `armor`, `helmet`, `boots`, `gloves`, `ring`, `necklace`, `shield`

### rarity 可选值
`common`, `uncommon`, `rare`, `epic`, `legendary`

## levels.js

### 关卡结构
```js
export const levelData = [
  {
    name: '第一章',
    map: [
      [1,1,1,1,1],    // 2D 瓦片数组
      [1,0,0,0,1],    // 0=空地, 1=墙, 2=平台, ...
      [1,1,1,1,1]
    ],
    playerSpawn: { x: 2, y: 3 },     // 瓦片坐标
    enemies: [
      { type: 'slime', x: 10, y: 3, patrolRange: 3 }
    ],
    npcs: [
      { type: 'villager', x: 5, y: 3, dialogueId: 'npc_01' }
    ],
    items: [
      { itemId: 'hp_potion', x: 8, y: 3, id: 'item_01' }
    ],
    chests: [
      { x: 15, y: 3, id: 'chest_01', lootTable: 'common_chest' }
    ],
    portals: [
      { x: 20, y: 3, targetLevel: 1 }
    ]
  }
];
```

### LEVEL_TILE 瓦片类型
| 值 | 含义 |
|---|------|
| 0 | 空地 |
| 1 | 墙壁 |
| 2 | 平台 |
| 3 | 可破坏物 |
| 4 | 水面 |

## lootTables.js

### 掉落表
```js
export const LOOT_TABLES = {
  slime: {
    drops: [
      { itemId: 'gold_coin', weight: 50, minCount: 1, maxCount: 3 },
      { itemId: 'slime_jelly', weight: 30 },
      { itemId: 'iron_sword', weight: 5 }
    ],
    dropChance: 0.8,      // 80% 概率掉落
    maxDrops: 2            // 最多掉落 2 件
  }
};

export const RARITY_MULTIPLIERS = {
  common:    { chance: 0.60, statMul: 1.0 },
  uncommon:  { chance: 0.25, statMul: 1.2 },
  rare:      { chance: 0.10, statMul: 1.5 },
  epic:      { chance: 0.04, statMul: 2.0 },
  legendary: { chance: 0.01, statMul: 3.0 }
};
```

## warriorSkills.js

见 [skills.md](skills.md) 获取完整技能数据格式。

## quests.js

```js
export const questData = {
  kill_slimes: {
    id: 'kill_slimes',
    name: '消灭史莱姆',
    description: '森林中的史莱姆越来越多了...',
    giver: 'villager_01',        // 发布任务的 NPC
    objectives: [
      { type: 'kill', target: 'slime', required: 5 }
    ],
    rewards: {
      xp: 100,
      gold: 50,
      items: [{ itemId: 'hp_potion', count: 3 }]
    }
  }
};
```

### 目标类型 (objective.type)
| 类型 | target 含义 | 触发方式 |
|------|------------|----------|
| `kill` | 敌人类型 ID | enemyDeath 事件 |
| `collect` | 道具 ID | keysChanged 事件 |
| `interact` | NPC ID | playerInteract 事件 |
| `artifact` | - | artifactCollected 事件 |
