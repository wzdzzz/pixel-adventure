# NPC 系统实施计划

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement task-by-task. Steps use checkbox (`- [ ]`) syntax.

**Goal:** 实现完整、抽象、数据驱动的 NPC 系统（对话/战斗/经济/成长/进阶全功能）

**Architecture:** 9 个独立 system + 数据驱动配置 + 节点化对话树 + 5 级阵营关系，按 7 个 phase 分阶段交付

**Tech Stack:** Phaser 3.90、vanilla JS ES Modules、Vite，无单测框架（采用浏览器手测）

**Spec:** `docs/superpowers/specs/2026-05-26-npc-system-design.md`

---

## 测试说明

项目无单测框架，每 task 的「测试」步骤 = 在浏览器（`pnpm dev`）冒烟验证 + console 检查。
所有任务完成后做一次完整集成测试（Phase 7 末尾）。
每个 task 完成后立即 commit。

---

## Phase 1：数据骨架 + 基础 NPC

### Task 1.1：创建 data/factions.js

**Files:**
- Create: `src/data/factions.js`

- [ ] **Step 1: 写文件**

```javascript
// src/data/factions.js
export const FACTIONS = {
  player:     { id: 'player',     hostileTo: [] },
  ally:       { id: 'ally',       hostileTo: ['monster', 'bandit'] },
  townfolk:   { id: 'townfolk',   hostileTo: ['monster', 'bandit'] },
  town_guard: { id: 'town_guard', hostileTo: ['monster', 'bandit'] },
  monster:    { id: 'monster',    hostileTo: ['player', 'ally', 'townfolk', 'town_guard'] },
  bandit:     { id: 'bandit',     hostileTo: ['player', 'ally', 'townfolk', 'town_guard'] },
  neutral:    { id: 'neutral',    hostileTo: [] }
};

export const INITIAL_REPUTATION = {
  townfolk: 0, town_guard: 0, ally: 50, monster: -100, bandit: -50, neutral: 0
};

export const RELATION_THRESHOLDS = [
  { min: 60,   name: 'intimate',  label: '亲密', emoji: '💚', discount: 0.7 },
  { min: 20,   name: 'friendly',  label: '友好', emoji: '💛', discount: 0.85 },
  { min: -19,  name: 'neutral',   label: '中立', emoji: '⚪', discount: 1.0 },
  { min: -59,  name: 'hostile',   label: '敌对', emoji: '💢', discount: null },
  { min: -100, name: 'vengeful',  label: '仇恨', emoji: '🗡', discount: null }
];

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

export function getRelationByValue(value) {
  for (const t of RELATION_THRESHOLDS) {
    if (value >= t.min) return t;
  }
  return RELATION_THRESHOLDS[RELATION_THRESHOLDS.length - 1];
}
```

- [ ] **Step 2: Commit**

```bash
git add src/data/factions.js
git commit -m "feat(npc): 阵营定义 + 5 级关系阈值"
```

---

### Task 1.2：实现 FactionSystem

**Files:**
- Create: `src/systems/FactionSystem.js`

- [ ] **Step 1: 写文件**

