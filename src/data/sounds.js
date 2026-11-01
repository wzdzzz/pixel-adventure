/**
 * sounds.js — 程序化音频数据层（纯数据，无逻辑）
 *
 * 全部音效用 Web Audio 实时合成，不依赖任何外部音频文件，
 * 与项目"代码生成像素占位图"的理念一致。
 *
 * ── SFX 描述格式 ──
 * 每个音效是一个描述对象，由 AudioEngine.playSfx() 解释：
 *   kind:'tone'  振荡器单音
 *     type      'sine'|'square'|'sawtooth'|'triangle'
 *     freq      起始频率 (Hz)
 *     freqEnd   终止频率（做滑音，可选）
 *     dur       时长 (s)
 *     gain      音量峰值 (0~1)
 *     attack/decay/sustain/release  ADSR（可选，单位 s / 比例）
 *     detune    音分偏移（可选）
 *   kind:'noise' 噪声（打击 / 爆破 / 脚步）
 *     dur, gain, attack, release
 *     filterType 'lowpass'|'highpass'|'bandpass'（可选）
 *     filterFreq, filterQ
 *   kind:'mix'   多层叠加：layers:[ <tone/noise 描述>, ... ]
 *   kind:'arp'   琶音序列：notes:[freq...], step:每音间隔(s), type, gain, dur(每音时长)
 *
 * 顶层可选字段：
 *   minInterval  同名音效节流间隔(ms)，默认 40
 *   volume       该音效整体缩放（叠加在 gain 之上），默认 1
 */

