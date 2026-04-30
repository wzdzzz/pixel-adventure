# 像素冒险 - Pixel Adventure 完整开发文档

> 最后更新：当前版本
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
│   │   └── gameConfig.js       # 核心配置（画布尺寸、物理、地图数据）
│   ├── assets/
│   │   └── AssetManager.js     # 纹理生成器（代码生成像素图，无外部图片）
│   ├── scenes/
│   │   ├── BootScene.js        # 启动场景（生成纹理 → 进入游戏）
│   │   ├── MainGameScene.js    # 主游戏场景（地图、实体、碰撞、事件）
│   │   ├── UIScene.js          # HUD 场景（血条、分数、钥匙计数）
│   │   ├── GameOverScene.js    # 死亡场景
│   │   └── VictoryScene.js     # 胜利场景
│   ├── entities/
│   │   ├── Player.js           # 玩家实体（FSM 状态机）
│   │   ├── Enemy.js            # 敌人实体（FSM 状态机）
│   │   ├── Item.js             # 道具实体（IDO 系统）
│   │   └── NPC.js              # NPC 实体（状态化对话）
│   ├── systems/
│   │   ├── InventorySystem.js  # 背包系统
│   │   ├── SaveSystem.js       # 存档系统（localStorage）
│   │   ├── UIManager.js        # 对话框管理（打字机效果、动画）
│   │   └── FocusLight.js       # 环境光效果（径向渐变遮罩）
│   └── data/
│       └── items.json          # 道具/敌人/NPC 配置数据
```

---

## 二、游戏核心配置（gameConfig.js）

| 配置项 | 值 | 说明 |
|--------|-----|------|
| 画布尺寸 | 800 x 600 | 固定分辨率 |
| 瓦片大小 | 32px | 地图网格单元 |
| 地图尺寸 | 50 x 40 瓦片 | 1600 x 1280 像素 |
| 物理引擎 | Arcade | 无重力（top-down） |
| 玩家速度 | 200 | |
| 玩家阻力 | 800 | 松键后减速 |
| 敌人速度 | 60~72 | 追击时 x1.2 |
| 渲染模式 | pixelArt: true | 像素风，禁用抗锯齿 |
| 缩放模式 | Scale.FIT | 自适应窗口 |

---

## 三、地图系统（MainGameScene.generateRichMap）

### 瓦片类型枚举

```javascript
const TILE = {
  EMPTY: 0,       // 空地（可行走）
  WALL: 1,        // 墙壁（碰撞体，不可穿越）
  OBSTACLE: 2,    // 障碍物（碰撞体）
  END: 3,         // 终点（胜利触发区）
  TREE: 4,        // 阔叶树（碰撞体，遮挡视野）
  TREE_PINE: 5,   // 松树（碰撞体）
  GRASS: 6,       // 矮草（纯装饰，无碰撞）
  GRASS_TALL: 7,  // 高草（纯装饰）
  WATER: 8,       // 水池（纯装饰，无碰撞）
  STONE: 9,       // 石头（碰撞体）
  FLOWER: 10,     // 花朵（纯装饰）
  MUSHROOM: 11,   // 蘑菇（纯装饰）
  SIGN: 12,       // 告示牌（可交互 NPC）
  BRIDGE: 13,     // 木桥（纯装饰，跨越水池用）
  FENCE: 14,      // 栅栏（碰撞体）
  CAMPFIRE: 15    // 篝火（纯装饰，有火焰动画）
};
```

### 地图生成逻辑

- **围墙**：四周一圈 WALL
- **迷宫墙体**：6 组 L/T 形墙体结构，分散在地图各处
- **水池**：2 片水区域（各 3~5x7 格），中间有木桥可通行
- **装饰物**：树木、草、花、石头、蘑菇随机分布在空地上
- **栅栏**：起点附近和地图角落的围栏装饰
- **篝火**：2 处，带火焰缩放动画
- **终点**：右下角 (38,47) 位置

### 实体随机生成

所有动态实体（敌人、道具、可破坏物、触发区域）使用 `getEmptyTiles()` 扫描地图空地，`pickRandomPositions()` 随机选取位置，排除起点附近 200px。每次游戏体验不同。

---

## 四、玩家系统（Player.js）

### FSM 状态机

```
IDLE ←→ WALK
  ↓       ↓
  ATTACK_STARTUP → ATTACK_ACTIVE → ATTACK_RECOVERY → IDLE
  ↓
  HURT → IDLE（250ms 后可操作，1000ms 无敌帧）
  ↓
  DEAD
