# NPC 系统设计文档

> 创建日期：2026-05-26
> 分支：feature/ui-panel-system
> 状态：Spec — 待实施

## 目标

为「像素远征」搭建**完整、抽象、数据驱动**的 NPC 系统，作为后续所有 NPC 相关玩法的统一基座。要求：
- 添加新 NPC = 写一份配置（零代码）
- 支持对话、战斗、商店、训练、任务、同伴、护送、派系、关系等全功能
- 与开放世界 chunk 流式加载 / 魂系篝火 / 存档系统无缝集成
- 每个子系统单一职责，便于独立测试、迭代

## 范围

覆盖 Z 方案（A~E 全部）：

| 组 | 内容 |
|---|---|
| **A 核心交互** | 节点化对话树、NPC 抽象基类、纯数据注册 |
| **B 战斗** | 触发战斗 / 友方 NPC 战斗 / 同伴雇佣 / 护送任务 |
| **C 经济** | 商店、铁匠服务、仓库 NPC |
| **D 成长** | 任务发布 / 提交、训练师、治疗 / 补给 |
| **E 进阶** | 派系 + 5 级关系 + 渐进式 reputation、巡逻、永久死亡 |

不在范围（明确排除）：
- 时间系统（昼夜循环 / NPC 日程）—— 等时间系统上线后再做 E2 完整日程
- 第三方对话 DSL（Ink/Yarn）—— 自研节点树
- 可视化对话树编辑器
- 多人同伴（首版上限 1）

---

## 架构总览

### 依赖关系

```
data/
  ├─ factions.js         (纯数据)
  ├─ npcs.js             (纯数据，引用 dialogues/)
  ├─ dialogues/*.js      (纯数据)
  ├─ shops.js            (纯数据)
  ├─ giftPreferences.js  (纯数据)
        ↓
systems/
  ├─ FactionSystem       (依赖 factions.js)
  ├─ NPCMemoryStore      (无依赖)
  ├─ ActionRegistry      (无依赖，注入式注册)
  ├─ DialogueEngine      (依赖 NPCMemoryStore + ActionRegistry + FactionSystem)
  ├─ ShopService         (依赖 LootEngine + InventorySystem + FactionSystem)
  ├─ TrainerService      (依赖 LevelSystem + SkillTreeSystem)
  ├─ CompanionManager    (依赖 CombatAI + Player)
  ├─ CombatAI            (无外部依赖；被 Enemy + CombatNPC 复用)
  └─ NPCRegistry         (注册 + 生命周期，依赖以上所有)
        ↓
entities/
  ├─ NPC                 (基础 NPC，包含 sprite / nametag / 交互范围)
  ├─ CombatNPC ← Actor   (战斗能力，使用 CombatAI)
        ↓
managers/InteractionHandler  (集成 NPC 交互入口)
ui/panels/
  ├─ ShopPanel           (双栏交易)
  ├─ TrainerPanel        (技能学习/重置)
  └─ DialoguePanel       (升级版对话框，含选项)
scenes/
  └─ PanelScene          (注入新 panel mixin)
```

所有依赖单向向上，无环。

### 与现有系统的契合点

| 现有 | 集成方式 |
|---|---|
| `WorldStateManager` | 序列化 NPCMemoryStore + FactionSystem |
| `EntityPool` | 固定 NPC 走对象池（生命周期与 chunk 一致） |
| `Enemy.js` | 抽离 AI 到 `CombatAI`，`Enemy` 改为薄壳 |
| `EnemySkillSystem` | CombatNPC / Companion 直接复用 |
| `LootEngine` | 商店库存生成复用 |
| `InventorySystem` | 商店买卖直接操作 |
| `SkillTreeSystem` | TrainerService 调用以解锁/重置 |
| `QuestSystem` | action `accept_quest` / `turn_in_quest` 委托 |
| `UIManager` | DialoguePanel 替代当前简单对话框；保留兼容 API |
| `SaveSystem` | 新增 `npcMemory` / `factionReputation` 字段，旧存档兼容 |

---

## 关键数据结构

### NPC 配置（`data/npcs.js`）

