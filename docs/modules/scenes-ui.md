# 场景与 UI 系统

> 文件：`src/scenes/*.js`, `src/systems/UIManager.js`

## 场景生命周期

```
BootScene (preload资源、注册动画)
  ↓
MainGameScene (主游戏逻辑)
  ├── UIScene (HUD 叠加层, parallel)
  └── PanelScene (面板叠加层, parallel, 默认休眠)
  ↓ (死亡)
GameOverScene
  ↓ (胜利)
VictoryScene
```

### 场景并行运行
- MainGameScene、UIScene、PanelScene 同时活跃
- UIScene 和 PanelScene 通过 `scene.launch()` 启动
- PanelScene 默认 `scene.sleep()`，Tab 键唤醒

## BootScene (105行)

**职责**：资源预加载、纹理生成、动画注册

- 调用 `AssetManager.generateAllTextures()` 生成所有像素纹理
- 注册角色动画帧（idle, walk, walk_up, attack, hurt, die）
- 完成后启动 MainGameScene

## MainGameScene (1400+行)

**职责**：核心游戏编排

### 主要功能
| 功能 | 方法 |
|------|------|
| 关卡加载 | `loadLevel()` — 解析 levels.js 地图数据 |
| 玩家生成 | `createPlayer()` — 初始化 Player + 所有系统 |
| 敌人生成 | `spawnEnemies()` — 按关卡配置生成 |
| 碰撞设置 | `setupCollisions()` — 注册所有 collider/overlap |
| 伤害处理 | `handleEnemyContact/AttackHit/SkillHit()` |
| 掉落处理 | `dropLoot()` — 敌人死亡时调用 LootEngine |
| 道具拾取 | `handleItemPickup()` — 添加到背包 |
| NPC 交互 | `handleNPCProximity()` — 触发对话 |
| 关卡切换 | `switchLevel()` — 传送门/胜利区域 |
| 存档恢复 | 在 create() 中恢复存档数据 |

### 系统实例
MainGameScene 持有所有系统实例：
```js
this.inventory      = new InventorySystem()
this.levelSystem    = new LevelSystem()
this.equipmentSystem = new EquipmentSystem()
this.skillTreeSystem = new SkillTreeSystem()
this.questSystem    = new QuestSystem()
this.uiManager      = new UIManager()
this.warFog         = new WarFog()
```

## UIScene (500+行)

**职责**：HUD 显示层

### HUD 元素（从上到下）
| 元素 | 位置 | 内容 |
|------|------|------|
| HP 条 | 左上 | 红色血条 + 数值 |
| 体力条 | HP 下方 | 黄色条 |
| 怒气条 | 体力下方 | 红色条（满时脉冲） |
| 经验条 | 底部 | 蓝色条 + 等级 |
| 分数 | 右上 | 金币数 |
| 任务追踪 | 右侧 | 当前任务 + 进度 |
| 技能栏 | 底部中央 | 4 个技能槽位 |
| 操作提示 | 底部 | 按键说明 |

### 技能栏
- 4 个 40×40 槽位，间距 6px
- 冷却遮罩：灰色半透明 + 倒计时数字
- 等级标签：右下角显示 Lv
- 自动读取 `player.skillEngine` 状态

### 自适应
- `resize` 事件重新布局
- 分数和任务追踪跟随画布宽度

## PanelScene (1600+行)

**职责**：全屏面板 UI

### 标签页
| 标签 | 内容 |
|------|------|
| 背包 | 32 格网格、道具图标、使用/丢弃 |
| 装备 | 8 槽位、当前装备、属性对比 |
| 角色 | 6 基础属性 + 14 派生属性、属性点分配 |
| 天赋 | 技能卡片、升级按钮、数值预览 |

### 交互
- Tab 键开关
- 打开时暂停游戏（`this.scene.pause('MainGameScene')`）
- 标签页切换
- 背包格子点击 → 弹出操作菜单
- 装备点击 → 脱下回背包
- 属性 +/- 按钮分配属性点
- 技能升级按钮

## UIManager (204行)

**职责**：对话窗口管理

- 打字机效果（逐字显示）
- 多页对话支持
- NPC 头像和名称显示
- 点击/按键翻页
