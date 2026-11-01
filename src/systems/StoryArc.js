/**
 * StoryArc — 体验弧第一阶段：序章引导、情境教学、方向指引、结局演出。
 *
 * 设计文档：docs/plans/2026-08-19-experience-arc-phase1-design.md
 * 原则：不新增玩法系统，只把既有任务链 / 对话 / worldState flag / Boss 事件组织成
 * "开场 → 四幕 → 结局"的完整经历。
 *
 * MainGameScene 是复用单例：本模块注册的全部监听/计时器在 shutdown 时解绑。
 */
import { UI_THEME } from '../config/uiTheme.js';
import { SaveSystem } from './SaveSystem.js';
import { TEXTURES } from '../assets/AssetManager.js';

/** 白骨鬼王巢穴（chunk 坐标，见 WorldLayout.bosses），读档补生成古印用 */
const KING_LAIRS = [
  { x: 14 * 1024 + 512, y: 2 * 1024 + 512 },
  { x: 14 * 1024 + 512, y: 14 * 1024 + 512 },
];

/** 序章开场字幕 */
export const PROLOGUE_LINES = [
  '灵脉异动，古宗禁制年久松脱。',
  '妖祟渐入商路，坊市悬赏日多。',
  '你背上行囊来到栖云坊市——散修的路，从挂名一纸名帖开始。',
];

/** 通关结语字幕 */
export const ENDING_LINES = [
  '白骨鬼王溃散，四方封印重归沉寂。',
  '阴煞灵潮自遗址退去，如潮水还海。',
  '商路复通，坊市灯火如常。',
  '云荒很大，你的路还长。',
];

/** 各幕接取时的方向指引 toast */
const ACT_DIRECTIONS = {
  ow_first_hunt: '出坊市，去外围水边清剿浊水精',
  ow_goblin_threat: '向西面山林去，山魈在那里聚集',
  ow_bone_legion: '向北面的太虚宗遗址进发',
  ow_slay_king: '深入遗址，直面白骨鬼王',
};

/**
 * 全屏字幕卡：黑幕 + 逐行淡入，任意键/点击跳过。
 * 期间休眠 UIScene 隐藏 HUD；resolve 前唤醒（可选关闭，供结局切场景用）。
 * @returns {Promise<void>}
 */
export function showStoryCard(scene, lines, { wakeUiAfter = true } = {}) {
  return new Promise((resolve) => {
    const cam = scene.cameras.main;
    const w = cam.width;
    const h = cam.height;

    if (scene.scene.isActive('UIScene')) scene.scene.sleep('UIScene');

    const container = scene.add.container(0, 0).setDepth(99999).setScrollFactor(0);
    const bg = scene.add.rectangle(w / 2, h / 2, w, h, UI_THEME.colors.ink, 1)
      .setAlpha(0).setInteractive();
    container.add(bg);

    const lineObjs = lines.map((text, i) => {
      const t = scene.add.text(w / 2, h / 2 - (lines.length - 1) * 30 + i * 60, text, {
        fontSize: '24px', fill: UI_THEME.text.paper, fontFamily: UI_THEME.font.body,
      }).setOrigin(0.5).setAlpha(0);
      container.add(t);
      return t;
    });

    const skipHint = scene.add.text(w / 2, h - 60, '（任意键继续）', {
      fontSize: '13px', fill: UI_THEME.text.disabled, fontFamily: UI_THEME.font.body,
    }).setOrigin(0.5).setAlpha(0);
    container.add(skipHint);

    let done = false;
    const finish = () => {
      if (done) return;
      done = true;
      scene.input.keyboard.off('keydown', finish);
      scene.input.off('pointerdown', finish);
      scene.tweens.add({
        targets: container, alpha: 0, duration: 350,
        onComplete: () => {
          container.destroy();
          if (wakeUiAfter && scene.scene.isSleeping('UIScene')) scene.scene.wake('UIScene');
          resolve();
        },
      });
    };

    scene.tweens.add({ targets: bg, alpha: 0.96, duration: 400 });
    lineObjs.forEach((t, i) => {
      scene.tweens.add({ targets: t, alpha: 1, duration: 600, delay: 500 + i * 850 });
    });
    const totalIn = 500 + lineObjs.length * 850 + 400;
    scene.tweens.add({ targets: skipHint, alpha: 1, duration: 400, delay: totalIn });
    // 全部展示后停留一段自动结束
    scene.time.delayedCall(totalIn + 3500, finish);

    // 任意键 / 点击立即结束
    scene.time.delayedCall(600, () => {
      if (done) return;
      scene.input.keyboard.on('keydown', finish);
      scene.input.on('pointerdown', finish);
    });
  });
}

