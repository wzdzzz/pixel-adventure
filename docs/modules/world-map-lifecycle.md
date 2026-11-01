# 大地图与开放世界生命周期

## 职责边界

| 模块 | 职责 | 不负责 |
|------|------|--------|
| `worldConfig.js` | 世界/chunk/tile 尺寸与坐标换算 | 地形内容 |
| `WorldGenerator` | 按 seed + chunk 坐标确定性生成地形、实体描述符、安全落点 | Phaser 对象生命周期 |
| `WorldStateManager` | 探索、击杀、宝箱、拾取、永久标记及序列化 | Tilemap 和实体实例 |
| `ChunkManager` | 有界 chunk 调度、Tilemap 创建/销毁、实体描述符过滤、chunk 事件 | 具体 Enemy/NPC/宝箱实例 |
| `MainGameScene` | 玩家、实体实例、碰撞、NPC 系统和世界总生命周期 | 大地图 UI 绘制 |
| `WorldMapScene` | 世界概览、已探索区域选择、发起传送 | 直接清理旧 chunk/实体 |
| `UIScene` | 小地图和 HUD | 修改世界状态 |

`EntityManager.js` 和 `EntityPool.js` 目前是未接入的预研实现。运行时敌人激活范围和实例销毁仍由 `MainGameScene` 管理，不能把这两个类当成已生效的对象池。

## 启动与读档

1. `MainGameScene.create()` 在创建世界前读取完整存档。
2. `enterWorld(saveData)` 先恢复 `WorldStateManager`，再用同一 seed 创建 `WorldGenerator` 和 `ChunkManager`。
3. 玩家位置在创建 Player 前恢复并限制在世界物理边界内。
4. 注册 `chunk-loaded`、`chunk-unloaded`、`player-chunk-changed` 后执行首次 `ChunkManager.update()`。
5. 玩家所在 chunk 同步加载；邻居按距离进入队列，每帧处理一个阶段。
6. `SaveSystem.load()` 恢复其余系统状态。旧档没有 `worldState` 时沿用本次已创建的世界，避免二次生成随机 seed。

## 普通移动

`MainGameScene.update()` 每帧把玩家坐标交给 `ChunkManager.update()`：

- 同一 chunk：只推进加载/卸载队列。
- 跨入新 chunk：立即标记当前 chunk 已探索并发出 `player-chunk-changed`。
- `loadRadius = 1`：目标 3x3 范围中心优先、邻居分帧加载。
- `unloadRadius = 2`：超出 5x5 保留范围后发出 `chunk-unloaded` 并销毁。
- 世界边缘只调度有效坐标，不创建用于阻挡的越界 Tilemap。

事件顺序：

```text
player-chunk-changed
  -> 探索记录
  -> 地标发现
  -> HUD 区域名

chunk-loaded
  -> 玩家/附近敌人墙碰撞
  -> chunk 动态实体
  -> 固定 NPC

chunk-unloaded
  -> 动态实体和碰撞器
  -> 非 persistent NPC
  -> Tilemap 层和剩余墙碰撞器
```

加载相邻 chunk 不等于探索，也不会解锁传送点或触发地标发现。

## 大地图与传送

打开 `WorldMapScene` 时，主场景用暂停来源 `world-map` 持有暂停。面板和存档选择分别使用 `panel`、`save-select`，任一叠加场景只能释放自己的暂停来源。

传送流程：

1. `WorldGenerator.findNearestWalkableTile()` 在已探索目标 chunk 内找安全 tile。
2. 同步玩家及物理 body，清空交互目标，并移动出战伙伴。
3. `ChunkManager.teleportReset()` 统一发出旧 chunk 卸载事件并销毁 Tilemap。
4. 只同步加载目标 chunk，邻居继续分帧加载，避免单帧创建 9 个三层 Tilemap。
5. 关闭地图并释放 `world-map` 暂停来源。

## 销毁与重启

`MainGameScene` 在 Phaser `SHUTDOWN` 事件中执行一次 `_shutdownWorld()`：

1. 停止仍打开的 `WorldMapScene` / `PanelScene`。
2. 解绑 chunk、玩家跨区和延迟 UI 创建监听器。
3. 销毁对话/商店/训练面板。
4. 销毁动态实体、固定 NPC 及各自持有的 Arcade collider/overlap。
5. 销毁全部 Tilemap，清空加载队列和 chunk 映射。
6. 销毁音频绑定，清空 `SystemRegistry` 和暂停来源。

碰撞器所有权遵循“实体或 chunk 任一侧销毁即可移除”，销毁前检查 `collider.world`，保证重复清理安全。

## 回归验证

```bash
pnpm build
pnpm test:smoke:world
```

`scripts/world-map-test.mjs` 覆盖探索语义、安全落点、物理 body 同步、传送加载峰值、世界边界、暂停来源、读档 seed/位置及场景重启清理。
