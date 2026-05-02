# 背包与装备系统

> 文件：`src/systems/InventorySystem.js`、`EquipmentSystem.js`、`LootEngine.js`、`src/data/items.json`、`lootTables.js`

## InventorySystem

### 基本参数
- 32 格容量
- 可堆叠物品 maxStack 由 items.json 决定（通常 99）
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
