# 像素远征 — 架构总览

> 最后更新：2026-05-01

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
├── main.js                    # 入口，Phaser Game 实例化
├── config/
│   └── gameConfig.js          # 画布尺寸、物理参数、全局常量
├── assets/
│   └── AssetManager.js        # 纹理生成、角色帧配置、动画定义
├── entities/                  # 游戏实体
│   ├── Actor.js               # 基类：HP/体力/怒气、I-Frames、Stats
│   ├── Player.js              # 玩家：状态机、输入、技能、交互
│   ├── Enemy.js               # 敌人：AI（巡逻/追击/攻击）、掉落
│   ├── Item.js                # 可拾取道具
│   └── NPC.js                 # NPC：对话、任务标记
├── systems/                   # 游戏系统
│   ├── Stats.js               # 属性引擎：6基础→14派生，缓存失效机制
│   ├── SkillEngine.js          # 技能执行：冷却、资源检查、阶段管理
│   ├── InventorySystem.js      # 背包：32格、堆叠、排序
│   ├── EquipmentSystem.js      # 装备：8槽位、属性加成
│   ├── LootEngine.js           # 掉落：加权随机、品质缩放
│   ├── LevelSystem.js          # 等级：经验、升级、属性/技能点
│   ├── SkillTreeSystem.js      # 天赋树：被动/主动节点
│   ├── QuestSystem.js          # 任务：追踪、目标进度
│   ├── SaveSystem.js           # 存档：全系统序列化/反序列化
│   ├── UIManager.js            # 对话窗口、打字机效果
│   └── WarFog.js               # 战争迷雾（RenderTexture）
├── scenes/                    # Phaser 场景
│   ├── BootScene.js           # 启动：资源预加载、动画注册
│   ├── MainGameScene.js       # 主场景：关卡加载、碰撞、AI、事件路由
│   ├── UIScene.js             # HUD：血条/体力/怒气、技能栏、任务追踪
│   ├── PanelScene.js          # 面板：背包、装备、角色属性、天赋树
│   ├── GameOverScene.js       # 死亡画面
│   └── VictoryScene.js        # 胜利画面
└── data/                      # 纯数据（无逻辑依赖）
    ├── items.json             # 道具/装备/消耗品定义
    ├── levels.js              # 关卡地图、敌人/NPC/道具配置
    ├── lootTables.js          # 掉落表、品质倍率
    ├── warriorSkills.js       # 战士技能定义 + 等级缩放函数
    └── quests.js              # 任务定义
```

## 依赖架构

```
Data 层（纯数据，无 import）
  ├── items.json, levels.js, lootTables.js, warriorSkills.js, quests.js
  │
Systems 层（导入 Data）
  ├── Stats.js ← 无依赖（纯计算）
  ├── LevelSystem.js ← 无依赖
  ├── SkillTreeSystem.js ← 无依赖
  ├── SkillEngine.js ← warriorSkills.js
  ├── InventorySystem.js ← items.json
  ├── LootEngine.js ← lootTables.js, items.json
  ├── EquipmentSystem.js ← LootEngine
  ├── QuestSystem.js ← quests.js
  └── SaveSystem.js ← 无依赖（通过参数接收系统实例）
  │
Entities 层（导入 Systems + Data）
  ├── Actor.js ← Stats.js, AssetManager.js
  ├── Player.js ← Actor.js, SkillEngine.js, warriorSkills.js
  ├── Enemy.js ← Actor.js, AssetManager.js
  ├── Item.js ← AssetManager.js
  └── NPC.js ← AssetManager.js
  │
Scenes 层（导入 Entities + Systems + Data）= 顶层编排
```

**关键原则：依赖只向上流动，无循环依赖。**

## 事件总线

系统间通过 Phaser 事件解耦，避免直接引用：

| 事件 | 触发方 | 监听方 | 数据 |
|------|--------|--------|------|
| `playerHpChanged` | Player | UIScene | hp, maxHp |
| `playerResourceChanged` | Player | UIScene | stamina, maxStamina, rage, maxRage |
| `enemyDeath` | MainGameScene | QuestSystem, LootEngine | enemy |
| `equipmentChanged` | EquipmentSystem | PanelScene | - |
| `questActivated` | QuestSystem | UIScene | quest |
| `questCompleted` | QuestSystem | UIScene | quest |
| `questProgressUpdated` | QuestSystem | UIScene | - |
| `screenShake` | Player/MainGame | MainGameScene | intensity, duration |
| `playerDeath` | Player | MainGameScene | - |
| `levelUp` | LevelSystem | UIScene, MainGame | level |
| `inventoryChanged` | InventorySystem | PanelScene | - |

## 模块文档索引

| 模块 | 文档 | 描述 |
|------|------|------|
| 实体系统 | [entities.md](modules/entities.md) | Actor/Player/Enemy/Item/NPC 继承与状态机 |
| 属性与战斗 | [stats-combat.md](modules/stats-combat.md) | 6基础属性、14派生属性、双资源、伤害公式 |
| 技能系统 | [skills.md](modules/skills.md) | SkillEngine、技能数据、阶段系统、升级 |
| 背包与装备 | [inventory-equipment.md](modules/inventory-equipment.md) | 背包、装备槽、掉落引擎、品质系统 |
| 成长系统 | [progression.md](modules/progression.md) | 经验/等级、天赋树、任务系统 |
| 场景与UI | [scenes-ui.md](modules/scenes-ui.md) | 场景生命周期、HUD、面板、对话 |
| 存档系统 | [save-system.md](modules/save-system.md) | 序列化格式、版本控制 |
| 数据格式 | [data-formats.md](modules/data-formats.md) | items.json、关卡、掉落表、技能数据 |

## 扩展指南

### 添加新技能
1. 在 `warriorSkills.js` 添加技能定义
2. 在 `SKILL_SLOTS` 中分配按键槽位
3. 在 `Player.js` 的 `onSkillActive/onSkillTick/onSkillRecovery/onSkillComplete` 中添加对应处理
4. 在 `MainGameScene.handleSkillHit()` 中添加伤害逻辑

### 添加新敌人类型
1. 在 `AssetManager.js` CHARACTERS 中添加帧配置
2. 在 `levels.js` 关卡数据中放置
3. Enemy AI 由 `Enemy.js` 状态机统一管理

### 添加新装备
1. 在 `items.json` 的 equipment 类别中添加
2. 在 `lootTables.js` 配置掉落权重
3. EquipmentSystem 自动处理属性加成

### 添加新关卡
1. 在 `levels.js` 添加新地图数据和配置
2. MainGameScene 自动加载（通过 currentLevel 索引）
