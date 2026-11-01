# 像素冒险 - Pixel Adventure 完整开发文档

> 最后更新：2026-05-01
> 技术栈：Phaser 3.80.1 + Vite 5.4.0
> 启动命令：`npm run dev`（端口 3000）

---

## 一、项目结构

```
pixel-adventure/
├── index.html                  # 入口页面
├── package.json                # 依赖配置
├── vite.config.js              # Vite 配置（端口 3000）
├── src/
│   ├── main.js                 # 游戏入口，创建 Phaser 实例
│   ├── config/
│   │   └── gameConfig.js       # 核心配置（画布尺寸、物理、地图、默认状态）
│   ├── assets/
│   │   └── AssetManager.js     # 纹理生成器 + 角色动画配置（CHARACTERS）
│   ├── scenes/
│   │   ├── BootScene.js        # 启动场景（加载精灵图、生成纹理、注册动画）
│   │   ├── MainGameScene.js    # 主游戏场景（地图、实体、碰撞、事件、关卡切换）
│   │   ├── UIScene.js          # HUD 场景（HP/MP 条、分数、钥匙、关卡显示）
│   │   ├── GameOverScene.js    # 死亡场景
│   │   └── VictoryScene.js     # 胜利场景
│   ├── entities/
│   │   ├── Actor.js            # 实体基类（Stats属性、HP/MP、受伤/击退、I-Frames）
│   │   ├── Player.js           # 玩家实体（继承 Actor，FSM 状态机）
│   │   ├── Enemy.js            # 敌人实体（继承 Actor，FSM 状态机）
│   │   ├── Item.js             # 道具实体（拾取系统）
│   │   └── NPC.js              # NPC 实体（状态化对话）
│   ├── systems/
│   │   ├── Stats.js            # 属性引擎（CON/STR/INT/AGI → 二级属性）
│   │   ├── InventorySystem.js  # 背包系统（最大 20 格）
│   │   ├── SaveSystem.js       # 存档系统（localStorage）
│   │   ├── UIManager.js        # 对话框管理（打字机效果、分页翻页）
│   │   └── WarFog.js           # 战争迷雾（RenderTexture 遮罩，当前已禁用）
│   └── data/
│       ├── items.json          # 道具/敌人/NPC 配置数据
│       └── levels.js           # 关卡数据（地图生成器、敌人配置、传送门）
├── public/
│   └── sprites/                # 精灵图资源
│       ├── *.png               # 道具/场景精灵（coin, potion, chest 等）
│       └── characters/         # 角色帧动画图
│           ├── hero/           # 英雄（idle, walk, attack, hurt, die）
│           ├── slime/          # 史莱姆
│           ├── skeleton/       # 骷髅兵
│           ├── goblin/         # 哥布林
│           ├── spider/         # 蜘蛛
│           ├── bat/            # 蝙蝠
│           ├── orc_warrior/    # 兽人战士
│           ├── fire_mage/      # 火焰法师
│           ├── giant_skeleton/ # 巨型骷髅
│           └── skeleton_king/  # 骷髅王（Boss）
```

---

## 二、游戏核心配置（gameConfig.js）

| 配置项 | 值 | 说明 |
|--------|-----|------|
| 画布尺寸 | 800 x 600 | 固定分辨率 |
| 瓦片大小 | 32px | 地图网格单元 |
| 地图尺寸 | 50 x 40 瓦片 | 1600 x 1280 像素 |
| 物理引擎 | Arcade | 无重力（top-down） |
| 玩家速度 | 200（由 Stats 计算） | agi*20+40 |
| 玩家阻力 | 800 | 松键后减速 |
| 敌人速度 | 80（配置基准） | 实际由 Stats 推导 |
| 渲染模式 | pixelArt: true, roundPixels: true | 像素风，禁用抗锯齿 |
| 缩放模式 | Scale.FIT + CENTER_BOTH | 自适应窗口居中 |

### 默认游戏状态（DEFAULT_STATE）

```javascript
{
  hp: 100, maxHp: 100, score: 0,
  inventory: [], keysCollected: 0,
  hasArtifact: false, currentLevel: 0
}
```

