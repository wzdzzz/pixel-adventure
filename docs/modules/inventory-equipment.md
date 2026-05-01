# 背包与装备系统

> 文件：`src/systems/InventorySystem.js`, `EquipmentSystem.js`, `LootEngine.js`, `src/data/items.json`, `lootTables.js`

## 背包系统 (InventorySystem)

### 基本参数
- 32 格容量
- 可堆叠物品最大叠加 99
- 支持排序（按类型→品质→名称）

### 数据结构
```js
// 背包格子
{ itemId: 'hp_potion', count: 5 }
// 空格子
null
```

### 关键方法
| 方法 | 作用 |
|------|------|
| `addItem(itemId, count)` | 添加道具，自动堆叠 |
| `removeItem(slotIndex, count)` | 移除指定格子的道具 |
| `useItem(slotIndex)` | 使用消耗品（回血等） |
| `sort()` | 按类型/品质/名称排序 |
| `exportData() / importData()` | 序列化/反序列化 |

## 装备系统 (EquipmentSystem)

### 8 个装备槽位
| 槽位 | 类型 |
|------|------|
| weapon | 武器 |
| armor | 护甲 |
| helmet | 头盔 |
| boots | 鞋子 |
| gloves | 手套 |
| ring | 戒指 |
| necklace | 项链 |
| shield | 盾牌 |

### 装备流程
```
玩家选择背包中的装备 → equip(slotIndex)
  → 如果对应槽位已有装备 → 旧装备回背包
  → 新装备戴上 → _applyBonuses() 重算属性
```

### 属性加成机制
1. 遍历所有已装备物品
2. 调用 `LootEngine.getScaledStats(item)` 获取属性
3. 累加到 `player.stats` 的 bonus / flatBonus 层
4. 调用 `player.stats.invalidate()` + `player.refreshStats()`

## 掉落引擎 (LootEngine)

### 掉落流程
```
敌人死亡 → LootEngine.roll(enemyId, playerDropRate)
  → 查 lootTables.js 获取掉落池
  → 加权随机选择掉落物
  → 品质判定（common → legendary）
  → 返回掉落列表
```

### 品质系统
| 品质 | 颜色 | 属性倍率 |
|------|------|----------|
| common | 白 | 1.0x |
| uncommon | 绿 | 1.2x |
| rare | 蓝 | 1.5x |
| epic | 紫 | 2.0x |
| legendary | 橙 | 3.0x |

### 属性缩放
```js
LootEngine.getScaledStats(item)
// 基于 item 的 baseStats × 品质倍率
// 返回 { bonus: {str: 0.05}, flatBonus: {maxHp: 10} }
```

## 数据格式 (items.json)

```json
{
  "items": {
    "iron_sword": {
      "id": "iron_sword",
      "name": "铁剑",
      "type": "equipment",
      "slot": "weapon",
      "rarity": "common",
      "icon": "⚔️",
      "description": "普通的铁剑",
      "baseStats": {
        "flatBonus": { "attack": 5 },
        "bonus": { "str": 0.05 }
      }
    },
    "hp_potion": {
      "id": "hp_potion",
      "name": "生命药水",
      "type": "consumable",
      "stackable": true,
      "maxStack": 99,
      "effect": { "type": "heal", "amount": 50 }
    }
  }
}
```

## 添加新装备

1. `items.json`：添加装备定义（含 slot, rarity, baseStats）
2. `lootTables.js`：配置哪些敌人掉落该装备及权重
3. 系统自动处理：品质缩放、属性加成、UI 显示
