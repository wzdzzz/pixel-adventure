import Phaser from 'phaser';
import { TEXTURES } from '../assets/AssetManager.js';
import { Tooltip } from '../ui/Tooltip.js';

export class UIScene extends Phaser.Scene {
  constructor() {
    super({ key: 'UIScene' });
  }

  create() {
    this.gameScene = this.scene.get('MainGameScene');

    // 固定画布尺寸，不再做 UI 缩放
    this._uiW = this.scale.gameSize.width;
    this._uiH = this.scale.gameSize.height;

    this.createHUD();
    this.createHealthBar();
    this.createScoreDisplay();
    this.createKeyDisplay();
    this.createGoldDisplay();
    this.createLevelDisplay();
    this.createControlsHint();
    this.createSkillBar();
    this.createBuffBar();
    this.tooltip = new Tooltip(this, { delay: 500 });
    this.attachSkillSlotTooltips();
    this.attachBuffSlotTooltips();
    this.setupEvents();
    this.createQuestTracker();

    // Listen for resize events to reposition all HUD elements
    this.scale.on('resize', this.onResize, this);

    // Cleanup all external listeners when the scene shuts down
    this.events.on('shutdown', () => {
      this.scale.off('resize', this.onResize, this);
      // 移除挂在 MainGameScene 事件上的监听，防止场景重启时引用已销毁的 UI 对象
      if (this.gameScene) {
        this.gameScene.events.off('playerHpChanged');
        this.gameScene.events.off('playerResourceChanged');
        this.gameScene.events.off('scoreChanged');
        this.gameScene.events.off('keysChanged');
        this.gameScene.events.off('levelChanged');
        this.gameScene.events.off('xpChanged');
        this.gameScene.events.off('levelUp');
        this.gameScene.events.off('goldChanged');
        this.gameScene.events.off('questActivated');
        this.gameScene.events.off('questProgressUpdated');
        this.gameScene.events.off('questCompleted');
        this.gameScene.events.off('skillSlotsChanged');
      }
    });
  }

  createHUD() {
    const width = this._uiW;
    const height = this._uiH;

    this.hudBg = this.add.rectangle(0, 0, width, 70, 0x000000, 0.7).setOrigin(0, 0);
    this.bottomBar = this.add.rectangle(0, height - 30, width, 30, 0x000000, 0.5).setOrigin(0, 0);

    this.hudBg.setDepth(1);
    this.bottomBar.setDepth(1);
  }

