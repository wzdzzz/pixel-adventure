# 音频系统（程序化合成）

> 设计/实施文档：`docs/plans/2026-05-29-procedural-audio-system.md`

## 概述

全部音频用 **Web Audio API 实时合成**，**不依赖任何外部音频文件**（.mp3/.ogg/.wav），
与项目"代码生成像素占位图"的理念一致。包含音效（SFX）与程序化背景音乐两部分，
通过现有 `scene.events` 事件系统驱动，与游戏逻辑解耦。

## 模块构成

| 文件 | 职责 |
|---|---|
| `src/data/sounds.js` | 纯数据层：`SOUNDS`（SFX 合成参数）+ `MUSIC`（曲库：BPM/音阶/和弦进行/音色） |
| `src/systems/AudioEngine.js` | 全局单例。AudioContext + master/music/sfx 三级 gain；音量持久化；合成原语 `playTone`/`playNoise`；`playSfx(name)` |
| `src/systems/MusicEngine.js` | 程序化循环音乐：前瞻调度器 + 交叉淡变；曲库 menu/explore/town/combat/boss |
| `src/systems/SoundManager.js` | 事件 → SFX 绑定 + 音乐状态机（战斗 ↔ 环境） |

依赖方向：`sounds.js(data) ← AudioEngine ← {MusicEngine, SoundManager} ← Scenes`。

## AudioEngine

- **单例**：`import audioEngine from './systems/AudioEngine.js'`，跨场景存活。
- **生命周期**：`main.js` 调 `audioEngine.init()`（建 ctx + gain 图，读 localStorage），
  并在首次 `pointerdown/keydown/touchstart` 调 `unlock()`（`ctx.resume()`，绕过浏览器自动播放策略）。
- **三级音量**（0~1，感知曲线 `gain=v²`）：`setMaster/Music/SfxVolume`、`setMuted/toggleMuted`，
  即时持久化到 localStorage（key `pixel_adventure_audio_settings`，**独立于存档槽**）。
- **合成原语**：
  - `playTone({type,freq,freqEnd,dur,attack,decay,sustain,release,gain,detune,dest})` — ADSR 振荡器音。
  - `playNoise({dur,gain,filterType,filterFreq,filterQ,attack,release,dest})` — 噪声（打击/爆破/火）。
- **`playSfx(name, {volume,when})`**：解释 `SOUNDS[name]`（kind: `tone`/`noise`/`mix`/`arp`），
  带同名节流（默认 40ms，防一帧多次受击爆音）。未解锁时安全 no-op。

## SFX 数据格式（`SOUNDS`）

```js
key: {
  kind: 'tone'|'noise'|'mix'|'arp',
  // tone:  type, freq, freqEnd?, dur, gain, attack?, decay?, sustain?, release?
  // noise: dur, gain, filterType?, filterFreq?, filterQ?, attack?, release?
  // mix:   layers: [ <tone/noise 描述>, ... ]
  // arp:   notes:[freq...], step, type, gain, dur
  minInterval?: 40,   // 同名节流(ms)
  volume?: 1,         // 整体缩放
}
```

涵盖：战斗（攻击/受击/暴击/死亡/技能）、进度经济（升级/经验/金币/拾取/传奇）、
物品装备（喝药/装备/强化成功失败）、UI（点击/悬停/开关/错误）、NPC（对话/任务/商店/篝火）。

## MusicEngine

- **前瞻调度器**：`setInterval`（100ms）+ 200ms 窗口，用 `audioEngine.now()` 做采样级精确排程，规避抖动。
- **每条曲目**一个子 `GainNode` → `audioEngine.musicGain`，切换时该 gain 斜坡做 0.8s 交叉淡变。
- **声部**：贝斯（和弦根音低八度，整拍）+ 琶音（8 分音符循环和弦音）+ 鼓（kick 120→40Hz 正弦下扫 + 低通噪声，hat 高通噪声反拍）。
- **曲库**：`menu`（菜单）/ `explore`（野外）/ `town`（城镇）/ `combat`（战斗）/ `boss`（留作扩展）。
- 未解锁时缓存请求曲目，解锁后由 tick 懒启动。

## SoundManager（事件桥接 + 音乐状态机）

- `bind()`：注册 ~26 个 `scene.events` 监听器（每个 handler try/catch 包裹，坏 payload 不抛进发射器）。
- `unbind()`/`destroy()`：场景 `shutdown` 时精确移除监听、停止音乐。
- **音乐状态机**：任意 `actorDamaged` 进战斗曲；`update()` 中 6s 无战斗事件回落到环境曲。
  场景按玩家位置调 `setAmbient('town'|'explore')`。

### 关键事件映射（节选）

`playerAttack`(职业)→近战/远程攻击音；`skillCast`→技能音；`actorDamaged`→玩家受击/命中音 + 进战斗；
`enemyDeath`(isBoss)→普通/Boss 死亡音；`levelUp`/`xpChanged`/`goldChanged`/`itemSlotsChanged`/`equipmentChanged`；
`questActivated`/`questCompleted`/`dialogueNodeEntered`/`shopBought`/`bonfireRest`/`switchPanelTab`；
`playSound`(name)→通用钩子（由 ActionRegistry 的 `play_sound` 对话 action 发射）。

## 集成点

- `main.js`：`init()` + 首次手势 `unlock()`。
- `MainGameScene`：create 时建 `MusicEngine`+`SoundManager` 并 `bind()`；`update` 调 `soundManager.update` + 按
  玩家到城镇中心 (8704,8704) 距离切 town/explore；`shutdown` 销毁。
- `MainMenuScene`：菜单背景乐 + 按钮 hover/click 音。
- `Player.js`：`tryAttack` emit `playerAttack`，`onSkillActive` emit `skillCast`。
- `ActionRegistry.js`：`play_sound:名称` → emit `playSound`。
- `PanelScene.js`：设置页加主/音乐/音效音量滑条 + 静音勾选 + 面板开关音。

## 设置面板

设置标签右栏：主音量 / 音乐 / 音效 三个可拖动滑条 + 静音勾选框，实时生效并自动保存（localStorage）。

## 验证

`scripts/audio-smoke-test.mjs`（Playwright）：插桩 AudioContext，加载游戏 → 解锁 → 进游戏 → 触发交互，
断言 ctx running、振荡器/噪声源 > 0、无 console/page error。

## 常见陷阱

- **自动播放策略**：AudioContext 初始 `suspended`，必须在用户手势后 `resume()`，否则无声但不报错。
- **节流**：高频事件（受击/经验）依赖 `minInterval` 防爆音；新增高频 SFX 记得设。
- **音量映射**：滑条线性 0~1，实际 gain 取平方（感知曲线）。
- **跨场景**：AudioEngine 是单例不随场景销毁；MusicEngine/SoundManager 每会话创建并在 shutdown 销毁。
- **headless 渲染**：冒烟测试需软件 GL 标志（`--use-angle=swiftshader --enable-unsafe-swiftshader`），否则 Phaser WebGL 启动失败（与音频无关）。
