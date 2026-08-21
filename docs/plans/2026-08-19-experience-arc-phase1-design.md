# 体验弧第一阶段：开场 · 主线四幕 · 结局（设计）

> 状态：已实现（2026-08-20）。实现与设计的差异：
> 1. 开放世界原本无"击败鬼王→古印→胜利"路径（该路径是旧关卡模式遗留），
>    实现时由 StoryArc 在 bossDefeated 时于原地生成古印拾取物，读档兜底在最近巢穴补生成；
> 2. 拾印瞬间立即冻结战斗（pauseGame），避免鬼王亡语「冥火归墟」在结局窗口期击杀玩家；
> 3. 测试基建同步：enterFreshGame helper 默认跳过序章字幕卡，避免既有 smoke 测试被暂停卡住。
> 日期：2026-08-19
> 前置讨论：完整游戏 = 体验弧 + 动机链 + 情绪节奏 + 外壳 + 完成感；第一阶段先补体验弧。
> 原则：**不新增玩法系统**。只用既有的任务链（locked/triggerNpc）、对话动作（accept_quest/give_item/set_flag）、
> NPC stage 切换（NpcTransitions）、Boss 事件（bossDefeated）和 worldState flag，把现有内容组织成
> "开场 → 四幕 → 结局"的完整经历。

## 1. 目标

新玩家从新建角色到击败白骨鬼王，全程有被牵引的目标链；通关有仪式感的结束；结束后世界仍可游玩。
具体拆成三块：

1. **序章**：出生后 3~5 分钟的被引导开局（登记散修 → 领第一桩差事），教学全部情境化，无教程弹窗。
2. **主线四幕**：现有 4 个主线任务由"并列可接的杀怪清单"改为链式四幕，每幕有交接对话与一句世界观揭示。
3. **结局**：击败鬼王 → 灵潮平息演出 → 拾取古印 → 结语字幕卡 → 结算 + 制作名单 → 「继续游历」post-game。

## 2. 范围控制（明确不做）

- 不做过场动画 / 镜头运镜系统——只用字幕卡、对话与既有横幅
- 不做寻路箭头 / 任务导航线——方向指引只用文案（"向西面山林去"）
- 不做新音乐 / 配音；不改任何战斗数值、掉落、地图生成
- 不做成就 / 完成度（第三阶段）；不做暂停菜单（第四阶段）

## 3. 序章设计

### 3.1 开场字幕卡

新档进入 MainGameScene 时（`worldState.getFlag('prologue_done')` 为假），世界渲染完成后压一层
黑幕字幕卡，三行逐行淡入，任意键/点击跳过，结束后淡出交还操作：

```
灵脉异动，古宗禁制年久松脱。
妖祟渐入商路，坊市悬赏日多。
你背上行囊来到栖云坊市——散修的路，从挂名一纸名帖开始。
```

实现：MainGameScene 内一个一次性覆盖层（rectangle + text + tween），非新场景。

### 3.2 序章引导任务 `ow_prologue`

把"去悬赏堂登记"本身做成一个隐藏引导主线任务，天然接入现有任务追踪 HUD 与游历录：

```js
{
  id: 'ow_prologue', title: '初到坊市', type: 'main',
  autoAvailable: false,   // 新档由代码直接 acceptQuest 激活；老档迁移视为已完成
  objectives: [{ id: 'meet_leijou', text: '到悬赏堂找雷九登记', type: 'interact', target: 'bounty_officer', required: 1 }],
  rewards: {}             // 无奖励，奖励在对话里发
}
```

- 新档判定：加载流程未读档且 `prologue_done` 未设 → `questSystem.acceptQuest('ow_prologue')`。
- 雷九头顶挂金色「！」浮动标记（NPC 侧小改动，由雷九当前 stage 决定显隐，见 4.3）。

### 3.3 雷九登记对话（intro stage）

```
雷九：新面孔？要在云荒讨生活，先在悬赏堂挂个名。……好了，从今日起你就是在册散修。
  [领第一桩差事]
雷九：近郊水源发浑，浊水精比往年多得不像话。去清掉五只，回来领钱。
      拿上这几包回春散——死在城门口，我可不好交代。
  → actions: accept_quest:ow_first_hunt, give_item:potion:3, set_flag:prologue_done
```

stage 切换不靠对话动作，由 NpcTransitions 监听 `quest:ow_first_hunt:accepted → act1` 完成。

### 3.4 情境教学提示（一次性 toast）

全部走现有 `showMessage` toast，每条由 worldState flag 保证只出现一次，新档才触发：

