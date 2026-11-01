# 开放世界任务 & 赏金系统 设计

> 日期：2026-05-29 · 分支：`feature/ui-panel-system`

## 背景

`QuestSystem` 的事件追踪机制完好（`enemyDeath`→击杀、`inventoryUpdated`→收集、`playerInteract`→交互，自动结算奖励），但 **内容与开放世界脱节**：

- `quests.js` 仍是关卡制残留：目标指向不存在的 `elder`/`scout` NPC、`key`/`portal`/`artifact`、`triggerLevel`。
- 唯一对话钩子 `accept_quest:tom_intro` 指向不存在的任务。
- 开放世界没有任何"可接取/可重复"的任务来源 → 玩家无持续目标（审计结论：打完即无事可做）。
- `accept_quest` action 只认 `status==='locked'`、用了 `q.name`（实际是 `title`）。

## 目标（v1）

让任务在开放世界真正可玩，并提供**无限可重复赏金**：

1. 重写 `quests.js`：删除关卡残留，新增可接取的击杀/收集类任务（用真实敌人 id / 物品）。
2. `QuestSystem`：
   - 支持 `available`（可接取）状态；`acceptQuest(id)` → `active`。
   - `generateBounties(count)`：按玩家等级生成可重复击杀赏金（随机敌人、缩放数量与金/经验奖励）。
   - `refreshBounties()`：清掉未接取的旧赏金，刷新一批。
   - 动态赏金（非静态 data）需序列化：`toJSON/fromJSON` 持久化完整定义 + 进度。
   - 保留：目标达成自动完成 + 发奖。
3. UI：`QuestLogPanel` 增"可接取"分组 + 选中后"接受任务"按钮。
4. 接取入口：
   - 任务日志（L 键）直接可接取（零新 UI）。
   - 新增"赏金官"NPC（城镇），对话可"刷新今日委托"。
   - 篝火休息也刷新赏金（回城节奏）。
5. 修 `accept_quest`：兼容 `available`/`locked` + 用 `title`。

## 数据模型

```js
// 静态任务（quests.js）
{ id, title, type:'main'|'side'|'bounty', description,
  autoAvailable: true,          // 进游戏即 'available'（否则 'locked' 由触发器开启）
  objectives:[{ id, text, type:'kill'|'collect', target, required }],
  rewards:{ xp, gold } }

// 动态赏金（generateBounties 生成，id 形如 bounty_<seq>）
// 结构同上，type:'bounty'，需整体进存档
```

状态：`locked`（触发器开）→ `available`（板上可接）→ `active`（追踪中）→ `completed`（已结算）。
仅 `active` 任务参与目标追踪（`updateObjectives` 已按 status 过滤）。

## 赏金生成

- 敌人池：`slime/goblin/spider/skeleton/bat/orc_warrior/fire_mage`（排除 boss）。
- 数量：按 tier（minion 8、normal 5、elite 3）+ 玩家等级微调。
- 奖励：`gold = required * tier系数 * (1+lv*0.1)`，`xp` 同理。
- 中文名映射在 data 层（敌人无内置中文名）。
- 去重：不生成与现有 available 赏金同敌人的重复项。

## 序列化

`toJSON`：静态任务存 `{id,status,objectives:[{id,current}]}`；动态赏金（id 前缀 `bounty_`）额外存完整定义（title/desc/objectives/rewards/type）。
`fromJSON`：先按定义重建动态赏金加入 `this.quests`，再套用 status/进度。

## 验收

- 进游戏即有 available 任务；`acceptQuest` → active；击杀目标敌人 → 进度+1 → 完成 → 金币/经验到账。
- `generateBounties` 产出合法可接取赏金；`refreshBounties` 轮换。
- QuestLogPanel 显示"可接取"并能接受。
- 存档：生成的赏金 + 进度跨存读档保留。
- build 通过、无 console/page error。

## 非目标（v1 不做）

- `reach`（到达 POI）类目标（无 reach 事件，留待 POI 进入事件）。
- 手动 turn-in 交付步骤（沿用达成即自动发奖）。
- 多步剧情链 / 分支（后续内容迭代）。
