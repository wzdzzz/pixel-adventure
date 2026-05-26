# NPC 系统

抽象 NPC 框架（对话、战斗、商店、训练、同伴、派系、记忆、送礼），数据驱动，零代码每 NPC。

## 总览

```
┌──────────────────────────────────────────────────────────┐
│                    数据层 (data/)                          │
│  npcs.js  factions.js  shops.js  trainers.js  dialogues/ │
└──────────────────────────────────────────────────────────┘
                            ↓
┌──────────────────────────────────────────────────────────┐
│                  系统层 (systems/)                         │
│  NPCMemoryStore  FactionSystem  DialogueEngine           │
│  ShopService     TrainerService  CompanionManager        │
│  ActionRegistry  CombatAI        NpcTransitions          │
└──────────────────────────────────────────────────────────┘
                            ↓
┌──────────────────────────────────────────────────────────┐
│                  实体层 (entities/)                        │
│       NPC (和平)           CombatNPC (有 HP)              │
└──────────────────────────────────────────────────────────┘
                            ↓
┌──────────────────────────────────────────────────────────┐
│   UI 层  DialoguePanel / ShopPanel / TrainerPanel        │
└──────────────────────────────────────────────────────────┘
```

## 关键模块

### NPCRegistry (`src/systems/NPCRegistry.js`)
- chunk 加载时 `spawnChunk(cx, cy)`，卸载时 `despawnChunk(key)`
- `persistent=true` 的 NPC 不随 chunk 卸载（同伴专用）
- `npcMemory.isDead(id)` 的 NPC 不再 spawn
- 有 `combatStats` → `new CombatNPC(...)` 否则 `new NPC(...)`

### NPCMemoryStore (`src/systems/NPCMemoryStore.js`)
- 每个 NPC 的 `{stage, flags, vars, dead}` 持久存储
- 事件：`npcStageChanged` / `npcFlagChanged` / `npcDied`

### FactionSystem (`src/systems/FactionSystem.js`)
- 阵营 reputation -100~+100，5 级关系（intimate/friendly/neutral/hostile/vengeful）
- `getRelation(faction, npcId)` 返回 `{name, label, emoji, discount}`
- `isHostile(a, b)` 决定攻击判定
- `applyDelta(faction, deltaKey, reason)` 调整声誉
- 误伤累计 ≥ `ACCIDENTAL_HIT_AGGRO_THRESHOLD` 触发派系翻脸

### DialogueEngine (`src/systems/DialogueEngine.js`)
- 节点树：`stages → nodes → {speaker, text, options[], action, goto/next, end}`
- `start(npc)` → 加载 `dialogues/<dialogueModule>.js` → 取 `getActiveStage()` 节点
- 选项含 `if/condition` 时按 npcMemory/faction 过滤
- `action` 走 ActionRegistry

### ActionRegistry (`src/systems/ActionRegistry.js`)
统一 action 派发器。格式 `'name:arg1:arg2'` 或数组。已实现：

| Action | 说明 |
|---|---|
| `close_dialogue` | 关闭对话 |
| `show_message:txt` | 屏幕提示 |
| `set_flag:key[:value]` | 写 worldState flag |
| `open_shop[:id]` | 打开商店 |
| `open_trainer[:id]` | 打开训练师 |
| `open_enhance/reforge/gem_inlay` | 打开背包（Phase 5 桩） |
| `accept_quest:id` | 接任务 |
| `turn_in_quest:id` | 强制完成任务 |
| `give_item:id[:count]` | 给物品 |
| `take_item:id[:count]` | 拿物品 |
| `give_gold:n` / `take_gold:n` | 金币增减 |
| `heal_player[:amount]` | 治疗 |
| `learn_skill:nodeId` | 免费解锁技能节点 |
| `teleport_player:x:y` | 瞬移玩家 |
| `recruit_companion` | 招募当前对话 NPC |
| `dismiss_companion` | 解雇 |
| `gift_item:id[:count]` | 送礼（按 giftPreferences 影响声誉） |

### ShopService + ShopPanel
- 配置：`data/shops.js`（固定货架 + 加权随机池 + 篝火刷新）
- 价格：`item.value × rarityMult × shop.priceMult × relation.discount`
- 拒绝交易：关系 hostile/vengeful (discount=null)
- 篝火休息时 `refreshAll()` 清空库存

### TrainerService + TrainerPanel
- 配置：`data/trainers.js`（职业过滤 + skills[] + talentResetCost）
- 学习：调 `SkillTreeSystem.unlock(nodeId)` + 扣金币
- 重置天赋：清空 currentRank，返还点数

### CompanionManager (`src/systems/CompanionManager.js`)
- 最多 1 个同伴；招募时设 `persistent=true` 防 chunk 卸载
- 跟随：250px 外朝玩家移动，350px 加速 1.5x，1500px 瞬移
- 战斗：劫持 `CombatAI.getTarget` 返回玩家最近敌人 / 250px 内最近
- 死亡：篝火休息时 `reviveAtBonfire()` 复活

### CombatAI (`src/systems/CombatAI.js`)
通用战斗状态机（从 Enemy.js 抽象），CombatNPC 使用。状态：
`PATROL ↔ CHASE → SKILL_TELEGRAPH → SKILL_ACTIVE → SKILL_RECOVERY`
配置项：`patrolRange / detectionRange / aggroDelay / disengageTime / getTarget / canEngage`

### NpcTransitions (`src/systems/NpcTransitions.js`)
NPC 配置中的 `transitions: [{from, to, on}]` 自动 stage 切换。
`on` 支持：
- `quest:<id>:completed` / `quest:<id>:accepted`
- `flag:<npcId>:<key>`
- 任意 scene event 名

## 配置示例

```javascript
// data/npcs.js
companion_rogue: {
  id: 'companion_rogue',
  name: '游侠艾琳',
  faction: 'ally',
  essential: true,
  spawn: { chunkX: 8, chunkY: 8, localX: 18, localY: 16 },
  initialStage: 'recruitable',
  dialogueModule: 'companion_rogue',
  combatStats: { level: 3, hp: 80, skills: ['basic_melee'], primaryAttackStat: 'agility' },
  recruitCost: { gold: 500 },
  transitions: [
    { from: 'recruitable', to: 'recruited', on: 'flag:companion_rogue:recruited' }
  ]
}
```

## 存档字段

新增的 SaveSystem 字段（v3.0+）：
- `npcMemory`: NPCMemoryStore.serialize() — 每个 NPC 的 stage/flags/vars/dead
- `factionData`: FactionSystem.serialize() — 各阵营 reputation
- `shopData`: ShopService.serialize() — 每个商店当前库存
- `companion`: `{ companionId }` — 当前同伴 id，加载后由 NPCRegistry 自动 recruit

## 关键约定
- Essential NPC（如铁匠汤姆）HP=0 时 `_isSurrendered=true`，HP 锁 1，进 `__surrendered__` stage
- 普通 CombatNPC 死亡 → `npcMemory.markDead(id)` → 永久不再 spawn
- 战斗 NPC 头顶名字用红色 (`#ff8888`)，和平 NPC 用蓝色 (`#00bfff`)
- 头顶 emoji：💚 亲密 / 💛 友好 / ⚪ 中立 / 💢 敌对 / 🗡 仇恨 / ⚔ 战斗中 / 🆘 投降 / ... 对话中