```js
export const NPCS = {
  blacksmith_tom: {
    id: 'blacksmith_tom',
    name: '铁匠汤姆',
    sprite: 'npc_blacksmith',          // AssetManager 贴图 key
    faction: 'townfolk',
    essential: true,                    // 关键 NPC，HP<=1 投降
    spawn: {                            // 哪些 chunk 生成
      chunkX: 8, chunkY: 8,
      localX: 12, localY: 16
    },
    initialStage: 'first_meeting',
    services: ['shop', 'enhance', 'reforge', 'gem_inlay'],
    shopId: 'tom_shop',                 // 引用 shops.js
    dialogueModule: 'blacksmith_tom',   // 引用 dialogues/blacksmith_tom.js
    movement: 'stand',                  // 'stand' | { type: 'patrol', radius: 64 }
    combatStats: null,                  // 非战斗 NPC
    giftPreferences: {                  // 送礼好恶
      loved: ['iron_ore', 'soul_crystal'],
      hated: ['rotten_flesh']
    }
  },

  town_guard_01: {
    id: 'town_guard_01',
    name: '城镇卫兵',
    faction: 'town_guard',
    sprite: 'npc_guard',
    spawn: { chunkX: 8, chunkY: 8, localX: 5, localY: 10 },
    initialStage: 'patrol',
    services: [],
    movement: { type: 'patrol', radius: 96 },
    combatStats: {                      // 战斗 NPC
      level: 10,
      hp: 200,
      skills: ['guard_slash', 'shield_bash'],
      primaryAttackStat: 'strength'
    },
    dialogueModule: 'town_guard'
  },

  companion_rogue: {
    id: 'companion_rogue',
    name: '游侠艾琳',
    faction: 'ally',
    sprite: 'npc_rogue',
    persistent: true,                   // 不随 chunk 卸载销毁（CompanionManager 托管）
    initialStage: 'recruitable',
    services: ['recruit'],
    combatStats: { level: 1, hp: 80, skills: ['quick_shot', 'evasion'] },
    recruitCost: { gold: 500 },
    dialogueModule: 'companion_rogue'
  }
};
```

### 阵营定义（`data/factions.js`）

```js
export const FACTIONS = {
  player:     { hostileTo: [] },
  ally:       { hostileTo: ['monster', 'bandit'] },
  townfolk:   { hostileTo: ['monster', 'bandit'] },
  town_guard: { hostileTo: ['monster', 'bandit'] },
  monster:    { hostileTo: ['player', 'ally', 'townfolk', 'town_guard'] },
  bandit:     { hostileTo: ['player', 'ally', 'townfolk', 'town_guard'] },
  neutral:    { hostileTo: [] }
};

// 玩家对每个阵营的初始 reputation（默认 0=中立）
export const INITIAL_REPUTATION = {
  townfolk: 0, town_guard: 0, ally: 50, monster: -100, bandit: -50, neutral: 0
};

// 关系等级（数值 → 名称）
export const RELATION_THRESHOLDS = [
  { min: 60,   name: 'intimate',  label: '亲密', emoji: '💚' },
  { min: 20,   name: 'friendly',  label: '友好', emoji: '💛' },
  { min: -19,  name: 'neutral',   label: '中立', emoji: '⚪' },
  { min: -59,  name: 'hostile',   label: '敌对', emoji: '💢' },
  { min: -100, name: 'vengeful',  label: '仇恨', emoji: '🗡' }
];

// 行为对 reputation 的影响（基线，可被 NPC 配置覆盖）
export const REPUTATION_DELTAS = {
  quest_completed: +10,
  quest_failed: -5,
  shop_purchase: +1,
  shop_sell: +1,
  accidental_hit: -3,
  accidental_kill: -20,
  faction_member_killed: -10,
  faction_boss_killed: -30,
  gift_loved: +10,
  gift_liked: +5,
  gift_neutral: +1,
  gift_hated: -10,
  reputation_quest_completed: +20
};
```

### 对话节点（`data/dialogues/blacksmith_tom.js`）