```javascript
// src/systems/FactionSystem.js
import { FACTIONS, INITIAL_REPUTATION, REPUTATION_DELTAS, getRelationByValue } from '../data/factions.js';

export class FactionSystem {
  constructor(scene, initial = null) {
    this.scene = scene;
    // 玩家 → 各阵营 reputation
    this.reputation = new Map();
    // NPC 个体 reputation 偏移
    this.npcOverrides = new Map();
    // 动态阵营关系（hostileTo 的运行时副本，可被剧情/动作修改）
    this.dynamicHostility = new Map();

    const init = initial?.reputation || INITIAL_REPUTATION;
    for (const [k, v] of Object.entries(init)) this.reputation.set(k, v);
    for (const [k, v] of Object.entries(initial?.npcOverrides || {})) this.npcOverrides.set(k, v);
    for (const [k, v] of Object.entries(initial?.dynamicHostility || {})) {
      this.dynamicHostility.set(k, new Set(v));
    }
  }

  getReputation(factionId, npcId = null) {
    const base = this.reputation.get(factionId) ?? 0;
    const override = npcId ? (this.npcOverrides.get(npcId) ?? 0) : 0;
    return Math.max(-100, Math.min(100, base + override));
  }

  getRelation(factionId, npcId = null) {
    return getRelationByValue(this.getReputation(factionId, npcId));
  }

  addReputation(factionId, delta, source = '') {
    const oldVal = this.reputation.get(factionId) ?? 0;
    const newVal = Math.max(-100, Math.min(100, oldVal + delta));
    if (oldVal === newVal) return;
    this.reputation.set(factionId, newVal);

    const oldRelation = getRelationByValue(oldVal);
    const newRelation = getRelationByValue(newVal);
    this.scene?.events?.emit('reputationChanged', { factionId, oldVal, newVal, delta, source });
    if (oldRelation.name !== newRelation.name) {
      this.scene?.events?.emit('relationChanged', { factionId, oldRelation, newRelation });
    }
  }

  setReputation(factionId, value) {
    const clamped = Math.max(-100, Math.min(100, value));
    const oldVal = this.reputation.get(factionId) ?? 0;
    this.reputation.set(factionId, clamped);
    if (oldVal !== clamped) {
      this.scene?.events?.emit('reputationChanged', { factionId, oldVal, newVal: clamped, delta: clamped - oldVal });
    }
  }

  addNpcOverride(npcId, delta) {
    const cur = this.npcOverrides.get(npcId) ?? 0;
    this.npcOverrides.set(npcId, Math.max(-100, Math.min(100, cur + delta)));
  }

  setNpcOverride(npcId, value) {
    this.npcOverrides.set(npcId, Math.max(-100, Math.min(100, value)));
  }

  isHostile(factionA, factionB) {
    if (factionA === factionB) return false;
    const def = FACTIONS[factionA];
    if (!def) return false;
    const dyn = this.dynamicHostility.get(factionA);
    if (dyn) return dyn.has(factionB);
    return def.hostileTo.includes(factionB);
  }

  setHostility(factionA, factionB, hostile) {
    if (!this.dynamicHostility.has(factionA)) {
      const base = FACTIONS[factionA]?.hostileTo || [];
      this.dynamicHostility.set(factionA, new Set(base));
    }
    const s = this.dynamicHostility.get(factionA);
    if (hostile) s.add(factionB); else s.delete(factionB);
  }

  applyDelta(factionId, deltaKey, source = '') {
    const delta = REPUTATION_DELTAS[deltaKey] ?? 0;
    this.addReputation(factionId, delta, source || deltaKey);
  }

  serialize() {
    return {
      reputation: Object.fromEntries(this.reputation),
      npcOverrides: Object.fromEntries(this.npcOverrides),
      dynamicHostility: Object.fromEntries(
        [...this.dynamicHostility.entries()].map(([k, v]) => [k, [...v]])
      )
    };
  }

  static deserialize(scene, data) {
    return new FactionSystem(scene, data || null);
  }
}
```

- [ ] **Step 2: Commit**

```bash
git add src/systems/FactionSystem.js
git commit -m "feat(npc): FactionSystem 阵营 + reputation + 关系等级"
```

---

### Task 1.3：实现 NPCMemoryStore

**Files:**
- Create: `src/systems/NPCMemoryStore.js`

- [ ] **Step 1: 写文件**

