# 存档系统

> 文件：`src/systems/SaveSystem.js`、`src/scenes/SaveSelectScene.js`、`src/scenes/MainGameScene.js`

## 多槽位存档

- 3 个槽位，localStorage key 形如 `pixel_adventure_save_<slotId>`（slotId ∈ 1, 2, 3）
- JSON 序列化
- **当前活跃槽**：registry `activeSaveSlot`（默认 1），auto-save 写入此槽
- 自动存档触发：
  - 30 秒一次（`time.addEvent`）
  - 技能槽位变化（`skillSlotsChanged` 事件）

## 老存档迁移

`SaveSystem.listAllSaves()` 内部调 `migrateOldSave()`：
- 检测旧 key `pixel_adventure_save`
- 若槽 1 还为空 → 写入槽 1
- 删除旧 key

## 存档数据结构

```json
{
  "timestamp": 1714900000000,
  "version": "2.2.0",
  "slotId": 1,
  "meta": {
    "classType": "warrior",
    "gender": "male",
    "level": 5,
    "xp": 120,
    "score": 1500,
    "currentLevel": 0,
    "levelName": "第一关 - 迷雾森林"
  },
  "player": {
    "position": { "x": 400, "y": 300 },
    "hp": 85, "maxHp": 100,
    "stamina": 120, "mana": 0, "rage": 30,
    "classType": "warrior",
    "gender": "male",
    "stats": { "base": { "con": 12, "str": 10, ... } },
    "statusEffects": [...],
    "skillSlots": ["charge", "whirlwind", "warCry", "execute"]
  },
  "gameState": {
    "score": 1500,
    "keysCollected": 2,
    "hasArtifact": false,
    "collectedItems": ["chest_001"],
    "currentLevel": 0
  },
  "inventory": [...],
  "levelSystem": { "level": 5, "xp": 120, "statPoints": 0, "skillPoints": 1 },
  "equipment": { "slots": { "weapon": {...}, ... } },
  "skillTree": {...},
  "skillEngine": { "cooldowns": {...}, "skillLevels": {...} },
  "quests": {...}
}
```

`meta` 字段独立于 `player/gameState`，专供 SaveSelectScene 卡片预览。

## API

| 方法 | 作用 |
|------|------|
| `SaveSystem.save(scene, slotId?)` | 保存到指定槽（默认活跃槽） |
| `SaveSystem.load(scene, slotId?)` | 加载指定槽 |
| `SaveSystem.hasSave(slotId?)` | 检查（无参时检查任意槽） |
| `SaveSystem.deleteSave(slotId)` | 删除指定槽 |
| `SaveSystem.getSaveInfo(slotId)` | 取槽预览信息（兜底兼容老存档） |
| `SaveSystem.listAllSaves()` | 返回 3 槽 info 数组（含迁移） |
| `SaveSystem.getActiveSlot/setActiveSlot` | 当前活跃槽（registry） |

## 加载流程（关键修复）

`MainGameScene.create` **必须先读 save 元数据**才能创建对的玩家：

```js
1. 检查 registry.pendingLoadSlot
2. 若有 → SaveSystem.getSaveInfo(slot) → 设：
   - registry.classType = info.classType
   - registry.gender = info.gender
   - gameState.currentLevel = info.currentLevel
   - registry.savedPlayerData 清空（避免复用旧位置/HP）
3. 然后 loadLevel(currentLevel) + createPlayer（用正确的职业）
4. tryLoadSave() → SaveSystem.load(this, slot) 完整恢复其他状态
```

否则会出现：用旧 classType 创建玩家、技能引擎类型与存档 skillSlots 不匹配 → 技能图标全空。

## 加载顺序（`SaveSystem.load`）

按依赖关系恢复：

1. **gameState** — 分数、钥匙、收集物、currentLevel
2. **inventory** — 背包内容
3. **levelSystem** — 等级 + XP；同时 `setFlatBonus('maxHp', (lv-1)*5)`
4. **equipmentSystem** — fromJSON 装备槽 + `_applyBonuses`
5. **skillTreeSystem** — 天赋节点
6. **skillEngine** — 技能等级 + 冷却
7. **questSystem** — 任务进度
8. **player.stats.base** — `setBase` 每个属性 → invalidate
9. **equipmentSystem._applyBonuses 再次** — base 恢复后重算装备加成
10. **statusEffects** — fromJSON
11. **skillSlots** — 写入 + emit `skillSlotsChanged`
12. **mana / rage / hp / stamina** — `Math.min(saved, max)` clamp（HP 必须在装备 maxHp 应用之后）
13. emit `onHpChanged` / `onResourceChanged` 让 UI 同步
14. `savedPlayerData` 设到 registry 备用
15. setActiveSlot(slotId)

## 已知细节

- 技能冷却**会持久化**（旧版本不持久化，已改）
- `collectedItems` 防止重复拾取场景中的道具/宝箱
- `Stats.toJSON` 仅保存 `base`；bonuses/flatBonuses 由装备和等级系统在加载时重算
- 加载后 emit `skillSlotsChanged` 让 UIScene 即使错过事件也能从 `player.skillSlots` 读对的图标

## SaveSelectScene 集成

- 主菜单"加载存档" → `mode: 'load'`
  - 选已存在槽 → 设 `pendingLoadSlot`，启动 `MainGameScene` + `UIScene`
  - 选空槽 → 触发 `onEmpty(slot)` 回主菜单进入新游戏（写入 `pendingNewGameSlot`）
- 游戏内 ESC "保存进度..." → `mode: 'save'`，`returnTo: 'MainGameScene'`
  - 选任意槽 → `SaveSystem.save(gameScene, slot)` + toast 提示
  - 关闭场景时 `gameScene.scene.resume()`

## 删除

每张卡片"✕ 删除" → 二次确认弹窗 → `SaveSystem.deleteSave(slot)`。