```js
export default {
  // 每个 Stage 一棵节点树
  first_meeting: {
    start: {
      speaker: '铁匠汤姆',
      text: '生面孔啊。你想干嘛？',
      next: 'menu'
    },
    menu: {
      options: [
        { text: '想做点委托', goto: 'offer_quest' },
        { text: '看看商品', goto: 'show_shop' },
        { text: '告辞', goto: 'end' }
      ]
    },
    offer_quest: {
      text: '帮我带 5 块铁矿回来，我教你打铁。',
      action: 'accept_quest:tom_intro',
      set: { stage: 'awaiting_ore' },
      next: 'end'
    },
    show_shop: {
      action: 'open_shop:tom_shop',
      next: 'end'
    },
    end: { end: true }
  },

  awaiting_ore: {
    start: {
      speaker: '铁匠汤姆',
      text: '矿石带回来了吗？',
      options: [
        { text: '交付 5×铁矿',
          if: 'hasItem(iron_ore,5)',
          goto: 'turn_in' },
        { text: '还在找', goto: 'end' }
      ]
    },
    turn_in: {
      action: ['take_item:iron_ore:5', 'turn_in_quest:tom_intro'],
      set: { stage: 'trusted', relationDelta: +20 },
      text: '好兄弟！以后想强化装备随时来找我。',
      next: 'end'
    },
    end: { end: true }
  },

  trusted: {
    start: {
      speaker: '铁匠汤姆',
      text: '兄弟！想做点啥？',
      options: [
        { text: '强化装备', action: 'open_enhance' },
        { text: '洗练词条', action: 'open_reforge' },
        { text: '镶嵌宝石', action: 'open_gem_inlay' },
        { text: '看看商品', action: 'open_shop:tom_shop' },
        { text: '告别', goto: 'end' }
      ]
    },
    end: { end: true }
  }
};
```

#### 对话节点字段规范

| 字段 | 类型 | 说明 |
|---|---|---|
| `speaker` | string | 显示的说话人名（缺省 = NPC 名） |
| `text` | string | 显示的文本（支持 `{var}` 插值） |
| `next` | string | 自动跳到的下一节点 id |
| `options` | array | 玩家选项（与 next 互斥）|
| `options[].text` | string | 选项文本 |
| `options[].if` | string\|fn | 显示条件（DSL 字符串或谓词函数）|
| `options[].goto` | string | 跳转节点 |
| `options[].action` | string\|array | 执行 action（注册表中查找）|
| `options[].set` | object | 写入 NPCMemory 或 flag |
| `if` | string\|fn | 节点级条件（不满足则按 next 跳过）|
| `action` | string\|array | 节点动作（在 text 显示后执行）|
| `set` | object | 写状态：`{ stage: 'xxx', flag_x: true, relationDelta: -5 }` |
| `call` | string | 调用子对话（其他节点 id），return 后继续 next |
| `end` | boolean | 终止对话 |

#### 条件 DSL（简化版）

支持的内置谓词（DialogueEngine 中实现）：

- `hasItem(itemId,count)` / `noItem(itemId)`
- `level>=N` / `level<=N`
- `flag(key)` / `notFlag(key)`
- `stage==xxx`
- `relation>=friendly` / `relation<=hostile`（默认对当前 NPC 所属阵营求值，可显式写 `relation(townfolk)>=friendly`）
- `quest:id:status`（status ∈ active/completed/notStarted）
- `gold>=N`
- 逻辑组合：`a && b`、`a || b`、`!a`

也可传入纯 JS 函数：`if: (ctx) => ctx.player.hp < ctx.player.maxHp * 0.5`

### NPC 记忆（`NPCMemoryStore`）

```js
class NPCMemoryStore {
  // 每个 NPC 一条
  // npcId -> { stage: 'xxx', flags: {...}, vars: {...}, dead: false }
}
```

序列化结构：

```json
{
  "blacksmith_tom": { "stage": "trusted", "flags": { "metInTavern": true }, "vars": { "trades": 12 } },
  "town_guard_01": { "stage": "patrol", "flags": {}, "vars": {} }
}
```

### Action 注册表

action 字符串格式：`name:arg1:arg2`，解析后调用注册的 handler。

内置 action：

| Action | 参数 | 说明 |
|---|---|---|
| `open_shop` | shopId | 打开商店面板 |
| `open_enhance` | - | 打开强化面板 |
| `open_reforge` | - | 打开洗练面板 |
| `open_gem_inlay` | - | 打开镶嵌面板 |
| `open_trainer` | trainerId | 打开训练师面板 |
| `accept_quest` | questId | 接任务 |
| `turn_in_quest` | questId | 交任务 |
| `give_item` | itemId:count | 给玩家物品 |
| `take_item` | itemId:count | 拿走物品 |
| `give_gold` | amount | 给金币 |
| `take_gold` | amount | 扣金币 |
| `heal_player` | percent | 回血（默认 100） |
| `learn_skill` | skillId | 直接解锁技能 |
| `trigger_combat` | factionOverride | 转敌对，立刻攻击 |
| `recruit_companion` | npcId | 招募为同伴 |
| `dismiss_companion` | - | 解雇当前同伴 |
| `teleport_player` | x:y | 传送 |
| `set_flag` | key:value | 写全局 flag（WorldStateManager） |
| `play_sound` | soundId | 播放音效 |
| `show_message` | text | 屏幕提示 |
| `close_dialogue` | - | 强制关闭对话 |

