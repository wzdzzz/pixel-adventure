/**
 * MusicEngine — 程序化背景音乐引擎（Web Audio，无外部音频文件）
 *
 * 职责：
 *  - 据 src/data/sounds.js 的 MUSIC 曲库，循环调度 chiptune 风格背景乐
 *  - 复用 AudioEngine 的合成原语 playTone / playNoise，所有音符走 musicGain
 *  - 前瞻调度器（look-ahead scheduler）：用 setInterval 周期 tick，提前把
 *    未来一小段窗口内的音符按 ctx 绝对时间精确排好，规避 setInterval 抖动
 *  - 曲目切换用交叉淡入淡出（per-track 子 gain 节点斜坡）
 *
 * 设计：
 *  - 每条活动曲目拥有一个独立 GainNode（_trackGain），连到 audioEngine.musicGain，
 *    该曲目所有音符 dest 指向它。切换时旧曲目 gain 淡出后销毁，新曲目 gain 淡入。
 *  - 假设每小节 4 拍。bar/beat 计数模 (bars * 4) 循环。
 *  - 未解锁（AudioContext 未 running）时不调度，但记住请求曲目，解锁后自动开始。
 *  - 单个坏音符不应中断整个循环：调度包 try/catch。
 *
 * 音量保持低且克制——这是环境背景乐，绝不能压过 SFX。
 */

import audioEngine from './AudioEngine.js';
import { MUSIC } from '../data/sounds.js';

const BEATS_PER_BAR = 4;          // 假设 4/4 拍
const TICK_MS = 100;              // 调度器 tick 间隔
const SCHEDULE_AHEAD = 0.2;       // 提前调度窗口（秒）
const CROSSFADE = 0.8;            // 交叉淡入淡出时长（秒）

// 各声部基础音量（再乘以曲目 gain）
const BASS_GAIN = 0.18;
const ARP_GAIN = 0.10;
const KICK_GAIN = 0.12;
const HAT_GAIN = 0.12;

/** 半音偏移 → 频率 */
function semitoneToFreq(root, s) {
  return root * Math.pow(2, s / 12);
}

export default class MusicEngine {
  constructor(audioEngineRef = audioEngine) {
    this.audioEngine = audioEngineRef;

    this._enabled = true;          // 主开关
    this._currentTrack = null;     // 当前正在调度的曲目名
    this._pendingTrack = null;     // 解锁后待启动的曲目名（未解锁时缓存）

    this._trackDef = null;         // 当前曲目数据
    this._trackGain = null;        // 当前曲目子 gain 节点
    this._fadingGains = [];        // 正在淡出、待回收的旧 gain 节点 [{ node, killAt }]

    this._nextNoteTime = 0;        // 下一个待调度的 16 分音符的绝对起始时间（秒）
    this._step16 = 0;              // 当前 16 分音符步进计数（模 bars*4*4）

    this._timer = null;            // setInterval 句柄
  }

  // ───────── 公共 API ─────────

  /**
   * 开始 / 切换曲目。幂等：若同名曲目已在播放，什么都不做。
   * 未解锁时仅记住请求，解锁后由 tick 自动启动。
   */
  play(trackName) {
    if (!MUSIC[trackName]) {
      if (import.meta?.env?.DEV) console.warn('[MusicEngine] 未知曲目:', trackName);
      return;
    }
    // 幂等：相同曲目（且确实在播放）则忽略
    if (this._currentTrack === trackName && this._trackGain) return;
    if (!this._enabled) { this._pendingTrack = trackName; return; }

    this._pendingTrack = trackName;
    this._ensureTimer();
    // 若已解锁则立即启动；否则等 tick 中懒启动
    if (this.audioEngine.unlocked && this.audioEngine.ctx) {
      this._beginTrack(trackName);
    }
  }

  /** 淡出并停止调度（保留 enabled 状态）。 */
  stop() {
    this._pendingTrack = null;
    this._fadeOutCurrent();
    this._currentTrack = null;
    this._trackDef = null;
    this._clearTimer();
  }

  /** 音乐主开关。关闭时停止调度；重新开启不会自动续播。 */
  setEnabled(enabled) {
    enabled = !!enabled;
    if (this._enabled === enabled) return;
    this._enabled = enabled;
    if (!enabled) {
      // 记住当前曲目以便外部决定是否恢复，但停止调度
      const remembered = this._currentTrack;
      this.stop();
      this._pendingTrack = remembered;
    }
  }