---

## 三、属性系统（systems/Stats.js）

### 基础四维属性

| 属性 | 缩写 | 默认值 | 作用 |
|------|------|--------|------|
| 体质 | CON | 10 | +10 MaxHP, +0.5/s HP回复, +0.01 韧性(减击退) |
| 力量 | STR | 8 | +2 物理攻击, +0.1 暴击伤害倍率 |
| 智力 | INT | 5 | +10 MaxMP, +1 法术强度 |
| 敏捷 | AGI | 8 | +1% 攻击速度, +20 移动速度(基础+40) |

### 二级属性推导公式

```javascript
maxHp       = con * 10         + flatBonuses.maxHp
maxMp       = int * 10         + flatBonuses.maxMp
attack      = str * 2          + flatBonuses.attack
spellPower  = int * 1          + flatBonuses.spellPower
moveSpeed   = agi * 20 + 40    + flatBonuses.moveSpeed
attackSpeed = 1.0 + agi * 0.01 + flatBonuses.attackSpeed
hpRegen     = con * 0.5        + flatBonuses.hpRegen
critDmg     = 1.5 + str * 0.1  + flatBonuses.critDmg
tenacity    = min(0.5, con * 0.01 + flatBonuses.tenacity)
defense     = flatBonuses.defense
```

### 加成层

- **base**：角色基础属性（升级时 +1 全属性）
- **bonuses**：装备/buff 的基础属性加成
- **flatBonuses**：二级属性直接加成（如装备直接 +attack）
- 内置缓存机制，属性变更时自动失效重算

---

## 四、Actor 基类（entities/Actor.js）

Player 和 Enemy 的共享基类，提供：

| 功能 | 说明 |
|------|------|
| Stats 集成 | 构造时创建 Stats 实例，驱动所有属性 |
| HP/MP 管理 | 基于 Stats 推导的 maxHp/maxMp |
| 受伤流程 | 防御减伤(min 1) → I-Frames → 击退(韧性减免) → 红闪 → 死亡检查 |
| I-Frames | 默认 200ms，受伤后无敌 |
| HP 回复 | 每秒回复 hpRegen 点（基于 CON） |
| 击退 | 力 200，方向为攻击者→目标，受韧性减免 |
| 受伤闪烁 | 红色 tint 闪烁 6 次（70ms 间隔），420ms 后清除 |
| 角色动画 | playAnim() 根据 characterType 播放帧动画 |
| 碰撞体 | 显示宽度 85%、高度 55%，底部对齐 |

---

## 五、玩家系统（entities/Player.js）

### 继承关系

```
Actor(con=10, str=8, int=5, agi=8, characterType='hero')
  └── Player
```

### FSM 状态机

```
IDLE ←→ WALK
  ↓       ↓
  ATTACK_STARTUP → ATTACK_ACTIVE → ATTACK_RECOVERY → IDLE
  ↓
  HURT → IDLE（200ms 后可操作）
  ↓
  DEAD
```

| 状态 | 持续时间 | 说明 |
|------|----------|------|
| IDLE | - | 静止，播放 idle 动画 |
| WALK | - | 移动中，播放 walk/walk_up 动画 |
| ATTACK_STARTUP | 100ms | 攻击前摇，速度归零 |
| ATTACK_ACTIVE | 100ms | 活跃帧，Hitbox 启用 |
| ATTACK_RECOVERY | 150ms | 后摇，速度归零 |
| HURT | 200ms 硬直 | 受击，I-Frames 800ms |
| DEAD | - | 死亡，不可操作 |

### 操作方式

| 按键 | 功能 |
|------|------|
| WASD / 方向键 | 移动（8 方向） |
| 鼠标左键 | 攻击（角色朝面朝方向攻击） |
| E | 与 NPC/告示牌/宝箱/传送门交互，翻页/关闭对话框 |
| R | 重启（仅 GameOver/Victory 场景） |

### 攻击系统

