import Phaser from 'phaser';
import { BIOMES, getDifficultyAtChunk, WORLD_CENTER } from '../world/biomes/biomeConfig.js';
import { WORLD_LAYOUT } from '../world/WorldLayout.js';

/**
 * 大地图场�� — 按 M 打开，展示 16×16 世界概览，可传送到已探索区域
 */
export class WorldMapScene extends Phaser.Scene {
  constructor() {
    super({ key: 'WorldMapScene' });
  }

  create() {
    this.gameScene = this.scene.get('MainGameScene');
    const w = this.cameras.main.width;
    const h = this.cameras.main.height;

    // ─── 半透明遮罩 ─────────────────────────────────────
    this.overlay = this.add.rectangle(w / 2, h / 2, w, h, 0x000000, 0.75)
      .setInteractive();

    // ─── 地图参数 ────────────────────────────────────────
    const gridCount = 16;
    const cellSize = Math.min(Math.floor((h - 200) / gridCount), 40);
    const mapSize = cellSize * gridCount;
    const mapX = Math.floor((w - mapSize) / 2);
    const mapY = 80;
    this._map = { mapX, mapY, cellSize, gridCount, mapSize };

    // ─── 标题 ────────────────────────────────────────────
    this.add.text(w / 2, 30, '世界地图', {
      fontSize: '22px', fill: '#ffd700', fontFamily: 'Courier New', fontStyle: 'bold'
    }).setOrigin(0.5);

    this.add.text(w / 2, 55, '点击已探索区域传送  |  M / ESC 关闭', {
      fontSize: '11px', fill: '#888888', fontFamily: 'Courier New'
    }).setOrigin(0.5);

    // ─── 地图底板 ────────────────────────────────────────
    this.add.rectangle(mapX - 4, mapY - 4, mapSize + 8, mapSize + 8, 0x111122, 0.95)
      .setOrigin(0, 0).setStrokeStyle(2, 0x4444aa);

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
    const mKey = this.input.keyboard.addKey(Phaser.Input.Keyboard.KeyCodes.M);
    mKey.on('down', () => this._close());
    const escKey = this.input.keyboard.addKey(Phaser.Input.Keyboard.KeyCodes.ESC);
    escKey.on('down', () => this._close());
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
        const color = biomeInfo?.color || 0x333333;
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
            fontSize: `${Math.max(8, cellSize - 8)}px`, fill: '#333344', fontFamily: 'Courier New'
          }).setOrigin(0.5).setAlpha(0.4);
        }

        // 只有已探索区域可点击传送
        if (explored) {
          cell.setInteractive({ useHandCursor: true });

          cell.on('pointerover', () => {
            cell.setStrokeStyle(2, 0xffffff);
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

    // 城镇 — 白色房子图标
    const town = WORLD_LAYOUT.town;
    this._addMarker(town.chunkX, town.chunkY, '🏠', '城镇', 0xffffff);

    // 营地 — 黄色帐篷图标
    for (const camp of WORLD_LAYOUT.camps) {
      const explored = ws?.exploredChunks?.has(`${camp.chunkX},${camp.chunkY}`);
      if (explored) {
        this._addMarker(camp.chunkX, camp.chunkY, '⛺', '营地', 0xffdd44);
      }
    }

    // Boss — 红色骷髅图标
    for (const boss of WORLD_LAYOUT.bosses) {
      const explored = ws?.exploredChunks?.has(`${boss.chunkX},${boss.chunkY}`);
      const defeated = ws?.getFlag?.(`boss_${boss.bossType}_${boss.chunkX}_${boss.chunkY}_defeated`);
      if (explored) {
        const icon = defeated ? '💀' : '👹';
        this._addMarker(boss.chunkX, boss.chunkY, icon, 'Boss', defeated ? 0x666666 : 0xff3333);
      }
    }
  }

  _addMarker(chunkX, chunkY, icon, label, tint) {
    const { mapX, mapY, cellSize } = this._map;
    const cx = mapX + chunkX * cellSize + cellSize / 2;
    const cy = mapY + chunkY * cellSize + cellSize / 2;

    const fontSize = Math.max(10, cellSize - 10);
    this.add.text(cx, cy, icon, {
      fontSize: `${fontSize}px`
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
    const fracX = (px / 1024) / gridCount;
    const fracY = (py / 1024) / gridCount;

    // 绿色闪烁点
    this._playerMarker = this.add.circle(
      mapX + fracX * mapSize,
      mapY + fracY * mapSize,
      5, 0x00ff00
    ).setDepth(3).setStrokeStyle(1, 0xffffff);

    this.tweens.add({
      targets: this._playerMarker,
      alpha: 0.3, duration: 500, yoyo: true, repeat: -1
    });

    // "你在这里" 标签
    this.add.text(
      mapX + fracX * mapSize,
      mapY + fracY * mapSize - 12,
      '▼ 你', {
        fontSize: '9px', fill: '#00ff00', fontFamily: 'Courier New', fontStyle: 'bold'
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
    const total = 256;
    const pct = Math.floor(explored / total * 100);

    this.add.text(infoX, infoY, '探索进度', {
      fontSize: '14px', fill: '#ffd700', fontFamily: 'Courier New', fontStyle: 'bold'
    });

    this.add.text(infoX, infoY + 22, `${explored} / ${total} (${pct}%)`, {
      fontSize: '12px', fill: '#cccccc', fontFamily: 'Courier New'
    });

    // 探索进度条
    const barW = 150, barH = 8;
    this.add.rectangle(infoX, infoY + 42, barW, barH, 0x333333)
      .setOrigin(0, 0).setStrokeStyle(1, 0x555555);
    this.add.rectangle(infoX + 1, infoY + 43, Math.max(1, (barW - 2) * pct / 100), barH - 2, 0x44aa44)
      .setOrigin(0, 0);

    // 悬停信息区
    this._infoTitle = this.add.text(infoX, infoY + 70, '', {
      fontSize: '14px', fill: '#ffffff', fontFamily: 'Courier New', fontStyle: 'bold'
    });
    this._infoBiome = this.add.text(infoX, infoY + 90, '', {
      fontSize: '11px', fill: '#aaaaaa', fontFamily: 'Courier New'
    });
    this._infoDiff = this.add.text(infoX, infoY + 108, '', {
      fontSize: '11px', fill: '#aaaaaa', fontFamily: 'Courier New'
    });
    this._infoHint = this.add.text(infoX, infoY + 130, '', {
      fontSize: '10px', fill: '#66aaff', fontFamily: 'Courier New'
    });

    // 传送点列表
    this.add.text(infoX, infoY + 170, '快速传送', {
      fontSize: '13px', fill: '#ffd700', fontFamily: 'Courier New', fontStyle: 'bold'
    });

    let btnY = infoY + 195;
    // 城镇 (始终可用)
    this._addTeleportBtn(infoX, btnY, '🏠 城镇中心', WORLD_LAYOUT.town.chunkX, WORLD_LAYOUT.town.chunkY, true);
    btnY += 30;

    // 营地
    for (let i = 0; i < WORLD_LAYOUT.camps.length; i++) {
      const camp = WORLD_LAYOUT.camps[i];
      const unlocked = ws?.exploredChunks?.has(`${camp.chunkX},${camp.chunkY}`);
      const names = ['西北营地', '东北营地', '西南营地', '东南营地'];
      this._addTeleportBtn(infoX, btnY, `⛺ ${names[i]}`, camp.chunkX, camp.chunkY, unlocked);
      btnY += 30;
    }

    // Boss 区域
    for (let i = 0; i < WORLD_LAYOUT.bosses.length; i++) {
      const boss = WORLD_LAYOUT.bosses[i];
      const unlocked = ws?.exploredChunks?.has(`${boss.chunkX},${boss.chunkY}`);
      const names = ['西北Boss', '东北Boss', '西南Boss', '东南Boss'];
      this._addTeleportBtn(infoX, btnY, `👹 ${names[i]}`, boss.chunkX, boss.chunkY, unlocked);
      btnY += 30;
    }
  }

  _addTeleportBtn(x, y, label, chunkX, chunkY, unlocked) {
    const bg = this.add.rectangle(x, y, 160, 24, unlocked ? 0x1a2a3a : 0x1a1a1a, 0.9)
      .setOrigin(0, 0)
      .setStrokeStyle(1, unlocked ? 0x4488aa : 0x333333);

    const txt = this.add.text(x + 8, y + 4, unlocked ? label : '🔒 未探索', {
      fontSize: '11px',
      fill: unlocked ? '#ccddee' : '#555555',
      fontFamily: 'Courier New'
    });

    if (unlocked) {
      bg.setInteractive({ useHandCursor: true });
      bg.on('pointerover', () => bg.setFillStyle(0x2a3a5a));
      bg.on('pointerout', () => bg.setFillStyle(0x1a2a3a));
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
    const diffColor = diff < 0.3 ? '#44ff44' : diff < 0.6 ? '#ffff44' : diff < 0.85 ? '#ff8844' : '#ff4444';

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
        fontSize: '10px', fill: '#aaaaaa', fontFamily: 'Courier New'
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

    // 目标世界坐标（chunk 中心）
    const destX = chunkX * 1024 + 512;
    const destY = chunkY * 1024 + 512;

    // 1. 清理所有实体 GameObjects
    if (this.gameScene._despawnAllWorldEntities) {
      this.gameScene._despawnAllWorldEntities();
    }

    // 2. 传送玩家
    player.sprite.setPosition(destX, destY);

    // 3. 销毁旧 chunk 并在新位置同步加载（包括实体生成）
    if (this.gameScene.chunkManager) {
      this.gameScene.chunkManager.teleportReset(destX, destY);
    }

    // 4. 通知 UI 更新区域名
    const gen = this.gameScene.worldGenerator;
    if (gen) {
      const biome = gen.getBiome(chunkX, chunkY);
      const biomeCfg = BIOMES[biome];
      this.gameScene.events.emit('levelChanged', biomeCfg?.name || biome, 0);
    }

    // 显示传送提示
    this.gameScene.events.emit('showMessage', `已传送到 (${chunkX}, ${chunkY})`);

    this._close();
  }

  // ═══════════════════════════════════════════════════════════
  //  关闭
  // ═══════════════════════════════════════════════════════════

  _close() {
    this.scene.stop('WorldMapScene');
    if (this.gameScene?.resumeGame) {
      this.gameScene.resumeGame();
    }
  }
}
