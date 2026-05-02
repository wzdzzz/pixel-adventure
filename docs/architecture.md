# 像素远征 — 架构总览

> 最后更新：2026-05-03（装备 Phase 3：套装 + 神圣洗练 + 神器配方）

## 技术栈

| 项目 | 版本 |
|------|------|
| 引擎 | Phaser 3.90.0 (Arcade Physics) |
| 构建 | Vite 5.4.0 |
| 语言 | ES6+ Modules (vanilla JS, 无 TypeScript) |
| 美术 | 代码生成像素占位图 (AssetManager) |
| 存储 | localStorage |

## 项目结构

```
src/
├── main.js                     # 入口，Phaser Game 实例化
├── config/gameConfig.js        # 画布 1920×1080、物理参数、全局常量
├── assets/AssetManager.js      # 纹理生成、角色帧配置、动画定义
├── entities/
│   ├── Actor.js                # 基类：HP/体力/怒气、I-Frames、Stats、StatusEffects
│   ├── Player.js               # 玩家：状态机、输入、技能、瞄准、蓄力
│   ├── Enemy.js                # 敌人：技能驱动 AI、巡逻、战斗状态
│   ├── EnemyProjectile.js      # 敌人弹道实体（远程攻击）
│   ├── Item.js                 # 可拾取道具
│   └── NPC.js                  # NPC：对话、任务标记
├── systems/
│   ├── Stats.js                # 属性引擎：6 基础 → 14 派生，缓存
│   ├── SkillEngine.js          # 玩家技能：冷却、资源、阶段
│   ├── EnemySkillSystem.js     # 敌人技能：冷却 + AI 选技能 + 4 种 type 执行
│   ├── StatusEffectSystem.js   # Buff/Debuff/DoT：应用、tick、修饰符
│   ├── InventorySystem.js      # 背包：32 格、堆叠、排序
│   ├── EquipmentSystem.js      # 装备：8 槽位、等级/职业限制 + 套装合并
│   ├── EquipmentGenerator.js   # 装备实例生成：rarity/affixes/sockets
│   ├── EnhanceSystem.js        # 强化：+0~+15 + 材料消耗
│   ├── ReforgeSystem.js        # 洗练：词条重 roll + 神圣洗练 + 5 次保底
│   ├── GemSystem.js            # 宝石：镶嵌/拆卸 + 3 同合成
│   ├── CraftingSystem.js       # 装备制作：配方表 → EquipmentGenerator
│   ├── TriggerSystem.js        # 触发型词条：onHit/onKill/onSkillCast/onCrit
│   ├── SetSystem.js            # 套装系统：2/4/6 件触发效果
│   ├── LootEngine.js           # 掉落：加权随机、品质缩放
│   ├── LevelSystem.js          # 等级：经验、升级、属性/技能点
│   ├── SkillTreeSystem.js      # 天赋树
│   ├── QuestSystem.js          # 任务追踪
│   ├── SaveSystem.js           # 3 槽位存档 + 老存档迁移（兼容 sockets/reforgePity）
│   ├── FloatingTextManager.js  # 飘字伤害/治疗
│   ├── UIManager.js            # 对话窗口
│   └── WarFog.js               # 战争迷雾（暂未启用）
├── scenes/
│   ├── BootScene.js            # 资源预加载、动画注册
│   ├── MainMenuScene.js        # 主菜单 + 角色选择
│   ├── SaveSelectScene.js      # 3 槽位存档选择/保存
│   ├── MainGameScene.js        # 主场景：关卡、碰撞、AI、事件路由、ESC 菜单
│   ├── UIScene.js              # HUD：HP/体力/怒气、技能栏、buff 栏、tooltip
│   ├── PanelScene.js           # 面板：角色/背包/技能/任务（4 标签）
│   ├── GameOverScene.js        # 死亡画面
│   └── VictoryScene.js         # 胜利画面
├── managers/
│   ├── LevelBuilder.js         # 关卡构建：地图、敌人、NPC、宝箱
│   └── InteractionHandler.js   # 战斗/交互处理（mixin 到 MainGameScene）
├── ui/
│   ├── Tooltip.js              # 通用 hover 提示工具（500ms 延迟）
│   └── panels/                 # 4 个面板模块（mixin 到 PanelScene）
│       ├── CharacterPanel.js
│       ├── InventoryPanel.js
│       ├── SkillTreePanel.js
│       └── QuestLogPanel.js
└── data/                       # 纯数据（无逻辑依赖）
    ├── classConfig.js          # 3 职业基础属性 + primaryAttackStat
    ├── warriorSkills.js        # 战士技能 + 状态效果模板
    ├── archerSkills.js         # 弓箭手技能 + 状态效果
    ├── mageSkills.js           # 法师技能 + 状态效果
    ├── statusEffects.js        # 三表合并 + emoji 图标 + getEffectTemplate
    ├── enemySkills.js          # 4 种敌人技能 type 定义
    ├── enemyConfig.js          # 怪物 → 技能列表/isBoss/aggroDelay
    ├── levels.js               # 关卡地图 + 敌人/NPC/道具
    ├── lootTables.js           # 掉落表 + 品质倍率（含 mythic）
    ├── items.json              # 装备模板（含 setId）/消耗品/材料/宝石
    ├── affixes.js              # 38+ 词条池（含 _trigger 触发型）
    ├── gems.js                 # 4 色 × 10 级宝石 + makeGemInstance
    ├── recipes.js              # 装备制作配方（含 4 mythic 神器）
    ├── sets.js                 # 4 套装定义（2/4/6 件触发）
    ├── materials.js            # 材料元数据
    └── quests.js               # 任务定义
```

