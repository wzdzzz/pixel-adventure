/**
 * AudioEngine — Web Audio 程序化合成核心（全局单例）
 *
 * 职责：
 *  - 管理唯一的 AudioContext + master/music/sfx 三级 gain 图
 *  - 三级音量 + 静音，持久化到 localStorage（全局偏好，独立于存档）
 *  - 处理浏览器自动播放策略（首次用户手势 unlock → ctx.resume()）
 *  - 提供低层合成原语 playTone / playNoise（供 MusicEngine 复用）
 *  - 提供高层 playSfx(name)：解释 src/data/sounds.js 的 SFX 描述
 *
 * 不依赖任何外部音频文件。跨场景存活，不随场景 shutdown 销毁。
 */

import { SOUNDS } from '../data/sounds.js';

const STORAGE_KEY = 'pixel_adventure_audio_settings';
const DEFAULT_MIN_INTERVAL = 40; // ms

class AudioEngine {
  constructor() {
    this.ctx = null;
    this.masterGain = null;
    this.musicGain = null;
    this.sfxGain = null;

    this._unlocked = false;
    this._initialized = false;

    // 音量（0~1，线性；映射到 gain 时取平方做感知曲线）
    this._master = 0.7;
    this._music = 0.5;
    this._sfx = 0.8;
    this._muted = false;

    // 同名 SFX 节流时间戳
    this._lastPlayed = new Map();
  }

  // ───────── 生命周期 ─────────

  /** 创建 AudioContext + gain 图；读取持久化设置。幂等。 */
  init() {
    if (this._initialized) return;
    this._load();

    try {
      const Ctx = window.AudioContext || window.webkitAudioContext;
      if (!Ctx) {
        console.warn('[AudioEngine] 浏览器不支持 Web Audio，音频禁用');
        this._initialized = true;
        return;
      }
      this.ctx = new Ctx();

      this.masterGain = this.ctx.createGain();
      this.musicGain = this.ctx.createGain();
      this.sfxGain = this.ctx.createGain();

      this.musicGain.connect(this.masterGain);
      this.sfxGain.connect(this.masterGain);
      this.masterGain.connect(this.ctx.destination);

      this._applyVolumes();
      this._unlocked = this.ctx.state === 'running';
    } catch (e) {
      console.warn('[AudioEngine] 初始化失败，音频禁用', e);
      this.ctx = null;
    }
    this._initialized = true;
  }

  /** 首次用户手势调用：恢复被浏览器挂起的 AudioContext。 */
  unlock() {
    if (!this.ctx) return;
    if (this.ctx.state === 'suspended') {
      this.ctx.resume().then(() => { this._unlocked = true; }).catch(() => {});
    } else {
      this._unlocked = true;
    }
  }

  get unlocked() { return this._unlocked && !!this.ctx && this.ctx.state === 'running'; }
  get available() { return !!this.ctx; }

  /** AudioContext 当前时间（未就绪返回 0）。 */
  now() { return this.ctx ? this.ctx.currentTime : 0; }

  // ───────── 音量 / 设置 ─────────

  setMasterVolume(v) { this._master = clamp01(v); this._applyVolumes(); this._save(); }
  setMusicVolume(v)  { this._music = clamp01(v);  this._applyVolumes(); this._save(); }
  setSfxVolume(v)    { this._sfx = clamp01(v);    this._applyVolumes(); this._save(); }
  getMasterVolume()  { return this._master; }
  getMusicVolume()   { return this._music; }
  getSfxVolume()     { return this._sfx; }

  setMuted(b) { this._muted = !!b; this._applyVolumes(); this._save(); }
  toggleMuted() { this.setMuted(!this._muted); return this._muted; }
  get muted() { return this._muted; }

  _applyVolumes() {
    if (!this.ctx) return;
    const t = this.ctx.currentTime;
    const m = this._muted ? 0 : perceptual(this._master);
    // setTargetAtTime 平滑过渡，避免爆音
    this.masterGain.gain.setTargetAtTime(m, t, 0.015);
    this.musicGain.gain.setTargetAtTime(perceptual(this._music), t, 0.015);
    this.sfxGain.gain.setTargetAtTime(perceptual(this._sfx), t, 0.015);
  }