```javascript
// src/systems/NPCMemoryStore.js
export class NPCMemoryStore {
  constructor(scene, initial = null) {
    this.scene = scene;
    // npcId -> { stage, flags, vars, dead }
    this.memory = new Map();
    if (initial) {
      for (const [k, v] of Object.entries(initial)) {
        this.memory.set(k, {
          stage: v.stage ?? null,
          flags: { ...(v.flags || {}) },
          vars: { ...(v.vars || {}) },
          dead: !!v.dead
        });
      }
    }
  }

  _ensure(npcId) {
    if (!this.memory.has(npcId)) {
      this.memory.set(npcId, { stage: null, flags: {}, vars: {}, dead: false });
    }
    return this.memory.get(npcId);
  }

  getStage(npcId, fallback = null) {
    return this.memory.get(npcId)?.stage ?? fallback;
  }

  setStage(npcId, stage) {
    const m = this._ensure(npcId);
    const old = m.stage;
    if (old === stage) return;
    m.stage = stage;
    this.scene?.events?.emit('npcStageChanged', { npcId, oldStage: old, newStage: stage });
  }

  getFlag(npcId, key, fallback = false) {
    return this.memory.get(npcId)?.flags[key] ?? fallback;
  }

  setFlag(npcId, key, value = true) {
    const m = this._ensure(npcId);
    m.flags[key] = value;
    this.scene?.events?.emit('npcFlagChanged', { npcId, key, value });
  }

  getVar(npcId, key, fallback = 0) {
    return this.memory.get(npcId)?.vars[key] ?? fallback;
  }

  setVar(npcId, key, value) {
    const m = this._ensure(npcId);
    m.vars[key] = value;
  }

  addVar(npcId, key, delta) {
    const cur = this.getVar(npcId, key, 0);
    this.setVar(npcId, key, cur + delta);
    return cur + delta;
  }

  markDead(npcId) {
    const m = this._ensure(npcId);
    m.dead = true;
    this.scene?.events?.emit('npcDied', { npcId });
  }

  isDead(npcId) {
    return this.memory.get(npcId)?.dead === true;
  }

  getAll() {
    return this.memory;
  }

  serialize() {
    const out = {};
    for (const [k, v] of this.memory.entries()) {
      out[k] = { stage: v.stage, flags: v.flags, vars: v.vars, dead: v.dead };
    }
    return out;
  }

  static deserialize(scene, data) {
    return new NPCMemoryStore(scene, data || null);
  }
}
```

- [ ] **Step 2: Commit**

```bash
git add src/systems/NPCMemoryStore.js
git commit -m "feat(npc): NPCMemoryStore stage/flag/var/death 存储"
```

---

### Task 1.4：升级 NPC 基类

**Files:**
- Modify: `src/entities/NPC.js`（完全重写）

- [ ] **Step 1: 重写 NPC.js**

新接口：从 config 接收 id、name、faction、initialStage、dialogueModule、movement、giftPreferences；与 NPCMemoryStore 和 FactionSystem 协作；保留 sprite + nametag + 状态指示器。提供 `getActiveStage()`、`getDialogueTree()`、`onInteract()` 接口。

完整代码见实施时直接写入（保持与现有 sprite/nametag/indicator 视觉一致），新增字段：
- `this.config` — 原始配置
- `this.faction` — 阵营 id
- `this.movement` — 'stand' 或 patrol config
- `this.dialogueModule` — string，DialogueEngine 用它去 `data/dialogues/` 找树
- `this.essential` — boolean
- `this.surrenderDialogue` — 自定义投降文本（可选）
- `this.persistent` — boolean
- `this.scene.npcMemory.getStage(this.id, this.config.initialStage)` 读 stage
- `updateState(memory, factionSystem)` 根据 stage / relation 更新指示器

`updateStateVisual` 改为根据 relation emoji 显示头顶图标，stage 切换时刷新。

- [ ] **Step 2: Commit**

```bash
git add src/entities/NPC.js
git commit -m "feat(npc): NPC 基类升级（config 驱动 + memory/faction 集成）"
```

---

### Task 1.5：创建 data/npcs.js 和首个测试 NPC

**Files:**
- Create: `src/data/npcs.js`

- [ ] **Step 1: 添加首个 NPC**

