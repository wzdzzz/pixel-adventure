# 属性与战斗系统

> 文件：`src/systems/Stats.js`, `src/entities/Actor.js`

## Stats 引擎

**纯计算模块，无副作用。** 提供 base → bonus → derived 三层属性系统。

### 6 基础属性

| 属性 | 缩写 | 作用 |
|------|------|------|
| 体质 | CON | 生命值、体力值、体力回复 |
| 力量 | STR | 物理攻击力 |
| 智力 | INT | 暴击倍率 |
| 敏捷 | AGI | 移动速度、暴击率、冷却缩减 |
| 感知 | PER | 防御力 |
| 幸运 | LCK | 暴击率、掉落率 |

### 14 派生属性

```js
maxHp      = CON * 10 + 50 + flatBonus
maxStamina = CON * 8 + 60
attack     = STR * 2 + 5 + flatBonus
defense    = PER * 1.5 + 2 + flatBonus
moveSpeed  = 120 + AGI * 2 + flatBonus
critRate   = AGI * 0.5 + LCK * 1.0     // 百分比
critDamage = 1.5 + INT * 0.02          // 倍率
cdr        = AGI * 0.5                  // 冷却缩减百分比
hpRegen    = CON * 0.3                  // 每秒
staminaRegen = CON * 0.8               // 每秒
dropRate   = 1.0 + LCK * 0.02          // 掉落倍率
xpBonus    = 0                          // 预留
```

### 加成层级

1. **base** — 角色初始值，升级可修改
2. **bonus** (百分比加成) — 装备 `%` 类属性，如 `{ str: 0.1 }` = STR +10%
3. **flatBonus** (固定加成) — 装备固定值、等级奖励，如 `{ maxHp: 25 }`
4. **derived** — 最终计算结果，带缓存

### 缓存失效

```js
stats.setBase('str', 12)     → invalidate()
stats.setBonus('str', 0.1)   → invalidate()
stats.setFlatBonus('maxHp', 50) → invalidate()
stats.getDerived()           → 如缓存失效则重算
```

## 伤害公式

```
最终伤害 = max(1, 攻击力 - 防御力)
```

- 攻击力 = `attacker.stats.getDerived().attack`
- 防御力 = `defender.stats.getDerived().defense`
- 最小伤害保底 1

### 技能伤害

```
技能伤害 = max(1, 攻击力 × 技能倍率 - 防御力)
```

- 冲锋倍率：120% + 15%/级
- 旋风斩 tick 倍率：60% + 10%/级

## 碰撞与物理

### 玩家-敌人碰撞
- 使用 `processCallback` 控制
- 冲锋时：`return false`（穿过敌人）
- 正常时：双方 `pushable = false`（互相阻挡但不推动）
- 敌人的 `pushable` 每帧重置为 `true`（保证敌人之间可互推）

### 接触伤害
- 玩家碰到敌人 → `handleEnemyContact()` → `player.takeDamage()`
- 受 `isInvulnerable` 和 I-Frames 保护