  createHealthBar() {
    // HP
    this.heartIcon = this.add.image(20, 18, TEXTURES.HEART).setScale(0.8).setDepth(2);
    this.hpBarBg = this.add.rectangle(50, 18, 150, 12, 0x333333).setOrigin(0, 0.5).setDepth(2);
    this.hpBarBg.setStrokeStyle(1, 0x666666);
    this.hpGhost = this.add.rectangle(51, 18, 148, 10, 0xffffff, 0.4).setOrigin(0, 0.5).setDepth(2.5);
    this.hpBar = this.add.rectangle(51, 18, 148, 10, 0x00ff00).setOrigin(0, 0.5).setDepth(3);
    this.hpText = this.add.text(210, 18, '100/100', {
      fontSize: '12px',
      fill: '#ffffff',
      fontFamily: 'Courier New'
    }).setOrigin(0, 0.5).setDepth(3);

    // Level display next to HP bar
    this.playerLevelText = this.add.text(210, 8, 'LV.1', {
      fontSize: '11px', fill: '#ffd700', fontFamily: 'Courier New', fontStyle: 'bold'
    }).setOrigin(0, 0.5).setDepth(3);

    // Stamina bar (replaces MP) - yellow
    this.staminaBarBg = this.add.rectangle(50, 35, 150, 10, 0x333333).setOrigin(0, 0.5).setDepth(2);
    this.staminaBarBg.setStrokeStyle(1, 0x444433);
    this.staminaBar = this.add.rectangle(51, 35, 148, 8, 0xddcc00).setOrigin(0, 0.5).setDepth(3);
    this.staminaText = this.add.text(210, 35, '140/140', {
      fontSize: '11px',
      fill: '#ddcc44',
      fontFamily: 'Courier New'
    }).setOrigin(0, 0.5).setDepth(3);

    // Rage bar - red, below stamina
    this.rageBarBg = this.add.rectangle(50, 48, 150, 8, 0x333333).setOrigin(0, 0.5).setDepth(2);
    this.rageBarBg.setStrokeStyle(1, 0x443333);
    this.rageBar = this.add.rectangle(51, 48, 0, 6, 0xff3333).setOrigin(0, 0.5).setDepth(3);
    this.rageText = this.add.text(210, 48, '0/100', {
      fontSize: '9px',
      fill: '#ff6644',
      fontFamily: 'Courier New'
    }).setOrigin(0, 0.5).setDepth(3);

    // XP bar (moved down)
    this.xpBarBg = this.add.rectangle(50, 58, 150, 6, 0x222233).setOrigin(0, 0.5).setDepth(2);
    this.xpBarBg.setStrokeStyle(1, 0x333344);
    this.xpBar = this.add.rectangle(51, 58, 0, 4, 0x9966ff).setOrigin(0, 0.5).setDepth(3);
    this.xpText = this.add.text(210, 58, 'XP: 0/40', {
      fontSize: '9px', fill: '#9988cc', fontFamily: 'Courier New'
    }).setOrigin(0, 0.5).setDepth(3);
  }

  createScoreDisplay() {
    const width = this._uiW;

    this.scoreLabelText = this.add.text(width / 2, 15, '分数', {
      fontSize: '12px',
      fill: '#aaaaaa',
      fontFamily: 'Courier New'
    }).setOrigin(0.5).setDepth(2);

    this.scoreText = this.add.text(width / 2, 32, '0', {
      fontSize: '18px',
      fill: '#ffff00',
      fontFamily: 'Courier New'
    }).setOrigin(0.5).setDepth(2);
  }

  createKeyDisplay() {
    const width = this._uiW;

    this.keyIcon = this.add.image(width - 200, 25, TEXTURES.KEY).setScale(0.8).setDepth(2);
    this.keyText = this.add.text(width - 180, 25, 'x0', {
      fontSize: '14px',
      fill: '#ff69b4',
      fontFamily: 'Courier New'
    }).setOrigin(0, 0.5).setDepth(2);
  }

  createGoldDisplay() {
    const width = this._uiW;
    this.goldText = this.add.text(width - 200, 40, '💰 0', {
      fontSize: '11px', fill: '#ffd700', fontFamily: 'Courier New'
    }).setDepth(2);
  }

  createLevelDisplay() {
    const width = this._uiW;

    this.levelText = this.add.text(width - 80, 25, '第一关', {
      fontSize: '12px',
      fill: '#7c4dff',
      fontFamily: 'Courier New'
    }).setOrigin(0.5, 0.5).setDepth(2);
  }

  createControlsHint() {
    const width = this._uiW;
    const height = this._uiH;

    this.controlsText = this.add.text(width / 2, height - 15, 'WASD:移动 | 左键:攻击 | 1-4:技能 | E:交互 | TAB:面板 | F:全屏', {
      fontSize: '12px',
      fill: '#888888',
      fontFamily: 'Courier New'
    }).setOrigin(0.5).setDepth(2);
  }