handler 注册接口（运行时可扩展）：

```js
actionRegistry.register('custom_action', (args, ctx) => { /* ... */ });
```

`ctx` 包含：`{ npc, player, scene, dialogueEngine, save: () => SaveSystem.save(scene) }`

---

## 核心系统接口

### `FactionSystem`

```js
class FactionSystem {
  constructor(initialReputation = {}) {}

  // 关系查询
  getReputation(factionId, npcId = null)            // 派系基线 + NPC 个体偏移
  getRelation(factionId, npcId = null)              // 返回 'intimate'/'friendly'/...
  isHostile(factionA, factionB)                     // hostileTo + reputation 综合判定

  // 关系变更
  addReputation(factionId, delta, source = '')      // 渐进，触发 npcRelationChanged 事件
  setReputation(factionId, value)                   // 剧情用，直接覆盖
  addNpcOverride(npcId, delta)                      // 个体关系偏移
  setNpcOverride(npcId, value)

  // 战斗目标选择
  findHostileTargets(factionId, candidates)         // 从 candidates 中筛出敌对目标

  // 序列化
  serialize() / static deserialize(data)
}
```

### `NPCMemoryStore`

```js
class NPCMemoryStore {
  getStage(npcId)                                   // string | initial
  setStage(npcId, stage)                            // 触发 npcStageChanged 事件
  getFlag(npcId, key) / setFlag(npcId, key, value)
  getVar(npcId, key)  / setVar(npcId, key, value)
  markDead(npcId)     / isDead(npcId)

  serialize() / static deserialize(data)
}
```

### `DialogueEngine`

```js
class DialogueEngine {
  constructor(scene, { memory, factions, actionRegistry })

  // 启动一段对话
  start(npc)                                        // 自动从 stage 找 dialogue tree 的 'start' 节点

  // 选择选项（由 DialoguePanel 调用）
  choose(optionIndex)

  // 推进/停止（无选项时点继续）
  advance()
  stop()

  // 内部
  _runNode(nodeId)
  _evalCondition(expr, ctx)                         // DSL 解释器
  _applyAction(actionStrOrArray, ctx)
  _applySet(setObj, ctx)
}
```

事件：
- `dialogueStarted`、`dialogueNodeEntered`、`dialogueEnded`
- `npcStageChanged`、`npcFlagChanged`

### `ShopService`

```js
class ShopService {
  constructor(scene, { lootEngine, inventory, factions })

  open(shopId, npc)                                 // 生成/读取库存，emit 'shopOpened'
  buy(shopId, slotIdx, count)
  sell(shopId, inventoryItem, count)
  refresh(shopId)                                   // 重新生成库存（篝火触发）

  getPriceForBuy(item, factionId)                   // 含关系折扣
  getPriceForSell(item, factionId)

  serialize() / static deserialize(data)
}
```

商店配置（`data/shops.js`）：
```js
{
  tom_shop: {
    name: '汤姆的铺子',
    tableId: 'shop_smith',                          // LootEngine 用的掉落表 id
    slots: 12,
    refresh: 'bonfire',
    sellbackRate: 0.3
  }
}
```

### `TrainerService`

```js
class TrainerService {
  constructor(scene, { levelSystem, skillTree, inventory })

  open(trainerId, npc)
  learn(trainerId, skillId)                         // 扣金币 + 技能点 + 调 SkillTree
  resetTalents(npc)                                 // 重置天赋（扣大金币）
}
```

### `CompanionManager`

```js
class CompanionManager {
  constructor(scene, { combatAI, player, factions })

  recruit(npc)                                      // 设为当前同伴
  dismiss()                                         // 解散
  getCurrent()
  isActive(npcId)
  update(delta)                                     // 每帧：跟随、AI、复活检查

  // 同伴生命周期
  onDeath(companion)                                // 标记倒地，篝火后复活
  reviveAtBonfire()
}
```

跟随逻辑：
- 距玩家 `> 250px` → 切换为 chase 状态加速跑回
- `< 80px` → 待机
- 中间区段 → 正常巡逻 / 战斗

目标选择优先级：
1. 玩家当前最近敌人（300px 内）
2. 自己附近 250px 内敌人
3. 待机

