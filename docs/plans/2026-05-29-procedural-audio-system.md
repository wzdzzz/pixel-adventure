# 程序化音频系统 — 设计 + 实施文档

> 日期：2026-05-29 · 分支：`feature/ui-panel-system`
> 作者：Claude（自主开发任务）

## 1. 背景与动机

经过两轮代码审计（gameplay loop + 集成 wiring），结论高度一致：

**游戏目前 100% 静音 —— 完全没有任何音频系统。**

- 战斗、技能、升级、拾取、UI 点击、对话、商店全部无声。
- `ActionRegistry.js:79` 的 `play_sound` 是 stub，仅打印日志。
- 设置面板（`PanelScene.createSettingsTab`）是纯静态文字，无任何可调项（音量/按键）。

这是当前项目**唯一一个完成度为 0 的核心系统**，其余系统（战斗 / 技能 / 装备三阶段 / 怪物缩放 / 大世界流式加载 / NPC 七阶段）都已成熟且集成良好。补齐音频对"游戏手感"的提升收益最大，且一次性关闭审计发现的 3 个最大缺口（无音频、play_sound stub、设置面板无功能）。

### 设计约束（关键）

项目核心哲学是 **"无外部美术资源，全部代码生成像素占位图"**。因此音频也必须遵循同一哲学：

> **不使用任何外部音频文件（.mp3/.ogg/.wav），全部用 Web Audio API 实时合成。**

这与项目"程序化生成"理念一致，也避免引入二进制资源到仓库。Phaser 3.80 内部用 Web Audio，我们直接使用浏览器原生 `AudioContext` 做合成，绕过 Phaser 的"加载音频文件"路径（不需要 preload 资源）。

## 2. 目标

1. 一个可复用的 **AudioEngine**：管理 `AudioContext`、master/music/sfx 三级音量、静音、持久化设置、浏览器自动播放策略（首次手势解锁）。
2. **数据驱动的 SFX 库**（`src/data/sounds.js`）：每个音效是一组合成参数（波形 / 频率 / 包络 / 噪声 / 滑音），与 `src/data/` 纯数据层风格一致。
3. **程序化背景音乐 MusicEngine**：用音阶 + 和弦进行 + 简单合成器 + 鼓点循环生成多套氛围曲（菜单 / 探索 / 战斗 / 城镇 / Boss），切换时交叉淡入淡出。
4. **SoundManager**：将现有游戏事件（`scene.events`）绑定到音效，并管理音乐状态机（进入战斗 / 离开战斗 / 进城 / Boss）。
5. **设置面板音量控制**：Master / Music / SFX 三个滑条 + 静音开关，持久化到 `localStorage`。
6. 接入 `play_sound` action，去除 stub。

## 3. 架构与依赖方向

遵循现有依赖方向 `Data ← Systems ← Entities ← Scenes`：

```
src/data/sounds.js          (纯数据：SFX 参数 + 音乐音阶/进行)
        ↑
src/systems/AudioEngine.js  (Web Audio 合成核心 + 音量 + 持久化)
        ↑                ↑
MusicEngine.js        SoundManager.js   (都依赖 AudioEngine 公共 API)
        ↑                ↑
   Scenes / Player / ActionRegistry / PanelScene  (事件 emit + 设置 UI)
```

- AudioEngine 注册到 `SystemRegistry`，key = `'audio'`，**全局单例**（跨场景存活，不随场景 shutdown 销毁）。
- AudioContext 只创建一次；场景切换不重建。
- SoundManager / MusicEngine 每个游戏会话由场景创建并绑定事件，shutdown 时解绑（但 AudioEngine 本身保留）。

## 4. AudioEngine 公共 API 契约（供 MusicEngine / SoundManager 依赖）

