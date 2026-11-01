import Phaser from 'phaser';
import { UI_THEME } from '../config/uiTheme.js';
import { BIOMES, getDifficultyAtChunk } from '../world/biomes/biomeConfig.js';
import { WORLD_LAYOUT } from '../world/WorldLayout.js';
import {
  WORLD_CHUNK_PX,
  WORLD_CONFIG,
  chunkTileToWorld,
} from '../world/worldConfig.js';

/**
 * 大地图场�� — 按 M 打开，展示 16×16 世界概览，可传送到已探索区域
 */
export class WorldMapScene extends Phaser.Scene {
  constructor() {
    super({ key: 'WorldMapScene' });
  }

  create() {
    this.gameScene = this.scene.get('MainGameScene');
    this._closing = false;
    const w = this.cameras.main.width;
    const h = this.cameras.main.height;

    // ─── 半透明遮罩 ─────────────────────────────────────
    this.overlay = this.add.rectangle(w / 2, h / 2, w, h, UI_THEME.colors.shadow, 0.86)
      .setInteractive();

    // ─── 地图参数 ────────────────────────────────────────
    const gridCount = WORLD_CONFIG.widthChunks;
    const cellSize = Math.min(Math.floor((h - 200) / gridCount), 40);
    const mapSize = cellSize * gridCount;
    const mapX = Math.floor((w - mapSize) / 2);
    const mapY = 80;
    this._map = { mapX, mapY, cellSize, gridCount, mapSize };

    // ─── 标题 ────────────────────────────────────────────
    this.add.text(w / 2, 30, '云荒舆图', {
      fontSize: '22px', fill: UI_THEME.text.brass, fontFamily: UI_THEME.font.display, fontStyle: 'bold'
    }).setOrigin(0.5);

    this.add.text(w / 2, 55, '点击已探索区域传送  |  M / ESC 关闭', {
      fontSize: '11px', fill: UI_THEME.text.muted, fontFamily: UI_THEME.font.body
    }).setOrigin(0.5);

    // ─── 地图底板 ────────────────────────────────────────
    this.add.rectangle(mapX - 4, mapY - 4, mapSize + 8, mapSize + 8, UI_THEME.colors.panel, 0.97)
      .setOrigin(0, 0).setStrokeStyle(2, UI_THEME.colors.border);

    // ─── 绘制 chunk 格子 ────────────────────────��───────
    this._drawGrid();

    // ─── 特殊地点标记 ────────────────────────────────────
    this._drawMarkers();

    // ─── 玩家当前位置 ────────────────────────────────────
    this._drawPlayerPos();

    // ─── 右侧信息面板 ────────────────────────────────────
    this._createInfoPanel();

    // ─── 底部图例 ────────────────────────────────────────
    this._drawLegend();

    // ─── 输入 ────────────────────────────────────────────
    this.mKey = this.input.keyboard.addKey(Phaser.Input.Keyboard.KeyCodes.M);
    this.mKey.once('down', () => this._close());
    this.escKey = this.input.keyboard.addKey(Phaser.Input.Keyboard.KeyCodes.ESC);
    this.escKey.once('down', () => this._close());
  }

  // ═══════════════════════════════════════════════════════════
  //  地图格子
  // ═══════════════════════════════════════════════════════════

  _drawGrid() {
    const { mapX, mapY, cellSize, gridCount } = this._map;
    const gen = this.gameScene?.worldGenerator;
    const ws = this.gameScene?.worldState;

    this._cells = [];

    for (let gy = 0; gy < gridCount; gy++) {
      for (let gx = 0; gx < gridCount; gx++) {
        const biomeId = gen ? gen.getBiome(gx, gy) : 'forest';
        const biomeInfo = BIOMES[biomeId];
        const color = biomeInfo?.color || UI_THEME.colors.panelRaised;
        const explored = ws?.exploredChunks?.has(`${gx},${gy}`);

        const cx = mapX + gx * cellSize;
        const cy = mapY + gy * cellSize;

        // 格子背景
        const cell = this.add.rectangle(cx, cy, cellSize - 1, cellSize - 1,
          color, explored ? 0.85 : 0.15)
          .setOrigin(0, 0);

        // 未探索覆盖问号图案
        let fogText = null;
        if (!explored) {
          fogText = this.add.text(cx + cellSize / 2, cy + cellSize / 2, '?', {
            fontSize: `${Math.max(8, cellSize - 8)}px`, fill: UI_THEME.text.disabled, fontFamily: UI_THEME.font.mono
          }).setOrigin(0.5).setAlpha(0.4);
        }

        // 只有已探索区域可点击传送
        if (explored) {
          cell.setInteractive({ useHandCursor: true });

          cell.on('pointerover', () => {
            cell.setStrokeStyle(2, UI_THEME.colors.jadeBright);
            this._showCellInfo(gx, gy, biomeId);
          });
          cell.on('pointerout', () => {
            cell.setStrokeStyle(0);
            this._clearCellInfo();
          });
          cell.on('pointerdown', () => {
            this._teleportTo(gx, gy);
          });
        }

        this._cells.push({ cell, gx, gy, explored, fogText });
      }
    }
  }