/**
 * 生成镇界古印拾取物：脉冲金光 + 玩家触碰拾取 → 触发结局序列。
 * 场景 shutdown 时随显示列表销毁，无需额外清理。
 */
function _spawnSealPickup(scene, ws, x, y) {
  if (scene._sealPickup?.active) return;
  const sprite = scene.physics.add.sprite(x, y, TEXTURES.ARTIFACT);
  sprite.setOrigin(0.5, 0.5).setDepth(y).setDisplaySize(30, 30);
  sprite.body.setAllowGravity(false);
  scene._sealPickup = sprite;

  const glow = scene.add.circle(x, y, 26, 0xc6a45f, 0.25).setDepth(y - 1);
  scene.tweens.add({ targets: glow, scale: 1.4, alpha: 0.06, duration: 900, yoyo: true, repeat: -1 });
  const label = scene.add.text(x, y - 28, '镇界古印', {
    fontSize: '11px', fill: UI_THEME.text.brass, fontFamily: UI_THEME.font.body,
  }).setOrigin(0.5).setDepth(y + 1);

  const overlap = scene.physics.add.overlap(scene.player.sprite, sprite, () => {
    if (ws.getFlag('ending_done')) return;
    ws.setFlag('ending_done', true);
    // 拾印即定局：立刻冻结战斗，避免鬼王亡语（冥火归墟）在结局窗口期击杀玩家
    scene.pauseGame('ending');
    overlap.destroy();
    sprite.destroy();
    glow.destroy();
    label.destroy();
    scene._sealPickup = null;
    // 兼容旧字段：VictoryScene 结算与任务监听仍读取它们
    const gs = scene.registry.get('gameState') || {};
    gs.hasArtifact = true;
    scene.registry.set('gameState', gs);
    scene.events.emit('artifactCollected');
    scene.events.emit('showMessage', '取得 镇界古印', '#e8d9a0');
    scene.time.delayedCall(900, () => scene.playEndingSequence?.());
  });
}

/**
 * 安装体验弧逻辑。在 MainGameScene.create() 的世界与存档就绪后调用。
 */