| flag | 触发点 | 文案 |
|---|---|---|
| hint_move | 字幕卡结束后 1s | WASD 移动 · E 与人交谈 |
| hint_attack | 首次有敌人进入索敌（enemyAggro/靠近） | 鼠标左键攻击 · 数字键 1-4 施展术法 |
| hint_loot | 首次拾取装备 | 按 B 打开行囊，装备新得的器物 |
| hint_potion | 首次气血低于 50% | 按 F1 服用回春散 |
| hint_levelup | 首次升级 | 按 X 打开传承，用悟道点习练术法 |

## 4. 主线四幕

### 4.1 链条结构

4 个既有主线任务全部改 `autoAvailable: false`，仅能通过雷九对话逐幕解锁（`acceptQuest` 支持 locked→active）。
任务 ID、目标、数量、奖励一律不变。

| 幕 | 任务 ID | 目标（不变） | 幕后揭示（完成后回访雷九） |
|---|---|---|---|
| 序 | ow_prologue | 见雷九登记 | —（交接第一幕） |
| 一 | ow_first_hunt | 浊水精 ×5 | 水中浊气未散，不似天灾，像有什么在上游搅动 |
| 二 | ow_goblin_threat | 山魈 ×6 | 山魈骨饰带阴煞气——只在古宗封印附近才有 |
| 三 | ow_bone_legion | 阴兵 ×6 + 尸傀将军 ×1 | 尸傀也是傀儡，操线的是白骨鬼王；封印撑不了几天 |
| 四 | ow_slay_king | 白骨鬼王 ×1 | → 进入结局（第 5 节） |

注：任务完成瞬间仍按现状自动发 XP/灵石（不改 QuestSystem 发奖时机）；
"回访雷九"承载的是**叙事交接与下一幕解锁**，不是领奖，避免玩家白跑。

### 4.2 幕间对话文案（初稿，克制口语风）

- **act1_done**：「浊水精清了？水里那股浊气还没散……不是天灾，倒像有什么在上游搅动。西边山里的山魈最近也不安分，去看看。」→ [接下差事] accept_quest:ow_goblin_threat
- **act2_done**：「你带回的骨饰上有阴煞气——这东西只在古宗封印附近才有。北面太虚宗遗址方向不对劲，阴兵都出来了。当心那个带兵的尸傀。」→ [接下差事] accept_quest:ow_bone_legion
- **act3_done**：「尸傀将军也是傀儡，操线的是白骨鬼王。遗址深处的封印撑不了几天了——云荒安不安稳，就看这一趟。」→ [领最后一桩差事] accept_quest:ow_slay_king
- **act4 进行中**：「鬼王在遗址深处等着。别逞强，备足丹药再去。」
- **post（通关后）**：「云荒能有今日安稳，坊市都记着你的名字。悬赏照旧有——世道从不缺麻烦。」

每个 stage 的对话都保留既有「查看悬赏榜 / 刷新今日悬赏」选项（options 附加在各 stage）。

### 4.3 雷九 stage 机

NPCMemoryStore 已持久化 stage；transitions 全部数据配置在 `data/npcs.js` 雷九条目：

```
intro ──quest:ow_first_hunt:accepted──▶ act1
act1 ──quest:ow_first_hunt:completed──▶ act1_done
act1_done ──quest:ow_goblin_threat:accepted──▶ act2
act2 ──quest:ow_goblin_threat:completed──▶ act2_done
act2_done ──quest:ow_bone_legion:accepted──▶ act3
act3 ──quest:ow_bone_legion:completed──▶ act3_done
act3_done ──quest:ow_slay_king:accepted──▶ act4
act4 ──quest:ow_slay_king:completed──▶ post
```

头顶「！」显隐规则：stage ∈ {intro, act1_done, act2_done, act3_done} 时显示（有新差事可交接）。

### 4.4 方向指引

每幕接取时对话文案自带方向词（西面山林 / 北面遗址……），并在接取后 `showMessage` 一条方向提示。
不做地图标记与导航线（第二阶段再评估）。

## 5. 结局仪式与 post-game

### 5.1 灵潮平息演出（击败鬼王瞬间）

MainGameScene 监听 `bossDefeated`，若 `enemy.config.id === 'skeleton_king'`：

1. 既有击败横幅照常；
2. 1.5s 后：屏幕一次柔和白闪（camera flash 800ms）+ toast「阴煞灵潮正在退去……」；
3. `worldState.setFlag('world_calm')`（供 post 对话/后续阶段使用）；
4. toast 引导：「拾取 镇界古印」。

### 5.2 结语字幕卡 → 结算

拾取镇界古印（现有 `handleVictory` 路径）改为先播结语字幕卡（同序章形式，黑幕逐行淡入，可跳过）：