- **输入**：鼠标左键，在 DEAD 和攻击进行中时无效
- **朝向**：左右翻转（facing: 1/-1），由最近一次水平移动方向决定
- **Hitbox**：固定 40x36 像素，偏移 22px（facing 方向），每次攻击只命中一次
- **无剑/斩击精灵**：攻击通过 attackHitbox 矩形判定

### 受击机制

- **伤害检查**：`isInvulnerable || state === DEAD || state === HURT` 时免疫
- **无击退**：Player 覆写 `applyKnockback()` 为空函数
- **硬直**：200ms 后恢复 IDLE
- **无敌帧**：800ms，期间不接受任何伤害
- **视觉反馈**：红/无色 tint 闪烁（继承自 Actor）
- **屏幕效果**：screenShake 3px/80ms

### 死亡动画

播放 die 动画，红色 tint，alpha 淡出 + 缩放 2x，1000ms 后触发 playerDeath 事件。

---

## 六、敌人系统（entities/Enemy.js）

### 继承关系

```
Actor(stats 从 config 推导或使用显式 stats, characterType=config.id)
  └── Enemy
```

### FSM 状态机

```
PATROL ↔ CHASE → ATTACK_STARTUP → ATTACK_ACTIVE → CHASE
                    ↓
                  HURT → CHASE（600ms 后恢复，或 DEAD）
```

| 状态 | 说明 |
|------|------|
| PATROL | 在 A/B 两点间巡逻，到达后等待 500ms |
| CHASE | 追击玩家，速度 x1.2 |
| ATTACK_STARTUP | 300ms 前摇，变橙色警告 |
| ATTACK_ACTIVE | 100ms 后发出 enemyAttack 事件 |
| HURT | 600ms 硬直 + I-Frames 600ms |

### 敌人种类（9 种）

| 敌人 | HP | 伤害 | 速度 | 巡逻 | 检测 | 属性(CON/STR/INT/AGI) | 显示尺寸 |
|------|-----|------|------|------|------|-----------------------|----------|
| 史莱姆 slime | 30 | 10 | 60 | 120 | 150 | 3/5/1/1 | 40x34 |
| 骷髅兵 skeleton | 50 | 14 | 50 | 100 | 180 | 5/7/2/1 | 42x48 |
| 哥布林 goblin | 35 | 12 | 70 | 100 | 160 | 3/6/1/3 | 46x44 |
| 蜘蛛 spider | 25 | 8 | 80 | 140 | 170 | 2/4/1/4 | 44x36 |
| 蝙蝠 bat | 20 | 6 | 90 | 160 | 200 | 2/3/1/5 | 44x34 |
| 兽人战士 orc_warrior | 70 | 18 | 45 | 80 | 160 | 7/9/1/1 | 50x52 |
| 火焰法师 fire_mage | 45 | 16 | 45 | 100 | 200 | 4/3/8/2 | 48x50 |
| 巨型骷髅 giant_skeleton | 100 | 22 | 35 | 80 | 180 | 10/11/2/1 | 56x70 |
| 骷髅王 skeleton_king | 150 | 25 | 30 | 60 | 220 | 15/13/5/1 | 64x74 |

> 注：HP/伤害/速度为配置原始值，实际战斗伤害由 Stats.getDerived().attack 计算（str*2）。
> 史莱姆有随机颜色变体（绿/蓝/红 tint）。

### 掉落

- 50% 金币
- 20% 药水
- 30% 无掉落

### 其他

- 脱战范围 = 检测范围 × 2
- 攻击距离 36px，攻击冷却 1500ms
- 受击后攻击冷却重置为 800ms
- 敌人间有碰撞（防止重叠堆叠）
- 敌人被墙、障碍物、装饰物（树/石头/栅栏）、可破坏物阻挡

---

## 七、道具系统（entities/Item.js）

### 道具属性

```javascript
{
  id: string,          // 唯一标识（如 "L0_coin_3"）
  type: string,        // 类型：HEAL / KEY / COIN / ARTIFACT
  value: number,       // 数值（金币分数 / 治疗量）
  name: string,        // 显示名
  description: string, // 描述
  onCollect: Function  // 拾取回调
}
```