```js
// src/systems/AudioEngine.js — 默认导出单例 audioEngine
class AudioEngine {
  ctx            // AudioContext（懒创建）
  masterGain     // → ctx.destination
  musicGain      // → masterGain
  sfxGain        // → masterGain

  // ── 生命周期 ──
  init()                 // 创建 ctx + gain 图；读 localStorage 设置；幂等
  unlock()               // 首次用户手势调用：ctx.resume()
  get unlocked()         // bool

  // ── 音量 / 设置（0~1） ──
  setMasterVolume(v) / getMasterVolume()
  setMusicVolume(v)  / getMusicVolume()
  setSfxVolume(v)    / getSfxVolume()
  setMuted(bool)     / get muted
  _save() / _load()      // localStorage key: 'pixel_adventure_audio_settings'

  // ── 低层合成原语（MusicEngine / SFX 复用）──
  now()                                  // ctx.currentTime（未解锁返回 0）
  // 播放一个带 ADSR 包络的振荡器音；返回 {osc, gain} 便于扩展
  playTone({ type='sine', freq, freqEnd=null, start=now, dur, attack=0.005,
             decay=0, sustain=1, release=0.05, gain=0.5, dest=sfxGain, detune=0 })
  // 播放一段噪声（白/粉），可选带通滤波，用于打击/爆破/脚步
  playNoise({ dur, start=now, gain=0.5, filterType=null, filterFreq=1000,
              filterQ=1, attack=0.001, release=0.05, dest=sfxGain })

  // ── 高层：按名播放数据驱动 SFX ──
  playSfx(name, opts={})   // 查 SoundLibrary[name]，合成；带节流（throttle）防刷
}
export default new AudioEngine();
```

**节流**：同名 SFX 在 `minInterval`（默认 40ms）内重复触发只播一次，防止"一帧多次受击"爆音。

**音量映射**：用感知（指数）映射 `gain = v*v`，滑条线性而听感自然。

## 5. SFX 库（`src/data/sounds.js`）

每个音效是合成描述。示例：

```js
export const SOUNDS = {
  // 战斗
  player_attack_melee: { kind:'noise', dur:0.12, filterType:'highpass', filterFreq:600, gain:0.35, release:0.1 },
  player_attack_ranged:{ kind:'tone', type:'triangle', freq:880, freqEnd:1320, dur:0.12, gain:0.3 },
  hit_impact:    { kind:'mix', layers:[ {kind:'noise',dur:0.08,filterType:'lowpass',filterFreq:1200,gain:0.4}, {kind:'tone',type:'square',freq:160,freqEnd:80,dur:0.1,gain:0.25} ] },
  crit_impact:   { ... 更亮更重 ... },
  enemy_death:   { kind:'tone', type:'sawtooth', freq:300, freqEnd:60, dur:0.35, gain:0.4, filter... },
  player_hurt:   { kind:'tone', type:'square', freq:220, freqEnd:120, dur:0.18, gain:0.4 },
  player_death:  { ... 长下行 ... },
  skill_cast:    { kind:'tone', type:'sine', freq:440, freqEnd:990, dur:0.25, gain:0.35 },
  // 进度 / 经济
  level_up:      { kind:'arp', notes:[523,659,784,1047], step:0.08, type:'square', gain:0.4 }, // 上行琶音
  xp_gain:       { kind:'tone', type:'sine', freq:1200, dur:0.05, gain:0.15 },
  coin:          { kind:'tone', type:'square', freq:1320, freqEnd:1760, dur:0.08, gain:0.25 },
  loot_pickup:   { kind:'tone', type:'triangle', freq:660, freqEnd:990, dur:0.1, gain:0.3 },
  loot_legendary:{ kind:'arp', notes:[784,988,1175,1568], step:0.07, gain:0.4 },
  chest_open:    { ... },
  // UI
  ui_click:      { kind:'tone', type:'square', freq:660, dur:0.04, gain:0.2 },
  ui_hover:      { kind:'tone', type:'sine', freq:880, dur:0.03, gain:0.1 },
  ui_open:       { kind:'tone', type:'triangle', freq:440, freqEnd:660, dur:0.12, gain:0.25 },
  ui_close:      { kind:'tone', type:'triangle', freq:660, freqEnd:440, dur:0.12, gain:0.25 },
  ui_error:      { kind:'tone', type:'square', freq:200, freqEnd:150, dur:0.15, gain:0.3 },
  // NPC / 系统
  dialogue_blip: { kind:'tone', type:'square', freq:520, dur:0.03, gain:0.12 },
  quest_complete:{ kind:'arp', notes:[659,784,988,1319], step:0.09, gain:0.4 },
  shop_buy:      { = coin 变体 },
  enhance_success/fail, equip, bonfire ...
};
```

