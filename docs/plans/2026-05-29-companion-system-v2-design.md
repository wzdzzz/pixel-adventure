# 伙伴系统 v2 设计文档（多招募 / 单出战 / UI / 操作 / 交互）

> 日期：2026-05-29 · 分支：`feature/ui-panel-system`
> 状态：**设计阶段**（实现前需评审本文档）

## 0. 目标概述

把当前"最多 1 个同伴"的简易系统，升级为**队伍 / 伙伴系统**：

- **可招募多个伙伴**（roster 队伍名册），但**同时只有 1 个"出战"**（active，在世界中跟随 + 战斗）。
- **伙伴界面**（PanelScene 新增"队伍"标签）：查看名册、详情、切换出战、待命、解散。
- **伙伴操作**：出战 / 换下（待命）/ 解散 / （可选）下达指令。
- **伙伴交互**：与出战伙伴对话下达战术指令（跟紧 / 待命 / 激进 / 防守）；保留送礼好感。
- 同时修复当前 4 个已确认 bug（见 §1）。

设计原则延续项目既有约定：数据驱动、事件解耦、`Data ← Systems ← Entities ← Scenes`、中文注释/UI、存档兼容老档。

---

## 1. 当前实现 + 已确认 Bug（根因已用复现验证）

现状：`CompanionManager`（`src/systems/CompanionManager.js`）单槽 `this.current`，招募把场上的 `CombatNPC` 标 `persistent` + 派系切 `ally` + 劫持其 `CombatAI.getTarget/canEngage`，每帧 `update()` 做跟随/瞬移。伙伴是带 `combatStats` 的 `CombatNPC`（见 `npcs.js: companion_rogue`）。

| # | Bug | 根因（文件:行） | 修复方向 |
|---|---|---|---|
| 1 | 招募后**不跟随** | `CombatNPC.update()` 每帧调 `ai.update()`，PATROL 态 `_updatePatrol` 用 `physics.moveTo`/`setVelocity` 覆盖了 `CompanionManager.update()` 设的跟随速度（CombatAI.js:227-253；CompanionManager 先跑、AI 后跑覆盖） | 出战伙伴进入 **FOLLOW 模式**：AI 无目标时不跑 PATROL，由 CompanionManager 接管移动（见 §4.3） |
| 2 | 对话**一直是招募内容** | `recruit_companion` action 的卫语 `if (ok && npc.npcMemory && npc.id)` 中 `npc.npcMemory` **恒为 undefined**（memory 在 `scene.npcMemory`，实例上没有该属性）→ `recruited` flag 从不写入 → `recruitable→recruited` 的 `flag:` 转换从不触发（ActionRegistry.js:289-291；npcs.js:84 transitions） | 去掉错误卫语，直接 `scene.npcMemory.setFlag(npc.id,'recruited',true)`（见 §4.2） |
| 3 | **队友伤害**：玩家可打到伙伴 | `handleAttackHit`/`handleSkillHit` 与 `NPCRegistry._registerCombatOverlap` 均无 `faction==='ally'` 判定（InteractionHandler.js:295/347；NPCRegistry.js:92-95） | 伤害入口统一加"友方跳过"过滤（见 §4.4） |
| 3b | **队友伤害**：伙伴可打到玩家 | `enemyHitboxSpawned`/`enemyProjectileSpawned` 对玩家的 overlap 无 owner 派系判定（MainGameScene.js:965/986） | hitbox/projectile 记 owner.faction，命中玩家时若 owner 为 ally 则跳过（见 §4.4） |

> 这些修复**必须包含在 v2 实现里**——多伙伴只是把单槽换成名册，跟随/友伤/对话推进是底层正确性。

---

## 2. 核心概念与数据模型

### 2.1 概念

- **Roster（名册）**：已招募的全部伙伴（持久化数据，不一定在世界里）。
- **Active / 出战**：名册中**唯一**被部署到世界的伙伴（一个真实 `CombatNPC`，跟随 + 战斗）。
- **Benched / 待命**：名册中其余伙伴，**纯数据**，不在世界、不渲染、不战斗。
- **招募来源 NPC**：世界中可招募的 `CombatNPC`（如 `companion_rogue`）。招募 = 把该 NPC "收编"成名册条目，其世界实例被移除/隐藏（变为数据）。

### 2.2 数据结构

