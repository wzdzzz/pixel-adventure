# CLAUDE.md — 像素远征项目上下文

## 项目概述
Phaser 3 像素风动作冒险 RPG，使用 Vite + vanilla JS ES Modules。
代码生成像素占位图（无外部美术资源）。

## 开发命令
```bash
pnpm dev          # 启动开发服务器 (localhost:3000)
pnpm build        # 生产构建
npx vite --force  # 清除 Vite 缓存启动
```

## 画布与显示
- 固定 1920×1080，`Phaser.Scale.NONE`，浏览器窗口居中
- `F` 键切换浏览器真·全屏

## 架构要点
- **依赖方向**：Data ← Systems ← Entities ← Scenes（无循环）
- **事件驱动**：系统间通过 Phaser 事件解耦（见 docs/architecture.md）
- **纯数据层**：`src/data/` 下的文件无逻辑依赖
- **Stats 引擎**：base → bonus(%) → flatBonus(固定值) → derived，带缓存失效
- **3 职业**：warrior / archer / mage，各自一份 `*Skills.js` + `classConfig.primaryAttackStat`
- **敌人技能驱动**：4 种技能 type（melee_strike / ranged_shot / charge_attack / aoe_burst）+ 战斗状态机（PATROL ↔ CHASE → SKILL_TELEGRAPH → SKILL_ACTIVE → SKILL_RECOVERY）
- **多槽存档**：3 槽位（key 形如 `pixel_adventure_save_1`），支持元数据预览

## 关键约定
- 中文注释和 UI 文本
- commit message 用中文描述
- 所有实体继承 Actor 基类（HP、体力、怒气、I-Frames、StatusEffectSystem）
- 玩家技能通过 SkillEngine（冷却/资源/阶段），Player 处理具体表现
- 敌人技能通过 EnemySkillSystem，Enemy 状态机驱动
- 装备属性通过 LootEngine.getScaledStats() 缩放
- 接触不造成伤害，敌人通过技能 hitbox/弹道造伤
- 普攻无僵直，仅 `effect.stagger` 显式声明的技能造僵直
- 默认无击退，仅 `effect.dedicatedKnockback: true` 的技能击退

## 文档
- 总览：`docs/architecture.md`
- 模块文档：`docs/modules/*.md`（实体、技能、敌人 AI、属性战斗、背包装备、成长、场景 UI、存档、战斗反馈、数据格式）
- 开发计划：`docs/plans/`

## 常见陷阱
- Phaser `setSize()` 只改视觉大小，物理体需要 `body.setSize()` 同步
- `body.pushable` 在 processCallback 中设置会永久生效，需每帧重置
- Vite 缓存可能导致 export 不更新，用 `npx vite --force` 或清除 `node_modules/.vite`
- I-Frames 计时器到期会清除 isInvulnerable，技能无敌需要额外保护（检查 `_whirlwindSuperArmor`）
- 技能 `trySkill()` 先 `setVelocity(0,0)`，读方向应用 `getAimDirection()`（鼠标）而非按键输入
- 加载存档时必须先用 `getSaveInfo` 决定 classType/currentLevel，再 `createPlayer`，否则技能/装备会与职业不匹配