### `CombatAI`（从 Enemy.js 抽离）

```js
class CombatAI {
  constructor(actor, { factionSystem, skillSystem, getTargets })
  update(delta)                                     // 状态机驱动
  setTargetSelector(fn)                             // 自定义目标选择
  // 状态：PATROL / CHASE / SKILL_TELEGRAPH / SKILL_ACTIVE / SKILL_RECOVERY / RETREAT
}
```

`actor` 必须实现接口：`{ sprite, hp, maxHp, faction, skills, position }`。

Enemy.js 重构后：
```js
class Enemy extends Actor {
  constructor(...) {
    super(...)
    this.combatAI = new CombatAI(this, { factionSystem, skillSystem, getTargets: () => scene.enemyTargets })
  }
  update(delta) { this.combatAI.update(delta) }
}
```

CombatNPC 同样模式。

### `NPCRegistry`

```js
class NPCRegistry {
  constructor(scene)

  // 注册一个 NPC 实例到场景
  spawn(npcConfig, chunk = null)                    // 创建 NPC / CombatNPC 实例
  despawn(npcId)                                    // chunk 卸载时
  get(npcId)
  getAll()
  getInChunk(chunkKey)
  getPersistent()                                   // 永久存在的（同伴 / 任务 NPC）
}
```

由 `ChunkManager` 在加载 chunk 时调用 `spawn`，卸载时调用 `despawn`。Persistent NPC（同伴 / 当前任务 NPC）不受 chunk 影响。

---

## 数据流示例

### 场景 1：玩家与铁匠对话买东西

```
玩家按 E
  └─ InteractionHandler.handleNPCDialogue(npc)
       └─ DialogueEngine.start(npc)
            └─ 取 NPCMemoryStore.getStage('blacksmith_tom') → 'trusted'
            └─ 从 dialogues/blacksmith_tom.js[trusted].start 开始
            └─ emit 'dialogueNodeEntered' → DialoguePanel 渲染文本+选项
玩家选「看看商品」
  └─ DialoguePanel → DialogueEngine.choose(3)
       └─ 解析 action 'open_shop:tom_shop'
       └─ ActionRegistry.dispatch('open_shop', ['tom_shop'], ctx)
            └─ ShopService.open('tom_shop', npc)
                 └─ 检查库存（首次/篝火后用 LootEngine 生成）
                 └─ emit 'shopOpened' → PanelScene 切到 ShopPanel
玩家点击购买
  └─ ShopPanel → ShopService.buy(...)
       └─ FactionSystem.getRelation('townfolk') → 计算折扣
       └─ 扣金币 + InventorySystem.add(item)
       └─ FactionSystem.addReputation('townfolk', +1, 'shop_purchase')
```

### 场景 2：玩家误伤卫兵，触发敌对

```
玩家攻击命中 town_guard_01
  └─ InteractionHandler.handleSkillHit 检测 target.faction === 'town_guard'
       └─ FactionSystem.addReputation('town_guard', -3, 'accidental_hit')
       └─ NPCMemoryStore.setVar('town_guard_01', 'hitCount', n+1)
       └─ 若 hitCount >= 3 或 reputation <= -20:
            ├─ town_guard 阵营整体转敌对
            ├─ FactionSystem 设 player ↔ town_guard 互敌
            └─ NPCRegistry 中所有 town_guard 进入 combat（CombatAI 唤起）
```

### 场景 3：完成任务推进 NPC stage

```
QuestSystem emit 'questCompleted' { questId: 'tom_intro' }
  └─ NPC.transitions 监听
       └─ 找到 { from: 'awaiting_ore', to: 'trusted', on: 'quest:tom_intro:completed' }
       └─ NPCMemoryStore.setStage('blacksmith_tom', 'trusted')
       └─ emit 'npcStageChanged' → UI 更新（如 NPC 头顶图标）
```

### 场景 4：同伴跟随和战斗

```
每帧 CompanionManager.update(delta)
  └─ 计算与玩家距离
  └─ 若 > 250px → CombatAI.state = RUSH（速度 1.5x）
  └─ 否则 CombatAI 正常 update
       └─ getTargets() → scene.enemyGroup
       └─ targetSelector: 优先 player.lastAttackedTarget，否则最近敌人
       └─ 释放技能 / 移动
```

### 场景 5：篝火休息

