# Bug 修复与完善计划

> 创建日期：2026-05-23
> 分支：feature/ui-panel-system

---

## P0 — Bug（影响游戏功能）

### 1. 技能树系统完全脱钩
- **文件**：`src/systems/SkillTreeSystem.js`、`src/entities/Player.js`、`src/systems/Stats.js`
- **问题**：
  - `stat_bonus` 效果解锁后从未写入 Stats
  - `skill_enhance` 效果解锁后 SkillEngine 不感知
  - `passive_unlock` 的 14 个被动完全未实现
  - `skillUnlocked` 事件无监听方
  - stat key 与 Stats.js 不匹配（`critDamage`→`critDmg`、`spellDamage`→`spellPower`、`maxMana`→`maxMp`、`slowDuration` 不存在）
- **修复方案**：
  1. 修正 SkillTreeSystem 中所有 stat key 与 Stats.js 对齐
  2. `unlock()` 成功后，按 effect type 立即应用：
     - `stat_bonus`：调用 `player.stats.addFlatBonus(key, value)` 或 `addBonusPct(key, value)`
     - `skill_enhance`：写入 SkillEngine 可查询的增强表
     - `passive_unlock`：写入 player 可查询的被动 flag 集合
  3. 存档加载时 `fromJSON` 后重放所有已解锁节点的效果
  4. Player 或相关系统监听 `skillUnlocked` 事件（或直接在 unlock 中调用）

### 2. 升级回蓝失效
- **文件**：`src/scenes/MainGameScene.js:1059`
- **问题**：`this.player.mp = this.player.maxMp`，属性名应为 `mana`/`maxMana`
- **修复**：改为 `this.player.mana = this.player.maxMana`

### 3. 等级压制失效
- **文件**：`src/managers/InteractionHandler.js:268`
- **问题**：`this.player.levelSystem` 不存在，应为 `this.levelSystem`
- **修复**：改为 `const playerLevel = this.levelSystem?.level || 1`

### 4. Boss 击败状态永远不显示
- **文件**：`src/scenes/WorldMapScene.js:144`、`src/scenes/MainGameScene.js:902`
- **问题**：写入 key `boss_${entityId}_defeated`，读取 key `boss_${bossType}_${chunkX}_${chunkY}_defeated`
- **修复**：统一 key 格式，以写入端为准或以读取端为准（需确认哪端更合理）

### 5. 套装效果无法触发
- **文件**：`src/data/sets.js`、`src/data/items.json`
- **问题**：多个套装的 pieces 列表引用了 setId 属于其他套装的装备
- **修复**：为每个套装设计独立的装备 pieces，确保 items.json 中 setId 与 sets.js 一一对应

### 6. 跳斩不缩放
- **文件**：`src/data/warriorSkills.js`
- **问题**：`leapStrike` 的 type `leap_slam` 在 `getSkillAtLevel()` 中无对应分支
- **修复**：在 `getSkillAtLevel()` 中添加 `leap_slam` 分支，缩放 damageMultiplier 和 stunDuration

### 7. 神话品质排序错误
- **文件**：`src/systems/InventorySystem.js:127`
- **问题**：`rarityOrder` 缺少 `mythic: 5`
- **修复**：添加 `mythic: 5`

---

## P1 — 功能未接入

### 8. 职业专属词条无效
- **文件**：`src/systems/Stats.js:54-58`、`src/data/affixes.js`、战斗代码
- **问题**：`rageGain/rangedDmg/spellDmg/manaRegen` 被装备写入 bonusPct 但从未被读取
- **修复**：在对应的战斗计算逻辑中消费这些 bonusPct 值

### 9. StatusEffect 存档恢复空实现
- **文件**：`src/systems/StatusEffectSystem.js:190`
- **问题**：`fromJSON()` 方法体为空
- **修复**：实现 fromJSON，至少恢复持续性 buff/debuff（短期效果可忽略）

### 10. allocateStat 半成品
- **文件**：`src/systems/LevelSystem.js:50-54`
- **问题**：接收 `statName` 但不使用，加属性逻辑在 UI 层
- **修复**：将 `player.stats.addBase(statName, 1)` 移入 `allocateStat`，UI 层只调用不处理

### 11. 技能树升级预览错误
- **文件**：`src/ui/panels/SkillTreePanel.js:317-319`
- **问题**：`getScaledSkill(skillId)` 返回当前等级数值，不是下一级
- **修复**：传入 level+1 参数或使用预览方法获取下一级数据

### 12. materials.js 缺少 6 种材料
- **文件**：`src/data/materials.js`
- **问题**：`refining_stone/chaos_essence/soul_crystal/star_fragment/divine_heart/world_core` 无定义
- **修复**：补全这 6 种材料的 MATERIALS 条目和相关表

---

## P2 — 功能缺失 / 内容不足

### 13. 战争迷雾禁用
- 决定是否在开放世界启用，若启用需在 `enterWorld()` 路径中创建实例

### 14. NPC 功能单一
- 目前只有硬编码对话，后续可扩展商店/任务交互

### 15. 任务系统未适配开放世界
- 仅 4 条任务绑定旧关卡制，需设计开放世界任务触发机制

### 16. 数据内容不足
- 敌人 9 种、敌人技能 6 个、配方 10 个，需扩充

### 17. 弓箭手/法师共用战士贴图
- `classConfig.js` 中 TODO 标记，需生成独立贴图

### 18. 任务日志 UI 不完整
- 无滚动、无追踪按钮、不支持 items 类型奖励

### 19. 调试按钮无环境保护
- `UIScene.js:814-852` 生产环境可用，需加 `import.meta.env.DEV` 保护

---

## P3 — 代码卫生

### 20. 空函数 `createKeyDisplay()`/`createGoldDisplay()` 仍被调用
### 21. `MainMenuScene` 死代码 `isStub = false` 分支
### 22. `handleEnemyContact` 空方法每帧调用
### 23. 关卡制遗留代码未清理
### 24. `ItemType` 枚举未使用
### 25. Tooltip destroy 未解绑事件监听

---

## 执行顺序

Phase 1：P0 #2 → #3 → #7 → #6 → #4 → #5 → #1 ✅ 全部完成
Phase 2：P1 #8 → #10 → #12 → #11 → #9 ✅ 全部完成
Phase 3：P2 #18(任务追踪+滚动) → #19(调试按钮保护) ✅ 完成
Phase 4：P3 #20(空函数清理) → #21(死代码移除) → #25(Tooltip解绑) ✅ 完成

未处理（需要较大工作量或设计决策）：
- #13 战争迷雾：需决定是否在开放世界启用
- #14 NPC 功能：需设计商店/任务交互系统
- #15 任务适配开放世界：需设计触发机制
- #16 数据内容扩充：需策划新敌人/技能/配方
- #17 弓箭手/法师贴图：需 AssetManager 生成新帧
- #22 handleEnemyContact：空方法但物理碰撞仍需 collider 注册，开销可忽略
- #23 关卡制遗留代码：保留以备兼容，暂不清理