export const SOUNDS = {
  // ───────── 战斗 ─────────
  player_attack_melee: {
    kind: 'mix', minInterval: 60,
    layers: [
      { kind: 'noise', dur: 0.11, filterType: 'highpass', filterFreq: 700, filterQ: 0.7, gain: 0.32, attack: 0.002, release: 0.09 },
      { kind: 'tone', type: 'triangle', freq: 520, freqEnd: 300, dur: 0.09, gain: 0.18, attack: 0.002, release: 0.06 },
    ],
  },
  // 飞剑出鞘：破风噪声 + 金属清鸣
  player_attack_ranged: {
    kind: 'mix', minInterval: 60,
    layers: [
      { kind: 'noise', dur: 0.12, filterType: 'highpass', filterFreq: 1800, filterQ: 0.8, gain: 0.2, attack: 0.002, release: 0.09 },
      { kind: 'tone', type: 'sine', freq: 1400, freqEnd: 2200, dur: 0.1, gain: 0.15, attack: 0.002, release: 0.07 },
      { kind: 'tone', type: 'triangle', freq: 950, freqEnd: 1500, dur: 0.12, gain: 0.13, attack: 0.002, release: 0.08 },
    ],
  },

  hit_impact: {
    kind: 'mix', minInterval: 45,
    layers: [
      { kind: 'noise', dur: 0.07, filterType: 'lowpass', filterFreq: 1400, gain: 0.34, attack: 0.001, release: 0.06 },
      { kind: 'tone', type: 'square', freq: 180, freqEnd: 70, dur: 0.1, gain: 0.22, attack: 0.001, release: 0.08 },
    ],
  },
  crit_impact: {
    kind: 'mix', minInterval: 45,
    layers: [
      { kind: 'noise', dur: 0.1, filterType: 'lowpass', filterFreq: 2200, gain: 0.42, attack: 0.001, release: 0.09 },
      { kind: 'tone', type: 'square', freq: 240, freqEnd: 90, dur: 0.14, gain: 0.3, attack: 0.001, release: 0.11 },
      { kind: 'tone', type: 'sawtooth', freq: 1200, freqEnd: 600, dur: 0.08, gain: 0.14, attack: 0.001, release: 0.06 },
    ],
  },

  enemy_death: {
    kind: 'mix', minInterval: 50,
    layers: [
      { kind: 'tone', type: 'sawtooth', freq: 320, freqEnd: 55, dur: 0.34, gain: 0.32, attack: 0.003, release: 0.18 },
      { kind: 'noise', dur: 0.2, filterType: 'lowpass', filterFreq: 900, gain: 0.22, attack: 0.003, release: 0.16 },
    ],
  },
  boss_death: {
    kind: 'arp', notes: [220, 165, 110, 82, 55], step: 0.12, type: 'sawtooth',
    dur: 0.4, gain: 0.4, minInterval: 200,
  },

  player_hurt: {
    kind: 'tone', type: 'square', freq: 240, freqEnd: 120, dur: 0.18, gain: 0.36,
    attack: 0.002, release: 0.12, minInterval: 120,
  },
  player_death: {
    kind: 'arp', notes: [392, 330, 262, 196, 131], step: 0.14, type: 'triangle',
    dur: 0.5, gain: 0.4, minInterval: 500,
  },

  // 符法起手：铃音 + 低频灵力涌动 + 纸符轻响
  skill_cast: {
    kind: 'mix', minInterval: 80,
    layers: [
      { kind: 'tone', type: 'sine', freq: 660, freqEnd: 1320, dur: 0.18, gain: 0.2, attack: 0.004, release: 0.12 },
      { kind: 'tone', type: 'sine', freq: 110, freqEnd: 165, dur: 0.3, gain: 0.15, attack: 0.02, release: 0.18 },
      { kind: 'noise', dur: 0.07, filterType: 'highpass', filterFreq: 3200, gain: 0.07, attack: 0.002, release: 0.05 },
    ],
  },

  // ───────── 进度 / 经济 ─────────
  // 修为精进：宫调五声上行
  level_up: {
    kind: 'arp', notes: [523, 587, 659, 784, 1047], step: 0.085, type: 'triangle',
    dur: 0.22, gain: 0.38, minInterval: 500,
  },
  xp_gain: {
    kind: 'tone', type: 'sine', freq: 1300, dur: 0.045, gain: 0.1,
    attack: 0.002, release: 0.04, minInterval: 80, volume: 0.8,
  },
  // 灵石入囊：玉石轻碰
  coin: {
    kind: 'tone', type: 'sine', freq: 1568, freqEnd: 2093, dur: 0.07, gain: 0.18,
    attack: 0.002, release: 0.05, minInterval: 50,
  },
  loot_pickup: {
    kind: 'tone', type: 'triangle', freq: 660, freqEnd: 990, dur: 0.1, gain: 0.26,
    attack: 0.003, release: 0.08, minInterval: 50,
  },
  // 灵宝现世：玉石清响（纯音五声）
  loot_legendary: {
    kind: 'arp', notes: [1047, 1319, 1568, 2093], step: 0.09, type: 'sine',
    dur: 0.22, gain: 0.34, minInterval: 300,
  },
  loot_drop: {
    kind: 'tone', type: 'triangle', freq: 440, freqEnd: 330, dur: 0.07, gain: 0.14,
    attack: 0.002, release: 0.05, minInterval: 40,
  },
  chest_open: {
    kind: 'mix', minInterval: 120,
    layers: [
      { kind: 'noise', dur: 0.18, filterType: 'bandpass', filterFreq: 2400, filterQ: 2, gain: 0.2, attack: 0.005, release: 0.14 },
      { kind: 'tone', type: 'triangle', freq: 660, freqEnd: 880, dur: 0.16, gain: 0.2, attack: 0.005, release: 0.12 },
    ],
  },

  // ───────── 物品 / 装备 ─────────
  potion_drink: {
    kind: 'tone', type: 'sine', freq: 330, freqEnd: 660, dur: 0.2, gain: 0.24,
    attack: 0.01, release: 0.14, minInterval: 100,
  },
  equip: {
    kind: 'mix', minInterval: 80,
    layers: [
      { kind: 'noise', dur: 0.08, filterType: 'highpass', filterFreq: 1500, gain: 0.18, attack: 0.002, release: 0.06 },
      { kind: 'tone', type: 'square', freq: 440, freqEnd: 660, dur: 0.1, gain: 0.18, attack: 0.002, release: 0.07 },
    ],
  },
  enhance_success: {
    kind: 'arp', notes: [659, 784, 1047], step: 0.07, type: 'triangle',
    dur: 0.16, gain: 0.34, minInterval: 200,
  },
  enhance_fail: {
    kind: 'tone', type: 'sawtooth', freq: 330, freqEnd: 150, dur: 0.28, gain: 0.3,
    attack: 0.003, release: 0.18, minInterval: 200,
  },

  // ───────── UI ─────────
  ui_click: {
    kind: 'tone', type: 'square', freq: 660, dur: 0.04, gain: 0.16,
    attack: 0.001, release: 0.035, minInterval: 30,
  },
  ui_hover: {
    kind: 'tone', type: 'sine', freq: 920, dur: 0.03, gain: 0.07,
    attack: 0.001, release: 0.025, minInterval: 20, volume: 0.8,
  },
  ui_open: {
    kind: 'tone', type: 'triangle', freq: 440, freqEnd: 700, dur: 0.12, gain: 0.2,
    attack: 0.002, release: 0.09, minInterval: 60,
  },
  ui_close: {
    kind: 'tone', type: 'triangle', freq: 700, freqEnd: 440, dur: 0.12, gain: 0.2,
    attack: 0.002, release: 0.09, minInterval: 60,
  },
  ui_error: {
    kind: 'tone', type: 'square', freq: 200, freqEnd: 150, dur: 0.16, gain: 0.26,
    attack: 0.002, release: 0.1, minInterval: 80,
  },

  // ───────── NPC / 系统 ─────────
  dialogue_blip: {
    kind: 'tone', type: 'triangle', freq: 560, dur: 0.03, gain: 0.1,
    attack: 0.001, release: 0.025, minInterval: 40, volume: 0.9,
  },
  quest_accept: {
    kind: 'arp', notes: [523, 587, 784], step: 0.08, type: 'triangle',
    dur: 0.14, gain: 0.3, minInterval: 200,
  },
  quest_complete: {
    kind: 'arp', notes: [587, 659, 784, 1047], step: 0.09, type: 'triangle',
    dur: 0.2, gain: 0.38, minInterval: 400,
  },
  shop_buy: {
    kind: 'mix', minInterval: 80,
    layers: [
      { kind: 'tone', type: 'square', freq: 1320, freqEnd: 1760, dur: 0.08, gain: 0.18, attack: 0.002, release: 0.06 },
      { kind: 'tone', type: 'square', freq: 880, dur: 0.05, gain: 0.12, attack: 0.002, release: 0.04 },
    ],
  },
  shop_sell: {
    kind: 'tone', type: 'square', freq: 880, freqEnd: 1100, dur: 0.07, gain: 0.16,
    attack: 0.002, release: 0.05, minInterval: 80,
  },
  bonfire: {
    kind: 'mix', minInterval: 300,
    layers: [
      { kind: 'noise', dur: 0.6, filterType: 'lowpass', filterFreq: 700, gain: 0.16, attack: 0.05, release: 0.4 },
      { kind: 'tone', type: 'sine', freq: 196, freqEnd: 262, dur: 0.5, gain: 0.16, attack: 0.05, release: 0.3 },
    ],
  },
};

