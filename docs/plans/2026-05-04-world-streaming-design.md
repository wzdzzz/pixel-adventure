# 大世界动态加载系统设计

> 日期：2026-05-04
> 状态：已确认

## 目标

将当前关卡制（80×60 瓦片）改为**无缝开放世界**，支持 Chunk 流式加载/卸载，地图可无限扩展。初期目标 512×512 瓦片（16×16 Chunk）。

## 需求摘要

| 项目 | 决定 |
|------|------|
| 世界类型 | 无缝开放世界，无加载屏 |
| 初期规模 | 512×512 瓦片 = 16×16 Chunk |
| 地形生成 | 混合：程序化框架 + 关键区域预制模板 |
| 生态区 | 4-6 个（森林/废墟/雪山/沙漠/沼泽/火山），自然过渡 |
| 据点 | 中心城镇 + 各区营地 |
| 怪物刷新 | 魂系：杀完不刷，篝火/营地休息后重置 |
| 怪物密度 | 群落分布，高密度区 30-50 只/Chunk |

---

## 一、世界坐标与 Chunk 体系

### 规格

- 瓦片大小：32×32 像素
- Chunk 大小：32×32 瓦片 = 1024×1024 像素
- 世界大小：16×16 Chunk = 512×512 瓦片 = 16384×16384 像素

### 坐标转换

```
chunkX = floor(playerWorldX / 1024)
chunkY = floor(playerWorldY / 1024)
Chunk 命名：`${chunkX}_${chunkY}`
```

---

## 二、种子化地形生成（WorldGenerator）

纯函数，无副作用。同种子 + 同坐标 = 同结果。

### 输入/输出

```
输入：worldSeed, chunkX, chunkY
输出：{
  tileData: number[32][32],       // 地面+墙壁+装饰层
  entitySpawnList: SpawnEntry[]   // 实体生成清单
}
```

### 生成流程

1. **生态区判定**（低频 Simplex 噪声 + 距中心距离）
   - 决定 biome: forest / ruins / snow / desert / swamp / volcano
2. **地形生成**（中频噪声）
   - 地面类型：草地/泥地/沙地/雪地/水域
   - 高频噪声：装饰物（树/花/蘑菇/石头）
   - 墙壁/迷宫：cellular automata，种子确定
3. **预制模板覆盖**
   - WorldLayout 定义固定位置：城镇(8_8)、Boss房(2_14)、营地(5_3)等
   - 命中预制区域 → 替换程序化数据
4. **实体生成清单**
   - 群落生成：每 Chunk 2-5 个群落中心点
   - 群落类型：巡逻队(3-5只) / 营地(6-10只) / 巢穴(15-25只)
   - entityId 确定性：`${type}_${chunkX}_${chunkY}_${index}`

### 怪物密度

| 区域类型 | 每 Chunk 怪物数 |
|----------|:-:|
| 城镇/营地 | 0 |
| 道路/平原 | 3-5 |
| 普通野外 | 10-20 |
| 怪物巢穴/废墟 | 30-50 |
| Boss 房 | 1 Boss + 10-15 小怪 |

---

## 三、Chunk 生命周期（ChunkManager）

### 加载/卸载策略

```
loadRadius: 1    → 加载玩家所在 Chunk 周围 3×3 = 9 个
unloadRadius: 2  → 超出 5×5 范围的卸载
```

### 核心流程

```
ChunkManager.update(playerX, playerY)
├── 计算当前 chunkX, chunkY
├── 如果和上次相同 → 跳过
├── diff = 需要加载的新 Chunk - 已有的
├── 新 Chunk → scheduleLoad(chunkKey)
└── 超出范围 → scheduleUnload(chunkKey)
```

### 分帧加载（防卡顿）

```
loadQueue: [ { chunkKey, step, data } ]

每帧处理：
  step 0: WorldGenerator 生成 tileData（纯计算，~1ms）
  step 1: 创建 Tilemap 层（ground + wall + decoration）（~2ms）
  step 2+: 每帧创建最多 10 个实体（查询 WorldStateManager 跳过已死亡的）

玩家速度 200px/s，穿越一个 Chunk 需 ~5 秒
加载一个 Chunk 预计 3-5 帧完成
```

### Tilemap 拼接

```
每个 Chunk 独立 Tilemap：
  const map = scene.make.tilemap({ data, tileWidth: 32, tileHeight: 32 })
  map.x = chunkX * 1024
  map.y = chunkY * 1024

相邻 Chunk 坐标无缝对齐
碰撞层各自独立，不跨 Chunk 合并
```

### 卸载流程

```
scheduleUnload(chunkKey):
  1. 保存活跃实体血量到 entityHpCache
  2. release 实体到 EntityPool（不 destroy）
  3. 销毁 Tilemap 层
  4. 从 activeChunks 移除
```

---

## 四、状态持久化（WorldStateManager）

### 核心原则：只存改变，不存地形