  createSkillBar() {
    const width = this._uiW;
    const height = this._uiH;
    const slotSize = 36;
    const gap = 6;
    const totalW = 4 * slotSize + 3 * gap;
    const startX = width / 2 - totalW / 2;
    const slotY = height - 52; // above bottom bar

    this.skillSlots = [];

    // Read skill slots and defs from the player dynamically
    const player = this.gameScene?.player;
    const playerSlots = player?.skillSlots || [null, null, null, null];
    const skillDefs = player?.skillEngine?.getSkillDefs() || {};

    for (let i = 0; i < 4; i++) {
      const x = startX + i * (slotSize + gap) + slotSize / 2;
      const skillId = playerSlots[i];
      const base = skillId ? skillDefs[skillId] : null;

      // Slot background
      const bg = this.add.rectangle(x, slotY, slotSize, slotSize, 0x1a1a2e, 0.85)
        .setStrokeStyle(1, base ? 0x5a5a8a : 0x333344).setDepth(4);

      // Skill icon text
      const icon = this.add.text(x, slotY - 2, base ? base.icon : '', {
        fontSize: '16px', fontFamily: 'Courier New'
      }).setOrigin(0.5).setDepth(5);

      // Key label
      const keyLabel = this.add.text(x - slotSize / 2 + 3, slotY - slotSize / 2 + 1, `${i + 1}`, {
        fontSize: '8px', fill: '#aaaaaa', fontFamily: 'Courier New'
      }).setDepth(6);

      // Cooldown overlay (darkening rectangle)
      const cdOverlay = this.add.rectangle(x, slotY, slotSize - 2, 0, 0x000000, 0.6)
        .setOrigin(0.5, 1).setDepth(5.5);

      // Cooldown text
      const cdText = this.add.text(x, slotY + 2, '', {
        fontSize: '10px', fill: '#ff6666', fontFamily: 'Courier New', fontStyle: 'bold'
      }).setOrigin(0.5).setDepth(6).setVisible(false);

      // Level text
      const lvText = this.add.text(x + slotSize / 2 - 2, slotY + slotSize / 2 - 2, '', {
        fontSize: '7px', fill: '#aaccff', fontFamily: 'Courier New'
      }).setOrigin(1, 1).setDepth(6);

      this.skillSlots.push({ bg, icon, keyLabel, cdOverlay, cdText, lvText, skillId, x, y: slotY, size: slotSize });
    }
  }

  /** 给技能栏 4 槽位绑 tooltip：内容动态读 player.skillEngine */
  attachSkillSlotTooltips() {
    if (!this.skillSlots || !this.tooltip) return;
    this.skillSlots.forEach((slot, i) => {
      slot.bg.setInteractive({ useHandCursor: false });
      this.tooltip.attach(slot.bg, () => {
        const player = this.gameScene?.player;
        const id = slot.skillId;
        if (!player || !id) return null;
        const engine = player.skillEngine;
        const skill = engine.getScaledSkill(id);
        if (!skill) return null;
        const level = engine.getSkillLevel(id);
        const desc = player._skillModule?.getSkillDescription?.(id, level) || skill.description || '';
        const cdSec = (skill.cooldown / 1000).toFixed(1);
        const resourceLabels = { stamina: '体力', rage: '怒气', mana: '魔力', none: '' };
        const r = resourceLabels[skill.resource] || '';
        const costLine = skill.resource === 'none'
          ? `冷却: ${cdSec}s`
          : `冷却: ${cdSec}s   ${r}: ${skill.cost}`;
        return {
          title: `${skill.icon || ''} ${skill.name}  Lv.${level}/${skill.maxLevel}`,
          body: `${desc}\n${costLine}`
        };
      });
    });
  }

  /** 给 buff 栏 8 槽位绑 tooltip：内容动态读 player.statusEffects */
  attachBuffSlotTooltips() {
    if (!this.buffSlots || !this.tooltip) return;
    this.buffSlots.forEach((slot, i) => {
      slot.bg.setInteractive({ useHandCursor: false });
      this.tooltip.attach(slot.bg, () => {
        const player = this.gameScene?.player;
        if (!player || !slot.bg.visible) return null;
        const list = player.statusEffects?.getActiveSummary() || [];
        const b = list[i];
        if (!b) return null;
        const sec = (b.remaining / 1000).toFixed(1);
        const stacksLine = b.stacks > 1 ? `  ×${b.stacks}` : '';
        return {
          title: `${b.icon || ''} ${b.name}${stacksLine}`,
          body: `${b.description || ''}\n剩余: ${sec}s`
        };
      });
    });
  }