```

| 状态 | 持续时间 | 说明 |
|------|----------|------|
| IDLE | - | 静止，等待输入 |
| WALK | - | 移动中 |
| ATTACK_STARTUP | 100ms | 攻击前摇，速度归零 |
| ATTACK_ACTIVE | 100ms | 活跃帧，Hitbox 生成 |
| ATTACK_RECOVERY | 150ms | 后摇，速度归零 |
| HURT | 250ms 硬直 | 受击，可被鼠标左键打断反击 |
| DEAD | - | 死亡，不可操作 |

### 操作方式

| 按键 | 功能 |
|------|------|
| WASD / 方向键 | 移动（8 方向） |
| 鼠标左键 | 攻击（自动转向鼠标方向） |
| E | 与 NPC 交互 / 关闭对话框 |

### 攻击系统

- **输入**：鼠标左键，角色自动朝鼠标世界坐标方向
- **方向计算**：每帧 `updateDirectionToMouse()`，将鼠标屏幕坐标转为世界坐标，计算归一化方向向量
- **剑精灵**：`swordSprite` 跟随玩家位置，攻击时从后向前旋转 200ms
- **斩击特效**：`slashSprite` 在 Hitbox 位置显示弧形斩击，带缩放+淡出动画
- **Hitbox**：根据方向（上下左右）调整尺寸（40x24 或 24x40），偏移 30px

### 受击机制

- **伤害检查**：`isInvulnerable || state === DEAD || state === HURT` 时免疫
- **击退**：力 600，方向为攻击者→玩家，配合 drag 1200 减速
- **硬直**：250ms 后恢复 IDLE，可被鼠标左键打断进入攻击（反击机制）
- **无敌帧**：1000ms，期间不接受任何伤害
- **视觉反馈**：红/无色 tint 闪烁 8 次（70ms 间隔），**不改变 alpha**，始终可见
- **屏幕效果**：hitStop 40ms + screenShake 5px/100ms

---

## 五、敌人系统（Enemy.js）

### FSM 状态机

```
PATROL ↔ CHASE → ATTACK_STARTUP → ATTACK_ACTIVE → CHASE
                    ↓
                  HURT → CHASE（或 DEAD）