```js
// 名册条目（纯数据，可序列化）
CompanionEntry = {
  uid,            // 唯一实例 id（招募时生成，区分同模板多份；MVP 可用 npcId）
  npcId,          // 模板 id（companion_rogue…），用于取 config / dialogueModule
  name,           // 显示名
  // 战斗数值快照（出战时用于重建 CombatNPC）
  level,          // 伙伴等级（v2 暂不独立成长，取 config.combatStats.level，预留升级）
  hpMax,          // 最大 HP
  hp,             // 当前 HP（待命缓慢回满 / 出战保留；死亡=0）
  skills,         // 技能 id 列表（来自 combatStats.skills）
  primaryAttackStat,
  // 状态
  state,          // 'benched' | 'active' | 'dead'
  stance,         // 战术姿态：'follow'(跟紧) | 'hold'(原地待命) | 'aggressive' | 'defensive'
  affinity,       // 好感度（预留；或复用 FactionSystem reputation）
  recruitedAt,    // 招募时间戳（排序用）
}

// 管理器持有
CompanionManager {
  roster: Map<uid, CompanionEntry>,
  activeUid: string | null,     // 当前出战
  activeNpc: CombatNPC | null,  // 出战伙伴的世界实例（仅 active 存在）
}
```

> **设计决策（默认值，可在评审改）**：
> - **D1 伙伴独立成长**：v2 **不做**独立升级/经验，等级取模板配置；预留 `level/xp` 字段。
> - **D2 伙伴装备**：v2 **不做**伙伴穿装备；预留（未来可给 active 伙伴一个简化装备槽）。
> - **D3 好感系统**：v2 复用 `FactionSystem`（送礼已走 faction delta）；`affinity` 字段预留独立化。
> - **D4 名册上限**：**无上限**（队伍面板需支持滚动/分页以容纳任意数量）。
> - **D5 招募后是否自动出战**：若当前**无出战**则自动出战；否则进待命并提示"已加入队伍，可在队伍面板出战"。

---

## 3. 架构

```
data/companions.js?(可选元数据)  +  data/npcs.js(combatStats/recruitCost/dialogueModule)
        ↑
CompanionManager（roster + active 生命周期 + 跟随 + 友伤判定 + 序列化）
        ↑                      ↑
CombatNPC / CombatAI(FOLLOW)   CompanionPanel(UI, PanelScene tab)
        ↑                      ↑
MainGameScene(update/overlap/spawn 编排) + ActionRegistry(recruit/dismiss/stance) + 对话
```

- `CompanionManager` 升级为名册管理：`recruit / dismiss / deploy(uid) / bench(uid) / getRoster / getActive / setStance / update / serialize / deserialize`。
- **出战实例化**：`deploy(uid)` → 用 entry 数据在玩家身边生成/复用一个 `CombatNPC`（active），进入 FOLLOW 模式；`bench()`/换人 → 把 active 的 hp 等回写 entry，销毁世界实例。
- **招募**：把世界里的候选 NPC 转成 entry（移除其世界实例，避免"招募后本体还站在原地"），按 D5 决定是否立即 deploy。

---

## 4. 关键机制详设

### 4.1 招募流程（修 bug2 + 多名册）

`recruit_companion` action：
1. 校验金币（`recruitCost`）。（名册无上限，不限数量）
2. `mgr.recruitFromNpc(npc)`：据 npc.config 建 `CompanionEntry` 入 roster；**移除该候选 NPC 的世界实例**（`npcRegistry.despawn`/隐藏）并 `npcMemory.setStage(npcId,'recruited')` 或 setFlag。
3. **正确写 flag**：`scene.npcMemory.setFlag(npc.id,'recruited',true)`（去掉 `npc.npcMemory` 卫语）→ 触发 `recruitable→recruited` 转换（再遇到/同模板对话显示已招募内容）。
4. 按 D5：无 active → `deploy(uid)`；否则提示进待命。
5. 失败回滚金币。

### 4.2 对话推进修复

仅需 §4.1 第 3 步。验证：`NPCMemoryStore.setFlag` 已 `emit('npcFlagChanged',{npcId,key,value})`（NPCMemoryStore.js:55），`NpcTransitions` 已监听 `flag:` 前缀（NpcTransitions.js:37-44），故写对 flag 即生效。

### 4.3 出战伙伴跟随修复（修 bug1）—— FOLLOW 模式

在 `CombatAI` 增加"跟随模式"开关，避免 PATROL 抢速度：

