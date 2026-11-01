# 背包与装备系统

> 文件：`src/systems/InventorySystem.js`、`EquipmentSystem.js`、`LootEngine.js`、`src/data/items.json`、`lootTables.js`

## InventorySystem

### 基本参数
- 32 格容量
- 可堆叠物品 maxStack 由 items.json 决定（默认 999）
- 排序：类型 → 品质 → 名称

### 数据结构
```js
// 背包格子
{ id, type, slot, rarity, ...itemData, quantity }
// 空格子
null
```

### 关键方法
| 方法 | 作用 |
|------|------|
| `addItem(item)` | 添加（自动堆叠或新格） |
| `removeItem(slotIndex, count)` | 移除指定格子 |
| `useItem(slotIndex)` | 使用消耗品（heal 等） |
| `getSlot(idx)` / `getItems()` | 查询 |
| `sort()` | 排序 |
| `exportData() / importData(data)` | 序列化 |

事件：`inventoryChanged`。

## EquipmentSystem

### 8 个装备槽位

| 槽 | 类型 |
|----|------|
| weapon | 武器 |
| armor | 护甲 |
| helmet | 头盔 |
| boots | 靴子 |
| ring1 / ring2 | 戒指（双槽） |
| necklace | 项链 |
| accessory | 饰品 |

### 装备流程（`equipFromInventory(slotIdx)`）

```
1. 查 inventory 取 item
2. 解析目标槽位（双戒指自动选空槽）
3. 等级检查 → 不足 emit 'showMessage'
4. 职业检查（weaponType）→ 不符 emit 'showMessage'
5. 从背包移除
6. 旧装备回背包（背包满则回滚）
7. 装到槽位
8. emit 'equipmentChanged' → _applyBonuses 重算属性
```

### 等级检查
```js
if (item.level && levelSystem.level < item.level)
  emit('showMessage', `等级不足 (需要 Lv.${item.level})`)
```

### 职业检查（`weaponType`）
基于装备的 `weaponType` 字段映射职业：

| weaponType | 允许职业 |
|------------|----------|
| `heavy` | warrior |
| `light` | archer |
| `magic` | mage |

不符则 emit `showMessage` 提示。

### `showMessage` 事件流
- `EquipmentSystem` emit `'showMessage'` → 由 **MainGameScene + PanelScene 同时监听**
- MainGameScene → `showQuickMessage`（屏幕中央）
- PanelScene → `_showPanelToast`（panel 顶部，确保打开背包时可见）

### 属性加成（`_applyBonuses`）

```
1. getStatBonuses() 遍历所有装备
2. 累加 base bonuses 到 stats.bonuses
3. 累加 flat bonuses 到 stats.flatBonuses
4. 与 LevelSystem 的 maxHp 加成合并
5. stats.invalidate() + player.refreshStats()
```

## LootEngine

### 掉落流程
```
enemy.die → emit 'enemyDropLoot' → LootEngine.roll(enemyId, dropBonus)
  → 查 lootTables.js 取掉落池
  → 加权随机选物
  → 品质判定 (common → legendary)
  → 缩放属性（getScaledStats）
  → 返回 drops[]
```

### 品质系统

| 品质 | 颜色 | 属性倍率 | 概率（基础） |
|------|------|----------|--------------|
| common | 白 | 1.0× | 60% |
| uncommon | 绿 | 1.2× | 25% |
| rare | 蓝 | 1.5× | 10% |
| epic | 紫 | 2.0× | 4% |
| legendary | 橙 | 3.0× | 1% |

`dropBonus` 属性提升稀有品质权重。

### 属性缩放（`getScaledStats(item)`）

```js
{
  statBonuses: { str: baseStats.bonus.str * rarityMul },
  flatBonuses: { attack: baseStats.flatBonus.attack * rarityMul }
}
```

## items.json 格式

### 装备
```json
{
  "id": "iron_sword",
  "name": "铁剑",
  "type": "equipment",
  "slot": "weapon",
  "rarity": "common",
  "weaponType": "heavy",
  "level": 1,
  "icon": "⚔️",
  "baseStats": {
    "flatBonus": { "attack": 5 },
    "bonus": { "str": 0.05 }
  }
}
```

### 消耗品
```json
{
  "id": "hp_potion",
  "name": "生命药水",
  "type": "consumable",
  "stackable": true,
  "maxStack": 99,
  "icon": "🧪",
  "effect": { "type": "heal", "amount": 50 }
}
```

### 货币
```json
{
  "id": "coin",
  "type": "currency",
  "stackable": true,
  "value": 10
}
```

## UI 显示

- **背包面板**（InventoryPanel）：8×4 网格，点击格子弹出菜单（使用/装备/丢弃）
- **装备面板**：左侧 8 槽位 + 右侧角色属性对比
- **稀有品质边框**：按 rarity 颜色描边 + 名字着色
- **掉落物**：高品质装备掉落时世界中显示发光圈

