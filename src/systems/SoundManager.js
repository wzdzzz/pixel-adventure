/**
 * SoundManager — 游戏事件 → 程序化音效 / 音乐状态机 的桥接层
 *
 * 职责：
 *  - 把已存在的游戏事件（scene.events）绑定到 AudioEngine 的具名 SFX
 *  - 驱动一个简单的音乐状态机（战斗 ↔ 环境），由战斗事件超时退出
 *  - 不加载任何外部音频文件；全部依赖 AudioEngine / MusicEngine 程序化合成
 *
 * 设计要点：
 *  - 每个事件 handler 都包在 try/catch 里，坏 payload 绝不会抛进 Phaser 的事件发射器
 *  - bind() 把 [事件名, 绑定后的函数] 存进 this._listeners，unbind() 精确移除
 *  - 音乐：actorDamaged 进战斗，6 秒无战斗事件回到环境曲（_ambientTrack）
 *  - 生命周期：scene shutdown 调 unbind()，scene destroy 调 destroy()
 */

import audioEngine from './AudioEngine.js';

const COMBAT_TIMEOUT = 6000; // ms，无战斗事件多久后退出战斗音乐
const DEV = !!(import.meta && import.meta.env && import.meta.env.DEV);

export default class SoundManager {
  /**
   * @param {Phaser.Scene} scene  MainGameScene（拥有 .events / .player / .time）
   * @param {MusicEngine} musicEngine
   */
  constructor(scene, musicEngine) {
    this.scene = scene || null;
    this.music = musicEngine || null;

    // 已注册监听器：[ [eventName, boundFn], ... ]，供 unbind() 精确移除
    this._listeners = [];
    this._bound = false;

    // ── 经济 / 进度节流状态 ──
    // 懒初始化：首次回调只记录基线，不发声
    this._lastXp = null;
    this._lastGold = null;

    // ── 音乐状态机 ──
    this._inCombat = false;
    this._lastCombatTime = 0;
    this._ambientTrack = 'explore';
  }

  // ───────── 生命周期 ─────────

  /** 注册全部 scene.events 监听器。幂等：重复调用先 unbind。 */
  bind() {
    if (!this.scene || !this.scene.events) return;
    if (this._bound) this.unbind();

    // 事件名 → handler 映射；handler 内部已各自 try/catch 包裹
    const map = {
      // ── 战斗 ──
      playerAttack: (classType) => this._onPlayerAttack(classType),
      skillCast: () => audioEngine.playSfx('skill_cast'),
      actorDamaged: (actor) => this._onActorDamaged(actor),
      enemyDeath: (enemy) => audioEngine.playSfx(enemy && enemy.isBoss ? 'boss_death' : 'enemy_death'),
      npcDeath: () => audioEngine.playSfx('enemy_death'),
      playerDeath: () => this._onPlayerDeath(),

      // ── 进度 / 经济 ──
      levelUp: () => audioEngine.playSfx('level_up'),
      xpChanged: (xp) => this._onXpChanged(xp),
      goldChanged: (gold) => this._onGoldChanged(gold),

      // ── 掉落 / 物品 / 装备 ──
      enemyDropLoot: () => audioEngine.playSfx('loot_drop'),
      itemSlotsChanged: () => audioEngine.playSfx('loot_pickup'),
      useItem: () => audioEngine.playSfx('potion_drink'),
      equipmentChanged: () => audioEngine.playSfx('equip'),
      // inventoryUpdated 故意不发声（过于频繁）

      // ── 任务 / 对话 ──
      questActivated: () => audioEngine.playSfx('quest_accept'),
      questCompleted: () => audioEngine.playSfx('quest_complete'),
      dialogueNodeEntered: () => audioEngine.playSfx('dialogue_blip'),
      dialogueStarted: () => audioEngine.playSfx('ui_open'),

      // ── 商店 / 训练师 ──
      shopOpened: () => audioEngine.playSfx('ui_open'),
      shopClosed: () => audioEngine.playSfx('ui_close'),
      trainerOpened: () => audioEngine.playSfx('ui_open'),
      shopBought: () => audioEngine.playSfx('shop_buy'),
      shopSold: () => audioEngine.playSfx('shop_sell'),

      // ── 篝火 / 面板 / 通用 ──
      bonfireRest: () => this._onBonfireRest(),
      switchPanelTab: () => audioEngine.playSfx('ui_click'),
      playSound: (name) => { if (typeof name === 'string') audioEngine.playSfx(name); },
    };

    for (const eventName in map) {
      // 用 _wrap 包一层 try/catch，保证坏 payload 不抛进 Phaser 发射器
      const fn = this._wrap(eventName, map[eventName]);
      this.scene.events.on(eventName, fn);
      this._listeners.push([eventName, fn]);
    }
    this._bound = true;
  }