- `CombatNPC`/`CombatAI` 增 `followMode`（出战伙伴 deploy 时置 true）。
- `CombatAI.update`：当 `followMode && !inCombat`（无敌对目标）→ **跳过 `_updatePatrol`**，把移动权交给 `CompanionManager.update()`（设跟随速度）。有目标时正常进战斗状态机（攻击敌人）。
- `CompanionManager.update()` 跟随逻辑沿用现有（FOLLOW_RANGE/RUSH/TELEPORT/卡墙瞬移），但仅当 `!inCombat`。
- `stance` 影响：
  - `follow`（默认）：常规跟随 + 自动接敌。
  - `hold`：原地待命（不跟随，仍可反击邻近敌人）。
  - `aggressive`：扩大索敌半径、主动冲向敌人。
  - `defensive`：缩小索敌、只在玩家/自身被攻击时还手，优先贴玩家。

### 4.4 友伤修复（修 bug3 / 3b）—— 统一派系过滤

新增工具 `isFriendly(a,b)`（同为 player/ally 视为友方）。在所有伤害入口前置判定：

- **玩家 → 目标**：`handleAttackHit`/`handleSkillHit` 开头 `if (target.faction === 'ally') return;`（出战伙伴 faction='ally'）。`_registerCombatOverlap` 亦可在回调内早退。
- **伙伴/敌人 hitbox/projectile → 玩家**：`enemyHitbox`/`projectile` 记 `_ownerFaction`；命中玩家时 `if (ownerFaction === 'ally') return;`（伙伴不伤玩家）。
- **伙伴 ↔ 敌人**：保持敌对（伙伴能打怪、能被怪打）。
- 玩家攻击误伤中立 `townfolk` 的既有"声望惩罚"逻辑（`_checkAccidentalHit`）保留，但对 `ally` 直接跳过伤害与惩罚。

### 4.5 出战切换（deploy/bench）

- `deploy(uid)`：若已有 active 且 ≠uid → 先 `bench(activeUid)`（回写 hp、销毁世界实例）。再据 entry 生成 active `CombatNPC`（玩家身旁），`followMode=true`，应用 stance。死亡(entry.state==='dead' 且 hp<=0) 的伙伴需先复活（篝火/道具）才能出战（或出战即半血，按 D6）。
- `bench(uid)`：active 数据回写 entry，销毁/隐藏世界实例，`activeUid=null`。
- `dismiss(uid)`：从 roster 删除；若是 active 先 bench。被解散的招募型伙伴是否可再招募？默认**可**（重置该 npc stage 到 recruitable）。

> **D6**：死亡伙伴出战 → 默认需篝火 `reviveAll()` 或不允许出战（提示"该伙伴已倒下，需在篝火恢复"）。沿用现有 `reviveAtBonfire`，扩展为复活全 roster。

---

## 5. 伙伴 UI（PanelScene 新增"队伍"标签）

`PanelScene.TABS` 增 `'party'`（图标 🛡 或 👥，标签"队伍"，快捷键如 `T`）。布局复用面板风格（黑底 + 边框 + Courier New）。

```
┌───────────────── 队伍 (3/6) ─────────────────┐
│ [名册列表 左栏]            [详情 右栏]          │
│ ▶ 游侠艾琳  Lv3  出战中     游侠艾琳            │
│   守卫鲍勃  Lv5  待命       Lv3 · HP 80/80      │
│   法师莉拉  Lv4  待命(倒下) 技能: 基础近战…     │
│   …                         姿态: ● 跟紧 ○原地  │
│                                  ○激进 ○防守    │
│                             [ 出战 ] [ 待命 ]   │
│                             [ 解散 ]            │
└───────────────────────────────────────────────┘
```

- 左栏：roster 列表，每行 名字/等级/状态（出战中 / 待命 / 待命(倒下)）。点击选中 → 右栏详情。
- 右栏：选中伙伴详情（名、等级、HP、技能、姿态单选）+ 操作按钮：
  - **出战**（选中非 active 且存活）→ `deploy(uid)`，列表刷新。
  - **待命**（选中为 active）→ `bench(uid)`。
  - **解散** → 二次确认 → `dismiss(uid)`。
  - **姿态**单选 → `setStance(uid, stance)`（active 立即生效，benched 记录待出战生效）。
- 事件驱动刷新：`companionRecruited/Dismissed/Deployed/Benched/Died/Revived/StanceChanged` → `refreshPartyTab()`。

> UI 复用 `CharacterPanel`/`InventoryPanel` 的 mixin 风格（`Object.assign(PanelScene.prototype, ...)`），新建 `src/ui/panels/PartyPanel.js`（`createPartyTab/refreshPartyTab`）。

---

## 6. 伙伴交互（世界内）

与出战伙伴交互（靠近按 E）→ 简短指令对话（不走完整 DialogueEngine，或走精简节点）：

