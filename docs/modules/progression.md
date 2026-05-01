# 成长系统

> 文件：`src/systems/LevelSystem.js`, `SkillTreeSystem.js`, `QuestSystem.js`, `src/data/quests.js`

## 等级系统 (LevelSystem)

### 经验公式
```js
expToNext = Math.floor(80 * Math.pow(1.15, level - 1))
```

### 升级奖励
| 奖励 | 数值 |
|------|------|
| 属性点 | +3 / 级 |
| 技能点 | +1 / 3 级 |
| maxHp flatBonus | +(level-1) × 5 |

### 关键方法
| 方法 | 作用 |
|------|------|
| `addXP(amount)` | 加经验，自动升级 |
| `spendStatPoint(statName)` | 消耗属性点提升基础属性 |
| `getSkillPoints()` | 获取可用技能点数 |
| `toJSON() / fromJSON()` | 序列化 |

### 属性点分配
- 在 PanelScene 角色标签页中操作
- 每点 +1 对应基础属性（CON/STR/INT/AGI/PER/LCK）
- 立即生效，通过 Stats 引擎重算所有派生值

## 天赋树系统 (SkillTreeSystem)

### 当前状态
- 基础框架已搭建
- 在 PanelScene 中显示为技能卡片（非传统树形）
- 技能升级通过 SkillEngine.upgradeSkill() 实现

### 数据结构
```js
{
  unlockedNodes: ['charge', 'whirlwind'],
  nodePoints: { charge: 2, whirlwind: 1 }
}
```

## 任务系统 (QuestSystem)

### 任务状态流
```
inactive → active → completed
```

### 目标类型
| 类型 | 触发事件 | 示例 |
|------|----------|------|
| kill | enemyDeath | 击杀 5 只史莱姆 |
| collect | keysChanged | 收集 3 把钥匙 |
| interact | playerInteract | 与 NPC 对话 |
| artifact | artifactCollected | 获取神器 |

### 任务数据 (quests.js)
```js
{
  id: 'kill_slimes',
  name: '消灭史莱姆',
  description: '消灭 5 只史莱姆',
  objectives: [
    { type: 'kill', target: 'slime', required: 5 }
  ],
  rewards: { xp: 100, gold: 50 }
}
```

### 关键方法
| 方法 | 作用 |
|------|------|
| `activateQuest(questId)` | 激活任务，开始追踪 |
| `updateProgress(type, target, amount)` | 更新目标进度 |
| `checkCompletion(questId)` | 检查是否完成 |
| `toJSON() / fromJSON()` | 序列化 |

### UI 显示
- UIScene 右上角显示当前活跃任务及进度
- 完成时弹出通知