### 道具列表

| 道具 | 类型 | 效果 | 碰撞体 |
|------|------|------|--------|
| 金币 | currency | +10 分 | 16x16 |
| 钥匙 | key | +1 钥匙计数 | 16x16 |
| 药水 | consumable | +25 HP | 16x16 |
| 生命之心 | consumable | +50 HP | 16x16 |
| 远古神器 | quest | 胜利关键物品 | 16x16 |

### 动画

- **悬浮**：上下浮动 8px，1000ms 循环
- **发光**：神器和钥匙有 alpha 闪烁（0.7~1.0）
- **拾取**：向上飞出 30px + 淡出 + 缩放到 0，300ms，Back.easeIn 缓动

---

## 八、NPC 系统（entities/NPC.js）

### 状态

```javascript
NPCState = { IDLE, READY, TALKING }
```

- **IDLE**：无指示器
- **READY**：头顶黄色 `!`（背包有钥匙时触发）
- **TALKING**：头顶 `...`

### 对话流程

1. 玩家接近 NPC → overlap 触发 → `setInteractTarget()`
2. 按 E → `playerInteract` 事件 → `handleNPCDialogue()`
3. UIManager 弹出对话框，全部对话作为分页传入
4. 打字机效果逐字显示，按 E 可跳过动画直接显示完整文本
5. 文字显示完后，按 E 翻到下一页或关闭（最后一页）
6. `dialoguing` 全锁防止重复触发
7. 远离 NPC（>100px）→ 自动关闭对话框

### 告示牌

告示牌是特殊的静态精灵，直接挂载 `npcInstance` 对象，包含 `name`、`getNextDialogue()`、`dialogues`、`setTalking()` 方法。显示尺寸 28x44，origin (0.5, 0.7)。

---

## 九、UIManager（systems/UIManager.js）

### 对话框窗口

- 半透明黑色背景 (0x000000, 0.92) + 绿色边框
- 居中显示在屏幕底部（y=480），宽 600、高 120
- 深度 100，不受相机滚动影响（scrollFactor=0）
- Enter 动画：缩放 0.8→1 + alpha 0→1，200ms，Back.easeOut
- Exit 动画：缩放 1→0.8 + alpha 1→0，150ms，Back.easeIn

### 分页系统

- 对话文本支持数组（多页）
- 显示 `[E] 下一页` 或 `[E] 关闭`（最后一页）
- 打字机未完成时按 E 跳过动画

### 打字机效果

每 30ms 显示一个字符，显示完成后触发回调。

---

## 十、关卡系统（data/levels.js）

### 瓦片类型枚举

```javascript
const TILE = {
  EMPTY: 0,        // 空地（可行走）
  WALL: 1,         // 墙壁（碰撞体，不可穿越）
  OBSTACLE: 2,     // 障碍物（碰撞体）
  END: 3,          // 终点（胜利触发区，仅第二关）
  TREE: 4,         // 阔叶树（碰撞体）
  TREE_PINE: 5,    // 松树（碰撞体）
  GRASS: 6,        // 矮草（纯装饰）
  GRASS_TALL: 7,   // 高草（静态物理体，无碰撞逻辑）
  WATER: 8,        // 水池（纯装饰）
  STONE: 9,        // 石头（碰撞体）
  FLOWER: 10,      // 花朵（纯装饰）
  MUSHROOM: 11,    // 蘑菇（纯装饰）
  SIGN: 12,        // 告示牌（可交互）
  BRIDGE: 13,      // 木桥（纯装饰，跨越水池用）
  FENCE: 14,       // 栅栏（碰撞体）
  CAMPFIRE: 15,    // 篝火（纯装饰，有火焰动画）
  CHEST: 16,       // 普通宝箱（按 E 打开）
  CHEST_LOCKED: 17,// 锁定宝箱（需要钥匙）
  PORTAL: 18       // 传送门（收集足够钥匙后可传送）
};
```

### 第一关：迷雾森林