  /** 销毁：清定时器、停止、断开所有节点。 */
  destroy() {
    this._clearTimer();
    this._fadeOutCurrent();
    // 立即断开所有淡出中的节点
    for (const f of this._fadingGains) {
      try { f.node.disconnect(); } catch (e) { /* 忽略 */ }
    }
    this._fadingGains = [];
    this._trackGain = null;
    this._trackDef = null;
    this._currentTrack = null;
    this._pendingTrack = null;
  }

  // ───────── 内部：定时器 ─────────

  _ensureTimer() {
    if (this._timer != null) return;
    this._timer = setInterval(() => {
      try { this._tick(); } catch (e) { /* 单 tick 错误不应中断循环 */ }
    }, TICK_MS);
  }

  _clearTimer() {
    if (this._timer != null) {
      clearInterval(this._timer);
      this._timer = null;
    }
  }

  // ───────── 内部：曲目生命周期 ─────────

  /** 启动一条曲目：建立子 gain、初始化调度时钟、淡入。 */
  _beginTrack(trackName) {
    const ctx = this.audioEngine.ctx;
    if (!ctx) return;

    // 先淡出旧曲目
    this._fadeOutCurrent();

    const def = MUSIC[trackName];
    const t = this.audioEngine.now();

    const trackGain = ctx.createGain();
    trackGain.gain.setValueAtTime(0.0001, t);
    // 淡入到 1（曲目内各音符已乘 def.gain，这里只做整体淡入/淡出包络）
    trackGain.gain.exponentialRampToValueAtTime(1, t + CROSSFADE);
    trackGain.connect(this.audioEngine.musicGain);

    this._trackGain = trackGain;
    this._trackDef = def;
    this._currentTrack = trackName;
    this._pendingTrack = null;

    // 从下一拍稍后开始调度，留出余量
    this._step16 = 0;
    this._nextNoteTime = t + 0.05;
  }

  /** 淡出当前曲目子 gain，放入回收列表。 */
  _fadeOutCurrent() {
    if (!this._trackGain) return;
    const node = this._trackGain;
    const t = this.audioEngine.now();
    try {
      node.gain.cancelScheduledValues(t);
      // 取当前值作为起点，平滑降到近零
      const cur = Math.max(0.0001, node.gain.value || 0.0001);
      node.gain.setValueAtTime(cur, t);
      node.gain.exponentialRampToValueAtTime(0.0001, t + CROSSFADE);
    } catch (e) { /* 忽略 */ }
    this._fadingGains.push({ node, killAt: t + CROSSFADE + 0.3 });
    this._trackGain = null;
  }

  /** 回收已淡出完成的旧 gain 节点。 */
  _reapFadingGains(now) {
    if (this._fadingGains.length === 0) return;
    const survivors = [];
    for (const f of this._fadingGains) {
      if (now >= f.killAt) {
        try { f.node.disconnect(); } catch (e) { /* 忽略 */ }
      } else {
        survivors.push(f);
      }
    }
    this._fadingGains = survivors;
  }

  // ───────── 内部：前瞻调度 ─────────

  _tick() {
    const ae = this.audioEngine;

    // 守卫：未解锁 / 无 ctx 时不调度，但保留 pending 等待解锁
    if (!ae.unlocked || !ae.ctx) return;
    if (!this._enabled) return;

    const now = ae.now();
    this._reapFadingGains(now);

    // 懒启动：解锁后若有待播曲目而尚未开始，则启动
    if (this._pendingTrack && (!this._trackGain || this._currentTrack !== this._pendingTrack)) {
      this._beginTrack(this._pendingTrack);
    }

    if (!this._trackGain || !this._trackDef) return;

    const def = this._trackDef;
    const beatDur = 60 / def.bpm;
    const stepDur = beatDur / 4;                 // 16 分音符
    const stepsPerBar = BEATS_PER_BAR * 4;       // 每小节 16 步
    const totalSteps = def.bars * stepsPerBar;   // 一个循环的总步数

    // 把所有落在 [now, now + SCHEDULE_AHEAD] 窗口内的步排进去
    while (this._nextNoteTime < now + SCHEDULE_AHEAD) {
      try {
        this._scheduleStep(def, this._step16, this._nextNoteTime, beatDur, stepDur, stepsPerBar);
      } catch (e) { /* 单步坏音符不中断循环 */ }

      this._nextNoteTime += stepDur;
      this._step16 = (this._step16 + 1) % totalSteps;

      // 防御：若 ctx 时间因暂停跳变导致落后过多，跳到现在附近
      if (this._nextNoteTime < now - 0.5) {
        this._nextNoteTime = now + 0.05;
      }
    }
  }