```javascript
// src/data/npcs.js
export const NPCS = {
  blacksmith_tom: {
    id: 'blacksmith_tom',
    name: '铁匠汤姆',
    sprite: 'npc',  // 暂用通用 npc 贴图
    faction: 'townfolk',
    essential: true,
    spawn: { chunkX: 8, chunkY: 8, localX: 12, localY: 16 },
    initialStage: 'greet',
    dialogueModule: 'blacksmith_tom',
    movement: 'stand',
    services: ['shop', 'enhance', 'reforge', 'gem_inlay'],
    shopId: 'tom_shop',
    giftPreferences: {
      loved: ['iron_ore'],
      hated: []
    }
  }
};

export function getNpcConfig(id) {
  return NPCS[id] || null;
}

export function getNpcsInChunk(chunkX, chunkY) {
  return Object.values(NPCS).filter(n =>
    n.spawn && n.spawn.chunkX === chunkX && n.spawn.chunkY === chunkY
  );
}
```

- [ ] **Step 2: Commit**

```bash
git add src/data/npcs.js
git commit -m "feat(npc): NPCS 配置表 + 首个测试 NPC（铁匠汤姆）"
```

---

### Task 1.6：实现 NPCRegistry

**Files:**
- Create: `src/systems/NPCRegistry.js`

- [ ] **Step 1: 写文件**

```javascript
// src/systems/NPCRegistry.js
import { NPC } from '../entities/NPC.js';
import { NPCS, getNpcConfig } from '../data/npcs.js';

export class NPCRegistry {
  constructor(scene) {
    this.scene = scene;
    this.instances = new Map();          // npcId -> NPC instance
    this.byChunk = new Map();            // chunkKey -> Set<npcId>
  }

  spawn(npcId, chunkKey = null) {
    if (this.instances.has(npcId)) return this.instances.get(npcId);
    const config = getNpcConfig(npcId);
    if (!config) {
      console.warn(`[NPCRegistry] unknown npc id: ${npcId}`);
      return null;
    }
    if (this.scene.npcMemory?.isDead(npcId)) return null;  // 永久死亡

    const wx = config.spawn.chunkX * 1024 + config.spawn.localX * 32 + 16;
    const wy = config.spawn.chunkY * 1024 + config.spawn.localY * 32 + 16;
    const npc = new NPC(this.scene, wx, wy, config);

    this.instances.set(npcId, npc);
    if (chunkKey) {
      if (!this.byChunk.has(chunkKey)) this.byChunk.set(chunkKey, new Set());
      this.byChunk.get(chunkKey).add(npcId);
    }
    return npc;
  }

  despawn(npcId) {
    const npc = this.instances.get(npcId);
    if (!npc) return;
    if (npc.config.persistent) return;   // persistent 不销毁
    npc.destroy();
    this.instances.delete(npcId);
    for (const set of this.byChunk.values()) set.delete(npcId);
  }

  despawnChunk(chunkKey) {
    const set = this.byChunk.get(chunkKey);
    if (!set) return;
    for (const npcId of set) {
      const npc = this.instances.get(npcId);
      if (npc && !npc.config.persistent) {
        npc.destroy();
        this.instances.delete(npcId);
      }
    }
    this.byChunk.delete(chunkKey);
  }

  spawnChunk(chunkX, chunkY) {
    const chunkKey = `${chunkX},${chunkY}`;
    for (const config of Object.values(NPCS)) {
      if (!config.spawn) continue;
      if (config.spawn.chunkX === chunkX && config.spawn.chunkY === chunkY) {
        this.spawn(config.id, chunkKey);
      }
    }
  }

  get(npcId) { return this.instances.get(npcId); }
  getAll() { return [...this.instances.values()]; }

  update(delta) {
    for (const npc of this.instances.values()) {
      if (npc.update) npc.update(delta);
    }
  }
}
```

- [ ] **Step 2: Commit**

```bash
git add src/systems/NPCRegistry.js
git commit -m "feat(npc): NPCRegistry 注册表 + chunk 生命周期"
```

---

### Task 1.7：MainGameScene 接入 NPC 系统初始化

**Files:**
- Modify: `src/scenes/MainGameScene.js`

- [ ] **Step 1: 在 enterWorld 或 create 中初始化**

