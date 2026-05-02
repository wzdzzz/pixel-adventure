# 装备 & 材料系统设计 — Phase 1 (核心循环)

> 创建日期：2026-05-03
> 分支：`feature/ui-panel-system`
> Phase 1 工时估算：~1.5 周

## Phase 范围（已确认走 B 方案）

| 阶段 | 范围 |
|------|------|
| **Phase 1（本期）** | 随机词条 / 6 品质 / 装备生成器 / 4 层材料 / 分解 / 强化 / 基础 UI |
| Phase 2（后续） | 洗练 / 孔位 + 宝石 / 触发型词条 / 装备制作 |
| Phase 3（终局） | 套装 / 顶级材料 / 完美词条追求 |

## 核心模型变化

### 装备：模板 (Template) → 实例 (Instance)

**现状**：`items.json` 定义模板，背包/装备槽存的就是模板引用，每件"铁剑"都一样。

**改造**：装备分两层
- **模板** (`items.json`)：定义 slot / weaponType / level / baseStats / **affixPools**（可掉落的词条池）
- **实例** (背包/装备槽)：`templateId` + `rarity` + `level` + `enhanceLevel` + `affixes[]` + `instanceId`

每次掉落都生成一个**实例**，rarity 和词条都是当时 roll 出来的，每件都不一样。

#### 实例数据格式

```js
{
  instanceId: 'eq_1714900000_abc',  // 唯一 ID
  templateId: 'iron_sword',
  type: 'equipment',
  rarity: 'rare',                    // common / uncommon / rare / epic / legendary / mythic
  level: 5,                          // 掉落时的等级
  enhanceLevel: 0,                   // +0 ~ +15
  affixes: [
    { id: 'attack_pct_t2', value: 8.5 },
    { id: 'crit_rate_t1', value: 4.2 }
  ]
}
```

显示时通过 `templateId` 查 `items.json` 拿名字/图标/baseStats，再叠加品质倍率、词条、强化。

## 6 品质系统

| 品质 | id | 倍率 | 词条数 | 边框色 | 名字色 |
|------|----|------|--------|--------|--------|
| 普通 | `common` | 1.0× | 0 | `#777` | `#cccccc` |
| 优秀 | `uncommon` | 1.2× | 1 | `#3a3` | `#44cc44` |
| 稀有 | `rare` | 1.5× | 2 | `#36c` | `#4488ff` |
| 史诗 | `epic` | 2.0× | 3 | `#a3c` | `#bb44ff` |
| 传说 | `legendary` | 2.5× | 4 | `#fa3` | `#ffaa44` |
| **神话** | `mythic` | 3.0× | 5 | `#f33` | `#ff4444` |

**新增 mythic**，更新 `RARITY_MULTIPLIERS` 和 `RARITY_COLORS`。

## 词条系统（Affix）

### 词条池结构

每个词条：`{ id, name, tier, pool, stat, valueRange, minRarity, weight }`

- `pool`：来源池标签（如 `weapon_common` / `armor_warrior`）
- `stat`：作用属性（`attackPct` / `critRate` / `lifesteal` 等）
- `tier`：T1（最强）~ T5（最弱），决定 valueRange
- `minRarity`：最低稀有度才会 roll 此词条
- `weight`：在池内被选中的权重

### 词条池分类

| Pool 名 | 装备类型 | 词条示例 |
|---------|----------|----------|
| `weapon_common` | 所有武器 | +攻击%、+暴击率、+暴击伤害、+攻速 |
| `armor_common` | 所有防具 | +生命值%、+防御%、+减伤、+生命回复 |
| `accessory_common` | 戒指/项链 | +属性点（str/agi/int）、+CDR、+移速 |
| `warrior` | 战士专属（武器+防具） | +怒气获得、近战伤害%、+吸血、+韧性 |
| `archer` | 弓手专属 | +连击、+暴击伤害（高 tier）、+移速 |
| `mage` | 法师专属 | +法术强度、+法力恢复、技能伤害%、CDR |

每个装备模板声明 `affixPools: ['weapon_common', 'warrior']` 等。

### Tier 与值域

| Tier | 倍率（相对 T5） | 描述 |
|------|------------------|------|
| T1 | 5.0× | 最强 |
| T2 | 3.5× | 强 |
| T3 | 2.5× | 中 |
| T4 | 1.7× | 一般 |
| T5 | 1.0× | 弱 |

