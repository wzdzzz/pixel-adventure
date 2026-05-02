# 属性与战斗系统

> 文件：`src/systems/Stats.js`、`src/entities/Actor.js`、`src/entities/Player.js`、`src/managers/InteractionHandler.js`

## Stats 引擎

**纯计算模块，无副作用**。三层属性系统：

```
base + bonuses(同属性加成) → effective stat
                          ↓
                    derived（含 flatBonuses）→ 缓存
```

### 6 基础属性

| 属性 | 缩写 | 含义 |
|------|------|------|
| 体质 | CON | HP / 体力 / HP 回复 |
| 力量 | STR | 物理攻击 / 暴击伤害 |
| 智力 | INT | 法力 / 法术强度 / CDR |
| 敏捷 | AGI | 移速 / 攻速 |
| 感知 | PER | 暴击率 / 护甲穿透 |
| 幸运 | LCK | 掉落加成 |

### 14 派生属性

```js
maxHp       = con*10 + flatBonus.maxHp
maxMp       = int*15 + flatBonus.maxMp
attack      = str*2  + flatBonus.attack          // ★ 见下方"职业差异化"
spellPower  = int*1  + flatBonus.spellPower
moveSpeed   = agi*20 + 40 + flatBonus.moveSpeed
attackSpeed = 1.0 + agi*0.01 + flatBonus.attackSpeed
hpRegen     = con*0.5 + flatBonus.hpRegen
critDmg     = 1.5 + str*0.1 + flatBonus.critDmg
critRate    = per*0.5 + flatBonus.critRate       // 百分比点
tenacity    = con*0.5 + str*0.2 + flatBonus.tenacity
armorPen    = str*0.3 + per*0.5 + flatBonus.armorPen
defense     = flatBonus.defense                   // 完全靠装备
dropBonus   = √lck + flatBonus.dropBonus
cdr         = min(40, int*0.2 + flatBonus.cdr)    // 上限 40%
encumbrance = flatBonus.encumbrance               // 预留
```

### 加成层级

1. **base**：角色初始 6 维（来自 `classConfig.baseStats`）+ 升级手动分配
2. **bonuses**（同属性加成）：装备/buff 给出的属性值（`{ str: 5 }`）
3. **flatBonuses**（派生层加成）：装备的固定派生值（`{ maxHp: 25, attack: 10 }`）+ 等级 maxHp 奖励
4. **derived**：最终结果，带 `_cache` 缓存

### 缓存失效
任何 `setBase / addBase / setBonus / setFlatBonus` → `invalidate()` 清缓存 → 下次 `getDerived()` 重算。

### 关键方法
| 方法 | 作用 |
|------|------|
| `getEffective(stat)` | base + bonuses[stat] |
| `getDerived()` | 全部派生（带缓存） |
| `setBase(stat, val)` / `addBase(stat, n)` | 改基础属性 |
| `setFlatBonus(stat, val)` | 等级/装备的派生加成 |
| `setEquipmentBonuses(b, fb)` | 装备调用，整体替换 |
| `toJSON / fromJSON` | 仅序列化 base（bonuses/flatBonuses 由系统重算） |

## 职业差异化攻击力

`Player.getAttack()` 重写 Actor 默认实现：

```js
const primaryStat = this.classConfig.primaryAttackStat;  // str/agi/int
const primary = this.stats.getEffective(primaryStat);
const flatAttack = this.stats.flatBonuses.attack || 0;
const baseAttack = primary * 2 + flatAttack;
const mod = this.statusEffects.getModifiers().attack ?? 1;
return baseAttack * mod;
```

| 职业 | primaryAttackStat |
|------|-------------------|
| warrior | str |
| archer | agi |
| mage | int |

确保升级 INT/AGI 也能提升对应职业的攻击力。

`CharacterPanel` 显示同步使用 `player.getAttack()`，避免与实战不一致。

`Enemy.getAttack()` 仍走 Actor 默认（用 `derived.attack` = str×2），简单稳定。

## 伤害计算（`Actor.takeDamage`）