  // ═══════════════════════════════════════════════════════════
  //  特殊地点标记
  // ═══════════════════════════════════════════════════════════

  _drawMarkers() {
    const { mapX, mapY, cellSize } = this._map;
    const ws = this.gameScene?.worldState;

    // 特殊地点使用单字印记，避免不同平台的 emoji 字形差异。
    const town = WORLD_LAYOUT.town;
    this._addMarker(town.chunkX, town.chunkY, '镇', '城镇', UI_THEME.colors.paper);

    // 驿站
    for (const camp of WORLD_LAYOUT.camps) {
      const explored = ws?.exploredChunks?.has(`${camp.chunkX},${camp.chunkY}`);
      if (explored) {
        this._addMarker(camp.chunkX, camp.chunkY, '驿', '驿站', UI_THEME.colors.brass);
      }
    }

    // 首领地界
    for (const boss of WORLD_LAYOUT.bosses) {
      const explored = ws?.exploredChunks?.has(`${boss.chunkX},${boss.chunkY}`);
      const defeated = ws?.getFlag?.(`boss_${boss.bossType}_${boss.chunkX}_${boss.chunkY}_defeated`);
      if (explored) {
        const icon = defeated ? '平' : '煞';
        this._addMarker(
          boss.chunkX,
          boss.chunkY,
          icon,
          '首领',
          defeated ? UI_THEME.colors.disabled : UI_THEME.colors.cinnabarBright
        );
      }
    }
  }

  _addMarker(chunkX, chunkY, icon, label, tint) {
    const { mapX, mapY, cellSize } = this._map;
    const cx = mapX + chunkX * cellSize + cellSize / 2;
    const cy = mapY + chunkY * cellSize + cellSize / 2;

    const fontSize = Math.max(10, cellSize - 10);
    this.add.text(cx, cy, icon, {
      fontSize: `${fontSize}px`,
      fill: `#${tint.toString(16).padStart(6, '0')}`,
      fontFamily: UI_THEME.font.display,
      fontStyle: 'bold'
    }).setOrigin(0.5).setDepth(2);
  }

  // ═══════════════════════════════════════════════════════════
  //  玩家位置
  // ═══════════════════════════════════════════════════════════

  _drawPlayerPos() {
    const { mapX, mapY, cellSize, gridCount, mapSize } = this._map;
    const player = this.gameScene?.player;
    if (!player?.sprite) return;

    const px = player.sprite.x;
    const py = player.sprite.y;
    const fracX = (px / WORLD_CHUNK_PX) / gridCount;
    const fracY = (py / WORLD_CHUNK_PX) / gridCount;

    // 玉色闪烁点
    this._playerMarker = this.add.circle(
      mapX + fracX * mapSize,
      mapY + fracY * mapSize,
      5, UI_THEME.colors.jadeBright
    ).setDepth(3).setStrokeStyle(1, UI_THEME.colors.paper);

    this.tweens.add({
      targets: this._playerMarker,
      alpha: 0.3, duration: 500, yoyo: true, repeat: -1
    });

    // "你在这里" 标签
    this.add.text(
      mapX + fracX * mapSize,
      mapY + fracY * mapSize - 12,
      '▼ 你', {
        fontSize: '12px', fill: UI_THEME.text.jadeBright, fontFamily: UI_THEME.font.body, fontStyle: 'bold'
      }
    ).setOrigin(0.5).setDepth(3);
  }

  // ═══════════════════════════════════════════════════════════
  //  右侧信息面板
  // ═══════════════════════════════════════════════════════════