  /** 槽位变更时刷新图标和 skillId（不重建容器） */
  refreshSkillSlots() {
    if (!this.skillSlots) return;
    const player = this.gameScene?.player;
    const playerSlots = player?.skillSlots || [null, null, null, null];
    const skillDefs = player?.skillEngine?.getSkillDefs() || {};
    this.skillSlots.forEach((slot, i) => {
      const id = playerSlots[i] || null;
      const base = id ? skillDefs[id] : null;
      slot.skillId = id;
      slot.icon.setText(base ? base.icon : '');
      slot.bg.setStrokeStyle(1, base ? 0x5a5a8a : 0x333344);
      // 清除冷却显示（旧技能的冷却状态不再适用）
      slot.cdOverlay.setSize(slot.size - 2, 0);
      slot.cdText.setVisible(false);
      slot.lvText.setText('');
    });
  }

  createBuffBar() {
    // 池：最多 8 个 buff 同时显示
    this.buffSlots = [];
    this.buffSlotMax = 8;
    this.buffIconSize = 28;
    for (let i = 0; i < this.buffSlotMax; i++) {
      const bg = this.add.rectangle(0, 0, this.buffIconSize, this.buffIconSize, 0x1a1a2e, 0.85)
        .setStrokeStyle(1, 0x66ff88).setDepth(4).setVisible(false);
      const icon = this.add.text(0, 0, '', {
        fontSize: '16px', fontFamily: 'Courier New'
      }).setOrigin(0.5).setDepth(5).setVisible(false);
      const time = this.add.text(0, 0, '', {
        fontSize: '9px', color: '#ffffff', fontFamily: 'Courier New',
        fontStyle: 'bold', stroke: '#000000', strokeThickness: 2
      }).setOrigin(0.5, 0.5).setDepth(6).setVisible(false);
      const stacks = this.add.text(0, 0, '', {
        fontSize: '9px', color: '#ffdd44', fontFamily: 'Courier New',
        fontStyle: 'bold', stroke: '#000000', strokeThickness: 2
      }).setOrigin(1, 0).setDepth(6).setVisible(false);
      this.buffSlots.push({ bg, icon, time, stacks });
    }
  }

  updateBuffBar() {
    if (!this.buffSlots) return;
    const player = this.gameScene?.player;
    const list = player?.statusEffects?.getActiveSummary() || [];
    const visible = list.slice(0, this.buffSlotMax);

    const width = this._uiW;
    const height = this._uiH;
    const size = this.buffIconSize;
    const gap = 4;
    const totalW = visible.length * size + Math.max(0, visible.length - 1) * gap;
    const startX = width / 2 - totalW / 2 + size / 2;
    const y = height - 92; // 在技能栏上方

    this.buffSlots.forEach((slot, i) => {
      if (i < visible.length) {
        const b = visible[i];
        const x = startX + i * (size + gap);
        slot.bg.setPosition(x, y).setVisible(true);
        // 按类型上色：buff 绿、debuff 红、其他黄
        if (b.type === 'debuff' || b.type === 'dot') {
          slot.bg.setStrokeStyle(1, 0xff6666);
        } else if (b.type === 'buff') {
          slot.bg.setStrokeStyle(1, 0x66ff88);
        } else {
          slot.bg.setStrokeStyle(1, 0xffdd44);
        }
        slot.icon.setPosition(x, y - 2).setText(b.icon || '✨').setVisible(true);
        // 倒计时（秒）— 内嵌在图标底部
        const sec = Math.max(0, b.remaining / 1000);
        slot.time.setPosition(x, y + size / 2 - 5)
          .setText(sec >= 10 ? `${Math.floor(sec)}` : sec.toFixed(1))
          .setVisible(true);
        // 叠加层数
        if (b.stacks > 1) {
          slot.stacks.setPosition(x + size / 2 - 2, y - size / 2 + 1)
            .setText(`x${b.stacks}`).setVisible(true);
        } else {
          slot.stacks.setVisible(false);
        }
      } else {
        slot.bg.setVisible(false);
        slot.icon.setVisible(false);
        slot.time.setVisible(false);
        slot.stacks.setVisible(false);
      }
    });
  }