- 选项：`跟紧我` / `原地待命` / `主动出击(激进)` / `保护我(防守)` / `查看队伍(打开面板)` / `让你休息(待命)`。
- 选项 → 对应 `set_stance`/`bench`/`open_party_panel` action。
- 送礼好感沿用现有 `gift_item`（faction delta），对出战伙伴可用。

新增对话 action：
- `set_stance:uid?:stance`（默认对 active）。
- `open_party_panel` → `switchPanelTab('party')` 或 launch PanelScene。
- 复用 `dismiss_companion`（扩展支持 uid）。

---

## 7. 存档（兼容老档）

扩展 `SaveSystem` 的 `companion` 字段 → `companions`：

```js
companions: {
  roster: [CompanionEntry…],   // 全名册
  activeUid: 'companion_rogue', // 出战
}
```

- **老档兼容**：旧 `companion:{companionId}` → 迁移为单条 roster + activeUid。
- 加载：`CompanionManager.deserialize` 重建 roster；`_restoreCompanionIfReady` 改为"按 activeUid 出战该 entry"（不再依赖世界里找到候选 NPC，因为出战是从 entry 数据生成）。
- 招募来源 NPC 的 stage（recruited/已收编）由 npcMemory 持久化，避免重复刷出可招募本体。

---

## 8. 事件清单（新增/变更）

| 事件 | payload | 用途 |
|---|---|---|
| `companionRecruited` | `{uid, npcId, name}` | 入册 |
| `companionDismissed` | `{uid}` | 出册 |
| `companionDeployed` | `{uid, npc}` | 出战 |
| `companionBenched` | `{uid}` | 待命 |
| `companionDied` | `{uid, npc}` | 倒下 |
| `companionRevived` | `{uid}` | 复活 |
| `companionStanceChanged` | `{uid, stance}` | 姿态 |
| `rosterChanged` | `()` | UI 通用刷新 |

（SoundManager 可后续给 deployed/recruited 加音效，非本期重点。）

---

## 9. 实施阶段拆分（建议）

- **P0 底层修复**（独立小步，先落地正确性）：
  - bug2 招募 flag、bug3/3b 友伤过滤、bug1 FOLLOW 模式（CombatAI followMode + CompanionManager 接管移动）。
- **P1 名册数据层**：`CompanionEntry` + `CompanionManager` 重构（roster/active/deploy/bench/dismiss/serialize/deserialize）+ 招募改为入册 + 移除候选世界实例。
- **P2 存档迁移**：`companions` 字段 + 老档兼容 + 复活全员。
- **P3 队伍 UI**：`PartyPanel` tab + 出战/待命/解散/姿态 + 事件刷新。
- **P4 世界交互**：出战伙伴指令对话 + `set_stance`/`open_party_panel` action + stance 战斗行为差异。
- **P5 打磨**：音效、文本、UI 反馈、边界（满员/倒下/重复招募）。
- **P6 检测**：build + Playwright 冒烟（招募→出战→走动跟随→打怪不误伤→切换待命→换人→存读档）。

---

## 10. 风险 / 边界

- **出战实例化与现有 NPCRegistry/chunk 流式加载的关系**：active 伙伴 `persistent`，不随 chunk 卸载销毁；benched 不在世界。
- **AI 劫持的还原**：deploy/bench 时正确装/卸 `followMode` 与 `getTarget/canEngage` 劫持，避免泄漏（参考现有 dismiss 的 `_orig*` 还原）。
- **重复招募同模板**：uid 区分；或限制每模板 1 份（默认限制 1 份，简化）。
- **场景重启监听器泄漏**：PartyPanel 复用 PanelScene（每次 create 重建，天然干净）；CompanionManager 在 MainGameScene 单例上，update 由场景调用，无新增 scene.events 长期监听（如有，需 shutdown 解绑，见 CLAUDE.md 常见陷阱）。

---

## 11. 开放决策（评审确认，默认见括号）

- D1 伙伴独立成长（默认：否，预留字段）
- D2 伙伴装备（默认：否，预留）
- D3 好感独立系统 vs 复用 faction（默认：复用 faction）
- D4 名册上限（**无上限**，UI 需滚动/分页）
- D5 招募后自动出战（默认：无 active 时自动，否则待命）
- D6 倒下伙伴出战（默认：需篝火复活）
- D7 每模板可招募份数（默认：1 份）
- D8 UI 入口（默认：PanelScene 新增"队伍"tab，快捷键 T）

> 以上默认值已写入设计；如需调整，评审时指出，否则按默认实现。
