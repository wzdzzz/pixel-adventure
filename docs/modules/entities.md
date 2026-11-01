# 实体系统

> 文件：`src/entities/Actor.js`, `Player.js`, `Enemy.js`, `EnemyProjectile.js`, `Item.js`, `NPC.js`

## 继承关系

```
Actor (基类)
├── Player    — 玩家：状态机、3 职业输入、技能、瞄准、蓄力
└── Enemy     — 敌人：技能驱动 AI、巡逻、战斗状态机
```

`EnemyProjectile`、`Item`、`NPC` 是独立类，不继承 Actor。

## Actor 基类

**职责**：HP/体力/怒气/法力管理、I-Frames、属性系统、状态效果、基础更新循环。

### 构造
```js
new Actor(scene, x, y, textureKey, statsConfig, characterId)
// statsConfig = { con, str, int, agi, per, lck }
```

### 资源系统
| 资源 | 公式 | 回复 |
|------|------|------|
| HP | `con*10 + flatBonus.maxHp` | 脱战后按 `hpRegen/秒`（con×0.05 基准；仅 Enemy 战斗中冻结 hpRegen） |
| 体力 | `con*8 + 60` | 停止使用 1 秒后，`con*0.8/秒` |
| 法力 | `int*10 + 50` | 持续 `int*0.5/秒` |
| 怒气 | 0-100 | 攻击 +8、被击 +12；脱战 3 秒后 5/秒 衰减 |

### I-Frames（无敌帧）
- 受击后启动；Player 默认 800ms，Enemy 默认 600ms
- `updateIFrames(delta)` 每帧递减计时器
- 旋风斩等技能无敌时通过 `_whirlwindSuperArmor` 标记保留

### 关键方法
| 方法 | 作用 |
|------|------|
| `takeDamage(damage, ax, ay)` | 防御减伤 → 受伤增幅(`damageTaken`) → 扣血 → I-Frames → 闪烁；**不再击退** |
| `takeTickDamage(amount)` | DoT 专用入口：绕过 I-Frames/防御/闪烁，直接扣血+飘字 |
| `heal(amount)` | 回血，emit `actorHealed` |
| `getAttack()` | 攻击力 = `derived.attack × buff.attack`（Player 重写为按职业主属性） |
| `getMoveSpeed()` | 移速 × buff.moveSpeed（含减速/加速）|
| `useStamina/Mana(amount)` | 扣资源，重置回复计时器 |
| `addRage(amount)` | 加怒气 |
| `refreshStats()` | 从 Stats 引擎刷新 max 值 |
| `updateActor(delta)` | I-Frames + Regen + StatusEffects.update |

### StatusEffectSystem 集成
每个 Actor 持有一个 `StatusEffectSystem` 实例。提供：
- `apply(effectId, config)`：施加 buff/debuff/DoT，支持 stacks/refreshable
- `getModifiers()` / `getFlatModifiers()`：累计百分比/固定加成
- `getActiveSummary()`：UI 用（含 icon/name/description/remaining）

`Actor.takeDamage` 会消费 `damageTaken`（受伤增幅）和 `defense`（防御乘数）等修饰符。

## Player

**职责**：输入、状态机、3 职业差异化、瞄准、蓄力、技能。

### 状态机
```
IDLE ←→ WALK
  ↓        ↓
ATTACK_STARTUP → ATTACK_ACTIVE → ATTACK_RECOVERY → IDLE
  ↓
CHARGING (蓄力技能：按住时进入)
  ├─ 移动/受击 → IDLE
  └─ 松开 / 满蓄 → SKILL_CASTING
  ↓
SKILL_CASTING (普通技能/释放后的蓄力技)
  ↓
HURT → IDLE
  ↓
DEAD
```

### 输入绑定
| 按键 | 功能 |
|------|------|
| WASD / 方向键 | 8 方向移动 |
| 左键 | 普通攻击（远程职业沿鼠标方向） |
| 1-4 | 技能槽位（数据来自 `player.skillSlots`，可在面板自定义） |
| E | 与 NPC / 宝箱 / 传送门交互 |
| Tab / I | 打开/关闭面板 |
| ESC | 游戏内菜单（保存进度/返回主菜单/继续） |
| F | 浏览器全屏切换 |

### 3 职业差异
| 职业 | 主属性 | 攻击类型 | 资源 | 主属性 stat |
|------|--------|----------|------|-------------|
| warrior | str | melee | rage | `primaryAttackStat: 'str'` |
| archer | agi | ranged | stamina | `'agi'` |
| mage | int | magic | mana | `'int'` |

`Player.getAttack()` 重写为 `(primary*2 + flatBonus.attack) × (1 + bonusPct.attack)` × buff，确保升级 INT/AGI 也提升伤害，百分比攻击加成正确应用。