  onResize(gameSize) {
    // Update camera size & 重算 UI 缩放
    this.cameras.main.setSize(gameSize.width, gameSize.height);
    this._uiW = gameSize.width;
    this._uiH = gameSize.height;
    const width = this._uiW;
    const height = this._uiH;

    // Top bar: full width
    this.hudBg.setPosition(0, 0);
    this.hudBg.setSize(width, 70);

    // Bottom bar: full width, anchored to bottom
    this.bottomBar.setPosition(0, height - 30);
    this.bottomBar.setSize(width, 30);

    // HP/MP bars: top-left, fixed offset (20, 18) — no change needed for these
    // (heartIcon, hpBarBg, hpBar, hpText, mpBarBg, mpBar, mpText stay at fixed left positions)

    // Score: top-center
    this.scoreLabelText.setPosition(width / 2, 15);
    this.scoreText.setPosition(width / 2, 32);

    // Keys: top-right
    this.keyIcon.setPosition(width - 200, 25);
    this.keyText.setPosition(width - 180, 25);

    // Level name: top-right
    this.levelText.setPosition(width - 80, 25);

    // Controls hint: bottom-center
    this.controlsText.setPosition(width / 2, height - 15);

    // Skill bar: bottom-center above controls
    if (this.skillSlots) {
      const slotSize = 36;
      const gap = 6;
      const totalW = 4 * slotSize + 3 * gap;
      const startX = width / 2 - totalW / 2;
      const slotY = height - 52;

      this.skillSlots.forEach((slot, i) => {
        const x = startX + i * (slotSize + gap) + slotSize / 2;
        slot.x = x;
        slot.y = slotY;
        slot.bg.setPosition(x, slotY);
        slot.icon.setPosition(x, slotY - 2);
        slot.keyLabel.setPosition(x - slotSize / 2 + 3, slotY - slotSize / 2 + 1);
        slot.cdOverlay.setPosition(x, slotY + (slotSize - 2) / 2);
        slot.cdText.setPosition(x, slotY + 2);
        slot.lvText.setPosition(x + slotSize / 2 - 2, slotY + slotSize / 2 - 2);
      });
    }

    // Gold display
    if (this.goldText) this.goldText.setPosition(width - 200, 40);

    // Quest tracker
    if (this.questTrackerBg) {
      this.questTrackerBg.setPosition(width - 10, height - 40);
      this.questTrackerTitle.setPosition(width - 205, height - 95);
      this.questTrackerObj1.setPosition(width - 205, height - 80);
      this.questTrackerObj2.setPosition(width - 205, height - 65);
    }
  }