| 配置 | 值 |
|------|-----|
| 地图尺寸 | 50x40 |
| 玩家出生点 | (150, 150) |
| 敌人 | 史莱姆x2, 哥布林x2, 蜘蛛x2, 蝙蝠x2, 骷髅兵x2, 兽人战士x1, 火焰法师x1, 巨型骷髅x1, 骷髅王x1（共14只） |
| 道具 | 金币x12, 钥匙x2, 药水x4, 无神器 |
| NPC | 村长(200,400), 旅行商人(600,200) |
| 告示牌 | 4 个（操作说明、道具说明、战斗提示、探索提示） |
| 宝箱 | 1 普通(水池边) + 1 锁定(水池边) |
| 传送门 | (47*32, 38*32)，需要 2 把钥匙激活 |
| 篝火 | 2 处 |

### 第二关：古老废墟

| 配置 | 值 |
|------|-----|
| 地图尺寸 | 50x40 |
| 玩家出生点 | (800, 1100) |
| 敌人 | 骷髅兵x4, 蝙蝠x3, 兽人战士x2, 史莱姆x3（共12只） |
| 道具 | 金币x15, 钥匙x2, 药水x6, 有神器 |
| NPC | 守卫者(800,700) |
| 告示牌 | 2 个 |
| 宝箱 | 2 普通 + 2 锁定 |
| 终点 | END 区域(25*32, 3*32)，需持有神器触发胜利 |
| 篝火 | 2 处 |

### 关卡切换

1. 收集足够钥匙 → 传送门激活（清除灰色 tint，脉冲发光）
2. 按 E → 确认对话 → 摄像机淡出 500ms
3. 重置钥匙/已拾取道具 → 加载新关卡 → 摄像机淡入 500ms
4. 无更多关卡时进入 VictoryScene

---

## 十一、宝箱系统

| 类型 | 纹理 | 需求 | 奖励 |
|------|------|------|------|
| 普通宝箱 | chest_closed → chest_open | 无 | +20 分 |
| 锁定宝箱 | chest_locked → chest_open | 消耗 1 把钥匙 | +50 分, +25 HP |

### 交互流程

1. 接近宝箱 → 显示标签（"按 E 打开" 或 "需要钥匙"）
2. 按 E → 检查钥匙（锁定宝箱）→ 打开动画（挤压 + 金色粒子） → 发放奖励
3. 距离 > 60px 时标签隐藏

---

## 十二、传送门系统

- **未激活**：灰色 tint，alpha 0.6，持续旋转动画
- **激活**（钥匙足够）：清除 tint，脉冲缩放 1.0↔1.2
- **标签**：显示钥匙需求进度（如 "需要 2 把钥匙 (1/2)"）
- **交互**：按 E → 显示确认对话 → 传送到下一关

---

## 十三、HUD 界面（scenes/UIScene.js）

| 元素 | 位置 | 说明 |
|------|------|------|
| HP 条 | 左上方 | 心形图标 + 150px 绿/黄/红条 + 数值文本 |
| MP 条 | HP 条下方 | 蓝色条 + 数值文本 |
| 分数 | 顶部居中 | 黄色数字，变化时缩放弹跳 |
| 钥匙 | 右上方 | 钥匙图标 + "x数量"，变化时缩放弹跳 |
| 关卡名 | 最右上方 | 紫色文字，切关时缩放弹跳 |
| 操作提示 | 底部居中 | "WASD:移动 \| 左键:攻击 \| E:交互" |

### HP 条颜色

- \> 60%：绿色 (0x00ff00)
- 30%~60%：黄色 (0xffff00)
- ≤ 30%：红色 (0xff0000) + 心形图标弹跳

---

## 十四、战争迷雾（systems/WarFog.js）

> 当前已禁用（代码已注释）

- 使用 `RenderTexture` + `erase` 技术
- 全屏有色遮罩（0x0a0a2e, alpha 0.7）覆盖
- 玩家位置处用径向渐变纹理擦除（半径 180px）
- 呼吸效果：半径以 sin 波微幅脉动（±3%）
- 深度 90，不随摄像机滚动

---

## 十五、相机系统