```javascript
// 在 imports 顶部
import { FactionSystem } from '../systems/FactionSystem.js';
import { NPCMemoryStore } from '../systems/NPCMemoryStore.js';
import { NPCRegistry } from '../systems/NPCRegistry.js';

// 在 enterWorld 中（worldState 初始化之后）：
this.factionSystem = FactionSystem.deserialize(this, saveData?.factionData);
this.npcMemory = NPCMemoryStore.deserialize(this, saveData?.npcMemory);
this.npcRegistry = new NPCRegistry(this);

// 在 ChunkManager 的 chunk 加载/卸载回调里调用：
// load:  this.npcRegistry.spawnChunk(cx, cy);
// unload: this.npcRegistry.despawnChunk(`${cx},${cy}`);
```

- [ ] **Step 2: 在 update() 添加**

```javascript
this.npcRegistry.update(delta);
```

- [ ] **Step 3: 在玩家进入存档/新游戏时把 NPCRegistry 与 InteractionHandler 关联**

InteractionHandler 的 NPC overlap 已经存在，确保 `handleNPCDialogue` 兼容新 NPC（暂时还用旧 dialogues 数组）。

- [ ] **Step 4: 浏览器冒烟**

`pnpm dev` 启动，进入游戏后玩家走到 chunk (8,8)，看到铁匠汤姆，按 E 触发旧式对话。
console 验证：`scene.npcRegistry.getAll()` 返回包含铁匠的数组。

- [ ] **Step 5: Commit**

```bash
git add src/scenes/MainGameScene.js
git commit -m "feat(npc): MainGameScene 接入 Faction/Memory/Registry 三大系统"
```

---

## Phase 2：DialogueEngine + ActionRegistry + DialoguePanel

### Task 2.1：实现 ActionRegistry

**Files:**
- Create: `src/systems/ActionRegistry.js`

`ActionRegistry` 用 Map<string, fn> 存 action handler。`parseActionString('open_shop:tom_shop')` → `{name:'open_shop', args:['tom_shop']}`。`dispatch(actionStr, ctx)` 查 handler 调用。支持数组（顺序执行多个 action）。

注册内置 action 桩（先 console.log，后续 phase 填实现）：open_shop、open_enhance、open_reforge、open_gem_inlay、open_trainer、accept_quest、turn_in_quest、give_item、take_item、give_gold、take_gold、heal_player、learn_skill、trigger_combat、recruit_companion、dismiss_companion、teleport_player、set_flag、play_sound、show_message、close_dialogue。

- [ ] Commit: `feat(npc): ActionRegistry + 21 个内置 action 桩`

---

### Task 2.2：实现 DialogueEngine（节点树解释器）

**Files:**
- Create: `src/systems/DialogueEngine.js`
- Create: `src/data/dialogues/index.js`

`DialogueEngine`：
- `start(npc)` — 读 stage，从 dialogues/<module>.js[stage].start 开始
- `_runNode(nodeId)` — 评估 if、显示 text、应用 set/action、计算后继（next 或 options）
- `choose(idx)` — 选项分支
- `_evalCondition(expr, ctx)` — 实现 DSL 子集（hasItem/level/flag/stage/relation/quest/gold/&&/||/!）
- 支持 `call`/`return`（子对话调用栈）
- `set` 写 NPCMemory：`{stage, flag_*, var_*, relationDelta}`

`data/dialogues/index.js` 导出 `getDialogueModule(name)` → import 对应文件。

提供 fallback：`__surrendered__` stage 用通用「饶命」文本。

- [ ] Commit: `feat(npc): DialogueEngine 节点树解释器 + 条件 DSL`

---

### Task 2.3：写铁匠对话模块

**Files:**
- Create: `src/data/dialogues/blacksmith_tom.js`

按 spec 中示例写完整对话树（greet/awaiting_ore/trusted 三阶段）。

- [ ] Commit: `feat(npc): 铁匠汤姆对话树`

---

### Task 2.4：实现 DialoguePanel

**Files:**
- Create: `src/ui/DialoguePanel.js`
- Modify: `src/systems/UIManager.js`（保留旧 API 但 NPC 走 DialoguePanel）

