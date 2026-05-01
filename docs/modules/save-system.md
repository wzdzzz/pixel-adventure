# 存档系统

> 文件：`src/systems/SaveSystem.js`

## 存档方式
- localStorage，key = `pixel_adventure_save`
- JSON 序列化
- 自动存档：每 30 秒
- 手动存档：F5 键

## 存档数据结构

```json
{
  "timestamp": 1714500000000,
  "version": "2.0.0",
  "player": {
    "position": { "x": 200, "y": 300 },
    "hp": 85,
    "maxHp": 100,
    "stamina": 120,
    "stats": {
      "base": { "con": 12, "str": 10, "int": 5, "agi": 9, "per": 6, "lck": 4 },
      "bonus": { "str": 0.1 },
      "flatBonus": { "maxHp": 25, "attack": 5 }
    }
  },
  "gameState": {
    "score": 1500,
    "keysCollected": 2,
    "hasArtifact": false,
    "collectedItems": ["chest_001", "item_gold_1"],
    "currentLevel": 0
  },
  "inventory": [
    { "itemId": "hp_potion", "count": 3 },
    null,
    { "itemId": "iron_sword", "count": 1 }
  ],
  "levelSystem": {
    "level": 5,
    "xp": 120,
    "statPoints": 2,
    "statAllocations": { "str": 3, "con": 2 }
  },
  "equipment": {
    "weapon": { "itemId": "iron_sword", "rarity": "uncommon" },
    "armor": null
  },
  "skillTree": {
    "unlockedNodes": ["charge"],
    "nodePoints": {}
  },
  "skillEngine": {
    "skillLevels": { "charge": 3, "whirlwind": 2 },
    "cooldowns": {}
  },
  "quests": {
    "active": ["kill_slimes"],
    "completed": ["talk_to_npc"],
    "progress": { "kill_slimes": { "slime": 3 } }
  }
}
```

## 恢复顺序

加载时按以下顺序恢复（有依赖关系）：

1. **gameState** — 基础游戏状态（分数、收集物）
2. **inventory** — 背包内容
3. **levelSystem** — 等级和属性点 → 应用 maxHp 加成
4. **equipment** — 装备 → 应用装备属性加成
5. **skillTree** — 天赋树状态
6. **player.stats.base** — 基础属性（属性点分配后的值）
7. **equipment bonuses** — 重新应用装备加成（在 base 恢复后）
8. **skillEngine** — 技能等级
9. **quests** — 任务进度
10. **player position** — 存入 registry，MainGameScene 读取后设置位置

## API

| 方法 | 作用 |
|------|------|
| `SaveSystem.save(scene)` | 保存当前状态到 localStorage |
| `SaveSystem.load(scene)` | 从 localStorage 恢复状态 |
| `SaveSystem.hasSave()` | 检查是否有存档 |
| `SaveSystem.deleteSave()` | 删除存档 |
| `SaveSystem.getSaveInfo()` | 获取存档摘要（时间戳、分数） |

## 注意事项
- 冷却时间不持久化（加载后所有技能立即可用）
- `collectedItems` 防止重复拾取已收集的道具/宝箱
- Stats 的 bonus/flatBonus 不直接保存，由装备和等级系统在加载时重算
