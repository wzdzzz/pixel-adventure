# Boss 战斗体验系统 设计

> 日期：2026-05-29 · 分支：`feature/ui-panel-system`

## 背景

Boss（skeleton_king）此前只是"放大的普通怪"：有 isBoss 标记、视觉缩放/tint、抗 stagger、保底掉落、永久击杀 flag、Boss 区域 POI，但**无专属战斗体验**——没有大血条、没有阶段/狂暴、没有登场/击败的仪式感。"讨伐骷髅王"主线任务因此缺乏"最终战"分量。

## 目标

让 Boss 战有辨识度与张力，串联 战斗 / UI / 音频 / 任务：

1. **Boss 血条 HUD**：屏幕顶部居中的大血条 + Boss 名 + 狂暴阶段标识，登场显示、脱战/击败隐藏。
2. **阶段 / 狂暴**：血量跌破阈值（66% / 33%）进入下一阶段，攻击与移速提升 + 红闪 + 震屏 + "进入狂暴"提示。
3. **登场 / 击败仪式**：`bossEngaged` 触发血条 + Boss 音乐；`bossDefeated` 触发"已被击败"横幅 + 回环境曲。
4. **Boss 音乐**：复用 MusicEngine 的 `boss` 曲，优先级高于普通战斗曲。

## 实现

### 数据 / 事件
- 敌人中文名复用 `data/quests.js` 的 `ENEMY_NAMES`（`Enemy.displayName`）。
- 新事件（`scene.events`）：`bossEngaged(boss)` / `bossPhase(boss, phase)` / `bossDefeated(boss)` / `bossDisengaged(boss)`。

### Enemy（`src/entities/Enemy.js`）
- 构造：`displayName`、`_bossPhase=0`、`_enrageMult=1`。
- `getAttack()` / `getMoveSpeed()` 覆盖：乘 `_enrageMult`（移速封顶 1.5×）。
- `_enterCombat`：isBoss → emit `bossEngaged`。
- `_exitCombat`：isBoss → 重置阶段 + emit `bossDisengaged`（脱战满血同时复位狂暴）。
- `takeDamage` 后：isBoss 且存活 → `_checkBossPhase()`。
- `_checkBossPhase`：按 `BOSS_PHASE_THRESHOLDS=[0.66,0.33]` 计算目标阶段，跨阶段则 `_enrageMult = 1 + phase*0.3` + 红闪/震屏/提示 + emit `bossPhase`。
- `die`：isBoss → 先 emit `bossDefeated`。

### UIScene（`src/scenes/UIScene.js`）
- `createBossBar()`：顶部居中容器（frame + bg + fill + name + phase），默认隐藏；监听 4 个 boss 事件；shutdown 解绑。
- `update()`（新增）：每帧按 `_bossRef.hp/maxHp` 刷新血条；boss 死亡/销毁则隐藏。
- `_showBossDefeatBanner`：居中金色"X 已被击败！"淡出横幅。

### SoundManager（`src/systems/SoundManager.js`）
- `bossEngaged` → `_inBoss=true` + 播 `boss` 曲（普通 `actorDamaged` 不再覆盖）。
- `bossDefeated`/`bossDisengaged` → `_inBoss=false` + 回环境曲。
- `update` 中 `_inBoss` 时跳过战斗超时（boss 曲持续到结束事件）。

## 验收（scripts/boss-test.mjs）

生成真实 skeleton_king → takeDamage 登场（事件 + 血条 + 名字 + boss 音乐）→ HP 50% 阶段1（enrage 1.3× + 攻击提升）→ HP 20% 阶段2（1.6×）→ die 击败（横幅 + 血条隐藏 + 退出 boss 音乐）。全通过、0 报错；伙伴/任务/音频回归绿。

## 非目标（后续）

- Boss 专属技能/弹幕编排（当前复用 enemySkills）。
- 多 Boss 差异化机制、阶段切换召唤小怪。
- Boss 锁门/限时等 arena 规则。
