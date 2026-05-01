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

## 架构要点
- **依赖方向**：Data ← Systems ← Entities ← Scenes（无循环）
- **事件驱动**：系统间通过 Phaser 事件解耦（见 docs/architecture.md）
- **纯数据层**：`src/data/` 下的文件无逻辑依赖
- **Stats 引擎**：base → bonus(%) → flatBonus(固定值) → derived，带缓存失效

## 关键约定
- 中文注释和 UI 文本
- commit message 用中文描述
- 所有实体继承 Actor 基类（HP、体力、怒气、I-Frames）
- 技能通过 SkillEngine 管理（冷却、资源、阶段），Player 负责具体表现
- 装备属性通过 LootEngine.getScaledStats() 缩放

## 文档
- 总览：`docs/architecture.md`
- 模块文档：`docs/modules/*.md`
- 开发计划：`docs/plans/`

## 常见陷阱
- Phaser `setSize()` 只改视觉大小，物理体需要 `body.setSize()` 同步
- `body.pushable` 在 processCallback 中设置会永久生效，需每帧重置
- Vite 缓存可能导致 export 不更新，用 `npx vite --force` 或清除 `node_modules/.vite`
- I-Frames 计时器到期会清除 isInvulnerable，技能无敌需要额外保护（检查 `_whirlwindSuperArmor`）