export function installStoryArc(scene) {
  const ws = scene.worldState;
  const quests = scene.questSystem;
  if (!ws || !quests) return;

  const cleanups = [];
  const on = (event, fn) => {
    scene.events.on(event, fn);
    cleanups.push(() => scene.events.off(event, fn));
  };

  // ── 一次性情境提示（worldState flag 保证跨存档只出现一次） ──
  const hintOnce = (flag, text) => {
    if (ws.getFlag(flag)) return false;
    ws.setFlag(flag, true);
    scene.events.emit('showMessage', text, '#88ccff');
    return true;
  };

  // 首次升级 → 传承提示
  if (!ws.getFlag('hint_levelup')) {
    const fn = () => {
      hintOnce('hint_levelup', '按 X 打开传承，用悟道点习练术法');
      scene.events.off('levelUp', fn);
    };
    on('levelUp', fn);
  }

  // 首次气血过半 → 用药提示
  if (!ws.getFlag('hint_potion')) {
    const fn = (hp, maxHp) => {
      if (hp <= 0 || !maxHp || hp / maxHp >= 0.5) return;
      hintOnce('hint_potion', '气血告急——按 F1 服用回春散');
      scene.events.off('playerHpChanged', fn);
    };
    on('playerHpChanged', fn);
  }

  // 首次拾得装备 → 行囊提示
  if (!ws.getFlag('hint_loot')) {
    const fn = () => {
      const inv = scene.inventory;
      if (!inv?.slots?.some((s) => s && s.type === 'equipment')) return;
      hintOnce('hint_loot', '得了新器物——按 B 打开行囊装备它');
      scene.events.off('inventoryUpdated', fn);
    };
    on('inventoryUpdated', fn);
  }

  // 首次有敌人接近 → 攻击提示（轮询，触发后停表）
  if (!ws.getFlag('hint_attack')) {
    const timer = scene.time.addEvent({
      delay: 1000, loop: true,
      callback: () => {
        const p = scene.player?.sprite;
        if (!p) return;
        const near = (scene.enemies || []).some((e) => {
          const s = e?.sprite;
          return s?.active && Math.hypot(s.x - p.x, s.y - p.y) < 420;
        });
        if (near && hintOnce('hint_attack', '鼠标左键攻击 · 数字键 1-4 施展术法')) timer.remove();
      },
    });
    cleanups.push(() => timer.remove(false));
  }

  // ── 各幕接取时的方向指引 ──
  on('questActivated', (q) => {
    const dir = ACT_DIRECTIONS[q?.id];
    if (dir) {
      scene.time.delayedCall(900, () => scene.events.emit('showMessage', dir, '#c6a45f'));
    }
  });

  // ── 结局：鬼王败亡 → 灵潮平息演出 + 掉落镇界古印 ──
  on('bossDefeated', (enemy) => {
    if (enemy?.config?.id !== 'skeleton_king' || ws.getFlag('world_calm')) return;
    ws.setFlag('world_calm', true);
    const dropX = enemy.sprite?.x ?? scene.player?.sprite?.x ?? 0;
    const dropY = enemy.sprite?.y ?? scene.player?.sprite?.y ?? 0;
    scene.time.delayedCall(1500, () => {
      if (scene._worldDisposed) return;
      scene.cameras.main.flash(900, 235, 248, 238);
      scene.events.emit('showMessage', '阴煞灵潮正在退去……', '#85d3ad');
      _spawnSealPickup(scene, ws, dropX, dropY);
      scene.time.delayedCall(2200, () => scene.events.emit('showMessage', '拾取遗落的镇界古印', '#c6a45f'));
    });
  });

  // 读档兜底：鬼王已灭但尚未拾印/结局未播 → 在最近巢穴补生成古印
  if (ws.getFlag('world_calm') && !ws.getFlag('ending_done')) {
    const px = scene.player?.sprite?.x ?? 0;
    const py = scene.player?.sprite?.y ?? 0;
    const lair = KING_LAIRS.reduce((a, b) =>
      Math.hypot(a.x - px, a.y - py) <= Math.hypot(b.x - px, b.y - py) ? a : b);
    _spawnSealPickup(scene, ws, lair.x, lair.y);
    scene.time.delayedCall(1200, () =>
      scene.events.emit('showMessage', '镇界古印仍遗落在鬼王巢穴', '#c6a45f'));
  }

  // ── 结局序列：拾取古印（_spawnSealPickup 的 overlap 回调）后调用 ──
  scene.playEndingSequence = () => {
    if (scene._endingPlaying) return;
    scene._endingPlaying = true;
    scene.pauseGame('ending'); // 幂等：拾印时已暂停
    showStoryCard(scene, ENDING_LINES, { wakeUiAfter: false }).then(() => {
      // 通关状态写档（当前槽位），供「继续游历」post-game 读回
      const slot = scene.registry.get('activeSaveSlot') || 1;
      try { SaveSystem.save(scene, slot); } catch (e) { console.warn('[StoryArc] 通关写档失败', e); }
      scene.registry.set('lastVictorySlot', slot);
      scene._endingPlaying = false;
      scene.scene.stop('UIScene');
      scene.scene.start('VictoryScene');
    });
  };
  cleanups.push(() => { scene.playEndingSequence = null; });

  // ── 序章 ──
  const prologue = quests.quests.find((q) => q.id === 'ow_prologue');
  if (!ws.getFlag('prologue_done') && prologue && prologue.status === 'locked') {
    // 全新旅程：激活引导任务 + 开场字幕卡
    quests.acceptQuest('ow_prologue');
    scene.time.delayedCall(400, () => {
      if (scene._worldDisposed) return;
      scene.pauseGame('story');
      showStoryCard(scene, PROLOGUE_LINES).then(() => {
        scene.resumeGame('story');
        hintOnce('hint_move', 'WASD 移动 · E 与人交谈');
      });
    });
  }

  scene.events.once('shutdown', () => cleanups.forEach((fn) => fn()));
}
