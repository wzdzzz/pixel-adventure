# 玩家技能系统

> 文件：`src/systems/SkillEngine.js`、`src/data/{warrior,archer,mage}Skills.js`、`src/data/statusEffects.js`、`src/entities/Player.js`、`src/managers/InteractionHandler.js`

## 架构

```
classConfig.js (主属性)
   ↓
warriorSkills / archerSkills / mageSkills (技能数据 + 缩放函数)
   ↓
SkillEngine (执行引擎：冷却、资源、阶段)
   ↓
Player (具体表现：hitbox 形态、移动、视觉)
   ↓
InteractionHandler.handleSkillHit (伤害结算、状态效果应用)
```

## 6 种技能 effect type

| Type | 用途 | hitbox 形态 | 派发方法 |
|------|------|-------------|----------|
| `dash` | 位移 + 撞击（冲锋、闪现、翻滚） | 跟随玩家 22px 偏移；blink 跳到终点 | `startChargeDash` |
| `leap_slam` | 跳向鼠标位置 + 落地 AOE + 地面 DoT | 落地点大范围 hitbox + 灼烧圈 | `startLeapSlam` |
| `melee` | 前方矩形（含蓄力、扇形） | 远程职业：240×N 长 hitbox 沿瞄准方向 / cone 时为扇形 AABB | `startMeleeSkill`（特殊：`startConeSkill`） |
| `spin` | 范围 AOE | 圆环；远程职业**锚定鼠标位置**（200px 内）；近战在玩家身上 | `startWhirlwind` |
| `buff` | 自身增益（war cry / mage shield 等） | 无 | `startBuffSkill` |
| `taunt` | 强制吸引敌人攻击 | 无 | `startTauntSkill` |

## 技能数据格式

```js
{
  id, name, description, icon,
  resource: 'stamina' | 'rage' | 'mana' | 'none',
  baseCost, baseCooldown,
  maxLevel: 5, upgradeCost: 1, requiredLevel: 1,
  category: 'active' | 'passive',
  phases: { startup, active, recovery },  // 毫秒

  effect: {
    type: 'dash' | 'melee' | 'spin' | 'buff' | 'taunt',

    // 共享
    baseDamageMultiplier,           // 伤害倍率（× attack）
    knockback,                      // 击退力度
    cameraShake,                    // 屏幕震动
    stagger,                        // ★ 仅此值 > 0 才造成僵直

    // 击退限制
    dedicatedKnockback: true,       // ★ 仅此标志为 true 才生效击退（默认无击退）

    // dash 特有
    distance, speed,
    blink: true,                    // 真闪现：瞬移到终点（mage 闪现）
    reverse: true,                  // 反向：朝鼠标反方向位移（archer 翻滚射击）

    // leap_slam 特有
    leapHeight: 80,                 // 抛物线最高点
    leapDuration: 400,              // 跳跃时间 ms
    groundDot: {                    // 落地后地面持续伤害
      damageMultiplier: 0.3,        // 每 tick 伤害倍率
      duration: 3000,               // 持续时间 ms
      tickInterval: 500,            // tick 间隔 ms
      radius: 60                    // 灼烧半径
    },

    // melee 特有
    hitbox: { w, h },

    // 蓄力（只能用于 melee）
    chargeable: true,
    chargeTime: 1500,
    minChargeTime: 200,
    chargeMovement: 'interrupt',    // 移动是否中断

    // 扇形多弹道（只能用于 melee）
    arrows: 5,
    spreadAngle: 60,                // 度

    // spin 特有
    radius, tickInterval,
    moveSpeedMod, superArmor,

    // buff 特有
    target: 'self',
    buffId, baseDuration, baseModifiers,

    // 应用状态效果（DoT / debuff）
    applyEffects: [
      { effectId: 'burn', chance: 0.25, duration: 4000, modifiers: { ... } }
    ]
  }
}
```

## 等级缩放（`getSkillAtLevel(skillId, level)`）

每职业 `*Skills.js` 各自实现，按 `effect.type` 派发：
- `dash`：`damageMultiplier = base + (lv-1) × 0.1~0.15`
- `spin`：`damageMultiplier = base + (lv-1) × 0.08~0.1`
- `melee`：`damageMultiplier = base + (lv-1) × 0.15~0.18`
- `buff`：`duration = base + (lv-1) × 500ms`，`modifiers` 各值 ×1.1/级
- 通用：`cost ×= (1 - 0.03×(lv-1))`，`cooldown ×= (1 - 0.05×(lv-1))`

## SkillEngine

**职责**：冷却、资源检查、阶段推进、等级管理。

### 生命周期
```
canUse() → execute()（扣资源、起冷却、进入 startup）
         ↓
update(delta) 每帧推进
         ↓
startup → 'phase_active' 事件 → onSkillActive(skill)
         ↓
active → tickInterval 触发 'skill_tick' → onSkillTick(skill)
         ↓
phase_recovery → onSkillRecovery
         ↓
skill_complete → onSkillComplete
```

### 关键方法
| 方法 | 作用 |
|------|------|
| `canUse(skillId)` | 检查冷却/资源/已施法状态 |
| `execute(skillId)` | 扣资源 + 起冷却 + 进入 startup（应用 CDR） |
| `update(delta)` | 推进阶段，返回 `{event, skill}` |
| `getScaledSkill(skillId)` | 获取当前等级的缩放数据 |
| `getSkillLevel/upgradeSkill` | 等级管理 |
| `hasHitTarget/markTargetHit` | 同一施法内防止重复命中（spin 多 tick 之间清理） |
| `cancelActiveSkill` | 被打断时调用 |
| `toJSON/fromJSON` | 序列化技能等级 |