DialoguePanel：
- 底部对话框 + 头像区 + 文本（打字机）+ 选项列表（1-9 数字键选择 / 鼠标点击）
- 监听 `dialogueNodeEntered` 事件刷新
- 关闭时 emit `dialogueEnded`

- [ ] Commit: `feat(npc): DialoguePanel 含选项分支 UI`

---

### Task 2.5：InteractionHandler 切换到 DialogueEngine

**Files:**
- Modify: `src/managers/InteractionHandler.js`

将 `handleNPCDialogue` 改为：若 npc 是新版（有 dialogueModule）→ DialogueEngine.start，否则走旧路径。

- [ ] Commit: `refactor(npc): InteractionHandler 走 DialogueEngine`

冒烟：与铁匠对话能看到 3 个选项，但 action 还是桩（show toast）。

---

## Phase 3：CombatAI 抽离 + CombatNPC

### Task 3.1：抽离 CombatAI

**Files:**
- Create: `src/systems/CombatAI.js`
- Modify: `src/entities/Enemy.js`

把 `Enemy.js` 中的状态机（PATROL/CHASE/SKILL_TELEGRAPH/SKILL_ACTIVE/SKILL_RECOVERY）抽到 `CombatAI`。`CombatAI` 通过 `getTargets` 函数和 `factionSystem.isHostile` 选择目标，与 actor 解耦。

Enemy 改为构造 CombatAI 实例并 delegate update。原有事件、技能逻辑全部保留。

注意：保持现有 Enemy 行为完全等价，先做最小改动。

- [ ] 冒烟：现有怪物战斗与之前完全一致（reuse 旧存档）
- [ ] Commit: `refactor(enemy): 抽离 CombatAI 系统（行为等价）`

---

### Task 3.2：实现 CombatNPC

**Files:**
- Create: `src/entities/CombatNPC.js`
- Modify: `src/entities/NPC.js`（支持 combatStats 时返回 CombatNPC 而非 NPC——或在 NPCRegistry 中判断）
- Modify: `src/systems/NPCRegistry.js`

NPCRegistry.spawn：若 config.combatStats → new CombatNPC，否则 new NPC。

CombatNPC 继承 Actor（HP/技能/资源），内含 CombatAI 实例，target selector 使用 FactionSystem.findHostileTargets。

- [ ] Commit: `feat(npc): CombatNPC 战斗 NPC（含 Actor + CombatAI）`

---

### Task 3.3：误伤转敌对 + 派系链

**Files:**
- Modify: `src/managers/InteractionHandler.js`
- Modify: `src/systems/FactionSystem.js`（加 `triggerHostility(factionId)` 便捷方法）

InteractionHandler 在玩家技能命中 NPC/CombatNPC 时：检测 faction，调 `factionSystem.applyDelta(faction, 'accidental_hit')`，NPCMemory.addVar(npcId, 'hitCount', 1)，若超阈值 → `factionSystem.triggerHostility(faction)` 使整个阵营对玩家敌对。

- [ ] 冒烟：攻击卫兵后整组卫兵开始追玩家。
- [ ] Commit: `feat(npc): 误伤累计 + 派系敌对联动`

---

### Task 3.4：添加测试用敌对 NPC（卫兵）

**Files:**
- Modify: `src/data/npcs.js`

```javascript
town_guard_01: {
  id: 'town_guard_01',
  name: '城镇卫兵',
  sprite: 'npc',
  faction: 'town_guard',
  spawn: { chunkX: 8, chunkY: 8, localX: 5, localY: 10 },
  initialStage: 'patrol',
  dialogueModule: 'town_guard',
  movement: { type: 'patrol', radius: 96 },
  combatStats: { level: 5, hp: 200, skills: [], primaryAttackStat: 'strength' }
}
```

Create: `src/data/dialogues/town_guard.js`（简短对话）

- [ ] Commit: `feat(npc): 测试卫兵 NPC + 对话`

---

## Phase 4：ShopService + ShopPanel + 铁匠服务

