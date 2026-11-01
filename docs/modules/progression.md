# 成长系统

> 文件：`src/systems/LevelSystem.js`、`SkillTreeSystem.js`、`QuestSystem.js`、`src/data/quests.js`

## LevelSystem

### 经验公式
```js
xpRequired = floor(50 * level^2.2 - level*10)
```

### 升级奖励
| 奖励 | 数值 |
|------|------|
| 属性点 | +5 / 级（**手动分配**，存为 `statPoints`） |
| 技能点 | +1 / 3 级（用于升级技能） |
| maxHp 加成 | `(level-1) × 5` 通过 `flatBonus.maxHp` 应用 |

### 经验补偿
```js
addXp(amount, enemyLevel) {
  if (enemyLevel - this.level >= 5) amount *= 1.5;        // 高等级敌人
  else if (enemyLevel - this.level <= -5) amount *= 0.1;  // 低等级几乎不给
}
```

### 关键方法
| 方法 | 作用 |
|------|------|
| `addXp(amount, enemyLevel)` | 加经验，自动循环 levelUp |
| `levelUp()` | level++ + 加点 + emit `'levelUp'` |
| `allocateStat(statName)` | 仅扣 statPoints + emit；实际 stat 修改在 CharacterPanel 调 `player.stats.addBase` |
| `getXpRequired() / getEnemyXp(enemyConfig)` | 查询辅助 |
| `toJSON / fromJSON` | 序列化 |

### 属性点分配（PanelScene 角色页）
```js
// CharacterPanel 内点击 +
if (levelSystem.allocateStat(statName)) {
  player.stats.addBase(statName, 1);  // 真正改属性
  player.stats.invalidate();
  player.refreshStats();
}
```

每点 `+1` 对应基础属性。立即生效，通过 Stats 引擎重算所有派生值。

### `levelUpBonus`（来自 `classConfig.js`）
> 暂未自动应用（需要在 `levelUp` 事件里读 `classConfig.levelUpBonus` 加 base）。当前仅起标识作用，留待后续迭代。

## SkillTreeSystem

### 当前实现
- 主动技能升级通过 `SkillEngine.upgradeSkill(skillId)`（消耗 `levelSystem.skillPoints`）
- `SkillTreeSystem` 持有被动 buff 节点的解锁状态（如"暴击 +5%"），目前仅占位

### 数据结构
```js
{
  unlockedNodes: ['shr_1', 'shr_2'],
  // 被动效果通过节点 effect 应用到玩家 stats
}
```

### 升级技能（`SkillTreePanel`）
- 2 列网格卡片，含图标、名称、Lv、描述、消耗、冷却
- 每张卡片右下"升级"按钮（消耗 1 技能点）
- 卡片右上 `[1][2][3][4]` 按钮装备/取消装备到对应槽位（绿框=已装备）

### 滚动支持
- 技能数量多时，鼠标滚轮纵向滚动
- 几何 mask 裁剪可视区
- 右侧细滚动条指示位置

## QuestSystem

### 任务状态流
```
未激活 → activeQuests → completedQuests
```

### 目标类型
| 类型 | 触发事件 | 示例 |
|------|----------|------|
| `kill` | `enemyDeath` | 击杀 5 只史莱姆 |
| `collect` | `keysChanged` / 道具拾取 | 收集 3 把钥匙 |
| `interact` | `playerInteract` | 与 NPC 对话 |
| `artifact` | 自定义 | 获取神器 |

### 数据 (`quests.js`)
```js
{
  id: 'kill_slimes',
  title: '消灭史莱姆',
  description: '...',
  giver: 'elder',
  level: 0,             // 在哪个关卡激活
  objectives: [
    { type: 'kill', target: 'slime', text: '消灭史莱姆', current: 0, required: 5 }
  ],
  rewards: { xp: 100, gold: 50 }
}
```

### 关键方法
| 方法 | 作用 |
|------|------|
| `activateQuestsForLevel(levelIdx)` | 自动激活当前关卡的任务 |
| `updateProgress(type, target, amount)` | 推进目标进度 |
| `getTrackedQuest()` | UI 用：当前追踪的任务 |
| `toJSON / fromJSON` | 序列化 |

### 事件
- `questActivated` / `questProgressUpdated` / `questCompleted`
- UIScene 监听以更新右下任务追踪面板