- **跟随**：`startFollow(player, true, 0.1, 0.1)` Lerp 平滑
- **死区**：80x60 像素，角色在死区内移动时相机不动
- **边界**：锁定在地图范围内
- **屏幕震动**：受击时随机偏移 scrollX/Y
- **关卡切换**：fadeOut/fadeIn 各 500ms

---

## 十六、碰撞与交互

### 碰撞层

| 碰撞对 | 类型 | 说明 |
|--------|------|------|
| Player ↔ Wall/Obstacle | collider | 物理阻挡 |
| Player ↔ Decoration（树/石头/栅栏等） | collider | 有 body 的装饰物阻挡玩家 |
| Player ↔ Breakable | collider | 可破坏物阻挡玩家 |
| Enemy ↔ Wall/Obstacle | collider | 敌人被阻挡 |
| Enemy ↔ Decoration | collider | 敌人被装饰物阻挡 |
| Enemy ↔ Breakable | collider | 敌人被可破坏物阻挡 |
| Enemy ↔ Enemy | collider | 防止敌人重叠堆叠 |
| Player ↔ Item | overlap | 拾取道具 |
| Player ↔ Enemy | collider | 接触伤害（pushable=false） |
| AttackHitbox ↔ Enemy | overlap | 攻击命中 |
| AttackHitbox ↔ Breakable | overlap | 破坏木桶 |
| Player ↔ NPC/Sign | overlap | 交互检测 |
| Player ↔ Chest | overlap | 宝箱交互 |
| Player ↔ Portal | overlap | 传送门交互 |
| Player ↔ TriggerZone | overlap | 区域触发 |
| Player ↔ EndZone | overlap | 胜利检测（第二关） |

### 可破坏物

- 木桶 HP=2，攻击 2 次后破碎
- 破碎时掉落：60% 金币，40% 药水
- 破碎动画：缩放挤压 + 淡出
- 每关随机生成 5 个

### 触发区域

- 每关 3 个随机位置
- 进入后显示系统提示文字（showQuickMessage）
- 每个区域只触发一次

---

## 十七、纹理系统（assets/AssetManager.js）

### 加载方式

纹理分为两类：
1. **精灵图文件**（BootScene.preload 加载）：coin, potion, campfire, sign, stone, artifact, npc, barrel, gem, lantern, rock_candle, heal_icon, chest_closed, chest_open, chest_locked，以及全部角色帧动画
2. **代码生成**（AssetManager.generateAllTextures）：player, enemy, wall, obstacle, ground, heart, particle, attack_effect, sword, sword_slash, tree, tree_pine, grass, grass_tall, water, flower, mushroom, bridge, fence, portal, fog_light

> 精灵图优先：如果文件已加载，代码生成器自动跳过（`gen()` 检查 `textures.exists()`）。

### 角色动画配置（CHARACTERS）

| 角色 | 显示尺寸 | 动画 |
|------|----------|------|
| hero | 36x52 | idle(4帧), walk(3帧), walk_up(4帧), attack(2帧), hurt(1帧), die(2帧) |
| slime | 40x34 | idle(3帧), walk(4帧), hurt(1帧), die(2帧) |
| skeleton | 42x48 | idle(2帧), walk(3帧), attack(2帧), hurt(1帧), die(2帧) |
| goblin | 46x44 | idle(2帧), walk(3帧), attack(2帧), hurt(1帧), die(2帧) |
| spider | 44x36 | idle(2帧), walk(4帧), hurt(1帧), die(2帧) |
| bat | 44x34 | idle(2帧), walk(3帧), hurt(1帧), die(2帧) |
| orc_warrior | 50x52 | idle(2帧), walk(3帧), attack(2帧), hurt(1帧) |
| fire_mage | 48x50 | idle(2帧), walk(3帧), attack(2帧) |
| giant_skeleton | 56x70 | idle(2帧), walk(3帧), attack(2帧), hurt(1帧) |
| skeleton_king | 64x74 | idle(2帧), walk(4帧), attack(2帧) |

---

## 十八、事件系统

游戏使用 Phaser 的事件系统进行模块间通信：

