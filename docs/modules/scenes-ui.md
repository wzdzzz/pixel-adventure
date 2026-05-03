# 场景与 UI 系统

> 文件：`src/scenes/*.js`、`src/systems/UIManager.js`、`src/ui/Tooltip.js`、`src/ui/panels/*.js`

## 场景生命周期

```
BootScene (preload + 动画注册)
  ↓
MainMenuScene (主菜单 + 角色选择)
  ↓ ──→ SaveSelectScene (mode='load') ──→ 选槽 → MainGameScene
  └── 新建游戏 ──→ 角色选择 → MainGameScene

MainGameScene (主游戏)
  ├── UIScene (HUD 叠加层, 平行运行)
  ├── PanelScene (面板叠加层, 按 Tab/I 唤醒)
  └── SaveSelectScene (mode='save', ESC 菜单)
  │
  │ (死亡) → GameOverScene → MainMenuScene
  │ (胜利) → VictoryScene → MainMenuScene
```

### 画布与缩放
- 固定 1920×1080 (`Phaser.Scale.NONE`)
- `autoCenter: CENTER_BOTH` 浏览器中居中
- 不响应窗口 resize（HUD 大小固定）
- F 键切换浏览器真·全屏

## BootScene

资源预加载、纹理生成（`AssetManager.generateAllTextures`）、动画注册。完成后跳 `MainMenuScene`。

## MainMenuScene

### 阶段 1：主菜单
- 标题 + 星空背景
- 按钮：**加载存档** / **新建游戏** / 退出游戏
- 点"加载存档" → 启动 `SaveSelectScene` mode='load'
- 点"新建游戏" → 进入阶段 2

### 阶段 2：角色选择
- 3 个职业卡片（warrior / archer / mage）
- 性别切换（male/female）
- 确认 → 写入 registry：`classType`、`gender`、`pendingNewGameSlot`（若来自空槽点击）
- 启动 `MainGameScene` + `UIScene`

## SaveSelectScene

### 模式
| mode | 用途 | 入口 |
|------|------|------|
| `load` | 选档加载 | MainMenu "加载存档" |
| `save` | 选槽保存 | 游戏内 ESC "保存进度..." |

### 卡片显示
3 张并排卡片，每张：
- 大职业图标（⚔️🏹🔮）
- 职业名 + 性别（♂/♀）
- 等级 + 关卡 + 分数
- 时间（`toLocaleString`）
- 当前活跃槽位金边 `(当前)`
- 删除按钮 + 二次确认

空槽显示"空 槽 位"，点击根据 mode：
- load → 触发 `onEmpty(slotId)` 回主菜单进入新游戏（pendingNewGameSlot 标记）
- save → 直接保存到该槽

### 关闭
ESC 键或底部"返回"按钮。

## MainGameScene

### 主要功能
| 功能 | 方法 |
|------|------|
| 加载前读 save 元数据 | `create` 开头检查 `pendingLoadSlot` → 设 `classType/gender/currentLevel` |
| 关卡加载 | `loadLevel(idx)` → LevelBuilder mixin |
| 玩家创建 | `createPlayer(level)` |
| 敌人/NPC/道具/木桶/传送门生成 | `LevelBuilder` 系列方法 |
| 碰撞设置 | `setupCollisions` 注册各种 overlap/collider |
| 战斗事件路由 | `setupEvents` 监听各类游戏事件 |
| 敌人技能 hitbox/弹道 注册 | 监听 `enemyHitboxSpawned/enemyProjectileSpawned` 动态注册 overlap |
| 自动存档 | 30 秒一次 + 槽位变化时立即保存 |
| ESC 菜单 | `_showExitConfirm` 弹出 3 选项 |

### 系统实例
```js
this.inventory       = new InventorySystem()
this.uiManager       = new UIManager()
this.floatingText    = new FloatingTextManager()
this.levelSystem     = new LevelSystem()
this.equipmentSystem = new EquipmentSystem()
this.skillTreeSystem = new SkillTreeSystem()
this.questSystem     = new QuestSystem()
```

### Mixin
- `Object.assign(prototype, LevelBuilder)`：关卡构建方法
- `Object.assign(prototype, InteractionHandler)`：碰撞/交互/技能命中处理

### ESC 菜单
3 按钮：
1. **保存进度...** → 启动 `SaveSelectScene` mode='save'
2. **返回主菜单** → 自动保存 + 切到 MainMenu
3. **继续游戏** → 关闭弹窗

## UIScene

### HUD 元素