```
InteractionHandler.handleBonfireInteraction
  └─ WorldStateManager.restAtBonfire()
  └─ NEW: CompanionManager.reviveAtBonfire()
  └─ NEW: ShopService.refreshAll()  (遍历篝火刷新策略的商店)
  └─ NEW: NPCRegistry.respawnNonEssentialKilled()
       (普通 NPC 永久死亡；essential NPC 不会死；这里不复活，仅清"投降"状态)
```

---

## 错误处理 & 边界

| 场景 | 处理 |
|---|---|
| 对话节点 id 未找到 | console.warn，跳到 'end' 节点（兜底） |
| action 名未注册 | console.warn，对话继续 |
| 商店库存数量不足 | 提示「该商品已售罄」，刷新面板 |
| 玩家金币不够买 | 按钮置灰，hover 提示 |
| NPC 同时在多个 chunk 配置 | NPCRegistry 启动时校验，重复 id 报错并丢弃 |
| 同伴被卡墙 | 5 秒未推进位置 → 瞬移到玩家身边 |
| 关系数值越界 | 自动 clamp 到 [-100, +100] |
| Stage 跳转到不存在的 stage | 回滚到 initialStage，warn |
| 加载存档时 NPC 配置已被删除 | NPCMemoryStore 中残留数据保留但不实例化（防数据丢失） |
| 玩家攻击 essential NPC 到 HP=1 | HP 锁定为 1、AI 暂停、临时切到内置 `__surrendered__` stage（NPC 不需要在配置里显式定义；DialogueEngine 兜底用通用「饶命」文本，可被 NPC config 中的 `surrenderDialogue` 字段覆盖） |
| Dialogue tree 中 set 写未知字段 | 忽略，warn |

---

## 测试策略

游戏项目无现成单测框架。采取**手测清单**：

### 单元级（控制台手动验证）

- `FactionSystem`：reputation 加减触发等级变化事件、阈值边界
- `NPCMemoryStore`：序列化往返、stage 变更事件
- `DialogueEngine`：节点跳转、条件评估、action 派发
- `ActionRegistry`：注册 / 派发 / 未知 action 处理

### 集成（in-game 冒烟）

1. 城镇生成 3 个 NPC（铁匠、商人、卫兵）
2. 与铁匠对话 → 接任务 → 完成任务 → stage 切换 → 可强化
3. 商店买卖 → 金币变化 → 关系 +1
4. 误伤卫兵 → 关系下降 → 多次后转敌对
5. 招募同伴 → 战斗中协助 → 死亡 → 篝火复活
6. 杀普通 NPC → 永久死亡 → 重读存档仍死
7. 攻击 essential NPC → 投降而非死亡
8. 篝火休息 → 商店刷新库存
9. 全过程存档 → 重载 → 状态一致（stage / reputation / 商店库存 / 同伴归属）

### 性能

- 10+ NPC 同屏 FPS ≥ 55
- 同伴跟随无明显卡顿
- 对话切换 < 100ms 响应

---

## 实施 Phase 拆分（提示给 writing-plans）

由于工程量大，建议分 7 个 Phase：

| Phase | 内容 | 可独立交付 |
|---|---|---|
| 1 | 数据骨架 + FactionSystem + NPCMemoryStore + 升级 NPC 基类 + 1 个测试 NPC | ✅ 城镇里有个会说话的 NPC（无服务） |
| 2 | DialogueEngine + ActionRegistry + DialoguePanel | ✅ 节点树对话 + 选项 + 简单 action |
| 3 | CombatAI 抽离 + CombatNPC + 阵营战斗联动 | ✅ 卫兵能打怪 / 误伤可触发敌对 |
| 4 | ShopService + ShopPanel + 铁匠/强化等服务集成 | ✅ 完整商店 + 铁匠 |
| 5 | TrainerService + TrainerPanel + 任务发布 / 提交集成 | ✅ 训练师 + 任务接口 |
| 6 | CompanionManager + 招募 + 跟随 AI + 复活 | ✅ 同伴系统 |
| 7 | 送礼系统 + 永久死亡 + essential 投降 + SaveSystem 集成 + 文档 | ✅ 系统完成 |

---

## 文档更新（实施时同步）

- `docs/architecture.md` — 添加 NPC 系统章节
- `docs/modules/npc-system.md` — 新文档，详述每个 system 接口
- `docs/modules/data-formats.md` — 添加 NPC / faction / dialogue / shop 格式
- `CLAUDE.md` — 「关键约定」追加 NPC 数据驱动惯例