```js
mods = statusEffects.getModifiers();
baseDef = derived.defense
defMod  = mods.defense ?? 1                    // 防御姿态等
defense = baseDef * defMod
dtMod   = mods.damageTaken ?? 1                // 猎人印记等
finalDamage = max(1, floor((rawDamage - defense) * dtMod))
hp -= finalDamage
isInvulnerable = true; iFramesTimer = iFramesDuration
emit 'actorDamaged'
```

**注意**：
- **不再调用 `applyKnockback`**（用户偏好）
- 仅 `effect.dedicatedKnockback: true` 的技能在 `handleSkillHit` 中显式调用 `enemy.applyKnockback(...)`

## DoT 伤害（`Actor.takeTickDamage`）

```js
takeTickDamage(amount) {
  if (hp <= 0) return;
  hp -= max(1, floor(amount));
  emit 'actorDamaged';   // 飘字
  if (hp <= 0) delayedCall(50, () => die());
}
```

绕过 I-Frames / 防御 / damageTaken 修饰符（DoT 已含在 dpt × stacks 中）。

## 修饰符消费表

| 修饰符 | 消费方 | 效果 |
|--------|--------|------|
| `attack` | `Player.getAttack` 末尾乘倍率 | +20% 攻击 |
| `defense` | `Actor.takeDamage` 防御 ×= mod | +30% 防御 |
| `moveSpeed` | `Actor.getMoveSpeed` ×= mod | -40% 减速 |
| `damageReduction` | `Player.takeDamage` 入口 ×= (1-x) | -30% 受伤 |
| `damageTaken` | `Actor.takeDamage` 末尾 ×= (1+x) | +20% 受伤（猎人印记） |
| `lifesteal` | `handleSkillHit` 命中后 heal | 15% 吸血 |

## 战斗中冻结回血

`Actor.updateRegen` 检查 `this.inCombat`：
- Enemy：战斗中跳过 hpRegen，脱战后满血恢复
- Player：无 `inCombat` 字段（undefined），不影响

体力/法力/怒气不受 inCombat 影响（保持战斗中可消耗+回复体力打技能）。

## 物理与碰撞

### 玩家-敌人碰撞
- `processCallback` 控制：
  - 冲锋（`PlayerState.SKILL_CASTING` + dash 类技能）→ `return false`（穿过敌人）
  - 正常 → 双方 `pushable = false`（互相阻挡）
- 敌人 `pushable` **每帧重置为 true**（保证敌人之间可互推，仅 process 中临时设 false）
- **接触不再造成伤害**（`handleEnemyContact` 仅推开物理）

### 敌人对玩家伤害
全部通过 `enemyHitboxSpawned` / `enemyProjectileSpawned` 事件 → MainGameScene 注册 overlap → `player.takeDamage`。

详见 `enemies-ai.md`。

### 普攻/技能 hitbox vs 敌人
- `physics.add.overlap(player.attackHitbox, enemy.sprite, () => handleAttackHit(enemy))`
- `physics.add.overlap(player.skillHitbox, enemy.sprite, () => handleSkillHit(enemy))`
- 命中时调 `enemy.takeDamage(damage, x, y, skillStagger)`

### 木桶可破坏
- 普攻：`attackHitbox` overlap，`attackHitRegistered` 单次保护
- **技能**：`skillHitbox` overlap，**不限制单次命中**（让范围技能多帧扣 hp 直到破，2 hp 木桶 ~ 1-2 帧破）
- `isBroken` 标记防止重复触发

## Stagger 机制（僵直）

`Enemy.takeDamage(damage, ax, ay, staggerMs = 0)`：
- 默认 0 → **普攻无僵直**（怪物正常移动）
- `staggerMs > 0` → 进入 HURT 状态，停止移动 + 中断技能 + 倒计时回 CHASE
- Boss：`min(staggerMs, 200)` 抗大僵直

技能侧：`InteractionHandler.handleSkillHit` 把 `skill.effect.stagger` 传到 `takeDamage`。
当前已声明 stagger 的技能：野蛮冲锋 800ms、地裂斩 600ms、陨石术 800ms。