### Task 4.1：实现 ShopService

**Files:**
- Create: `src/data/shops.js`
- Create: `src/systems/ShopService.js`

shops.js：`tom_shop: { name, tableId, slots, refresh: 'bonfire', sellbackRate: 0.3 }`

ShopService：
- `open(shopId, npc)` — 首次或刷新后用 LootEngine.generateLoot 填库存，emit `shopOpened`
- `buy(shopId, idx, count)` — 价格计算 + 扣金币 + 加背包 + reputation +1
- `sell(shopId, item, count)` — 回收价 + 加金币 + 减背包
- `getPriceForBuy(item, factionId, npcId)` — 基础价 × rarityMult × relation discount
- `refresh(shopId)` / `refreshAll()` — 重置库存为 null

库存持久化到 worldState（与篝火刷新协调）。

- [ ] Commit: `feat(npc): ShopService 商店服务（库存/定价/买卖）`

---

### Task 4.2：实现 ShopPanel

**Files:**
- Create: `src/ui/panels/ShopPanel.js`
- Modify: `src/scenes/PanelScene.js`

双栏 UI（左：商店库存，右：玩家背包），底部金币 + 关系等级显示。

- [ ] Commit: `feat(npc): ShopPanel 双栏交易 UI`

---

### Task 4.3：接入服务 action

**Files:**
- Modify: `src/systems/ActionRegistry.js`（实现 open_shop / open_enhance / open_reforge / open_gem_inlay）

打开对应 Panel（Shop 走 ShopPanel；强化/洗练/镶嵌走现有 PanelScene 模块）。

- [ ] Commit: `feat(npc): action 接入商店和铁匠服务`

---

### Task 4.4：篝火刷新商店

**Files:**
- Modify: `src/managers/InteractionHandler.js`（handleBonfireInteraction）

`scene.shopService?.refreshAll()`

- [ ] Commit: `feat(npc): 篝火休息刷新所有商店库存`

---

## Phase 5：TrainerService + 任务接口

### Task 5.1：TrainerService

**Files:**
- Create: `src/data/trainers.js`
- Create: `src/systems/TrainerService.js`

trainers.js：`{ trainer_id: { name, skills: [{skillId, goldCost, levelReq, prereqSkill}], talentResetCost: 5000 } }`

TrainerService.learn(trainerId, skillId)：检查 prereq → 扣金币 → SkillTreeSystem.unlock。

- [ ] Commit: `feat(npc): TrainerService 训练师服务`

---

### Task 5.2：TrainerPanel

**Files:**
- Create: `src/ui/panels/TrainerPanel.js`

技能列表 + 学习按钮 + 重置天赋按钮。

- [ ] Commit: `feat(npc): TrainerPanel 训练师 UI`

---

### Task 5.3：接入任务 action

**Files:**
- Modify: `src/systems/ActionRegistry.js`

`accept_quest`/`turn_in_quest`/`give_item`/`take_item`/`give_gold`/`take_gold`/`heal_player`/`learn_skill`/`teleport_player`/`set_flag`/`show_message`/`close_dialogue`/`open_trainer` 全部实现。

QuestSystem 完成任务时 emit `questCompleted` → NPC 监听做 stage transition。

- [ ] Commit: `feat(npc): 实现所有任务/服务相关 action`

---

### Task 5.4：NPC stage transitions

**Files:**
- Modify: `src/entities/NPC.js`（在 init 时订阅事件，自动 transition）

config 中 `transitions: [{from, to, on}]`，从 `data/npcs.js` 读取，在 NPC 实例化时挂钩 scene.events。

- [ ] Commit: `feat(npc): 事件驱动的 stage transitions`

---

## Phase 6：CompanionManager + 招募

### Task 6.1：CompanionManager 核心

**Files:**
- Create: `src/systems/CompanionManager.js`

API：recruit / dismiss / getCurrent / update(delta) / onDeath / reviveAtBonfire

