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
- **装备系统**（已完成 Phase 1+2+3）：
  - 实例化 instance（每件唯一） + 6 品质（含 mythic）+ 词条池 + 强化（+0~+15）
  - 洗练（chaos_essence + 锁定 1-2 条）+ 神圣洗练（divine_heart，T1 ×3 + 5 次保底）
  - 孔位 + 4 色 × 10 级宝石（3 同合 1 高级）+ 触发型词条（onHit/onKill/onSkillCast/onCrit）
  - 装备制作（recipes.js）+ 4 套装系统（2/4/6 件触发）+ 神器配方（mythic, world_core）
- **NPC 系统**（已完成 Phase 1~7，见 `docs/modules/npc-system.md`）：
  - 数据驱动 `data/npcs.js` + `dialogues/*` + `shops.js` + `trainers.js`
  - NPCMemoryStore（每 NPC stage/flag/var/dead）+ FactionSystem（5 级关系 + reputation -100~+100）
  - DialogueEngine（节点树）+ ActionRegistry（21+ action）+ NpcTransitions（事件驱动 stage 切换）
  - ShopService/Panel（折扣 + 篝火刷新）+ TrainerService/Panel（教技能 + 重置天赋）
  - CombatAI（通用战斗状态机）+ CombatNPC + CompanionManager **队伍系统 v2**（见 `docs/plans/2026-05-29-companion-system-v2-design.md`）：
    - 名册无上限 roster + 单一出战 active；待命=隐藏禁用常驻实例，出战=劫持 AI+followMode 跟随
    - recruit/deploy/bench/dismiss/setStance（follow/hold/aggressive/defensive）；篝火 reviveAll
    - 队伍 UI（PanelScene 'party' tab，T 键）；存档 companions{roster,activeId} 兼容老档
    - 友方 faction='ally' 不受/不造成玩家伤害；出战伙伴对话可下达姿态指令
- **音频系统**（程序化合成，无外部音频文件，见 `docs/modules/audio.md`）：
  - Web Audio 实时合成；`AudioEngine`（全局单例 + 三级音量 + localStorage 持久化 + 解锁）
  - 数据驱动 `data/sounds.js`（SFX 参数 + 音乐曲库）；`MusicEngine`（前瞻调度循环乐 + 交叉淡变）
  - `SoundManager`（事件→SFX + 战斗/环境音乐状态机）；设置面板音量滑条 + 静音

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
- 音频：AudioContext 初始 `suspended`，须首次用户手势后 `resume()`（main.js 已处理）；未解锁时 `playSfx` 安全 no-op
- 音频：高频事件 SFX 依赖 `SOUNDS[name].minInterval` 节流防爆音；音量滑条线性但 gain 取平方（感知曲线）
- **场景事件监听器泄漏**：MainGameScene 是复用单例，Phaser 不会在 shutdown 自动清除 `scene.events.on(...)` 注册的用户监听器。任何在 MainGameScene 上挂监听的对象（面板/系统）必须在 `scene.events.once('shutdown', ...)` 里 `off` 解绑，否则返回主菜单/加载存档后会累积陈旧监听器，在已销毁的 UIScene 显示对象上操作导致 `drawImage` 崩溃（DialoguePanel/ShopPanel/TrainerPanel/SoundManager 已遵循此模式）
