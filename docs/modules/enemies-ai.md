# 敌人 AI 与技能系统

> 文件：`src/entities/Enemy.js`、`src/entities/EnemyProjectile.js`、`src/systems/EnemySkillSystem.js`、`src/data/enemySkills.js`、`src/data/enemyConfig.js`

## 设计目标

- **接触不掉血**：敌人通过技能 hitbox/弹道造伤，贴身不受伤
- **可拓展**：4 种技能 type 由数据驱动，新加 type 只需写一个执行函数
- **真实战斗体验**：进入仇恨需要时间（被发现），脱战会满血回复
- **boss 区分**：抗 stagger、立即仇恨、长脱战时间

## 战斗状态机

```
PATROL ←──────── 脱战 ──────────┐
  │                              │
  │ aggroDelay 内停在感知范围     │
  │ 或 takeDamage                │
  ↓                              │
CHASE ──── pickSkill 命中 ────→ SKILL_TELEGRAPH (telegraph ms)
  ↑                                       ↓
  └─────────── recovery ─────── SKILL_ACTIVE (activeWindow ms)
                                          ↓
                                  SKILL_RECOVERY (300ms)
HURT (仅 stagger > 0)
DEAD
```

### 进入战斗 (`_updateCombatState`)
- 玩家在 `detectionRange` 内 **持续 `aggroDelay` ms** → 仇恨
- 玩家走开则 `aggroTimer` 衰减 2× 恢复速度
- `takeDamage` 立即 `_enterCombat`（远程偷袭也能拉仇恨）

### 退出战斗 (`_exitCombat`)
- 玩家**离开 `disengageRange` 持续 `disengageTime` ms** → 脱战
- **HP 立即满血**
- 取消进行中的技能
- 回 PATROL

### 战斗中冻结 HP 自动回复
- `Actor.updateRegen` 检查 `inCombat` 标记
- 仅 Enemy 在战斗时跳过 `hpRegen`，其他资源不变
- Player 无 `inCombat` 字段（始终 falsy） → 玩家正常回血

## 巡逻 (`startPatrol` + `updatePatrol`)

- 自 spawn 点向左右各 `patrolRange/2` 设置 `patrolPointA/B`
- `moveToPoint(target)` 仅设速度（不再用 `delayedCall` 切换）
- `updatePatrol` 距离驱动：到点 < 8px → 停 1.5 秒 → 切换目标 → 继续走
- **卡墙检测**：`body.velocity` 持续 < 5 累计 800ms → 自动调头切换 patrolPoint

## 4 种技能 type

| Type | 行为 | telegraph 视觉 | 适用 |
|------|------|----------------|------|
| `melee_strike` | 前方矩形 hitbox（active window 内单次有效） | 染色 | slime / goblin / spider / skeleton 近战 |
| `ranged_shot` | 朝玩家发射 `EnemyProjectile` | 染色 | bat / skeleton 投骨 / boss 巨弹 |
| `charge_attack` | 设速度冲向玩家，hitbox 跟随 | 染色 + 方向线 | spider 扑击 / boss 冲撞 |
| `aoe_burst` | 圆形 AOE | 染色 + 渐显圆环（长 telegraph 警示） | boss / fire_mage |

### 技能配置（`enemySkills.js`）

```js
basic_melee: {
  type: 'melee_strike',
  range: 50,           // 玩家进入此距离才会选用
  cooldown: 1500,
  telegraph: 300,      // 预警时间 ms
  activeWindow: 100,   // 实际伤害窗口 ms
  damage: 1.0,         // 伤害倍率（× enemy.getAttack()）
  hitbox: { w: 36, h: 32 },
  telegraphTint: 0xff8800,
  priority: 0          // 多技能可用时按 priority 倒排，同优先级随机
}
```

### 远程类技能 (`ranged_shot`) 特有
- `minRange`：最小距离，玩家太近不射（保持距离）
- `projectileSpeed/Size/Color/Lifetime`
- 视觉：`EnemyProjectile`（圆形 + 拖尾粒子）

### 冲锋类 (`charge_attack`) 特有
- `speed`：冲锋速度
- hitbox 跟随敌人 sprite，每帧同步位置（`updateHitboxFollow`）

### AOE 类 (`aoe_burst`) 特有
- `radius`：圆形伤害半径
- 长 telegraph（700ms+）+ 渐显圆环让玩家有时间走开
- 爆炸视觉：圆形闪光 + 缩放渐淡

## EnemySkillSystem

每个 Enemy 持有一份。