/**
 * ── 程序化音乐曲库 ──
 * MusicEngine 据此调度循环音乐。每条曲目：
 *   bpm        每分钟拍数
 *   scale      可用音高（MIDI 音符号数组，相对根音偏移）
 *   root       根音频率 (Hz)
 *   chords     和弦进行（每个是根音上的半音偏移数组），逐小节循环
 *   bars       一个循环的小节数
 *   bassType / leadType  音色
 *   drums      是否加鼓点
 *   gain       该曲目整体音量缩放
 */
const C2 = 65.41, C3 = 130.81, A2 = 55, A3 = 110, D3 = 146.83, E3 = 164.81;

export const MUSIC = {
  // 云荒引：羽调五声，慢速留白，似古琴散板
  menu: {
    bpm: 66, root: A2, gain: 0.5, drums: false,
    bassType: 'triangle', leadType: 'sine',
    scale: [0, 3, 5, 7, 10, 12],                 // A 羽调五声
    chords: [[0, 7, 12], [3, 10, 15], [5, 12, 17], [7, 12, 19]],
    bars: 4,
  },
  // 青岚行：宫调五声，无鼓留白，泛音气质的野外游历
  explore: {
    bpm: 88, root: C2, gain: 0.4, drums: false,
    bassType: 'triangle', leadType: 'sine',
    scale: [0, 2, 4, 7, 9, 12, 14, 16],          // C 宫调五声
    chords: [[0, 7, 14], [9, 14, 21], [4, 9, 16], [2, 7, 12]],
    bars: 4,
  },
  // 栖云坊：明亮宫调，笛音轻快，坊市烟火气
  town: {
    bpm: 96, root: C3, gain: 0.4, drums: false,
    bassType: 'sine', leadType: 'triangle',
    scale: [0, 2, 4, 7, 9, 12, 14, 16],          // C 宫调五声
    chords: [[0, 4, 9], [2, 7, 12], [4, 9, 14], [0, 7, 16]],
    bars: 4,
  },
  // 伏妖：羽调紧凑鼓点，短促弦乐推进
  combat: {
    bpm: 138, root: D3, gain: 0.4, drums: true,
    bassType: 'sawtooth', leadType: 'square',
    scale: [0, 3, 5, 7, 10, 12],                 // D 羽调五声
    chords: [[0, 7, 12], [3, 10, 15], [5, 10, 17], [0, 7, 15]],
    bars: 4,
  },
  // 白骨鬼王：羽调叠半音压迫，阴煞鼓阵
  boss: {
    bpm: 150, root: A2, gain: 0.44, drums: true,
    bassType: 'sawtooth', leadType: 'square',
    scale: [0, 1, 3, 7, 8, 10, 12],              // 羽调加变徵压迫
    chords: [[0, 7, 12], [1, 7, 13], [3, 10, 15], [0, 6, 13]],
    bars: 4,
  },
};