`kind` 支持：`tone` / `noise` / `mix`（多层叠加）/ `arp`（琶音序列）。AudioEngine.playSfx 据此分派到原语。

## 6. MusicEngine（`src/systems/MusicEngine.js`）

程序化、零素材的循环音乐。设计为低调氛围（chiptune 风格）：

- **音阶**：每条曲目一个调式（如探索=自然小调、城镇=大调五声、战斗=多利亚、Boss=减音阶/半音紧张）。
- **结构**：固定 BPM + 4 和弦循环进行；每拍用 `audioEngine.playTone` 调度 bass + arpeggio + 偶发旋律音 + 简单 noise 鼓点（kick=低频正弦下扫，hat=短高通噪声）。
- **调度**：用 `setInterval`/Phaser timer 提前调度下一小节（look-ahead scheduler，避免 setInterval 抖动）。所有音连到 `audioEngine.musicGain`。
- **曲库**：`menu` / `explore` / `town` / `combat` / `boss`。
- **切换**：`play(trackName)` 交叉淡出旧曲淡入新曲（~0.8s）。`stop()`。
- 音乐数据（BPM / 和弦 / 调式 / 音色）放 `src/data/sounds.js` 的 `MUSIC` 段。

API：
```js
class MusicEngine {
  constructor(audioEngine)
  play(trackName)   // 幂等：同曲不重启
  stop()
  setEnabled(bool)
  destroy()
}
```

## 7. SoundManager（`src/systems/SoundManager.js`）

绑定 `scene.events` → `audioEngine.playSfx`，并驱动 MusicEngine 状态机。

```js
class SoundManager {
  constructor(scene, audioEngine, musicEngine)
  bind()       // 注册所有事件监听
  unbind()     // shutdown 时解绑
  update(dt)   // 战斗状态超时检测（最后受击/造成伤害 N 秒后退出 combat 音乐）
}
```

### 事件 → 音效映射（基于已审计的事件目录）

| 事件 | 音效 |
|---|---|
| `playerAttack`（新增 emit） | player_attack_melee / _ranged（按职业） |
| `skillCast`（新增 emit） | skill_cast |
| `actorDamaged`（敌人受击） | hit_impact / crit_impact（看 isCrit） |
| `actorDamaged`（玩家受击）/`playerHpChanged` 下降 | player_hurt |
| `enemyDeath` / `npcDeath` | enemy_death |
| `playerDeath` | player_death |
| `levelUp` | level_up |
| `xpChanged`（增加） | xp_gain（轻、节流） |
| `goldChanged`（增加） | coin |
| `enemyDropLoot` / `spawnItem` | （掉落落地音，轻） |
| `itemSlotsChanged` / 拾取 | loot_pickup；传奇+ → loot_legendary |
| `useItem` | （喝药音） |
| `equipmentChanged` | equip |
| `questActivated` | ui_open 变体 |
| `questCompleted` | quest_complete |
| `dialogueNodeEntered` | dialogue_blip（逐节点） |
| `shopBought`/`shopSold` | shop_buy/coin |
| `shopOpened`/`trainerOpened` | ui_open |
| `enhance`/reforge 成功失败 | enhance_success/fail（看 showMessage 或新增事件） |
| `bonfireRest` | bonfire |
| `switchPanelTab` / `panel:open` | ui_click |
| `showMessage` | （可选，按颜色区分 error） |

### 音乐状态机
- 进入战斗：检测到敌人 `actorDamaged`/玩家受击 → `music.play('combat')`，记录 `lastCombatTime`。
- 脱战：`update` 中超过 6s 无战斗 → 回到 `explore`（或 `town`，若在城镇 chunk）。
- Boss：`enemyDeath` 的 isBoss、或接近 Boss 时 → `boss`（简化：Boss 存活且在屏 → boss 曲；MVP 可先用 combat 曲覆盖，Boss 单独留 TODO）。
- 进城镇 chunk（chunk 8,8 / town POI）→ `town`。