  _createInfoPanel() {
    const { mapX, mapY, mapSize } = this._map;
    const infoX = mapX + mapSize + 20;
    const infoY = mapY;

    // 探索统计
    const ws = this.gameScene?.worldState;
    const explored = ws?.exploredChunks?.size || 0;
    const total = WORLD_CONFIG.widthChunks * WORLD_CONFIG.heightChunks;
    const pct = Math.floor(explored / total * 100);

    this.add.text(infoX, infoY, '探索进度', {
      fontSize: '14px', fill: UI_THEME.text.brass, fontFamily: UI_THEME.font.display, fontStyle: 'bold'
    });

    this.add.text(infoX, infoY + 22, `${explored} / ${total} (${pct}%)`, {
      fontSize: '12px', fill: UI_THEME.text.paper, fontFamily: UI_THEME.font.mono
    });

    // 探索进度条
    const barW = 150, barH = 8;
    this.add.rectangle(infoX, infoY + 42, barW, barH, UI_THEME.colors.panel)
      .setOrigin(0, 0).setStrokeStyle(1, UI_THEME.colors.borderMuted);
    this.add.rectangle(infoX + 1, infoY + 43, Math.max(1, (barW - 2) * pct / 100), barH - 2, UI_THEME.colors.jade)
      .setOrigin(0, 0);

    // 悬停信息区
    this._infoTitle = this.add.text(infoX, infoY + 70, '', {
      fontSize: '14px', fill: UI_THEME.text.paper, fontFamily: UI_THEME.font.body, fontStyle: 'bold'
    });
    this._infoBiome = this.add.text(infoX, infoY + 90, '', {
      fontSize: '11px', fill: UI_THEME.text.muted, fontFamily: UI_THEME.font.body
    });
    this._infoDiff = this.add.text(infoX, infoY + 108, '', {
      fontSize: '11px', fill: UI_THEME.text.muted, fontFamily: UI_THEME.font.body
    });
    this._infoHint = this.add.text(infoX, infoY + 130, '', {
      fontSize: '10px', fill: UI_THEME.text.jade, fontFamily: UI_THEME.font.body
    });

    // 传送点列表
    this.add.text(infoX, infoY + 170, '挪移阵', {
      fontSize: '13px', fill: UI_THEME.text.brass, fontFamily: UI_THEME.font.display, fontStyle: 'bold'
    });

    let btnY = infoY + 195;
    // 城镇 (始终可用)
    this._addTeleportBtn(infoX, btnY, '镇 · 城镇中心', WORLD_LAYOUT.town.chunkX, WORLD_LAYOUT.town.chunkY, true);
    btnY += 30;

    // 营地
    for (let i = 0; i < WORLD_LAYOUT.camps.length; i++) {
      const camp = WORLD_LAYOUT.camps[i];
      const unlocked = ws?.exploredChunks?.has(`${camp.chunkX},${camp.chunkY}`);
      const names = ['西北营地', '东北营地', '西南营地', '东南营地'];
      this._addTeleportBtn(infoX, btnY, `驿 · ${names[i]}`, camp.chunkX, camp.chunkY, unlocked);
      btnY += 30;
    }

    // Boss 区域
    for (let i = 0; i < WORLD_LAYOUT.bosses.length; i++) {
      const boss = WORLD_LAYOUT.bosses[i];
      const unlocked = ws?.exploredChunks?.has(`${boss.chunkX},${boss.chunkY}`);
      const names = ['西北首领', '东北首领', '西南首领', '东南首领'];
      this._addTeleportBtn(infoX, btnY, `煞 · ${names[i]}`, boss.chunkX, boss.chunkY, unlocked);
      btnY += 30;
    }
  }

  _addTeleportBtn(x, y, label, chunkX, chunkY, unlocked) {
    const bg = this.add.rectangle(
      x,
      y,
      160,
      24,
      unlocked ? UI_THEME.colors.panelRaised : UI_THEME.colors.backdrop,
      0.92
    )
      .setOrigin(0, 0)
      .setStrokeStyle(1, unlocked ? UI_THEME.colors.border : UI_THEME.colors.borderMuted);

    this.add.text(x + 8, y + 4, unlocked ? label : '未探', {
      fontSize: '11px',
      fill: unlocked ? UI_THEME.text.paper : UI_THEME.text.disabled,
      fontFamily: UI_THEME.font.body
    });

    if (unlocked) {
      bg.setInteractive({ useHandCursor: true });
      bg.on('pointerover', () => bg.setFillStyle(UI_THEME.colors.panelHover));
      bg.on('pointerout', () => bg.setFillStyle(UI_THEME.colors.panelRaised));
      bg.on('pointerdown', () => this._teleportTo(chunkX, chunkY));
    }
  }

  // ═══════════════════════════════════════════════════════════
  //  悬停信息
  // ═══════════════════════════════════════════════════════════