## 依赖架构

```
Data 层（纯数据，无 import）
  ├── classConfig, warriorSkills, archerSkills, mageSkills, statusEffects
  ├── enemySkills, enemyConfig, items.json, levels, lootTables, quests
  │
Systems 层（导入 Data）
  ├── Stats ← 无依赖
  ├── LevelSystem ← 无依赖
  ├── SkillEngine ← 各职业 skills
  ├── EnemySkillSystem ← enemySkills + EnemyProjectile
  ├── StatusEffectSystem ← 无依赖
  ├── InventorySystem ← items
  ├── LootEngine ← lootTables, items
  ├── EquipmentSystem ← LootEngine
  ├── SkillTreeSystem ← 无依赖
  ├── QuestSystem ← quests
  ├── SaveSystem ← 无依赖（参数注入）
  ├── FloatingTextManager ← 无依赖
  └── UIManager ← 无依赖
  │
Entities 层（导入 Systems + Data）
  ├── Actor ← Stats, StatusEffectSystem
  ├── Player ← Actor + SkillEngine + classConfig + 各 *Skills
  ├── Enemy ← Actor + EnemySkillSystem + enemyConfig
  ├── EnemyProjectile ← 独立
  ├── Item / NPC ← AssetManager
  │
Scenes 层（顶层编排）
  ├── BootScene
  ├── MainMenuScene ← classConfig
  ├── SaveSelectScene ← SaveSystem
  ├── MainGameScene ← 所有系统 + LevelBuilder/InteractionHandler mixin
  ├── UIScene ← Tooltip
  ├── PanelScene ← 4 个 panel mixin + Tooltip
  └── GameOverScene / VictoryScene
```

**关键原则**：依赖只向上流动，无循环依赖。

## 事件总线

系统间通过 Phaser 事件解耦：