```

| 状态 | 说明 |
|------|------|
| PATROL | 在 A/B 两点间巡逻，到达后等待 500ms |
| CHASE | 追击玩家，速度 x1.2 |
| ATTACK_STARTUP | 300ms 前摇，变橙色警告 |
| ATTACK_ACTIVE | 100ms 后造成伤害 |
| HURT | 受击反馈，击退 + 闪红 |

### 敌人参数（slime）

| 参数 | 值 |
|------|-----|
| HP | 30 |
| 伤害 | 10 |
| 速度 | 60 |
| 巡逻范围 | 120px |
| 检测范围 | 150px |
| 脱战范围 | 300px（detectionRange x 2） |
| 攻击距离 | 36px |
| 攻击冷却 | 1500ms |

### 掉落

- 50% 金币
- 20% 药水
- 30% 无掉落

---

## 六、道具系统（Item.js - IDO）

### 道具属性

```javascript
{
  id: string,          // 唯一标识（如 "coin_3"）
  type: string,        // 类型：HEAL / KEY / COIN / ARTIFACT
  value: number,       // 数值（金币分数 / 治疗量）
  name: string,        // 显示名
  description: string, // 描述
  onCollect: Function  // 拾取回调
}
```

### 道具列表

| 道具 | 类型 | 效果 | 纹理颜色 |
|------|------|------|----------|
| 金币 | COIN | +10 分 | 黄色 |
| 钥匙 | KEY | +1 钥匙计数 | 粉色 |
| 药水 | HEAL | +25 HP | 绿色 |
| 生命之心 | HEAL | +50 HP | 红色（心形） |
| 远古神器 | ARTIFACT | 胜利关键物品 | 紫色 |

### 拾取动画

向上飞出 30px + 淡出 + 缩放到 0，300ms，Back.easeIn 缓动。

---

## 七、NPC 系统（NPC.js）

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
3. UIManager 弹出对话框，打字机效果逐字显示
4. 文字显示完后，按 E/SPACE 关闭对话框
5. `dialoguing` 全锁防止 overlap 重复触发
6. 远离 NPC → overlap 离开回调 → 自动关闭对话框

### 告示牌

告示牌是特殊的 NPC（无 NPC 类实例），直接挂载 `npcInstance` 对象到 sprite 上，包含 `name`、`getNextDialogue()`、`setTalking()` 方法。

---

## 八、UIManager（systems/UIManager.js）

### 对话框窗口

- 半透明黑色背景 (0x000000, 0.92) + 绿色边框
- 居中显示在屏幕底部（y=480）
- 深度 100，不受相机滚动影响（scrollFactor=0）
- Enter 动画：缩放 0.8→1 + alpha 0→1，200ms，Back.easeOut
- Exit 动画：缩放 1→0.8 + alpha 1→0，150ms，Back.easeIn

### 打字机效果

每 30ms 显示一个字符，显示完成后触发 `onComplete` 回调。

---

## 九、环境光系统（systems/FocusLight.js）

- 使用 `RenderTexture` + `MULTIPLY` 混合模式
- 全屏黑色遮罩（alpha 0.5）覆盖
- 玩家位置处绘制径向渐变（白色→透明），半径 200px
- 轻微闪烁效果（每 100ms 随机 0~0.05 alpha 变化）
- 模拟地牢探索的灯光感

---

## 十、相机系统

- **跟随**：`startFollow(player, true, 0.1, 0.1)` Lerp 平滑
- **死区**：80x60 像素，角色在死区内移动时相机不动
- **边界**：锁定在地图范围内
- **屏幕震动**：受击时随机偏移 scrollX/Y，持续 100ms

---

## 十一、碰撞与交互

### 碰撞层

| 碰撞对 | 类型 | 说明 |
|--------|------|------|
| Player ↔ Wall/Obstacle/Tree/Stone/Fence | collider | 物理阻挡 |
| Enemy ↔ Wall/Obstacle | collider | 敌人也被阻挡 |
| Player ↔ Item | overlap | 拾取道具 |
| Player ↔ Enemy | overlap | 接触伤害 |
| AttackHitbox ↔ Enemy | overlap | 攻击命中 |
| AttackHitbox ↔ Breakable | overlap | 破坏木桶 |
| Player ↔ NPC/Sign | overlap | 交互检测 |
| Player ↔ TriggerZone | overlap | 区域触发 |
| Player ↔ EndZone | overlap | 胜利检测 |

### 可破坏物

- 木桶 HP=2，攻击 2 次后破碎
- 破碎时随机掉落金币或药水
- 破碎动画：缩放挤压 + 淡出

### 触发区域

- 3 个随机位置的触发区
- 进入后显示系统提示文字
- 每个区域只触发一次

---

## 十二、存档系统（systems/SaveSystem.js）

- 使用 `localStorage`，key 为 `pixel_adventure_save`
- 保存内容：玩家位置/HP、游戏状态（分数/钥匙/神器）、背包数据、已拾取道具列表
- 自动存档：每 30 秒
- 游戏结束时可删除存档重启

---

## 十三、纹理系统（assets/AssetManager.js）

所有纹理由代码生成（`Graphics API`），无外部图片资源。

### 纹理列表

| 纹理键 | 尺寸 | 颜色 | 说明 |
|--------|------|------|------|
| player | 28x28 | 绿色 | 像素角色 |
| enemy | 28x28 | 红色 | 像素角色 |
| npc | 28x32 | 蓝色 | 像素角色 |
| coin | 20x20 | 黄色 | 道具 |
| key | 20x20 | 粉色 | 道具 |
| artifact | 24x24 | 紫色 | 道具 |
| potion | 16x20 | 绿色 | 道具 |
| heart | 20x18 | 粉红 | 心形 |
| wall | 32x32 | 深灰 | 墙壁方块 |
| obstacle | 32x32 | 棕色 | 障碍物 |
| sword | 8x28 | 银色 | 剑武器 |
| sword_slash | 48x48 | 白色 | 弧形斩击特效 |
| tree | 32x48 | 绿色 | 阔叶树 |
| tree_pine | 32x48 | 深绿 | 松树 |
| grass | 32x32 | 绿色 | 矮草 |
| grass_tall | 32x32 | 深绿 | 高草 |
| water | 32x32 | 蓝色 | 水池 |
| stone | 32x32 | 灰色 | 石头 |
| flower | 32x32 | 粉色 | 花朵 |
| mushroom | 20x20 | 橙色 | 蘑菇 |
| sign | 32x32 | 棕色 | 告示牌 |
| bridge | 32x32 | 棕色 | 木桥 |
| fence | 32x20 | 深棕 | 栅栏 |
| campfire | 24x24 | 橙色 | 篝火 |

---

## 十四、事件系统

游戏使用 Phaser 的事件系统进行模块间通信：

| 事件名 | 参数 | 说明 |
|--------|------|------|
| `playerHpChanged` | hp, maxHp | HP 变化 |
| `scoreChanged` | score | 分数变化 |
| `keysChanged` | count | 钥匙数量变化 |
| `artifactCollected` | - | 获得神器 |
| `inventoryUpdated` | items[] | 背包更新 |
| `playerInteract` | target | 玩家交互 |
| `enemyAttack` | enemy, damage | 敌人攻击 |
| `enemyDeath` | enemy | 敌人死亡 |
| `spawnItem` | type, x, y | 生成道具 |
| `playerDeath` | - | 玩家死亡 |
| `hitStop` | duration(ms) | 全局定格冻结 |
| `screenShake` | intensity, duration | 屏幕震动 |
| `triggerZoneEntered` | zone | 进入触发区域 |

---

## 十五、已知问题 & 待优化

1. **地图数据冗余**：`gameConfig.js` 中的 `LAYERS.GROUND` 二维数组已不再使用（地图由 `generateRichMap()` 程序生成），可清理
2. **告示牌交互**：告示牌是 staticSprite 直接挂 npcInstance，不是 NPC 类实例，碰撞体可能需要调整
3. **FocusLight 性能**：每帧 clear + draw RenderTexture，低端设备可能卡顿，可考虑降低刷新率
4. **敌人种类单一**：目前只有 slime，可在 items.json 的 enemies 中添加新种类
5. **音乐/音效**：当前无音频，可添加 BGM 和攻击/拾取音效

---

## 十六、快速上手指南

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

1. 在 `src/data/items.json` 的 `enemies` 中添加配置
2. 在 `MainGameScene.createEnemies()` 中添加生成位置

### 添加新道具

1. 在 `src/data/items.json` 的 `items` 中添加配置
2. 在 `MainGameScene.createItems()` 中添加生成逻辑和 `onCollect` 回调

### 添加新 NPC

1. 在 `src/data/items.json` 的 `npcs` 中添加对话数据
2. 在 `MainGameScene.createNPCs()` 中创建 NPC 实例

### 修改地图

编辑 `MainGameScene.generateRichMap()` 方法，调整墙体/装饰物坐标。