  _save() {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify({
        master: this._master, music: this._music, sfx: this._sfx, muted: this._muted,
      }));
    } catch (e) { /* 忽略隐私模式等存储失败 */ }
  }

  _load() {
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      if (!raw) return;
      const d = JSON.parse(raw);
      if (typeof d.master === 'number') this._master = clamp01(d.master);
      if (typeof d.music === 'number') this._music = clamp01(d.music);
      if (typeof d.sfx === 'number') this._sfx = clamp01(d.sfx);
      if (typeof d.muted === 'boolean') this._muted = d.muted;
    } catch (e) { /* 忽略损坏数据 */ }
  }

  // ───────── 低层合成原语 ─────────

  /**
   * 播放一个带 ADSR 包络的振荡器音。
   * @returns {{osc, gain}|null}
   */
  playTone(opts = {}) {
    if (!this.unlocked) return null;
    const {
      type = 'sine', freq = 440, freqEnd = null,
      start = this.now(), dur = 0.2,
      attack = 0.005, decay = 0, sustain = 1, release = 0.05,
      gain = 0.5, detune = 0, dest = this.sfxGain,
    } = opts;

    const t0 = start;
    const osc = this.ctx.createOscillator();
    osc.type = type;
    osc.frequency.setValueAtTime(Math.max(1, freq), t0);
    if (freqEnd != null) {
      osc.frequency.exponentialRampToValueAtTime(Math.max(1, freqEnd), t0 + dur);
    }
    if (detune) osc.detune.setValueAtTime(detune, t0);

    const g = this.ctx.createGain();
    const peak = Math.max(0.0001, gain);
    g.gain.setValueAtTime(0.0001, t0);
    g.gain.exponentialRampToValueAtTime(peak, t0 + attack);
    const sustainLevel = Math.max(0.0001, peak * sustain);
    if (decay > 0) g.gain.exponentialRampToValueAtTime(sustainLevel, t0 + attack + decay);
    const endT = t0 + dur;
    // 从峰值/sustain 连续衰减到近零（在 endT+release 处结束）
    g.gain.exponentialRampToValueAtTime(0.0001, endT + release);

    osc.connect(g);
    g.connect(dest || this.sfxGain);
    osc.start(t0);
    osc.stop(endT + release + 0.02);
    osc.onended = () => { try { osc.disconnect(); g.disconnect(); } catch (e) {} };
    return { osc, gain: g };
  }

  /**
   * 播放一段噪声（可选带通/低通/高通滤波）。用于打击 / 爆破 / 风 / 火。
   * @returns {{src, gain}|null}
   */
  playNoise(opts = {}) {
    if (!this.unlocked) return null;
    const {
      dur = 0.1, start = this.now(), gain = 0.5,
      filterType = null, filterFreq = 1000, filterQ = 1,
      attack = 0.001, release = 0.05, dest = this.sfxGain,
    } = opts;

    const t0 = start;
    const frames = Math.max(1, Math.floor(this.ctx.sampleRate * (dur + release)));
    const buffer = this.ctx.createBuffer(1, frames, this.ctx.sampleRate);
    const data = buffer.getChannelData(0);
    for (let i = 0; i < frames; i++) data[i] = Math.random() * 2 - 1;

    const src = this.ctx.createBufferSource();
    src.buffer = buffer;

    let node = src;
    if (filterType) {
      const filter = this.ctx.createBiquadFilter();
      filter.type = filterType;
      filter.frequency.setValueAtTime(filterFreq, t0);
      filter.Q.setValueAtTime(filterQ, t0);
      src.connect(filter);
      node = filter;
    }

    const g = this.ctx.createGain();
    const peak = Math.max(0.0001, gain);
    g.gain.setValueAtTime(0.0001, t0);
    g.gain.exponentialRampToValueAtTime(peak, t0 + attack);
    g.gain.exponentialRampToValueAtTime(0.0001, t0 + dur + release);

    node.connect(g);
    g.connect(dest || this.sfxGain);
    src.start(t0);
    src.stop(t0 + dur + release + 0.02);
    src.onended = () => { try { src.disconnect(); g.disconnect(); } catch (e) {} };
    return { src, gain: g };
  }

  // ───────── 高层：按名播放 SFX ─────────

  /**
   * 按名播放数据驱动 SFX（见 src/data/sounds.js）。
   * @param {string} name SOUNDS 中的 key
   * @param {object} opts { volume?, when? } volume 额外缩放，when 起始时间偏移(s)
   */
  playSfx(name, opts = {}) {
    if (!this.unlocked) return;
    const def = SOUNDS[name];
    if (!def) {
      if (import.meta?.env?.DEV) console.warn('[AudioEngine] 未知音效:', name);
      return;
    }

    // 节流：防止同名音效在极短时间内爆音
    const minInterval = def.minInterval ?? DEFAULT_MIN_INTERVAL;
    const last = this._lastPlayed.get(name) || 0;
    const nowMs = this.ctx.currentTime * 1000;
    if (nowMs - last < minInterval) return;
    this._lastPlayed.set(name, nowMs);

    const start = this.now() + (opts.when || 0);
    const volScale = (def.volume ?? 1) * (opts.volume ?? 1);
    this._renderSfx(def, start, volScale);
  }

  /** 递归渲染一个 SFX 描述（tone/noise/mix/arp）。 */
  _renderSfx(def, start, volScale) {
    const dest = this.sfxGain;
    switch (def.kind) {
      case 'tone':
        this.playTone({ ...def, start, gain: (def.gain ?? 0.5) * volScale, dest });
        break;
      case 'noise':
        this.playNoise({ ...def, start, gain: (def.gain ?? 0.5) * volScale, dest });
        break;
      case 'mix':
        (def.layers || []).forEach((layer) => this._renderSfx(layer, start, volScale));
        break;
      case 'arp': {
        const notes = def.notes || [];
        const step = def.step ?? 0.08;
        const noteDur = def.dur ?? step * 1.6;
        notes.forEach((freq, i) => {
          this.playTone({
            type: def.type || 'square', freq, dur: noteDur,
            attack: 0.004, release: 0.06,
            gain: (def.gain ?? 0.4) * volScale,
            start: start + i * step, dest,
          });
        });
        break;
      }
      default:
        if (import.meta?.env?.DEV) console.warn('[AudioEngine] 未知 SFX kind:', def.kind);
    }
  }
}

function clamp01(v) { v = Number(v); if (!isFinite(v)) return 0; return Math.max(0, Math.min(1, v)); }
function perceptual(v) { return clamp01(v) ** 2; } // 感知音量曲线

// 全局单例
const audioEngine = new AudioEngine();
export default audioEngine;