| 事件 | 触发方 | 监听方 | 数据 |
|------|--------|--------|------|
| `playerHpChanged` | Player | UIScene | hp, maxHp |
| `playerResourceChanged` | Player | UIScene | stamina, maxStamina, rage, maxRage |
| `actorDamaged` | Actor.takeDamage / takeTickDamage | MainGameScene | actor, damage |
| `actorHealed` | Actor.heal | MainGameScene | actor, amount |
| `enemyHitboxSpawned` | EnemySkillSystem | MainGameScene | hitbox, lifetime |
| `enemyProjectileSpawned` | EnemySkillSystem | MainGameScene | projectile |
| `enemyDeath` | Enemy.die | MainGameScene → QuestSystem, LootEngine | enemy |
| `enemyDropLoot` | Enemy.die | MainGameScene | enemyId, x, y |
| `equipmentChanged` | EquipmentSystem | PanelScene | slot, item, prev |
| `inventoryChanged` | InventorySystem | PanelScene | - |
| `showMessage` | EquipmentSystem 等 | MainGameScene + PanelScene | text, color |
| `skillSlotsChanged` | Player.setSkillSlot | UIScene + MainGame（自动存档） | skillSlots |
| `questActivated/Progress/Completed` | QuestSystem | UIScene | quest |
| `screenShake` | 多处 | MainGameScene | intensity, duration |
| `playerDeath` | Player | MainGameScene | - |
| `levelUp` | LevelSystem | UIScene, MainGame | level |
| `xpChanged` | LevelSystem | UIScene | xp, xpRequired |

## 模块文档索引

| 模块 | 文档 | 描述 |
|------|------|------|
| 实体系统 | [entities.md](modules/entities.md) | Actor / Player / Enemy / EnemyProjectile / Item / NPC |
| 玩家技能 | [skills.md](modules/skills.md) | SkillEngine + 5 种 effect type + 蓄力/扇形/瞄准 |
| 敌人 AI | [enemies-ai.md](modules/enemies-ai.md) | 战斗状态、4 种敌人技能、巡逻、boss |
| 属性与战斗 | [stats-combat.md](modules/stats-combat.md) | 6 基础 → 14 派生、伤害公式、修饰符 |
| 背包与装备 | [inventory-equipment.md](modules/inventory-equipment.md) | 背包、装备槽、等级/职业限制、品质 |
| 成长系统 | [progression.md](modules/progression.md) | 经验/等级、属性点分配、天赋、任务 |
| 场景与 UI | [scenes-ui.md](modules/scenes-ui.md) | 场景生命周期、HUD、面板、tooltip |
| 战斗反馈 | [combat-feedback.md](modules/combat-feedback.md) | 飘字、头顶血条、buff 栏、AOE 视觉 |
| 存档系统 | [save-system.md](modules/save-system.md) | 3 槽位、元数据、加载顺序、迁移 |
| 数据格式 | [data-formats.md](modules/data-formats.md) | items / levels / 技能 / 状态效果格式 |

## 扩展指南

### 添加新职业
1. `classConfig.js` 添加条目（含 `primaryAttackStat`、`baseStats`、`levelUpBonus`）
2. 创建 `src/data/<class>Skills.js`（参考 `warriorSkills.js`），含 `SKILLS` / `SKILL_SLOTS` / `EFFECTS` / `getSkillAtLevel` / `getSkillDescription`
3. `Player.js` 的 `SKILL_MODULES` map 添加新模块
4. `AssetManager.js` 添加角色纹理帧（如需新美术）
5. `data/statusEffects.js` 把新 EFFECTS 合并到 STATUS_EFFECTS

### 添加新玩家技能
1. 在对应职业 `*Skills.js` 添加技能定义
2. `SKILL_SLOTS` 中分配键位（如需默认绑定）
3. `getSkillAtLevel()` 加缩放分支（按 `effect.type`）
4. `Player.onSkillActive()` 派发到对应 `startXxx()` 方法
5. `InteractionHandler.handleSkillHit()` 中按 type 加伤害逻辑（已有的 type 自动复用）

### 添加新敌人技能 type
1. `enemySkills.js` 增加配置 + 新 type（如 `summon`）
2. `EnemySkillSystem._executeXxx()` 加执行函数
3. `executeTelegraph` 按需添加视觉指示

### 添加新敌人
1. `AssetManager.CHARACTERS` 添加帧配置
2. `enemyConfig.js` 配置技能列表 + `isBoss` + `aggroDelay`
3. `levels.js` 关卡数据中放置 `{ type: 'xxx', count: N }`

### 添加新状态效果
1. 在对应职业 `*Skills.js` 的 `EFFECTS` 添加（dot/buff/debuff）
2. `statusEffects.js` 的 `EFFECT_ICONS` 加 emoji
3. 技能 `applyEffects` 数组引用 effectId — 自动绑 onTick（DoT）