跟随逻辑：
- distance > 250px → CombatAI 暂时切到 RUSH（速度 1.5x）回到玩家身边
- distance > 1500px → 瞬移到玩家身边
- 5s 内位置无变化（卡墙）→ 瞬移

目标选择：玩家最近敌人优先 / 否则自己 250px 内最近。

复活：篝火休息时 hp=maxHp、active=true。

- [ ] Commit: `feat(npc): CompanionManager 同伴管理 + 跟随 AI`

---

### Task 6.2：recruit_companion / dismiss_companion action

**Files:**
- Modify: `src/systems/ActionRegistry.js`

实现：扣金币（recruitCost）→ CompanionManager.recruit(npc) → npc.config.persistent = true（运行时标记）。

- [ ] Commit: `feat(npc): 招募/解雇同伴 action`

---

### Task 6.3：添加测试同伴 NPC

**Files:**
- Modify: `src/data/npcs.js`
- Create: `src/data/dialogues/companion_rogue.js`

```javascript
companion_rogue: {
  id: 'companion_rogue', name: '游侠艾琳', sprite: 'npc',
  faction: 'ally', persistent: false,
  spawn: { chunkX: 8, chunkY: 8, localX: 18, localY: 16 },
  initialStage: 'recruitable',
  dialogueModule: 'companion_rogue',
  combatStats: { level: 1, hp: 80, skills: [], primaryAttackStat: 'agility' },
  recruitCost: { gold: 500 }
}
```

dialogue：`recruitable` stage 含「招募（500 金）」选项 → action `recruit_companion:companion_rogue`。

- [ ] Commit: `feat(npc): 测试同伴 NPC（游侠艾琳）`

---

### Task 6.4：篝火复活同伴

**Files:**
- Modify: `src/managers/InteractionHandler.js`

`scene.companionManager?.reviveAtBonfire()`

- [ ] Commit: `feat(npc): 篝火休息复活同伴`

---

## Phase 7：送礼 + 永久死亡 + Essential + 存档

### Task 7.1：送礼系统

**Files:**
- Create: `src/data/giftPreferences.js`（已在 npcs.js 内联，此处提供工具）
- Modify: `src/systems/ActionRegistry.js`（新 action `gift_item`）

`gift_item:itemId:count` → 从背包扣物品 → 检测 NPC.giftPreferences → 调 reputation delta。
对话内可加「送礼」选项调用此 action。

- [ ] Commit: `feat(npc): 送礼系统（loved/liked/neutral/hated 4 档）`

---

### Task 7.2：永久死亡

**Files:**
- Modify: `src/entities/CombatNPC.js`（die 方法）
- Modify: `src/systems/NPCRegistry.js`（spawn 时检查 isDead）

CombatNPC.die → 
- 非 essential：npcMemory.markDead(id)，常规死亡
- essential：HP 锁 1，切到 `__surrendered__` stage，AI 暂停

- [ ] Commit: `feat(npc): 永久死亡 + essential 投降机制`

---

### Task 7.3：SaveSystem 集成

**Files:**
- Modify: `src/systems/SaveSystem.js`

save：添加 `npcMemory`、`factionData`、`companion`（当前同伴 id）、`shopInventories`。
load：分别 deserialize。
旧存档兼容：缺失字段用默认值。

- [ ] Commit: `feat(save): NPC 系统数据存档集成`

---

### Task 7.4：文档更新

**Files:**
- Create: `docs/modules/npc-system.md`
- Modify: `docs/architecture.md`（添加 NPC 章节）
- Modify: `docs/modules/data-formats.md`（添加 NPC/faction/dialogue/shop 格式）
- Modify: `CLAUDE.md`（关键约定追加 NPC 惯例）

- [ ] Commit: `docs(npc): NPC 系统文档`

---

### Task 7.5：集成冒烟测试

按 spec「测试策略 → 集成」9 项清单执行，记录失败 case 并修复。

- [ ] Commit: `test(npc): 集成测试通过 + 修复发现的问题`

---

### Task 7.6：Push

```bash
git push origin feature/ui-panel-system
```

- [ ] Push 完成。