  /** 移除 bind() 中注册的全部监听器（精确按引用移除）。场景 shutdown 时调。 */
  unbind() {
    if (this.scene && this.scene.events) {
      for (const [eventName, fn] of this._listeners) {
        this.scene.events.off(eventName, fn);
      }
    }
    this._listeners = [];
    this._bound = false;
  }

  /** 每帧由场景调用：处理战斗音乐超时回落到环境曲。 */
  update(/* time, delta */) {
    if (!this._inCombat || !this.scene || !this.scene.time) return;
    const now = this.scene.time.now;
    if (now - this._lastCombatTime > COMBAT_TIMEOUT) {
      this._inCombat = false;
      this._playMusic(this._ambientTrack);
    }
  }

  /** 卸载：解绑事件 + 停止音乐。 */
  destroy() {
    this.unbind();
    if (this.music && typeof this.music.stop === 'function') {
      try { this.music.stop(); } catch (e) { /* 忽略 */ }
    }
    this.scene = null;
    this.music = null;
  }

  // ───────── 音乐控制（供场景调用） ─────────

  /**
   * 设置环境曲目（如进城用 'town'，野外用 'explore'）。
   * 若当前不在战斗中，立即切到该曲；战斗中只记录，待退出战斗时生效。
   * @param {'explore'|'town'|'menu'|string} trackName
   */
  setAmbient(trackName) {
    if (typeof trackName !== 'string' || !trackName) return;
    this._ambientTrack = trackName;
    if (!this._inCombat) {
      this._playMusic(trackName);
    }
  }

  /** 主动播放当前环境曲（仅当不在战斗中）。场景决定何时调用。 */
  startAmbient() {
    if (!this._inCombat) {
      this._playMusic(this._ambientTrack);
    }
  }

  // ───────── 内部 handler ─────────

  /** playerAttack(classType)：远程职业用远程攻击音，否则近战。 */
  _onPlayerAttack(classType) {
    const ranged = classType === 'archer' || classType === 'mage';
    audioEngine.playSfx(ranged ? 'player_attack_ranged' : 'player_attack_melee');
  }

  /** actorDamaged(actor)：玩家受伤 vs 其他受击；并进入战斗音乐。 */
  _onActorDamaged(actor) {
    const isPlayer = this.scene && actor && actor === this.scene.player;
    audioEngine.playSfx(isPlayer ? 'player_hurt' : 'hit_impact');
    this._enterCombat();
  }

  /** playerDeath：播放死亡音，音乐回到环境曲。 */
  _onPlayerDeath() {
    audioEngine.playSfx('player_death');
    this._inCombat = false;
    this._playMusic(this._ambientTrack);
  }

  /** xpChanged(xp)：仅当 xp 上升时发声；首次只记录基线。 */
  _onXpChanged(xp) {
    if (typeof xp !== 'number' || !isFinite(xp)) return;
    if (this._lastXp === null) { this._lastXp = xp; return; }
    if (xp > this._lastXp) audioEngine.playSfx('xp_gain');
    this._lastXp = xp;
  }

  /** goldChanged(gold)：仅当金币上升时发声；首次只记录基线。 */
  _onGoldChanged(gold) {
    if (typeof gold !== 'number' || !isFinite(gold)) return;
    if (this._lastGold === null) { this._lastGold = gold; return; }
    if (gold > this._lastGold) audioEngine.playSfx('coin');
    this._lastGold = gold;
  }

  /** bonfireRest：篝火音效，音乐回到环境曲（探索）。 */
  _onBonfireRest() {
    audioEngine.playSfx('bonfire');
    this._inCombat = false;
    this._playMusic('explore');
  }

  // ───────── 音乐状态机内部 ─────────

  /** 进入战斗：刷新计时；若此前不在战斗则切到战斗曲。 */
  _enterCombat() {
    this._lastCombatTime = (this.scene && this.scene.time) ? this.scene.time.now : 0;
    if (!this._inCombat) {
      this._inCombat = true;
      this._playMusic('combat');
    }
  }

  /** 安全地调用 music.play（music 可能为 null）。 */
  _playMusic(track) {
    if (this.music && typeof this.music.play === 'function') {
      try { this.music.play(track); } catch (e) { if (DEV) console.warn('[SoundManager] music.play 失败:', e); }
    }
  }

  // ───────── 工具 ─────────

  /** 把 handler 包一层 try/catch，保证异常不抛进 Phaser 事件发射器。 */
  _wrap(eventName, fn) {
    return (...args) => {
      try {
        fn(...args);
      } catch (e) {
        if (DEV) console.warn(`[SoundManager] 事件 "${eventName}" handler 异常:`, e);
      }
    };
  }
}