## 玩家瞄准 (`getAimDirection`)

- 远程职业（`isRangedClass()` true）：读 `pointer.worldX/Y`，归一化为单位向量
- 近战职业：回退到 `facing`（左/右）
- 鼠标在玩家身上时：兜底用 facing 避免除零

应用：
- 普攻 sweep（远程 30→220px，6 帧扫掠）
- `startMeleeSkill` 的 hitbox 中心（远程职业 only）
- `startChargeDash` 的位移方向（所有职业）
- `startWhirlwind` 远程分支的 AOE 锚点
- 角色按鼠标 X 翻面

## 关键技能实现

### 普攻 (`handleAttackStartup/Active`)
- 近战：`facing*22` 偏移 + 40×36 矩形 hitbox（100ms）
- 远程：24×24 hitbox 沿 `_rangedAim` 30→220 扫掠（100ms / 6 帧）；同时生成视觉弹道飞 220px

### Charge Dash (`startChargeDash`)
- `getAimDirection()` 决定方向
- `effect.reverse: true` → 反向位移（archer 翻滚射击）
- `effect.blink: true` → 直接 `setPosition(end)`，残影 + 终点 hitbox。允许穿墙，但终点若在墙内则自动退到墙前（`_findBlinkEndpoint`）
- 否则用 velocity 推进（warrior 冲锋、archer 翻滚等）

### Melee Skill (`startMeleeSkill`)
- 远程职业：射程 = `clamp(180 + (dmgMul-1)×50, 140, 240)`
  - `effect.chargeable` → 长 240×N 静止 hitbox（不 sweep）
  - `effect.arrows > 1` → `startConeSkill`（扇形多弹道 + 半透明扇形指示）
  - 否则单弹道 + hitbox 沿瞄准方向 sweep
- 近战职业：固定 `facing*22` 矩形 hitbox

### Whirlwind / Spin (`startWhirlwind`)
- 远程职业：AOE 锚定到鼠标位置（最大 200px），双层脉冲圆（外圈描边 + 内圈实心反向脉冲）
- 近战职业：以玩家为中心，sprite 旋转 tween
- `superArmor` 标记保留 `_whirlwindSuperArmor`，避免 i-frames 清除时失去无敌
- 多 tick：`hitTargets` 在每 tick 之间清理（让同一敌人多次受击）

### 蓄力技能（chargedShot）
- `trySkill` 检测 `chargeable` → 进入 `CHARGING` 状态（不消耗资源、不进冷却）
- `handleCharging` 每帧累计计时；移动 → 取消；松开 → `_releaseCharge`
- 进度条：`_chargeBarBg/Fill`，玩家头顶（颜色按 t 渐变）
- `_chargeRatio = 0.4 + 0.6 × t`（min 0.4，max 1.0）
- 释放后调 `skillEngine.execute` → 普通技能流程
- `handleSkillHit` 中 `damage *= chargeRatio`

### 扇形多弹道（multiShot）
- 5 发弹道按 `spreadAngle/2` 散开
- hitbox：扇形 4 个特征点（顶点 + 弧两端 + 弧中点）的 AABB
- 显示半透明扇形指示（350ms 渐淡）

## Status Effects 应用

`InteractionHandler.applySkillEffects(target, applyEffects[])`：
1. 按 `chance` 概率判定
2. 从 `STATUS_EFFECTS`（`statusEffects.js`）查模板，含 `type/tickInterval/damagePerTick/icon/name` 等
3. DoT 类型自动绑 `onTick`，按 `source.getAttack() × dpt × stacks` 调 `target.takeTickDamage`
4. 调用 `target.statusEffects.apply(effectId, config)`

## 修饰符消费链

| 修饰符 | 消费方 | 作用 |
|--------|--------|------|
| `attack` | `Player.getAttack`（×倍率） | 战吼/血怒等增益 |
| `defense` | `Actor.takeDamage`（×倍率） | 防御姿态 |
| `moveSpeed` | `Actor.getMoveSpeed`（×倍率） | 疾风步、frostSlow |
| `damageReduction` | `Player.takeDamage`（×(1-x)） | 法师护盾 |
| `damageTaken` | `Actor.takeDamage`（×(1+x)） | 猎人印记 |
| `lifesteal` | `handleSkillHit`（伤害的 N% 回血） | 血怒 |

## UI 集成

- **HUD 技能栏**：`UIScene.createSkillBar` 4 个槽位，从 `player.skillSlots` 读图标，冷却倒计时
- **Buff 栏**：技能栏正上方，从 `player.statusEffects.getActiveSummary()` 动态读
- **Tooltip**：500ms hover 显示技能/buff 详情
- **技能面板**：2 列卡片网格，可滚动；每张卡片有 `[1][2][3][4]` 装备按钮

## 添加新技能步骤

1. 对应职业 `*Skills.js` 添加 `XXX_SKILLS.newSkill = { ... }`
2. `SKILL_SLOTS` 数组中分配键位（如默认绑定）
3. `getSkillAtLevel()` 在 effect.type 分支添加缩放（通常已有同 type 模板）
4. 如果是新 effect.type：
   - `Player.onSkillActive` 加 case
   - 实现 `startXxxSkill(skill)` 方法
   - `handleSkillCasting` 加 hitbox 位置维护逻辑
   - `InteractionHandler.handleSkillHit` 加伤害结算分支
5. 如果带状态效果：在 `*Skills.js` 的 `EFFECTS` 加模板，由 `applySkillEffects` 自动处理