## 8. 集成点（需修改的现有文件）

| 文件 | 改动 |
|---|---|
| `src/main.js` | import 并 `audioEngine.init()`；绑定一次性 `pointerdown/keydown` → `audioEngine.unlock()`。 |
| `src/systems/SystemRegistry.js` | 无需改（用现有 register/get）。 |
| `src/scenes/MainGameScene.js` | create 时实例化 MusicEngine + SoundManager 并 `bind()`；shutdown `unbind()`；首次进入播 explore/town 音乐。 |
| `src/scenes/MainMenuScene.js` | 菜单音乐 + 按钮 ui_click/hover；首次手势 unlock。 |
| `src/entities/Player.js` | `tryAttack()` 末尾 `emit('playerAttack', this.classType)`；`trySkill`/execute 成功后 `emit('skillCast', skillId)`。 |
| `src/systems/ActionRegistry.js` | `play_sound` 改为真实调用 `audioEngine.playSfx(args.sound)`。 |
| `src/scenes/PanelScene.js` | `createSettingsTab` 增加 Master/Music/SFX 滑条 + 静音 checkbox + ui 反馈，读写 audioEngine。 |
| `src/entities/Actor.js` | `actorDamaged` 事件已带 `{ amount, isCrit, source }`？需确认 payload，必要时补 `isCrit`。 |

> 注意：跨场景编辑文件较多，集成阶段由**单一执行者顺序完成**，避免并发改同一文件冲突。新文件（AudioEngine/MusicEngine/SoundManager/sounds.js）可并行创建。

## 9. 设置持久化

- localStorage key：`pixel_adventure_audio_settings` = `{ master, music, sfx, muted }`。
- 与存档槽（`pixel_adventure_save_*`）独立——音量是全局偏好，不随存档。
- AudioEngine.init 时读取；任何 setter 即时 `_save()`。

## 10. 浏览器自动播放策略

Chrome/Firefox 要求 AudioContext 在用户手势后才能出声。方案：
- `audioEngine.init()` 创建 ctx（可能处于 `suspended`）。
- main.js 注册一次性 `pointerdown` + `keydown` 监听 → `audioEngine.unlock()` → `ctx.resume()`，然后移除监听。
- MainMenuScene 的"开始游戏"点击天然就是首次手势，菜单音乐随即响起。

## 11. 验收标准（最后检测）

1. `pnpm build` 通过，无新增报错/警告（除既有 chunk size 警告）。
2. 运行时无 console 错误（AudioContext 未解锁前调用安全降级）。
3. 主菜单点击有音乐 + 按钮音。
4. 进游戏后：攻击 / 受击 / 击杀 / 升级 / 拾金币 / 开面板 各有音。
5. 战斗中音乐切到 combat，脱战恢复。
6. 设置面板三滑条 + 静音实时生效；刷新页面后保持（localStorage）。
7. 静音 / master=0 时完全无声且不报错。
8. 未解锁音频（未交互）时不抛异常。

## 12. 实施阶段（subagent 分工）

- **Phase 1（基础，串行先行）**：`src/data/sounds.js` + `src/systems/AudioEngine.js`。
- **Phase 2（并行，依赖 Phase 1 API）**：`MusicEngine.js`、`SoundManager.js`。
- **Phase 3（集成，单执行者顺序）**：main.js / MainGameScene / MainMenuScene / Player / ActionRegistry / PanelScene 接线 + 新增事件 emit。
- **Phase 4（检测）**：build + 运行时 smoke test + 修复 + 更新文档（CLAUDE.md 架构要点、docs/modules 新增 audio 模块文档）。

## 13. 非目标（本次不做）

- 不引入外部音频文件 / Phaser audio loader。
- 不做按键自定义重映射（设置面板仍保留操作说明，仅增加音量区）。
- 不做空间化（3D positional audio）—— 全部 2D，按事件距离可选做音量衰减（留 TODO）。
- Boss 专属音乐可先用 combat 覆盖，标 TODO。
