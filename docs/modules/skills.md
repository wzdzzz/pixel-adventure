# 技能系统

> 文件：`src/systems/SkillEngine.js`, `src/data/warriorSkills.js`, `src/entities/Player.js`

## 架构

```
warriorSkills.js (数据定义)
      ↓
SkillEngine.js (执行引擎：冷却、资源、阶段)
      ↓
Player.js (具体表现：hitbox、移动、视觉)
      ↓
MainGameScene.js (伤害结算：handleSkillHit)
```

## 技能数据 (warriorSkills.js)

### 当前技能

| 技能 | 按键 | 类型 | 资源 | 基础消耗 | 基础CD |
|------|------|------|------|----------|--------|
| 野蛮冲锋 | 1 | dash | 体力 | 25 | 5s |
| 旋风斩 | 2 | spin | 体力 | 35 | 8s |
| (预留) | 3 | - | - | - | - |
| (预留) | 4 | - | - | - | - |

### 等级缩放

每级变化：
- 消耗：-3%/级
- 冷却：-5%/级（受 CDR 属性额外减少）
- 冲锋伤害倍率：+15%/级（Lv1=120%, Lv5=180%）
- 旋风斩 tick 倍率：+10%/级（Lv1=60%, Lv5=100%）
- 冲锋眩晕：+100ms/级

### 数据结构

```js
{
  id, name, description, icon,
  resource: 'stamina' | 'rage' | 'none',
  baseCost, baseCooldown,
  maxLevel: 5,
  upgradeCost: 1,        // 每级消耗技能点
  requiredLevel: 1,      // 解锁所需玩家等级
  phases: { startup, active, recovery },  // 毫秒
  effect: { type, ...技能特有参数 }
}
```

### 辅助函数

- `getSkillAtLevel(skillId, level)` — 返回缩放后的完整技能对象
- `getSkillDescription(skillId, level)` — 返回填充数值的描述文本

## SkillEngine

**职责**：冷却管理、资源检查、阶段推进、等级管理

### 生命周期

```
canUse() → execute() → update(delta) 每帧推进
                         ↓
              startup → active → recovery → complete
              (事件)   (事件+tick)  (事件)    (事件)
```

### 关键方法

| 方法 | 作用 |
|------|------|
| `canUse(skillId)` | 检查冷却、资源、是否正在施法 |
| `execute(skillId)` | 扣资源、启冷却、进入 startup 阶段 |
| `update(delta)` | 推进阶段计时，返回事件 `{event, skill}` |
| `getScaledSkill(skillId)` | 获取当前等级的缩放技能数据 |
| `upgradeSkill(skillId, levelSystem)` | 消耗技能点升级 |
| `getActiveSkill()` | 获取当前施法中的技能 |
| `cancelActiveSkill()` | 取消当前技能（被打断时） |
| `toJSON() / fromJSON()` | 序列化/反序列化（保存技能等级） |

### 阶段事件

| 事件 | 时机 | Player 响应 |
|------|------|-------------|
| `phase_active` | startup 结束 | 调用 `startChargeDash()` 或 `startWhirlwind()` |
| `skill_tick` | active 期间每 tickInterval | `whirlwindTick()` 重置 hitbox 允许再次命中 |
| `phase_recovery` | active 结束 | 关闭 hitbox、恢复状态 |
| `skill_complete` | recovery 结束 | 回到 IDLE 状态 |

## 技能实现细节

### 冲锋 (Charge / dash)

- **方向**：读取当前按键输入方向（getInputDirection），支持 8 方向；无输入时沿朝向水平冲
- **阶段**：100ms startup → 300ms active → 200ms recovery
- **效果**：沿方向高速移动，hitbox 跟随，单次命中
- **碰撞**：施法期间通过 processCallback return false 穿过敌人
- **命中**：120%攻击力伤害 + 眩晕 1s + 击退 50px + 屏幕震动

### 旋风斩 (Whirlwind / spin)

- **阶段**：100ms startup → 1200ms active → 300ms recovery
- **效果**：以玩家为中心的 AOE，每 200ms 一次 tick
- **无敌**：从 startup 开始即 `isInvulnerable = true`，recovery 阶段解除
- **移动**：active 阶段可自由移动，移速 +20%
- **视觉**：精灵旋转 tween
- **命中**：每 tick 60%攻击力伤害，敌人 i-frames 缩短到 180ms

## 技能栏 UI (UIScene)

- 底部 4 个槽位，显示图标 + 按键标签 + 等级
- 冷却中显示灰色遮罩 + 倒计时文字
- 未解锁的槽位显示锁定状态

## 技能升级 (PanelScene 天赋树标签页)

- 每个技能显示卡片：图标、名称、等级、描述、数值
- 升级按钮消耗技能点（每 3 级获得 1 点）
- 升级后显示下一级预览

## 添加新技能步骤

1. `warriorSkills.js`：添加技能定义到 `WARRIOR_SKILLS` 对象
2. `warriorSkills.js`：在 `SKILL_SLOTS` 数组中分配槽位（index 2 或 3）
3. `warriorSkills.js`：在 `getSkillAtLevel()` 中添加缩放逻辑
4. `Player.js`：在 `onSkillActive()` 中添加 `startXxx()` 方法
5. `Player.js`：根据需要实现 `onSkillTick()` / `onSkillRecovery()` / `onSkillComplete()`
6. `MainGameScene.js`：在 `handleSkillHit()` 中添加伤害逻辑