  setupEvents() {
    if (this.gameScene) {
      this.gameScene.events.on('playerHpChanged', (hp, maxHp) => {
        this.updateHealthBar(hp, maxHp);
      });

      this.gameScene.events.on('playerResourceChanged', (stamina, maxStamina, rage, maxRage) => {
        this.updateStaminaBar(stamina, maxStamina);
        this.updateRageBar(rage, maxRage);
      });

      this.gameScene.events.on('scoreChanged', (score) => {
        this.updateScore(score);
      });

      this.gameScene.events.on('keysChanged', (count) => {
        this.updateKeyCount(count);
      });

      this.gameScene.events.on('levelChanged', (name, index) => {
        this.updateLevelDisplay(name, index);
      });

      // XP changes
      this.gameScene.events.on('xpChanged', (xp, xpRequired) => {
        this.updateXpBar(xp, xpRequired);
      });

      // Level up
      this.gameScene.events.on('levelUp', (level) => {
        if (this.playerLevelText) this.playerLevelText.setText(`LV.${level}`);
      });

      // Sync initial level/XP from loaded save
      const levelSystem = this.gameScene.registry?.get('levelSystem');
      if (levelSystem) {
        if (this.playerLevelText) this.playerLevelText.setText(`LV.${levelSystem.level}`);
        this.updateXpBar(levelSystem.xp, levelSystem.getXpRequired());
      }

      // Gold changes
      this.gameScene.events.on('goldChanged', (gold) => {
        if (this.goldText) this.goldText.setText(`💰 ${gold}`);
      });

      // Quest tracking
      this.gameScene.events.on('questActivated', () => this.updateQuestTracker());
      this.gameScene.events.on('questProgressUpdated', () => this.updateQuestTracker());
      this.gameScene.events.on('questCompleted', () => this.updateQuestTracker());

      // 技能槽位变化（来自技能面板装备按钮）
      this.gameScene.events.on('skillSlotsChanged', () => this.refreshSkillSlots());
    }
  }

  updateHealthBar(hp, maxHp) {
    const percentage = hp / maxHp;
    const newWidth = Math.max(0, 148 * percentage);

    // Ghost bar - only on decrease
    if (newWidth < this.hpBar.width) {
      // Stop any existing ghost tween
      if (this.hpGhostTween) this.hpGhostTween.stop();
      this.hpGhost.width = this.hpBar.width;
      this.hpGhostTween = this.tweens.add({
        targets: this.hpGhost,
        width: newWidth,
        duration: 500, delay: 200,
        ease: 'Quad.easeOut'
      });
    } else {
      // On heal, ghost immediately matches
      this.hpGhost.width = newWidth;
    }

    this.hpBar.width = newWidth;

    if (percentage > 0.6) {
      this.hpBar.setFillStyle(0x00ff00);
    } else if (percentage > 0.3) {
      this.hpBar.setFillStyle(0xffff00);
    } else {
      this.hpBar.setFillStyle(0xff0000);
    }

    this.hpText.setText(`${Math.floor(hp)}/${maxHp}`);

    if (percentage <= 0.3) {
      this.tweens.add({
        targets: this.heartIcon,
        scaleX: 1.3, scaleY: 1.3,
        duration: 200, yoyo: true
      });
    }
  }

  updateStaminaBar(stamina, maxStamina) {
    if (!maxStamina || maxStamina <= 0) return;
    const percentage = stamina / maxStamina;
    this.staminaBar.width = Math.max(0, 148 * percentage);
    this.staminaText.setText(`${Math.floor(stamina)}/${maxStamina}`);
  }

  updateRageBar(rage, maxRage) {
    const percentage = rage / maxRage;
    this.rageBar.width = Math.max(0, 148 * percentage);
    this.rageText.setText(`${Math.floor(rage)}/${maxRage}`);

    // Rage bar pulses when full
    if (rage >= maxRage && !this._ragePulsing) {
      this._ragePulsing = true;
      this._ragePulseTween = this.tweens.add({
        targets: this.rageBar, alpha: 0.6,
        duration: 400, yoyo: true, repeat: -1
      });
    } else if (rage < maxRage && this._ragePulsing) {
      this._ragePulsing = false;
      if (this._ragePulseTween) this._ragePulseTween.stop();
      this.rageBar.setAlpha(1);
    }
  }

  updateScore(score) {
    this.scoreText.setText(score.toString());
    this.tweens.add({
      targets: this.scoreText,
      scaleX: 1.2,
      scaleY: 1.2,
      duration: 100,
      yoyo: true
    });
  }

  updateKeyCount(count) {
    this.keyText.setText(`x${count}`);
    this.tweens.add({
      targets: this.keyText,
      scaleX: 1.3,
      scaleY: 1.3,
      duration: 100,
      yoyo: true
    });
  }