| 元素 | 位置 | 内容 |
|------|------|------|
| HP 条 | 左上 | 红血条 + ghost 滞后效果 + 等级 |
| 体力条 | HP 下方 | 黄条 |
| 怒气条 | 体力下方 | 红条（满时脉冲） |
| 经验条 | 怒气下方 | 紫条 |
| 分数 | 顶部居中 | 金币数 |
| 钥匙/金币 | 右上 | 数量 |
| 关卡名 | 右上 | 当前关卡 |
| 任务追踪 | 右下 | 当前追踪任务 + 进度（最多 2 条目标） |
| 技能栏 | 底部居中 | 4 槽位（图标 + 冷却倒计时 + 等级 + 按键标签） |
| Buff 栏 | 技能栏正上方 | 最多 8 个 buff 图标 + 倒计时（buff 绿框 / debuff 红框） |
| 操作提示 | 底部 | 按键说明 |

### Tooltip 集成
- 共享 `Tooltip` 实例（500ms hover）
- 技能栏 4 槽位 + buff 栏 8 槽位都挂 tooltip
- 内容动态读 `player.skillEngine.getScaledSkill(id)` 和 `player.statusEffects.getActiveSummary()`

### 事件监听
- `playerHpChanged` / `playerResourceChanged` → 更新 HP/体力/怒气
- `xpChanged` / `levelUp` → 更新经验/等级
- `scoreChanged/keysChanged/goldChanged/levelChanged`
- `questActivated/Progress/Completed` → 任务追踪
- `skillSlotsChanged` → `refreshSkillSlots`（不重建容器，仅更新图标）

### 自适应
- `resize` 事件 → 重新排版（虽然画布固定，备用）
- shutdown 时清理所有 `gameScene.events.off`

## PanelScene

### 4 标签页
| 标签 | 内容 |
|------|------|
| 角色 | 6 基础属性 + 14 派生属性 + 属性点分配 + 已激活套装 |
| 背包 | 32 格、堆叠、操作菜单、双栏对比 tooltip |
| 技能 | 2 列网格卡片、装备槽按钮、升级按钮、滚动 |
| 任务 | 已激活/已完成任务列表 |

### 触发
- Tab / I 键打开
- ESC / 再按 Tab 关闭
- 打开时 `pauseGame()`（physics.pause）

### 双 Tooltip 容器
PanelScene 持有两个 tooltip 容器（`tooltipContainer` + `tooltipContainer2`），用于背包装备悬浮时并排对比：
- **左侧**：当前悬浮装备的详细信息
- **右侧**：已装备同槽位物品 + 属性差值标注（▲/▼）
- 角色面板装备槽悬浮只显示单个 tooltip（无对比）
- `hideTooltip()` 统一隐藏两个容器

### 装备 Tooltip 内容（`formatEquipTooltip`）
- 品质颜色边框 + 名称/等级/强化等级
- 词条列表（含触发型词条描述）
- 宝石孔位及已镶嵌宝石属性值（如 `孔1: 🔴 红宝石 Lv.3 (+9 攻击)`）
- 套装效果展示：所有 2/4/6 件奖励 + ✓/○ 标记已激活/未激活
- 由 `InventoryPanel.js` 导出，`CharacterPanel.js` 复用

### 右键菜单
- 背包：右键装备弹出菜单（使用/装备/强化/洗练/镶嵌/丢弃）
- 角色面板：右键已装备物品弹出菜单（强化/洗练/镶嵌/卸下）
- 浏览器右键菜单通过 `gameConfig.input.mouse.preventDefaultDown/Up` + canvas `oncontextmenu` 禁用
- 使用 `pointer.button === 2` 检测右键（比 `rightButtonDown()` 更可靠）

### Tooltip（通用）
- `hoverTooltip = new Tooltip(this, { delay: 500 })`
- 技能卡片 emoji 图标挂 tooltip 显示完整描述

### 共享 toast
- 监听 `gameScene.events.on('showMessage')` → `_showPanelToast`（顶部，depth 9999）
- 装备等级/职业不符提示在打开背包时仍可见

### Mixin
4 个 panel 模块（CharacterPanel / InventoryPanel / SkillTreePanel / QuestLogPanel）通过 `Object.assign` 混入 PanelScene 原型。

## Tooltip 工具类

```js
const tip = new Tooltip(scene, { delay: 500 });
tip.attach(target, () => ({ title, body }));
```

- 共享一个 panel（bg + title + body 文字）
- pointerover → 启动定时器 → 显示
- pointerout / pointerdown → 取消
- 自动屏幕边缘 clamp，避免溢出

## UIManager

对话窗口管理。
- 打字机效果（逐字显示）
- 多页对话 + 翻页
- NPC 名字标签
- depth 9990（**避开装饰物覆盖**）

## 操作总览（HUD 提示）

```
WASD:移动 | 左键:攻击 | 1-4:技能 | E:交互 | TAB:面板 | F:全屏
```

ESC：游戏内菜单（保存/退主菜单/继续）
