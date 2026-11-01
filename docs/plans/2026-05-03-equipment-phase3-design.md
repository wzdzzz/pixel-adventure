# 装备 & 材料系统 Phase 3 设计

> 创建：2026-05-03
> 上游设计：`2026-05-03-equipment-materials-system-design.md`（Phase 1+2+3 全设计）
> Phase 1：`2026-05-03-equipment-materials-phase1.md`（已完成）
> Phase 2：`2026-05-03-equipment-phase2-design.md`（已完成）
> Phase 3 工时估算：~1 周

## Phase 3 范围

| 子模块 | 内容 |
|--------|------|
| **3A 套装 (Sets)** | 4 套装：每套 6 件，2/4/6 件激活效果 |
| **3B 顶级材料** | divine_heart 神铸之心 / world_core 世界核心，用于完美词条 + 神器配方 |
| **3C 完美词条** | Reforge 升级：连续保底 + divine_heart 强力洗练 |
| **3D 神器配方 (Mythic)** | 4 个 mythic 配方，需顶级材料 |
| **3E UI** | CharacterPanel 显示已激活套装 / InventoryPanel tooltip 显示套装归属 |

## 1. 套装系统 (Sets)

### 数据结构 (`src/data/sets.js`)

```js
export const SETS = {
  warrior_legacy: {
    id: 'warrior_legacy',
    name: '远征战士套装',
    pieces: ['iron_sword', 'guardian_plate', 'iron_helm', 'worn_boots', 'copper_ring', 'bone_necklace'],
    bonuses: {
      2: { stat: 'attack',  value: 0.05, isFlat: false, label: '攻击 +5%' },
      4: { stat: 'maxHp',   value: 0.10, isFlat: false, label: '生命 +10%' },
      6: { stat: 'attack',  value: 0.20, isFlat: false, label: '攻击 +20% / 全属性 +5' }
    }
  },
  archer_legacy:  { ... },
  mage_legacy:    { ... },
  guardian_set:   { ... }   // 通用防御套
};
```

### 装备模板加 setId

`items.json` 装备项加可选字段：
```json
{
  "id": "iron_sword",
  ...,
  "setId": "warrior_legacy"
}
```

未加 setId 的装备不参与套装（保持自由搭配空间）。

### SetSystem 计算逻辑

```js
class SetSystem {
  computeActiveBonuses(slots) {
    // 1. 统计每个 setId 的件数
    const counts = {};
    for (const slot of EQUIP_SLOTS) {
      const eq = slots[slot];
      if (!eq?.setId) continue;
      counts[eq.setId] = (counts[eq.setId] || 0) + 1;
    }
    // 2. 累加激活的 bonus
    const flatBonuses = {};
    const bonusPct = {};
    const baseBonuses = {};
    const activeSets = [];
    for (const [setId, n] of Object.entries(counts)) {
      const def = SETS[setId];
      if (!def) continue;
      activeSets.push({ setId, count: n, name: def.name, activeTiers: [] });
      for (const tier of [2, 4, 6]) {
        if (n >= tier && def.bonuses[tier]) {
          // 应用到对应通道
        }
      }
    }
    return { flatBonuses, bonusPct, baseBonuses, activeSets };
  }
}
```

### 集成点

`EquipmentSystem.getStatBonuses()` 末尾调用 `SetSystem.computeActiveBonuses(this.slots)` 并合并到三个通道。
`EquipmentSystem.getActiveSets()` 暴露给 CharacterPanel UI。

## 2. 顶级材料

### items.json 新增

```json
"divine_heart": {
  "id": "divine_heart",
  "name": "神铸之心",
  "type": "material",
  "rarity": "legendary",
  "stackable": true, "maxStack": 99,
  "level": 1,
  "sellPrice": 500,
  "description": "神祇遗留的核心 — 完美洗练 / 神器制作所需"
},
"world_core": {
  "id": "world_core",
  "name": "世界核心",
  "type": "material",
  "rarity": "mythic",
  "stackable": true, "maxStack": 99,
  "level": 1,
  "sellPrice": 1500,
  "description": "蕴含世界本源之力 — 神话级装备制作所需"
}
```

### 掉落

- `divine_heart` — 5+ 级 boss 掉落（低概率）
- `world_core` — 终局 boss / 任务奖励（极稀有）

## 3. 完美词条机制（Reforge 升级）

### 数据：装备实例加 pity 计数

```js
{
  ...,
  reforgePity: 0   // 累计未出 T1 词条的洗练次数
}
```

### Reforge 三档新增「神圣洗练」

| 模式 | 资源 | 效果 |
|------|------|------|
| 普通 | chaos_essence × 2 + 1000 金币 | 当前实现 |
| 锁定 1 | + soul_crystal × 1 | 当前实现 |
| 锁定 2 | + soul_crystal × 3 | 当前实现 |
| **神圣** | + divine_heart × 1 | T1 词条概率 ×3；保底连续 5 次未出 T1 必出 1 条 T1 |

### canReforgeDivine / reforgeDivine 接口

ReforgeSystem 加 `divine: boolean` 参数：
- 校验 divine_heart × 1 余量
- T1 词条权重 ×3
- 命中 T1 → reforgePity 重置；未命中 → reforgePity++
- pity ≥ 5 → 强制至少 roll 出 1 条 T1（如果池中存在）

## 4. 神器配方 (Mythic Recipes)

### recipes.js 新增

```js
divine_blade_recipe: {
  id: 'divine_blade_recipe',
  name: '神圣巨剑配方',
  resultId: 'lava_blade',     // 复用 legendary 模板，结果直接 mythic
  resultRarity: 'mythic',
  resultLevel: 15,
  materials: [
    { matId:'world_core', count: 1 },
    { matId:'divine_heart', count: 3 },
    { matId:'soul_crystal', count: 5 },
    { matId:'ancient_core', count: 10 }
  ],
  gold: 20000,
  requiredLevel: 15
}
// 另外 3 个：world_guardian / abyss_ring / void_robe
```

## 5. UI 改造

### CharacterPanel 加套装信息区

属性栏底部新增「已激活套装」面板（可折叠）：
```
🛡 远征战士套装  4/6
  ✓ 攻击 +5%
  ✓ 生命 +10%
  ✗ 6 件：攻击 +20%（缺 2）
```

### InventoryPanel tooltip 加套装行

```
铁剑  +5
力量 +1   攻击 5
[词条…]
[孔位…]
🔗 套装：远征战士 (1/6)
```

### SmithyPanel openReforgeModal 加「神圣洗练」按钮

- 检查 divine_heart 余量
- 不足时灰显
- 显示 pity 计数提示（连续 N 次未出 T1）

## 6. 不在 Phase 3 范围

- ❌ 商店 / 交易系统
- ❌ 装备绑定机制
- ❌ 跨职业借词条
- ❌ 词条转移
- ❌ 装备词条强化（refining_stone 真正消费）
- ❌ 超时空套装（跨主题混搭）

## 7. 存档兼容

- 老 instance 缺 `reforgePity` → 默认 `0`
- 老 instance 缺 `setId`（未来通过 templateId 查 items.json，无需写入实例）

## 8. 测试计划

- 装备 2/4/6 件套效果实时叠加
- 卸下 1 件后高 tier 失效
- 神圣洗练消耗 + pity 计数
- 神器配方完整制作流程
- 老存档加载 → reforgePity 字段补齐