  _showCellInfo(gx, gy, biomeId) {
    const biomeInfo = BIOMES[biomeId];
    const diff = getDifficultyAtChunk(gx, gy);
    const diffStr = diff < 0.3 ? '安全' : diff < 0.6 ? '普通' : diff < 0.85 ? '危险' : '极危';
    const diffColor = diff < 0.3
      ? UI_THEME.text.jadeBright
      : diff < 0.6
        ? UI_THEME.text.brass
        : diff < 0.85
          ? UI_THEME.text.cinnabarBright
          : UI_THEME.text.cinnabar;

    this._infoTitle.setText(`(${gx}, ${gy})`);
    this._infoBiome.setText(`区域: ${biomeInfo?.name || biomeId}`);
    this._infoDiff.setText(`难度: ${diffStr}`).setColor(diffColor);

    // 检查特殊地点
    let special = '';
    const town = WORLD_LAYOUT.town;
    if (gx === town.chunkX && gy === town.chunkY) special = '城镇中心 — 安全区域';
    for (const camp of WORLD_LAYOUT.camps) {
      if (gx === camp.chunkX && gy === camp.chunkY) special = '营地 — 有篝火和商人';
    }
    for (const boss of WORLD_LAYOUT.bosses) {
      if (gx === boss.chunkX && gy === boss.chunkY) special = `Boss 区域 — ${boss.bossType}`;
    }
    this._infoHint.setText(special || '点击传送到此区域');
  }

  _clearCellInfo() {
    this._infoTitle.setText('');
    this._infoBiome.setText('');
    this._infoDiff.setText('');
    this._infoHint.setText('');
  }

  // ═══════════════════════════════════════════════════════════
  //  图例
  // ═══════════════════════════════════════════════════════════

  _drawLegend() {
    const { mapX, mapY, mapSize } = this._map;
    const y = mapY + mapSize + 15;
    let x = mapX;

    const biomeList = ['forest', 'ruins', 'snow', 'desert', 'swamp', 'volcano'];
    for (const id of biomeList) {
      const info = BIOMES[id];
      this.add.rectangle(x, y, 12, 12, info.color, 0.85).setOrigin(0, 0);
      this.add.text(x + 16, y, info.name, {
        fontSize: '10px', fill: UI_THEME.text.muted, fontFamily: UI_THEME.font.body
      });
      x += 90;
    }
  }

  // ═══════════════════════════════════════════════════════════
  //  传送
  // ═══════════════════════════════════════════════════════════

  _teleportTo(chunkX, chunkY) {
    const player = this.gameScene?.player;
    if (!player?.sprite) return;

    const gen = this.gameScene.worldGenerator;
    const safeTile = gen?.findNearestWalkableTile?.(chunkX, chunkY, 16, 16);
    if (!safeTile) {
      this.gameScene.events.emit(
        'showMessage',
        `无法传送到 (${chunkX}, ${chunkY})：没有安全落点`,
        UI_THEME.text.cinnabarBright
      );
      return;
    }

    // 目标世界坐标（最近可行走 tile 的中心）
    const { x: destX, y: destY } = chunkTileToWorld(
      chunkX, chunkY, safeTile.localX, safeTile.localY
    );

    // 1. 传送玩家
    player.sprite.setPosition(destX, destY);
    player.sprite.setVelocity(0, 0);
    if (player.sprite.body) {
      player.sprite.body.reset(destX, destY);
      player.sprite.body.setVelocity(0, 0);
    }
    player.canInteract = false;
    player.interactTarget = null;

    const companion = this.gameScene.companionManager?.getActiveNpc?.();
    if (companion?.sprite) {
      const cx = destX + 24;
      const cy = destY + 24;
      companion.sprite.setPosition(cx, cy);
      companion.sprite.setVelocity?.(0, 0);
      if (companion.sprite.body) {
        companion.sprite.body.reset(cx, cy);
        companion.sprite.body.setVelocity(0, 0);
      }
    }

    // 2. ChunkManager 统一卸载旧世界，并同步加载目标 chunk。
    if (this.gameScene.chunkManager) {
      this.gameScene.chunkManager.teleportReset(destX, destY);
    }

    this.gameScene.cameras.main.centerOn(destX, destY);

    // 显示传送提示
    this.gameScene.events.emit('showMessage', `已传送到 (${chunkX}, ${chunkY})`);

    this._close();
  }

  // ═══════════════════════════════════════════════════════════
  //  关闭
  // ═══════════════════════════════════════════════════════════

  _close() {
    if (this._closing) return;
    this._closing = true;
    if (this.gameScene) {
      this.gameScene._worldMapInputLockUntil = this.gameScene.time.now + 250;
    }
    this.scene.stop('WorldMapScene');
    if (this.gameScene?.resumeGame) {
      this.gameScene.resumeGame('world-map');
    }
  }
}
