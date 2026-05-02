# 战斗反馈视觉

> 文件：`src/systems/FloatingTextManager.js`、`src/entities/Enemy.js`（头顶血条）、`src/scenes/UIScene.js`（buff 栏）、`src/ui/Tooltip.js`、`src/entities/Player.js`（蓄力进度条、AOE 视觉、扇形指示）

## FloatingTextManager（飘字伤害/治疗）

### API
```js
manager.spawn(x, y, text, options)
// options: { color, fontSize, bold, prefix }
```

- 对象池（默认 16 个 Text）复用 → 无 GC 抖动
- 700ms 浮动 + 淡出 + 100ms 缩放小弹跳
- 水平 ±8px 随机抖动避免重叠
- depth 1000

### 颜色规则（`MainGameScene.setupEvents`）

| 事件 | 颜色 | 用例 |
|------|------|------|
| `actorDamaged` (敌人受伤) | `#ffeb3b` 黄 | 玩家攻击命中 |
| `actorDamaged` (玩家受伤) | `#ff4444` 红加粗 | 敌人技能命中 |
| `actorHealed` | `#66ff66` 绿，前缀 `+` | 主动治疗（药水/技能）|
| 宝箱奖励 | `#ffdd44` 黄加粗 | `+50 分` |
| 宝箱治疗 | `#66ff66` 绿 | `+25 HP` |

被动 HP regen **不**飘字（避免每秒刷屏）。

### 触发链
- `Actor.takeDamage` 末尾 emit `actorDamaged`
- `Actor.takeTickDamage` (DoT) emit `actorDamaged`
- `Actor.heal` 实际增血时 emit `actorHealed`
- `MainGameScene` 监听并调 `floatingText.spawn`

## 敌人头顶血条（`Enemy.createHealthBar`）

每个 Enemy 自带：
- 背景条（深灰 `0x222222`）+ 前景条（按比例）
- 宽度 = `sprite.displayWidth × 0.8`，高度 3px
- 位置：精灵顶部上方 6px
- 颜色：>60% 绿、>30% 黄、其他红
- `update()` 每帧跟随
- `destroyHealthBar()` 在 die() 调用

## 玩家蓄力进度条（`_showChargeBar/_updateChargeBar`）

蓄力技能（`effect.chargeable: true`）期间：
- 玩家头顶 36×4 像素条
- 颜色按 `t = chargeTime/maxTime` 渐变：
  - t < 0.4：黄 `0xffdd44`
  - t < 0.8：橙 `0xff8833`
  - 否则：红 `0xff3333`
- 移动/受击 → `_cancelCharge` 销毁条
- 释放后销毁条

## Buff 栏（`UIScene.createBuffBar`）

技能栏正上方一条横排：
- 28×28 槽位，最多 8 个
- 内容：emoji 图标 + 倒计时数字 + 多层 `xN`
- 边框颜色：
  - buff → 绿 `0x66ff88`
  - debuff/dot → 红 `0xff6666`
  - 其他 → 黄
- 数据源：`player.statusEffects.getActiveSummary()`（每帧刷新）
- 每个槽位挂 Tooltip（500ms hover 显示完整描述）

`StatusEffectSystem.apply(effectId, config)` 配置可包含：
- `icon`、`name`、`description` — UI 用
- `modifiers` / `flatMods` — 属性修饰
- `tickInterval`、`onTick` — DoT 用
- `maxStacks`、`refreshable`

## AOE 视觉（远程 spin 技能）

`startWhirlwind` 远程职业分支：
- AOE 锚定鼠标位置（最大 200px 距离，超出 clamp 到圆周）
- **双层脉冲圆**：
  - 外圈：`effect.radius` 描边圆，膨胀 1.12× + 渐淡，320ms yoyo
  - 内圈：`effect.radius × 0.55` 实心圆，反向收缩 0.75× + 变亮，220ms yoyo
- 颜色按技能：`getSkillProjectileColor(skill)`
  - 火 → 橙红、冰 → 蓝、奥术 → 紫、箭 → 绿
- `_cleanupSkillVisuals` 销毁所有视觉 + 停止 tween

## 扇形指示（multiShot）

`startConeSkill`：
- 半透明三角扇形 fill + 描边
- 16 段 arc 连接顶点 → 弧两端
- 350ms alpha 渐淡到 0 自销
- 同时 spawn N 发视觉弹道按角度散开

## Charge Dash 残影（mage 闪现）

`spawnGhostAfterimage`：
- 在当前位置克隆一个 sprite 作为残影
- 渐淡消失（300ms）
- 再加 `sprite.setAlpha(0.4)` 期间表示传送中

## 命中视觉

### 受伤闪烁（`Actor.flashDamage`）
- 受击瞬间 sprite tint 红 `0xff0000`
- 70ms × 5 次交替 tint/clear
- 420ms 后强制清除 tint

### Hit Stop（`MainGameScene.startHitStop`）
- 命中关键技能时 `physics.pause()` 短暂停帧（50ms）
- 增强打击感

### 屏幕震动（`screenShake` 事件）
- `intensity` × `duration` 参数
- camera.scrollX/Y 随机抖动

## NPC 对话窗口（UIManager）

- depth 9990（避免被 setDepth(y) 的装饰物覆盖）
- 打字机效果（逐字 30ms）
- 多页 + E 键翻页 + 自动换行
- 显示 NPC 名字 + 头像（如有）

## 交互提示（`Player.updateInteractHint`）

- 文字 `按 E 交互`
- 跟随**玩家头顶**（`sprite.y - displayHeight/2 - 14`）
- 走开 → 自动隐藏

## Tooltip（500ms hover）

通用工具，挂到任意 interactive 对象。
- 输入：`getContent()` 函数返回 `{ title, body }` 或 null
- pointerover → 启动 500ms 计时器
- pointerout / pointerdown → 取消并隐藏
- 标题黄、正文白；边框紫
- 自动 clamp 到屏幕内

集成点：
- HUD 技能栏 4 槽位（动态读 skill data）
- HUD buff 栏 8 槽位（动态读 statusEffects）
- 技能面板每张技能卡的图标