```
WorldStateManager
├── seed: number                              // 世界种子
├── exploredChunks: Set<string>               // 已探索 Chunk
├── killedEntities: Map<string, number>       // entityId → 击杀时间戳
├── openedChests: Set<string>                 // 永久记录
├── pickedItems: Set<string>                  // 永久记录
├── entityHpCache: Map<string, number>        // 临时：Chunk卸载时暂存血量（不存档）
├── bonfireReset: number                      // 上次休息时间戳
├── permanentFlags: Map<string, any>          // 不可重置标记
│   "boss_skeleton_king_defeated" → true
│   "town_blacksmith_unlocked" → true
```

### 篝火重置机制（魂系）

```
restAtBonfire():
  1. 回满 HP/MP
  2. killedEntities.clear()（Boss 除外，由 permanentFlags 保护）
  3. pickedItems.clear()（散落物品刷新）
  4. openedChests 不清除（永久）
  5. 记录时间戳
  6. 自动存档

效果：走出去所有普通怪/精英重新出现
```

### Chunk 加载时查询

```
for each spawn in spawnList:
  if worldState.isEntityDead(spawn.id)     → 跳过
  if worldState.isChestOpened(spawn.id)    → 生成已开启状态
  else                                     → 正常生成
  if entityHpCache.has(spawn.id)           → 恢复血量
```

### 存档集成

```
SaveSystem.save() 新增 worldState 字段：
  { seed, exploredChunks, killedEntities, openedChests,
    pickedItems, permanentFlags, bonfireReset }

读档 = 等同于休息：怪物满血（entityHpCache 不存档）
```

---

## 五、实体管理与对象池

### 距离分级

```
EntityManager.update(cameraBounds):
  dist < 1200px  → ACTIVE：正常 update + AI + 物理
  dist < 2048px  → DORMANT：停 AI，物理 disable，不可见
  超出            → 由 ChunkManager 卸载回收到池
```

### 对象池（EntityPool）

```
EntityPool
├── pools: Map<string, Entity[]>
│
├── acquire(type, x, y, config)
│   有空闲 → pop + reset(x, y, config)
│   无空闲 → new Enemy(...)
│
├── release(entity)
│   setActive(false), setVisible(false), body.enable = false
│   push 回 pools
│
└── 预热：启动时每种怪预建 5-10 个
```

### 碰撞注册

```
使用 Group 碰撞，注册一次：
  scene.physics.add.collider(player, enemyGroup)
  scene.physics.add.collider(enemyGroup, wallGroup)

acquire → enemyGroup.add(sprite)
release → enemyGroup.remove(sprite)
Group 只检测 active 成员 → dormant 自动跳过
```

---

## 六、场景改造

### MainGameScene 新流程

```
enterWorld(saveData?):
  ├── 初始化 WorldStateManager（新游戏创种子 / 读档反序列化）
  ├── 初始化 ChunkManager
  ├── 初始化 EntityPool（预热）
  ├── 创建 Player（城镇出生 / 读档位置）
  ├── 摄像机 startFollow(player)
  └── 首次 ChunkManager.update()

update(time, delta):
  ├── ChunkManager.update(player.x, player.y)
  ├── EntityManager.update(cameraBounds)
  ├── player.update(delta)
  └── 活跃实体 update(delta)

不再有 loadLevel / cleanupLevel
关卡概念消失，只有连续世界
```

### 摄像机

```
不设 camera.setBounds（世界无固定边界）
实际边界由 WorldGenerator 控制（超出有效区域生成不可通行地形）
camera.startFollow / deadzone 不变
```

### 现有系统兼容

| 系统 | 改动 | 说明 |
|------|:---:|------|
| SaveSystem | 中 | 新增 worldState 序列化 |
| InventorySystem | 无 | |
| EquipmentSystem | 无 | |
| SkillEngine | 无 | |
| LevelSystem | 小 | 去掉"当前关卡"，经验值保留 |
| QuestSystem | 小 | 目标改为区域/坐标 |
| LootEngine | 小 | 掉落表不变，按 biome 配置 |
| UIScene/HUD | 小 | 去掉关卡显示，加区域名称 |
| InteractionHandler | 中 | 篝火/传送点交互新增 |

---

## 七、新增文件清单

```
src/world/
├── WorldGenerator.js       // 种子化地形生成（纯函数）
├── WorldLayout.js          // 预制区域定义（城镇/Boss房/营地坐标）
├── ChunkManager.js         // Chunk 加载/卸载调度
├── WorldStateManager.js    // 状态持久化（击杀/宝箱/探索）
├── EntityPool.js           // 对象池
├── EntityManager.js        // 实体距离分级激活
└── biomes/
    ├── forest.js           // 各 biome 的瓦片配置 + 怪物表
    ├── ruins.js
    ├── snow.js
    ├── desert.js
    ├── swamp.js
    └── volcano.js
```