每个词条定义模板：`{ stat: 'attackPct', baseRange: [2, 4] }`，T1 等于 `[2×5, 4×5]` = `[10, 20]`。

### 词条生成规则

```js
generateAffixes(template, rarity, level):
  count = AFFIX_COUNTS[rarity]   // 0/1/2/3/4/5
  pool = 合并 template.affixPools 对应的所有词条
  filtered = 词条 where minRarity <= rarity AND tier 与 level 匹配
  selected = []
  for i in 0..count:
    pick = 加权随机（不与 selected 同 stat 重复）
    value = 在 pick.valueRange 内随机
    selected.push({ id: pick.id, value })
  return selected
```

**约束**：同一件装备词条**不重复**（同 stat 视为重复）。

## 强化系统（Enhance）

### 等级 +0 ~ +15

每 +1 把所有 baseStats（不含词条）按 5% 复利提升：

```js
finalStat = base × rarityMul × (1 + 0.05 × enhanceLevel)
```

### 成功率
| 等级段 | 成功率 | 失败 |
|--------|--------|------|
| +1 ~ +5 | 100% | - |
| +6 ~ +10 | 70% | 维持原级 |
| +11 ~ +15 | 40% | -1 级 |

### 材料成本（递进）

| 等级 | 材料 | 数量 | 金币 |
|------|------|------|------|
| +1~+5 | 铁矿碎片 (`iron_shard`) | level × 2 | level × 50 |
| +6~+10 | 强化石 (`enhance_stone`) | level - 5 | level × 200 |
| +11~+15 | 远古核心 (`ancient_core`) | level - 10 | level × 800 |

Phase 1 不实现"保护符"，失败简单 -1 或维持。

## 分解系统（Decompose）

把背包里的装备实例分解成材料：

| 装备品质 | 产物 |
|----------|------|
| common | iron_shard ×1 |
| uncommon | iron_shard ×2 |
| rare | enhance_stone ×1 |
| epic | refining_stone ×2 |
| legendary | chaos_essence ×1 |
| mythic | soul_crystal ×1 |

强化等级 ≥ +5 → 额外 +1 同等材料。

**Phase 1 不可逆**：分解后装备消失。

## 4 层材料分类

按用途分组（Phase 1 仅启用与"强化/分解"相关的材料）：

| Tier | 材料 | 用途 | Phase |
|------|------|------|-------|
| T1 | `iron_shard` 铁矿碎片 | 强化 +1~+5 | 1 |
| T1 | `mana_dust` 魔力粉尘 | （Phase 2 宝石合成） | - |
| T1 | `bone_fragment` 兽骨 | （Phase 2 制作） | - |
| T2 | `enhance_stone` 强化石 | 强化 +6~+10 | 1 |
| T2 | `refining_stone` 精炼石 | （Phase 2 词条洗练） | - |
| T3 | `ancient_core` 远古核心 | 强化 +11~+15 | 1 |
| T3 | `chaos_essence` 混沌精华 | （Phase 2 洗练） | - |
| T3 | `soul_crystal` 灵魂结晶 | （Phase 2 锁词条） | - |
| T4 | `divine_heart` 神铸之心 | （Phase 3 终局强化） | - |

Phase 1 实际新增到 items.json 的材料：iron_shard / enhance_stone / ancient_core（其他 Phase 2/3 时再加）。

## 掉落规则

### 装备掉落

`LootEngine.roll(enemyId)` 现状：从 lootTable.pools 选 templateId。

**改造**：选中模板后，加一步"实例化"：
1. 决定品质（基于敌人等级 + 玩家 dropBonus）
2. 调 `EquipmentGenerator.generate(templateId, rarity, level)`
3. 返回完整实例

### 品质权重（基于敌人等级）
```js
普通怪：common 60% / uncommon 30% / rare 10%
精英怪：common 30% / uncommon 40% / rare 25% / epic 5%
Boss：    rare 30% / epic 40% / legendary 25% / mythic 5%
```

### 材料掉落

`lootTables.js` 各 enemy 的 `pools` 加 `materials` 池：
```js
{ name: 'materials', weight: 25, items: [
  { id: 'iron_shard', range: [1, 3] }
]}
```

## 系统改造点

