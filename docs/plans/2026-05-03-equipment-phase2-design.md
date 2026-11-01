# 装备 & 材料系统 Phase 2 设计

> 创建：2026-05-03
> 上游设计：`2026-05-03-equipment-materials-system-design.md`（Phase 1+2+3 全设计）
> Phase 1：`2026-05-03-equipment-materials-phase1.md`（已完成）
> Phase 2 工时估算：~2.5 周（A 1.5w + B 1w）

## Phase 2 范围（一次性开发）

| 子模块 | 内容 |
|--------|------|
| **2A 洗练 (Reforge)** | 重铸词条；可锁定 1-2 条；消耗 混沌精华 + 灵魂结晶 + 金币 |
| **2A 孔位 (Sockets)** | 装备掉落时按品质带 0-4 个孔；孔位用宝石填充 |
| **2A 宝石 (Gems)** | 4 色 × 10 级；镶嵌/拆卸；3 同合成高 1 级 |
| **2B 触发型词条 (Trigger Affixes)** | 词条带 onHit/onCrit/onKill 回调 — 真正改变玩法 |
| **2B 装备制作 (Crafting)** | 配方表 + 工坊面板，用材料合成装备 |

## 1. 洗练（Reforge）

### 模型
重 roll 装备实例的 affixes 数组：
```js
reforge(equipInstance, lockedAffixIds = []) {
  // 1. 校验 ok / 资源够
  // 2. 扣材料 + 金币
  // 3. 保留 lockedAffixIds 对应词条（按 stat 维度防止重复）
  // 4. 调 rollAffixes 重新生成剩余词条数
  // 5. 装备 _applyBonuses
}
```

### 锁定规则
- 0 锁：基础消耗（混沌精华 ×2 + 1000 金币）
- 1 锁：+灵魂结晶 ×1
- 2 锁：+灵魂结晶 ×3
- 锁定的词条**不变**，按 stat 维度从池子里排除（避免重复）

### UI
SmithyPanel 加 `openReforgeModal(eq)`：
- 顶部显示当前装备 + 词条列表（带 checkbox 锁定）
- 实时显示成本（按锁定数）
- 预览按钮（不消耗）：在右侧显示重 roll 后的预览（暂不持久化）
- 确认 → 真正应用

## 2. 孔位（Sockets）

### 数据结构
装备 instance 加字段：
```js
{
  ...,
  sockets: [
    { gemId: null },           // 空孔
    { gemId: 'red_gem_lv3' },  // 镶嵌的宝石实例 ID（来自 inventory）
    ...
  ]
}
```

`sockets.length` = 孔位数量（含空孔）。

### 孔位数（按品质生成）
| 品质 | 孔位数 |
|------|--------|
| common | 0 |
| uncommon | 0 |
| rare | 1 |
| epic | 2 |
| legendary | 3 |
| mythic | 4 |

`EquipmentGenerator.generate` 末尾按 rarity 创建 `sockets: Array(n).fill({ gemId: null })`。

## 3. 宝石（Gems）

### 4 色 × 10 级

| 颜色 | 主属性 |
|------|--------|
| 红 (red) | +attack（按级递增） |
| 蓝 (blue) | +maxMp / +int |
| 绿 (green) | +maxHp / +defense |
| 黄 (yellow) | +critRate / +critDmg |

### 数据格式 (`data/gems.js`)
```js
GEMS = {
  red_gem: {
    id: 'red_gem',
    color: 'red',
    name: '红宝石',
    levels: [
      { lv: 1, stat: 'attack', value: 3, isFlat: true },
      { lv: 2, stat: 'attack', value: 6, isFlat: true },
      // ... lv 1-10
    ]
  },
  // blue_gem / green_gem / yellow_gem
};
```

### 宝石实例
宝石作为 inventory item（type:'gem'）：
```js
{
  id: 'red_gem',
  type: 'gem',
  level: 3,         // 1-10
  name: '红宝石 Lv.3',
  stat: 'attack',
  value: 12,
  isFlat: true,
  stackable: true,  // 同色同级可堆叠
  maxStack: 99
}
```

### 合成
- 3 颗同色同级 → 1 颗高 1 级
- Lv.10 不可再合成
- 消耗：3 颗源宝石（不消耗其他材料）

## 4. 触发型词条（Trigger Affixes）

### 数据扩展
词条 def 加 `trigger` 字段：
```js
fire_on_hit_t2: {
  id: 'fire_on_hit_t2',
  name: '火焰附魔',
  pool: 'weapon_common',
  tier: 2,
  isFlat: false,
  stat: '_trigger',          // 特殊 stat，不进 Stats 通道
  trigger: {
    event: 'onHit',
    chance: 0.20,             // 20% 触发
    effect: 'spawn_fireball'  // 在 InteractionHandler 中分发
  },
  valueRange: [1, 1],         // 占位（不参与数值）
  minRarity: 'rare', weight: 5
}
```