  updateLevelDisplay(name, index) {
    this.levelText.setText(name);
    this.tweens.add({
      targets: this.levelText,
      scaleX: 1.3, scaleY: 1.3,
      duration: 200, yoyo: true
    });
  }

  updateXpBar(xp, xpRequired) {
    if (!this.xpBar) return;
    const percentage = xpRequired > 0 ? xp / xpRequired : 0;
    this.xpBar.width = Math.max(0, 148 * percentage);
    this.xpText.setText(`XP: ${xp}/${xpRequired}`);
  }

  createQuestTracker() {
    const width = this._uiW;
    const height = this._uiH;

    this.questTrackerBg = this.add.rectangle(width - 10, height - 40, 200, 60, 0x000000, 0.5)
      .setOrigin(1, 1).setStrokeStyle(1, 0x333355).setDepth(1);

    this.questTrackerTitle = this.add.text(width - 205, height - 95, '', {
      fontSize: '10px', fill: '#ffaa44', fontFamily: 'Courier New', fontStyle: 'bold'
    }).setDepth(2);

    this.questTrackerObj1 = this.add.text(width - 205, height - 80, '', {
      fontSize: '9px', fill: '#aaaaaa', fontFamily: 'Courier New'
    }).setDepth(2);

    this.questTrackerObj2 = this.add.text(width - 205, height - 65, '', {
      fontSize: '9px', fill: '#aaaaaa', fontFamily: 'Courier New'
    }).setDepth(2);
  }

  updateQuestTracker() {
    const questSystem = this.gameScene?.registry?.get('questSystem');
    if (!questSystem || !this.questTrackerTitle) return;

    const quest = questSystem.getTrackedQuest();
    if (!quest) {
      this.questTrackerTitle.setText('');
      this.questTrackerObj1.setText('');
      this.questTrackerObj2.setText('');
      this.questTrackerBg.setVisible(false);
      return;
    }

    this.questTrackerBg.setVisible(true);
    this.questTrackerTitle.setText(quest.title);

    const objs = quest.objectives.filter(o => o.current < o.required);
    this.questTrackerObj1.setText(objs[0] ? `○ ${objs[0].text} (${objs[0].current}/${objs[0].required})` : '');
    this.questTrackerObj2.setText(objs[1] ? `○ ${objs[1].text} (${objs[1].current}/${objs[1].required})` : '');
  }

  update() {
    this.updateSkillBar();
    this.updateBuffBar();
  }

  updateSkillBar() {
    if (!this.skillSlots || !this.gameScene?.player?.skillEngine) return;
    const engine = this.gameScene.player.skillEngine;

    for (const slot of this.skillSlots) {
      if (!slot.skillId) continue;

      const cdInfo = engine.getCooldownInfo(slot.skillId);
      const level = engine.getSkillLevel(slot.skillId);

      // Level display
      slot.lvText.setText(`Lv${level}`);

      if (cdInfo.remaining > 0) {
        // On cooldown
        const fraction = cdInfo.fraction;
        slot.cdOverlay.setSize(slot.size - 2, (slot.size - 2) * fraction);
        slot.cdOverlay.setPosition(slot.x, slot.y + (slot.size - 2) / 2);
        slot.cdText.setText(`${(cdInfo.remaining / 1000).toFixed(1)}`);
        slot.cdText.setVisible(true);
        slot.bg.setStrokeStyle(1, 0x444444);
      } else {
        // Ready
        slot.cdOverlay.setSize(slot.size - 2, 0);
        slot.cdText.setVisible(false);

        const check = engine.canUse(slot.skillId);
        if (check.canUse) {
          slot.bg.setStrokeStyle(1, 0x66aaff);
        } else {
          slot.bg.setStrokeStyle(1, 0x664444); // insufficient resource
        }
      }

      // Highlight when actively casting this skill
      if (engine.activeSkillId === slot.skillId) {
        slot.bg.setStrokeStyle(2, 0xffdd44);
      }
    }
  }
}