  /**
   * 调度第 step（16 分音符）上的所有声部。
   * @param {object} def        曲目数据
   * @param {number} step       全局 16 分步索引（已模 totalSteps）
   * @param {number} start      该步绝对起始时间（秒）
   * @param {number} beatDur    一拍时长（秒）
   * @param {number} stepDur    一个 16 分音符时长（秒）
   * @param {number} stepsPerBar 每小节步数（16）
   */
  _scheduleStep(def, step, start, beatDur, stepDur, stepsPerBar) {
    const root = def.root;
    const dest = this._trackGain;
    const tGain = def.gain ?? 0.5;

    const stepInBar = step % stepsPerBar;        // 0..15
    const beatInBar = Math.floor(stepInBar / 4); // 0..3
    const barIndex = Math.floor(step / stepsPerBar) % def.bars;

    const chords = def.chords || [[0]];
    const chord = chords[barIndex % chords.length] || [0];
    const isBeat = (stepInBar % 4) === 0;        // 落在整拍上
    const isOffBeat = (stepInBar % 4) === 2;     // 8 分反拍

    // ── 贝斯：每小节首拍 + 每拍轻触和弦根音（低八度），整拍较长音 ──
    if (isBeat) {
      const bassSemi = (chord[0] ?? 0) - 12; // 低一个八度
      const bassFreq = semitoneToFreq(root, bassSemi);
      // 首拍音更长更稳，其余拍稍短
      const dur = beatInBar === 0 ? beatDur * 1.5 : beatDur * 0.8;
      this.audioEngine.playTone({
        type: def.bassType || 'triangle',
        freq: bassFreq,
        start,
        dur,
        attack: 0.006,
        decay: 0.04,
        sustain: 0.8,
        release: 0.08,
        gain: BASS_GAIN * tGain,
        dest,
      });
    }

    // ── 琶音 / 旋律：在每个 8 分音符（偶数步）上循环和弦音 ──
    if ((stepInBar % 2) === 0) {
      const arpIndex = Math.floor(stepInBar / 2); // 0..7 每小节 8 个 8 分位
      const chordLen = chord.length || 1;
      // 在和弦音上来回循环，并偶尔抬高八度做点变化
      let semi = chord[arpIndex % chordLen] ?? 0;
      if (arpIndex >= chordLen && (arpIndex % 2) === 1) semi += 12;
      const freq = semitoneToFreq(root, semi);
      this.audioEngine.playTone({
        type: def.leadType || 'square',
        freq,
        start,
        dur: stepDur * 1.4,
        attack: 0.004,
        decay: 0.02,
        sustain: 0.7,
        release: 0.05,
        gain: ARP_GAIN * tGain,
        dest,
      });
    }

    // ── 鼓 ──
    if (def.drums) {
      // 底鼓：第 1 拍与第 3 拍
      if (isBeat && (beatInBar === 0 || beatInBar === 2)) {
        // 用音调下扫做更有冲击力的 kick（120→40Hz），再叠一层低通噪声
        this.audioEngine.playTone({
          type: 'sine',
          freq: 120,
          freqEnd: 40,
          start,
          dur: 0.12,
          attack: 0.002,
          release: 0.05,
          gain: KICK_GAIN * tGain,
          dest,
        });
        this.audioEngine.playNoise({
          start,
          dur: 0.05,
          filterType: 'lowpass',
          filterFreq: 120,
          filterQ: 0.7,
          gain: KICK_GAIN * 0.6 * tGain,
          attack: 0.001,
          release: 0.04,
          dest,
        });
      }
      // 踩镲：反拍（8 分反拍）上很短的高通噪声
      if (isOffBeat) {
        this.audioEngine.playNoise({
          start,
          dur: 0.025,
          filterType: 'highpass',
          filterFreq: 6000,
          filterQ: 0.8,
          gain: HAT_GAIN * tGain,
          attack: 0.001,
          release: 0.02,
          dest,
        });
      }
    }
  }
}