```
白骨鬼王溃散，四方封印重归沉寂。
阴煞灵潮自遗址退去，如潮水还海。
商路复通，坊市灯火如常。
云荒很大，你的路还长。
```

字幕卡结束 → **先自动写档**（当前槽位，含主线完成与 world_calm 状态）→ `scene.start('VictoryScene')`。

### 5.3 VictoryScene 扩展

在现有结算（历练所得/禁制令牌）下方追加：

- **制作名单**（分段淡入）：《云荒问道》｜设计·程序·美术·音乐：wzdzzz × Claude｜引擎：Phaser 3｜感谢游玩
- 两个选项替换现有单一「重返山门」：
  - **继续游历**：读取刚写入的当前槽位存档回到世界（复用 SaveSelectScene 的加载路径；玩家在坊市篝火醒来）
  - **重返山门**：回主菜单（现状行为）

### 5.4 post-game 状态

- 主线四幕全部 completed，游历录主线区显示完成态；
- 雷九 stage=post，悬赏刷新照常（可重复赏金即 post-game 内容）；
- 不重置世界、不做 NG+（第三阶段再议）。
- 边界：击杀鬼王后未拾取古印就离开——沿用现状（掉落物持久性不在本阶段改动），
  仅靠 5.1 的 toast 引导；`ow_slay_king` 已完成不受影响。

## 6. 改动清单（文件级）

| 文件 | 改动 |
|---|---|
| `data/quests.js` | 新增 ow_prologue；4 个主线 autoAvailable→false |
| `data/dialogues/bounty_officer.js` | 重写为多 stage：intro/act1~act4/act*_done/post，含全部交接文案 |
| `data/npcs.js` | 雷九条目加 transitions 表 + 初始 stage=intro |
| `entities/NPC.js`（或 MainGameScene） | 头顶「！」标记（按 stage 显隐，~30 行） |
| `scenes/MainGameScene.js` | 新档判定+acceptQuest(ow_prologue)；字幕卡组件（序章/结语复用）；bossDefeated 结局钩子；教学 hint 触发点 |
| `managers/InteractionHandler.js` | handleVictory 改为结语字幕卡→写档→VictoryScene |
| `scenes/VictoryScene.js` | 制作名单 + 继续游历/重返山门双选项 |
| `systems/SaveSystem.js` | storyVersion 迁移（见 7） |

## 7. 存档兼容（storyVersion: 1）

老档（无 storyVersion）加载时在 `_normalizeSaveData` 内存态迁移，不回写：

1. `prologue_done` 置真，`ow_prologue` 置 completed（老玩家不重走序章）；
2. 主线链修补：找到最高进度幕 k（active 或 completed）→ 幕 ≤k 保持原状；k 之后全部 locked；
   若老档 4 幕全为 available（从未开始）→ 第一幕 locked 其余 locked，雷九 stage=intro（重新从登记开始，无损失）；
3. 雷九 stage 按修补后的链条状态推导写入 npcMemory；
4. 已通关老档（ow_slay_king completed）→ 直接 post 状态 + world_calm。

## 8. 测试与验收

新增自动化：

- `scripts/prologue-test.mjs`：新档 → 字幕卡出现并可跳过 → ow_prologue 追踪中 → 雷九「！」可见 →
  对话登记 → ow_first_hunt active + 回春散×3 入包 → 模拟击杀 5 浊水精 → 雷九 stage=act1_done → 接第二幕成功。
- `scripts/ending-test.mjs`（复用 boss-test 基建）：召唤并击杀鬼王 → 白闪+平息 toast → 拾古印 →
  结语字幕卡 → VictoryScene 含制作名单 → 继续游历回到世界且雷九 stage=post。
- `scripts/story-migration-test.mjs`（node 单测）：构造三种老档（未开始/中途/已通关）断言迁移结果。

验收标准：

- 新档从出生到接下第一幕差事 ≤3 分钟，全程无阻断式教程；
- 游历录主线区任何时刻只有一个当前幕（其余 locked 不可见或置灰）；
- 通关流程完整走通且通关后可继续游玩，赏金循环正常；
- 三类老档迁移后状态自洽，不丢进度不重复发奖；
- 既有全部 smoke 测试通过。

## 9. 实现顺序

1. **P0 数据层**：quests.js 链化 + 雷九对话/transitions（纯数据，先行验证链条走得通）
2. **P1 序章**：字幕卡 + ow_prologue + 「！」标记 + 教学 hints
3. **P2 结局**：平息演出 + 结语卡 + VictoryScene 扩展 + 继续游历
4. **P3 兼容与测试**：storyVersion 迁移 + 三个新测试脚本 + 全量回归