### API
| 方法 | 作用 |
|------|------|
| `tick(delta)` | 推进所有冷却 |
| `pickSkill(player)` | 返回当前可用最高优先级技能（cooldown=0 + range 内） |
| `executeTelegraph(skill)` | 染色 + 视觉指示器 |
| `executeActive(skill, player)` | 派发到 `_executeMeleeStrike/RangedShot/ChargeAttack/AoeBurst` |
| `executeRecovery(skill)` | 清理 hitbox/视觉 + 启动冷却 |
| `cancel()` | 死亡或被打断时清理（销毁 telegraph 圆环、charge 指示线、active hitbox） |
| `updateHitboxFollow()` | charge_attack 用：让 hitbox 每帧跟敌人 |

### 执行链
1. `executeTelegraph` 创建视觉提示（圆环 / 方向线 / 染色）
2. telegraph 时间到 → `executeActive` 创建 hitbox 或弹道，emit `enemyHitboxSpawned` / `enemyProjectileSpawned`
3. MainGameScene 监听事件 → 注册 `physics.add.overlap(player.sprite, hitbox, ...)` → 命中 → `player.takeDamage`
4. activeWindow 到 → `executeRecovery` 清理 + 启动冷却
5. 回 CHASE，下次 `pickSkill` 时该技能 CD 还在

## 怪物配置（`enemyConfig.js`）

```js
ENEMY_CONFIG = {
  slime:    { skills: ['basic_melee'], isBoss: false },
  goblin:   { skills: ['basic_melee'], isBoss: false },
  spider:   { skills: ['basic_melee', 'pounce'], isBoss: false },
  skeleton: { skills: ['basic_melee', 'basic_shot'], isBoss: false },
  bat:      { skills: ['basic_shot'], isBoss: false },
  orc_warrior: { skills: ['basic_melee', 'pounce'], isBoss: false },
  fire_mage:{ skills: ['basic_shot', 'ground_pound'], isBoss: false },
  giant_skeleton: { skills: ['heavy_strike', 'pounce'], isBoss: false },

  skeleton_king: {
    skills: ['heavy_strike', 'pounce', 'heavy_shot', 'ground_pound'],
    isBoss: true,
    tint: 0xff8888,
    aggroDelay: 0,         // 立即仇恨
    disengageRange: 600,
    disengageTime: 5000
  }
};
```

## EnemyProjectile

独立实体类，由 `EnemySkillSystem._executeRangedShot` 创建。

```js
new EnemyProjectile(scene, x, y, dirX, dirY, {
  speed, size, color, lifetime, damage, owner
});
```

- `physics.add.sprite` + 圆形碰撞体
- 视觉：`add.circle` + 描边 + 拖尾粒子
- `onHit(target)`：调 `target.takeDamage` + 爆点缩放渐淡 + 销毁
- `lifetime` 到期自销
- 反向引用 `sprite.projectileInstance`

## 接触 vs 技能伤害

- `handleEnemyContact`：仅保留物理碰撞推开，**不再造成伤害**
- 全部敌人伤害走 `enemyHitboxSpawned` / `enemyProjectileSpawned` 事件 → MainGameScene 注册 overlap → `player.takeDamage`

## Stagger 机制

- `Enemy.takeDamage(damage, ax, ay, staggerMs = 0)` 第 4 参数控制
- **默认 0**（普攻无僵直），仅显式声明的技能造僵直：
  - 战士冲锋 800ms、地裂斩 600ms、陨石术 800ms
- Boss 抗 stagger：`min(staggerMs, 200)`

## 事件流

```
玩家走近怪 → 累计 aggroTimer
   500ms 后 → _enterCombat → setState(CHASE)
   CHASE 中 → pickSkill 返回 basic_melee
   → setState(SKILL_TELEGRAPH) + executeTelegraph (染色)
   → 300ms 后 → executeActive
     → 创建 hitbox + emit enemyHitboxSpawned
     → MainGameScene 注册 overlap(player.sprite, hitbox)
     → 重叠 → player.takeDamage(enemyAttack × damageMul)
   → 100ms 后 → executeRecovery (清理 + 启动 1500ms CD)
   → 回 CHASE
```

## Boss 行为差异

- 拥有 4 个技能：heavy_strike / pounce / heavy_shot / ground_pound
- 立即仇恨（`aggroDelay: 0`）
- 长脱战时间（5 秒）
- 抗 stagger 至 200ms
- 4 个技能轮换（同优先级随机），CD 错开避免一直放同一技能
- 视觉：tint + 略放大尺寸（已有 `skeleton_king` 64×74 sprite）

## 添加新敌人技能 type

1. `enemySkills.js`：定义新技能配置（如 `summon`）
2. `EnemySkillSystem.executeActive` 加 type case
3. 实现 `_executeSummon(skill, player)`：创建 minion 怪物
4. 如需视觉指示：`executeTelegraph` 加 type 分支
5. 在 `enemyConfig.js` 给 boss 加入 skills 列表