| 事件名 | 参数 | 说明 |
|--------|------|------|
| `playerHpChanged` | hp, maxHp, mp, maxMp | HP/MP 变化 |
| `scoreChanged` | score | 分数变化 |
| `keysChanged` | count | 钥匙数量变化 |
| `artifactCollected` | - | 获得神器 |
| `inventoryUpdated` | items[] | 背包更新 |
| `playerInteract` | target | 玩家交互（NPC/宝箱/传送门） |
| `enemyAttack` | enemy, damage | 敌人攻击 |
| `enemyDeath` | enemy | 敌人死亡（+20 分） |
| `spawnItem` | type, x, y | 生成道具（掉落/木桶破碎） |
| `playerDeath` | - | 玩家死亡 |
| `hitStop` | duration(ms) | 全局物理暂停 |
| `screenShake` | intensity, duration | 屏幕震动 |
| `levelChanged` | name, index | 关卡切换 |

---

## 十九、存档系统（systems/SaveSystem.js）

- 使用 `localStorage`，key 为 `pixel_adventure_save`
- 保存内容：玩家位置/HP、游戏状态（分数/钥匙/神器/已拾取道具）、背包数据
- 自动存档：每 30 秒
- 存档版本号：`1.0.0`
- GameOver 时可删除存档重启
- 关卡切换时重置钥匙和已拾取道具，清除保存的玩家位置

---

## 二十、Y 深度排序

动态实体（Player、Enemy、NPC）和部分场景物件按 Y 坐标设置 depth，实现自然的遮挡关系：
- `sprite.setDepth(sprite.y)` — 每帧更新
- 墙/障碍物/树/石头/栅栏/篝火在创建时 `setDepth(wy)`

---

## 二十一、已知问题 & 待优化

1. **音乐/音效**：当前无音频，可添加 BGM 和攻击/拾取音效
2. **战争迷雾已禁用**：WarFog 系统完整但注释关闭，启用可能影响性能
3. **敌人 AI 单一**：所有敌人共用 patrol/chase/attack 逻辑，缺乏差异化行为（如远程攻击、特殊技能）
4. **Stats 实际使用有限**：INT/MP 系统已就绪但尚无法术/技能消耗 MP
5. **告示牌交互**：告示牌是 staticSprite 直接挂 npcInstance，不是 NPC 类实例
6. **背包 UI 缺失**：InventorySystem 有数据管理但无可视化背包界面
7. **掉落物碰撞**：敌人掉落物与已有 item 共用 overlap，但新生成的 item 需手动添加 overlap

---

## 二十二、快速上手指南

```bash
# 安装依赖
npm install

# 启动开发服务器
npm run dev
# → http://localhost:3000

# 构建生产版本
npm run build
```

### 添加新敌人

1. 在 `public/sprites/characters/` 下创建角色帧图片目录
2. 在 `src/assets/AssetManager.js` 的 `CHARACTERS` 中添加动画配置
3. 在 `src/data/items.json` 的 `enemies` 中添加属性配置（含 stats）
4. 在 `src/data/levels.js` 的关卡 `enemies` 数组中添加 `{ type, count }`

### 添加新道具

1. 在 `src/data/items.json` 的 `items` 中添加配置
2. 在 `MainGameScene.createItems()` 中添加生成逻辑和 `onCollect` 回调
3. 可选：在 `public/sprites/` 下添加精灵图

### 添加新 NPC

1. 在 `src/data/levels.js` 的关卡 `npcs` 数组中添加对话数据
2. NPC 类自动创建实例，支持多页对话

### 添加新关卡

1. 在 `src/data/levels.js` 中创建 `generateLevelNMap()` 地图生成函数
2. 在 `levelData` 数组末尾添加关卡配置对象
3. 配置 `enemies`、`items`、`npcs`、`signs`、`portalRequiredKeys`
4. 上一关传送门自动链接到新关卡

### 修改地图

编辑 `src/data/levels.js` 中对应关卡的 `generateMap()` 函数，使用 TILE 枚举设置瓦片。