## 添加新装备

1. `items.json` 加条目（含 `slot/rarity/weaponType/level/baseStats`）
2. `lootTables.js` 配掉落权重
3. 自动处理：品质缩放、属性加成、UI 显示、限制检查

---

## Phase 1+2+3 升级（装备实例化 + 词条 + 强化 + 制作 + 套装）

### 实例化装备
每次掉落生成唯一实例（`instanceId`），与模板（`items.json`）解耦：
```js
{
  instanceId, templateId,
  rarity, level, enhanceLevel,
  affixes: [{ id, value }],
  sockets: [{ gemId, gemLevel }],
  reforgePity: 0      // Phase 3：洗练保底计数
}
```

### 6 品质 + 词条
- 品质：`common / uncommon / rare / epic / legendary / mythic`
- `RARITY_MULTIPLIERS` × `(1 + 0.1 × level)` × `(1 + 0.05 × enhanceLevel)`
- 词条池见 `data/affixes.js`：T1（最强）~ T5；带 `_base_xxx` / `_trigger` 特殊 stat

### 强化系统（Phase 1, `EnhanceSystem.js`）
+0~+15，每级消耗递增材料；失败可能降级（保底机制保留）。

### 洗练（Phase 2+3, `ReforgeSystem.js`）
- 普通：chaos_essence ×2 + 1000 金币
- 锁定 1/2 条：+ soul_crystal
- **神圣洗练（Phase 3）**：+ divine_heart ×1，T1 词条权重 ×3
- **保底机制**：连续 5 次洗练未出 T1 → 强制至少 1 条 T1（`reforgePity` 字段计数）

### 孔位 + 宝石（Phase 2, `GemSystem.js`）
- 装备生成时按品质带 0-4 孔（rare=1 / epic=2 / legendary=3 / mythic=4）
- 4 色宝石 × 10 级，3 同色同级合成高 1 级（红=攻击 / 蓝=法强 / 绿=生命 / 黄=暴击）
- 镶嵌效果由 `EquipmentSystem.getStatBonuses()` 累加

### 触发型词条（Phase 2, `TriggerSystem.js`）
- 词条 `stat='_trigger'`，带 `trigger: { event, chance, effect, power }`
- 触发点：`onHit / onKill / onSkillCast / onCrit`
- 触发效果：`spawn_fireball / heal_pct / reduce_cd / lifesteal_pct`
- 由 `InteractionHandler` / `Player.onSkillActive` 注入

### 装备制作（Phase 2+3, `CraftingSystem.js`）
- 配方表：`data/recipes.js`
- Phase 2：6 个普通配方（rare / epic 装备）
- Phase 3：4 个 mythic 配方需 `world_core` / `divine_heart`

### 套装系统（Phase 3, `SetSystem.js`）
- `data/sets.js`：4 套装 × 6 件，2/4/6 件触发
- 装备模板带 `setId` 字段（运行时查 `items.json`）
- 通过 `EquipmentSystem.getStatBonuses()` 末尾合并到三通道（flatBonuses/bonusPct/bonuses）
- `EquipmentSystem.getActiveSets()` 暴露给 `CharacterPanel` 渲染

### 顶级材料（Phase 3）
| 材料 | rarity | 用途 |
|------|--------|------|
| `chaos_essence` | rare | 洗练基础 |
| `soul_crystal` | epic | 锁词条 |
| `star_fragment` | rare | 宝石升级 |
| `refining_stone` | uncommon | 高级制作 |
| `divine_heart` | legendary | 神圣洗练 / 神器配方 |
| `world_core` | mythic | 神话配方专属 |

### 强化 UI
- 强化模态显示成功率 + 失败后果提示
- +1~+5 必定成功
- +6~+10 成功率 70%，失败保持等级
- +11~+15 成功率 40%，失败降 1 级（⚠ 警告标注）

### 制作 UI
- 制作模态 540×600，支持 mask-based 滚动浏览配方
- 配方显示：品质颜色 + 材料需求（含持有数量） + rarity 标注
- 滚轮滚动：Phaser wheel 事件参数 `(pointer, currentlyOver, deltaX, deltaY, deltaZ)`，deltaY 是第 4 参数

### 宝石 UI
- 镶嵌模态显示已镶嵌宝石属性值（`🔴 红宝石 Lv.3  +9 攻击`）
- 宝石选择器显示每颗宝石的属性加成和持有数量
- 合成模态显示宝石属性信息

### 存档兼容
`SaveSystem.fromJSON()` 加载时为老 instance 补齐：
- `instanceId / affixes / enhanceLevel / sockets / reforgePity` 缺省