### 数据层（新增）
- `src/data/affixes.js` — 词条池定义（约 30-40 条目）
- `src/data/materials.js` — 材料定义（Phase 1 启用 3 个）
- `src/data/items.json` — 装备模板加 `affixPools` 字段；新增材料条目

### 系统层（新增）
- `src/systems/EquipmentGenerator.js` — 实例化装备（rarity + affixes 生成）
- `src/systems/EnhanceSystem.js` — 强化：成本 / 成功率 / 应用

### 系统层（改造）
- `src/systems/LootEngine.js`
  - `getScaledStats(item)` 改为 `computeFinalStats(instance)`：含 baseStats×rarity×level + 词条值 + enhance 倍率
  - drop 流程加 instance 化
- `src/systems/EquipmentSystem.js`
  - `equipFromInventory` 处理 instance（不再只是 templateId）
  - `_applyBonuses` 从 instance 词条聚合 modifiers
- `src/systems/InventorySystem.js`
  - 存储 instance（含 instanceId 唯一标识）
  - 同 templateId 不再 stack（每件实例独立）

### 实体层（保持）
- `Player.stats` 经 `_applyBonuses` 接收装备贡献的 statBonuses + flatBonuses，无需大改

### 场景/UI（改造）
- `src/ui/panels/InventoryPanel.js`
  - 装备 tooltip 显示：基础值（含 enhance）+ 词条列表（按 tier 颜色）+ 总评分
  - 装备格子右键菜单：使用 / 装备 / **强化** / **分解** / 丢弃
- `src/ui/panels/SmithyPanel.js`（新建）
  - 不作为独立 tab，而是简化为右键菜单弹出的小窗口
  - 强化窗口：当前级、下一级预览、所需材料、强化按钮
  - 分解窗口：装备预览、产出材料、确认按钮
- `src/scenes/PanelScene.js` — 把 SmithyPanel 注入

### 词条值消费（Stats 引擎）

新增 `attackPct` / `defensePct` / `lifeRegen` / `lifesteal` / `cdr` 等词条 stat。Stats 引擎已有 flatBonuses 机制，词条以 percentage 应用：

```js
// 装备汇总后给 Stats:
stats.setBonusPct({ attackPct: 0.20, critRate: 4.5 })  // 装备词条贡献
stats.setFlatBonus({ attack: 25 })                       // baseStats×rarity×enhance
```

Stats.getDerived() 会用这些 flatBonus 和 bonusPct 重新计算 attack/defense/critRate 等派生值。

**目前 Stats 没有 `bonusPct` 通道**，需要新增（或合并入 flatBonuses 用合理 stat key 命名 `attackBonusPct`）。Phase 1 实现细节见实施计划。

## 存档兼容

老存档可能有：
- equipment 槽存的是模板对象（无 instanceId / affixes / enhanceLevel）
- inventory 同上

**迁移策略**：load 时检查 equipment/inventory 每条 item：
- 缺 `instanceId` → 视为旧装备，给一个 fallback `instanceId` 和 `affixes: []`、`enhanceLevel: 0`、品质保持原值
- 旧装备分解或丢弃后被新实例替代

不主动转换，避免破坏体验。

## 测试要点

- 装备掉落：每个怪都能 drop 不同 rarity 的实例，词条不重复 stat
- 强化：+1~+5 必成；+6+ 有概率维持；+11+ 有概率掉级
- 分解：每个 rarity 给对的材料数
- 装备穿戴：词条加成正确进入 Stats，攻击力/暴击率 UI 同步
- 老存档加载：不报错，旧装备仍可使用

## 实施顺序（详细 plan 见 writing-plans）

1. 数据层：affixes.js / materials.js / items.json 模板加字段
2. EquipmentGenerator
3. LootEngine 改造（drop instance）
4. Stats 引擎加 bonusPct 通道
5. EquipmentSystem 改造（消费 instance）
6. InventorySystem 改造（实例存储）
7. EnhanceSystem
8. UI 改造（tooltip + 强化/分解菜单）
9. SaveSystem 兼容老存档
10. 调参 + 测试

## 不在 Phase 1 范围

- ❌ 洗练（reforge）
- ❌ 孔位 + 宝石
- ❌ 触发型词条（"攻击有概率触发火球" 等）
- ❌ 套装
- ❌ T4 顶级材料 / 神铸之心
- ❌ 装备制作（craft）
- ❌ 物品市场/交易
- ❌ 装备绑定机制