### 远程瞄准 (`getAimDirection()`)
- 远程职业（archer/mage）读 `pointer.worldX/Y` → 单位向量
- 近战职业回退到 `facing` 水平方向
- 用于：普攻 hitbox 扫掠 / melee 类技能位置 / 蓄力技 hitbox / dash 方向 / spin AOE 锚点

### 蓄力技能（`effect.chargeable: true`）
- `CHARGING` 状态：玩家头顶进度条（黄→橙→红 渐变颜色）
- 移动 → `_cancelCharge()`（`chargeMovement: 'interrupt'`）
- 满蓄或松开 → `_releaseCharge()`，`_chargeRatio = 0.4 + 0.6 × t`
- 释放后用一个 **覆盖完整射程的长 hitbox**（不扫掠），保证沿路敌人都命中
- 受击中蓄力 → `Player.takeDamage` 检测 CHARGING 自动取消

### 技能槽位自定义
- `setSkillSlot(idx, skillId)` API（去重 + emit `skillSlotsChanged`）
- 槽位变化触发自动存档（避免刷新丢失）
- 在 `SkillTreePanel` 每张技能卡有 `[1][2][3][4]` 按钮装备/取消

### 碰撞体
- `sprite.body`：脚部小碰撞体
- `attackHitbox`：普攻判定（远程沿瞄准方向 100ms 扫掠 220px）
- `skillHitbox`：技能判定（按 type 形态各异）
- `sprite.body.pushable = false`：玩家不可推动

## Enemy

**职责**：技能驱动 AI、巡逻、战斗状态机、boss 行为。

### 状态机
```
PATROL  (在 patrolPointA/B 来回；卡墙 800ms 自动调头)
   ↓ 进入感知范围 aggroDelay ms 或受击
   ↓
CHASE   → 向玩家移动；可用技能即施放
   ↓
SKILL_TELEGRAPH (染色/AOE 圆环/方向线 提示) → telegraph ms
   ↓
SKILL_ACTIVE (执行技能 hitbox/弹道) → activeWindow ms
   ↓
SKILL_RECOVERY → 300ms → CHASE

HURT (仅 effect.stagger > 0 才进入；boss 抗 stagger 至 200ms)
DEAD
```

### 战斗状态字段
| 字段 | 默认 | 作用 |
|------|------|------|
| `inCombat` | false | 是否仇恨中 |
| `aggroDelay` | 500ms | 感知范围内停留多久才仇恨（boss=0 即时） |
| `disengageRange` | `detectionRange × 2.5` | 脱战距离 |
| `disengageTime` | 3000ms（boss 5000ms） | 持续超出多久脱战 |

**脱战行为**：HP 满血恢复 + 取消进行中的技能 + 回 PATROL。

**战斗中冻结 HP 自动回复**（`Actor.updateRegen` 检查 `inCombat`）。

### 技能系统
- `EnemySkillSystem` 实例（见 `docs/modules/enemies-ai.md`）
- 在 CHASE 中调 `pickSkill(player)` 选可用技能 → telegraph → execute → recovery → CD

### 配置参数（来自 `enemyConfig.js`）
| 参数 | 含义 |
|------|------|
| `skills` | 技能 ID 列表 |
| `isBoss` | 抗 stagger + 立即仇恨 |
| `tint` | 染色 |
| `displayScale` | 显示缩放 |
| `aggroDelay/disengageRange/disengageTime` | 战斗状态调参 |

### 头顶血条
- 每个 Enemy 自带 HP 条（背景 + 填充）
- 颜色按比例变（绿→黄→红）
- `update()` 每帧跟随 sprite 位置

## EnemyProjectile

敌人远程技能弹道实体。
- `physics.add.sprite` + 圆形物理体
- 朝目标方向匀速移动，命中玩家造伤后销毁
- 视觉：圆形 + 白色描边 + 拖尾粒子
- `lifetime` 到期自动销毁
- 反向引用 `sprite.projectileInstance` 便于碰撞回调

## Item / NPC

**Item**：浮动动画、拾取飞入效果、`itemId` 关联 `items.json`。

**NPC**：名字标签、`!` 任务标记、对话窗口（深度 9990，避免被装饰挡住）。

## Player.update 流程

1. `updateActor(delta)` — I-Frames、Regen、StatusEffects
2. `stateTimer += delta`
3. switch `state` → 对应 handler（IDLE/WALK/CHARGING/SKILL_CASTING 等）
4. `skillEngine.update(delta)` — 推进技能阶段，触发事件
5. `updateInteractHint()` — 交互提示文字跟随玩家头顶

## Enemy.update 流程

1. `updateActor(delta)`
2. `updateHealthBar()`
3. `skillSystem.tick(delta)` — 推进冷却 + `updateHitboxFollow()`（charge_attack）
4. `_updateCombatState(distance, delta)` — aggroTimer / disengageTimer
5. switch `state` → 对应 handler
