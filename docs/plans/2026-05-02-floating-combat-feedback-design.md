# 战斗反馈视觉设计 — 头顶血条 + 飘字伤害

> 创建日期：2026-05-02
> 分支：`feature/ui-panel-system`

## 目标

为战斗交互补充实时视觉反馈：
1. 所有敌人头顶常驻血条
2. 受伤/治疗时在世界中飘出数字（敌人受伤、玩家受伤、玩家主动治疗）

## 设计决策

### 头顶血条
- **可见性**：始终显示（敌人活着即显示）
- **样式**：背景条（深灰）+ 前景条（HP 颜色按 HUD 规则：>60% 绿、>30% 黄、其余红）
- **尺寸**：宽度 = `sprite.displayWidth * 0.8`，高度 3px
- **位置**：精灵显示矩形顶部上方 6px
- **生命周期**：随 Enemy 实例创建/更新/销毁

### 飘字伤害数字
- **范围**：敌人受伤 + 玩家受伤 + 玩家主动治疗
- **被动 HP regen 不飘字**（每秒 1-2 点会刷屏，HUD 已能反馈）
- **样式**：
  | 类型 | 颜色 | 字号 | 加粗 | 前缀 |
  |------|------|------|------|------|
  | 敌人受伤 | `#ffeb3b` | 12px | 否 | 无 |
  | 玩家受伤 | `#ff4444` | 13px | 是 | 无 |
  | 治疗 | `#66ff66` | 12px | 否 | `+` |
- **动画**：向上浮动 30px + 淡出，700ms，水平随机抖动 ±8px
- **对象池**：复用 Phaser Text，避免 GC 抖动

## 架构

### 新模块
**`src/systems/FloatingTextManager.js`**
- 由 MainGameScene 持有
- 导出 API：`spawn(x, y, text, { color, fontSize, bold, prefix })`
- 内部维护对象池

### 修改点
| 文件 | 改动 |
|------|------|
| `src/entities/Actor.js` | `takeDamage()` 计算后 emit `actorDamaged(actor, finalDamage)`；`heal()` emit `actorHealed(actor, amount)` |
| `src/entities/Enemy.js` | 构造时创建血条对象；`update()` 同步位置/宽度；`die()` 销毁血条 |
| `src/scenes/MainGameScene.js` | `create()` 实例化 FloatingTextManager；监听 `actorDamaged` / `actorHealed` 调用 `manager.spawn()` |

### 事件流

```
Player 攻击命中 Enemy
  → handleAttackHit → enemy.takeDamage(dmg, x, y)
    → Actor.takeDamage 应用防御 → emit 'actorDamaged'
      → MainGameScene 监听器 → FloatingTextManager.spawn() (黄字)

Enemy 攻击命中 Player
  → emit 'enemyAttack' → player.takeDamage(dmg)
    → Actor.takeDamage → emit 'actorDamaged'
      → MainGameScene 监听器 → FloatingTextManager.spawn() (红字加粗)

Player 使用药水
  → player.heal(amount)
    → Actor.heal → emit 'actorHealed'
      → MainGameScene 监听器 → FloatingTextManager.spawn() (绿字 +N)
```

## 性能考量

- 血条用 `Phaser.GameObjects.Rectangle` 两个组合，不是 Graphics（避免每帧重绘）
- 飘字对象池容量 16，超出回收最老
- 血条更新仅在 Enemy.update() 中触发，已绑定每帧
- 死亡敌人立即销毁血条，无内存泄漏

## 不在范围

- 不实现暴击数字高亮（伤害管线无 crit roll）
- 不实现"差值伤害"（第二条 ghost 血条）— 敌人 HP 变化频率低，无必要
- 不实现伤害类型分色（物理/魔法等）— 当前无伤害类型
- 不为 Breakable（可破坏物）加血条 — 一击碎，无意义