### 触发点（在 InteractionHandler 注入）
- `onHit`：普攻/技能命中敌人
- `onCrit`：暴击命中（暂不实现 — Phase 1 没有 crit 系统）
- `onKill`：击杀敌人
- `onSkillCast`：施放技能

### 触发效果（数据驱动 + 代码分发）
```js
const TRIGGER_EFFECTS = {
  spawn_fireball: (player, enemy, ctx) => { /* 生成火球弹道 */ },
  heal_on_kill: (player, enemy, ctx) => { player.heal(20); },
  reduce_cd: (player, enemy, ctx) => { /* CDR 应用 */ }
};
```

### 实现要点
- TriggerSystem 类，遍历装备词条收集触发器
- InteractionHandler 在每个触发点调用 `triggerSystem.fire('onHit', { player, enemy, damage })`
- 每次施法/命中按 chance 概率 roll

### Phase 2 启用 4 个触发型词条
1. `fire_on_hit_t2`：20% 命中触发火球（造成 50% 攻击力火焰伤害）
2. `heal_on_kill_t2`：击杀回 5% maxHp
3. `cdr_on_skill_t2`：施法后 -0.5s 所有技能 CD
4. `lifesteal_on_crit_t2`：暴击吸血 30%（先实现框架，crit 系统是 Phase 3 的）

## 5. 装备制作（Crafting）

### 配方数据 (`data/recipes.js`)
```js
RECIPES = {
  steel_blade_recipe: {
    id: 'steel_blade_recipe',
    resultId: 'steel_blade',           // items.json 的装备模板 ID
    resultRarity: 'rare',              // 制作时的品质
    resultLevel: 5,
    materials: [
      { matId: 'enhance_stone', count: 5 },
      { matId: 'iron_shard', count: 20 }
    ],
    gold: 500,
    requiredLevel: 5                    // 玩家等级
  },
  // ...
};
```

### CraftingSystem
```js
canCraft(recipeId) → { ok, reason, cost? }
craft(recipeId)    → 扣材料 + 金币 → 调 EquipmentGenerator.generate(resultId, resultRarity, resultLevel) → 装入背包
```

### Phase 2 启用 4-6 个配方
- 钢铁剑（rare，Lv.5）— 入门高品装备
- 守护板甲（rare，Lv.8）
- 影刃（rare，Lv.5）
- 火焰法杖（epic，Lv.10）
- 暴风斗篷（accessory rare，Lv.6）
- 远古之戒（accessory epic，Lv.12）

## 6. UI 改造

### SmithyPanel 新增 modal
- `openReforgeModal(eq)` — 洗练
- `openSocketModal(eq)` — 镶嵌/拆卸
- `openGemFusionModal()` — 宝石合成
- `openCraftModal()` — 装备制作

### InventoryPanel 装备 tooltip 扩展
显示：
- 孔位行：`孔位: ⬜ ⬜ 🔴Lv3` （空 / 已镶嵌）
- 宝石贡献：合并到基础属性显示

### 触发型词条显示
词条行：`T2 火焰附魔: 20% 触发火球`（特殊格式）

### 右键菜单加选项
背包装备右键：装备 / 强化 / 洗练 / 镶嵌 / 分解 / 丢弃
角色面板装备槽右键：强化 / 洗练 / 镶嵌 / 卸下

## 7. 数据层新增

### items.json 新增
- 4 种基础宝石（lv 1）：red_gem / blue_gem / green_gem / yellow_gem 的初级形态作为掉落物
- 4 种洗练材料：chaos_essence（混沌精华）、soul_crystal（灵魂结晶）、refining_stone（精炼石）、star_fragment（星辰碎片，宝石升级用）

### lootTables.js 调整
- 普通怪可掉低级宝石（Lv.1）
- 精英/boss 掉中高级宝石（Lv.2-3）
- 高级材料从 boss 掉

### Phase 1 未启用的材料表项
- `chaos_essence` (T3, 洗练) ✓ Phase 2 启用
- `soul_crystal` (T3, 锁词条) ✓ Phase 2 启用
- `refining_stone` (T2, 词条增强) ✓ Phase 2 启用（如有词条强度提升机制可用；本期主要给制作）
- `star_fragment` (T3, 宝石升级) ✓ Phase 2 启用

## 8. 存档兼容

老 instance 缺：
- `sockets` → 默认 `[]`（孔位数 0）

宝石作为新 type，老 inventory 不会有，无需兼容。

## 9. 不在 Phase 2 范围（推迟到 Phase 3）

- ❌ 套装系统（2/4/6 件套效果）
- ❌ 顶级材料 `divine_heart` / `world_core`
- ❌ 完美词条追求（保底/保送）
- ❌ 高级触发词条联动（如组合套装触发）
- ❌ 商店 / 交易系统
- ❌ 装备绑定机制
