import Phaser from 'phaser';
import { TEXTURES } from '../assets/AssetManager.js';
import { Tooltip } from '../ui/Tooltip.js';
import itemData from '../data/items.json';
import { BIOMES, getDifficultyAtChunk } from '../world/biomes/biomeConfig.js';
import { WORLD_LAYOUT } from '../world/WorldLayout.js';

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
    this.createKeyDisplay();
    this.createGoldDisplay();
    this.createLevelDisplay();
    this.createSkillBar();
    this.createItemBar();
    this.createBuffBar();
    this.tooltip = new Tooltip(this, { delay: 500 });
    this.attachSkillSlotTooltips();
    this.attachItemSlotTooltips();
    this.attachBuffSlotTooltips();
    this.setupEvents();
    this.createQuestTracker();
    this.createDebugButton();
    this.createMinimap();

    // Listen for resize events to reposition all HUD elements
    this.scale.on('resize', this.onResize, this);

    // Cleanup all external listeners when the scene shuts down
    this.events.on('shutdown', () => {
      this.scale.off('resize', this.onResize, this);
      if (this.gameScene) {
        this.gameScene.events.off('playerHpChanged');
        this.gameScene.events.off('playerResourceChanged');
        this.gameScene.events.off('keysChanged');
        this.gameScene.events.off('levelChanged');
        this.gameScene.events.off('xpChanged');
        this.gameScene.events.off('levelUp');
        this.gameScene.events.off('goldChanged');
        this.gameScene.events.off('questActivated');
        this.gameScene.events.off('questProgressUpdated');
        this.gameScene.events.off('questCompleted');
        this.gameScene.events.off('skillSlotsChanged');
        this.gameScene.events.off('itemSlotsChanged');
      }
    });
  }

  createHUD() {
    // 左下角状态区域背景
    this.hudBg = this.add.rectangle(0, this._uiH - 120, 280, 120, 0x000000, 0.7)
      .setOrigin(0, 0).setDepth(1);
  }

  createHealthBar() {
    const height = this._uiH;
    const baseX = 15;
    const baseY = height - 110;

    // Level display
    this.playerLevelText = this.add.text(baseX, baseY, 'LV.1', {
      fontSize: '13px', fill: '#ffd700', fontFamily: 'Courier New', fontStyle: 'bold'
    }).setDepth(3);

    // HP - 红色
    this.heartIcon = this.add.image(baseX + 10, baseY + 24, TEXTURES.HEART).setScale(0.8).setDepth(2);
    this.hpBarBg = this.add.rectangle(baseX + 30, baseY + 24, 180, 14, 0x333333).setOrigin(0, 0.5).setDepth(2);
    this.hpBarBg.setStrokeStyle(1, 0x666666);
    this.hpGhost = this.add.rectangle(baseX + 31, baseY + 24, 178, 12, 0xffffff, 0.4).setOrigin(0, 0.5).setDepth(2.5);
    this.hpBar = this.add.rectangle(baseX + 31, baseY + 24, 178, 12, 0xcc3333).setOrigin(0, 0.5).setDepth(3);
    this.hpText = this.add.text(baseX + 215, baseY + 24, '100/100', {
      fontSize: '11px', fill: '#ffffff', fontFamily: 'Courier New'
    }).setOrigin(0, 0.5).setDepth(3);

    // Stamina bar - 蓝色
    this.staminaBarBg = this.add.rectangle(baseX + 30, baseY + 44, 180, 10, 0x333333).setOrigin(0, 0.5).setDepth(2);
    this.staminaBarBg.setStrokeStyle(1, 0x333344);
    this.staminaBar = this.add.rectangle(baseX + 31, baseY + 44, 178, 8, 0x3388dd).setOrigin(0, 0.5).setDepth(3);
    this.staminaText = this.add.text(baseX + 215, baseY + 44, '140/140', {
      fontSize: '10px', fill: '#5599ee', fontFamily: 'Courier New'
    }).setOrigin(0, 0.5).setDepth(3);

    // Rage bar - 橙色
    this.rageBarBg = this.add.rectangle(baseX + 30, baseY + 60, 180, 8, 0x333333).setOrigin(0, 0.5).setDepth(2);
    this.rageBarBg.setStrokeStyle(1, 0x443322);
    this.rageBar = this.add.rectangle(baseX + 31, baseY + 60, 0, 6, 0xff8822).setOrigin(0, 0.5).setDepth(3);
    this.rageText = this.add.text(baseX + 215, baseY + 60, '0/100', {
      fontSize: '9px', fill: '#ffaa44', fontFamily: 'Courier New'
    }).setOrigin(0, 0.5).setDepth(3);

    // XP bar
    this.xpBarBg = this.add.rectangle(baseX + 30, baseY + 76, 180, 6, 0x222233).setOrigin(0, 0.5).setDepth(2);
    this.xpBarBg.setStrokeStyle(1, 0x333344);
    this.xpBar = this.add.rectangle(baseX + 31, baseY + 76, 0, 4, 0x9966ff).setOrigin(0, 0.5).setDepth(3);
    this.xpText = this.add.text(baseX + 215, baseY + 76, 'XP: 0/40', {
      fontSize: '9px', fill: '#9988cc', fontFamily: 'Courier New'
    }).setOrigin(0, 0.5).setDepth(3);

    // Key + Gold below XP
    this.keyIcon = this.add.image(baseX + 30, baseY + 95, TEXTURES.KEY).setScale(0.7).setDepth(2);
    this.keyText = this.add.text(baseX + 45, baseY + 95, 'x0', {
      fontSize: '11px', fill: '#ff69b4', fontFamily: 'Courier New'
    }).setOrigin(0, 0.5).setDepth(2);
    this.goldText = this.add.text(baseX + 100, baseY + 95, '💰 0', {
      fontSize: '11px', fill: '#ffd700', fontFamily: 'Courier New'
    }).setOrigin(0, 0.5).setDepth(2);
  }

  createKeyDisplay() {
    // 已整合到 createHealthBar 左下角
  }

  createGoldDisplay() {
    // 已整合到 createHealthBar 左下角
  }

  createLevelDisplay() {
    // 右上角仅保留关卡名
    const width = this._uiW;
    this.levelText = this.add.text(width - 15, 15, '第一关', {
      fontSize: '12px', fill: '#7c4dff', fontFamily: 'Courier New'
    }).setOrigin(1, 0).setDepth(2);
  }

  createSkillBar() {
    const width = this._uiW;
    const height = this._uiH;
    const slotSize = 40;
    const gap = 6;
    // 4 技能 + 4 物品 = 8 槽, 中间留 gap*2 分隔
    const totalW = 4 * slotSize + 3 * gap;
    const startX = width / 2 - totalW / 2 - (4 * slotSize + 4 * gap) / 2 - gap;
    const slotY = height - 50;

    this.skillSlots = [];

    const player = this.gameScene?.player;
    const playerSlots = player?.skillSlots || [null, null, null, null];
    const skillDefs = player?.skillEngine?.getSkillDefs() || {};

    for (let i = 0; i < 4; i++) {
      const x = startX + i * (slotSize + gap) + slotSize / 2;
      const skillId = playerSlots[i];
      const base = skillId ? skillDefs[skillId] : null;

      const bg = this.add.rectangle(x, slotY, slotSize, slotSize, 0x1a1a2e, 0.85)
        .setStrokeStyle(1, base ? 0x5a5a8a : 0x333344).setDepth(4);

      const icon = this.add.text(x, slotY - 2, base ? base.icon : '', {
        fontSize: '18px', fontFamily: 'Courier New'
      }).setOrigin(0.5).setDepth(5);

      const keyLabel = this.add.text(x - slotSize / 2 + 3, slotY - slotSize / 2 + 1, `${i + 1}`, {
        fontSize: '9px', fill: '#aaaaaa', fontFamily: 'Courier New'
      }).setDepth(6);

      const cdOverlay = this.add.rectangle(x, slotY, slotSize - 2, 0, 0x000000, 0.6)
        .setOrigin(0.5, 1).setDepth(5.5);

      const cdText = this.add.text(x, slotY + 2, '', {
        fontSize: '11px', fill: '#ff6666', fontFamily: 'Courier New', fontStyle: 'bold'
      }).setOrigin(0.5).setDepth(6).setVisible(false);

      const lvText = this.add.text(x + slotSize / 2 - 2, slotY + slotSize / 2 - 2, '', {
        fontSize: '8px', fill: '#aaccff', fontFamily: 'Courier New'
      }).setOrigin(1, 1).setDepth(6);

      this.skillSlots.push({ bg, icon, keyLabel, cdOverlay, cdText, lvText, skillId, x, y: slotY, size: slotSize });
    }
  }

  createItemBar() {
    const width = this._uiW;
    const height = this._uiH;
    const slotSize = 40;
    const gap = 6;
    const totalSkillW = 4 * slotSize + 3 * gap;
    const startX = width / 2 - totalSkillW / 2 - (4 * slotSize + 4 * gap) / 2 - gap;
    const itemStartX = startX + totalSkillW + gap * 3;
    const slotY = height - 50;

    this.itemSlots = [];

    // 从玩家读取物品快捷栏
    const player = this.gameScene?.player;
    const playerItemSlots = player?.itemSlots || [null, null, null, null];

    for (let i = 0; i < 4; i++) {
      const x = itemStartX + i * (slotSize + gap) + slotSize / 2;

      const bg = this.add.rectangle(x, slotY, slotSize, slotSize, 0x1a2a1e, 0.85)
        .setStrokeStyle(1, 0x3a5a3a).setDepth(4);

      const icon = this.add.text(x, slotY - 2, '', {
        fontSize: '16px', fontFamily: 'Courier New'
      }).setOrigin(0.5).setDepth(5);

      const keyLabel = this.add.text(x - slotSize / 2 + 3, slotY - slotSize / 2 + 1, `F${i + 1}`, {
        fontSize: '8px', fill: '#88aa88', fontFamily: 'Courier New'
      }).setDepth(6);

      const countText = this.add.text(x + slotSize / 2 - 3, slotY + slotSize / 2 - 3, '', {
        fontSize: '9px', fill: '#ffffff', fontFamily: 'Courier New', fontStyle: 'bold',
        stroke: '#000000', strokeThickness: 2
      }).setOrigin(1, 1).setDepth(6);

      this.itemSlots.push({ bg, icon, keyLabel, countText, x, y: slotY, size: slotSize });
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

  /** 给物品快捷栏绑 tooltip：显示物品名称和描述 */
  attachItemSlotTooltips() {
    if (!this.itemSlots || !this.tooltip) return;
    this.itemSlots.forEach((slot, i) => {
      slot.bg.setInteractive({ useHandCursor: false });
      this.tooltip.attach(slot.bg, () => {
        const player = this.gameScene?.player;
        const inventory = this.gameScene?.inventory;
        const itemId = player?.itemSlots?.[i];
        if (!itemId) return null;
        // 从背包查总数量
        let qty = 0;
        if (inventory) {
          for (const s of inventory.slots) {
            if (s && s.id === itemId) qty += s.quantity || 0;
          }
        }
        const data = itemData.items?.[itemId];
        const name = data?.name || itemId;
        const desc = data?.description || '';
        return {
          title: `${name} ×${qty}`,
          body: `${desc}\n快捷键: F${i + 1}`
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
      slot.cdOverlay.setSize(slot.size - 2, 0);
      slot.cdText.setVisible(false);
      slot.lvText.setText('');
    });
  }

  /** 物品快捷栏刷新（按物品 id 查找背包） */
  refreshItemSlots() {
    if (!this.itemSlots) return;
    const player = this.gameScene?.player;
    const inventory = this.gameScene?.inventory;
    const boundIds = player?.itemSlots || [null, null, null, null];

    this.itemSlots.forEach((slot, i) => {
      const itemId = boundIds[i];
      if (!itemId) {
        slot.icon.setText('');
        slot.countText.setText('');
        slot.bg.setStrokeStyle(1, 0x3a5a3a);
        return;
      }
      // 查背包里该 id 的总数量
      let qty = 0;
      let icon = '';
      if (inventory) {
        for (const s of inventory.slots) {
          if (s && s.id === itemId) {
            qty += s.quantity || 0;
            if (!icon) icon = s.icon || '';
          }
        }
      }
      // 没有 icon 则从 items.json 取
      if (!icon) {
        const data = itemData.items?.[itemId];
        icon = data?.icon || '🧪';
      }
      slot.icon.setText(icon);
      slot.countText.setText(`${qty}`);
      slot.bg.setStrokeStyle(1, qty > 0 ? 0x55aa55 : 0x553333);
    });
  }

  createBuffBar() {
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
    const gapB = 4;
    const totalW = visible.length * size + Math.max(0, visible.length - 1) * gapB;
    const startX = width / 2 - totalW / 2 + size / 2;
    const y = height - 80; // 在技能栏上方

    this.buffSlots.forEach((slot, i) => {
      if (i < visible.length) {
        const b = visible[i];
        const x = startX + i * (size + gapB);
        slot.bg.setPosition(x, y).setVisible(true);
        if (b.type === 'debuff' || b.type === 'dot') {
          slot.bg.setStrokeStyle(1, 0xff6666);
        } else if (b.type === 'buff') {
          slot.bg.setStrokeStyle(1, 0x66ff88);
        } else {
          slot.bg.setStrokeStyle(1, 0xffdd44);
        }
        slot.icon.setPosition(x, y - 2).setText(b.icon || '✨').setVisible(true);
        const sec = Math.max(0, b.remaining / 1000);
        slot.time.setPosition(x, y + size / 2 - 5)
          .setText(sec >= 10 ? `${Math.floor(sec)}` : sec.toFixed(1))
          .setVisible(true);
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
    this.cameras.main.setSize(gameSize.width, gameSize.height);
    this._uiW = gameSize.width;
    this._uiH = gameSize.height;
  }

  setupEvents() {
    if (this.gameScene) {
      this.gameScene.events.on('playerHpChanged', (hp, maxHp) => {
        this.updateHealthBar(hp, maxHp);
      });

      this.gameScene.events.on('playerResourceChanged', (stamina, maxStamina, rage, maxRage, mana, maxMana) => {
        // 蓝条：法师显示魔力，其他显示体力
        const isMage = this.gameScene?.player?.classType === 'mage';
        if (isMage) {
          this.updateStaminaBar(mana, maxMana);
        } else {
          this.updateStaminaBar(stamina, maxStamina);
        }
        this.updateRageBar(rage, maxRage);
      });

      this.gameScene.events.on('keysChanged', (count) => {
        this.updateKeyCount(count);
      });

      this.gameScene.events.on('levelChanged', (name, index) => {
        this.updateLevelDisplay(name, index);
      });

      this.gameScene.events.on('xpChanged', (xp, xpRequired) => {
        this.updateXpBar(xp, xpRequired);
      });

      this.gameScene.events.on('levelUp', (level) => {
        if (this.playerLevelText) this.playerLevelText.setText(`LV.${level}`);
      });

      // Sync initial level/XP from loaded save
      const levelSystem = this.gameScene.registry?.get('levelSystem');
      if (levelSystem) {
        if (this.playerLevelText) this.playerLevelText.setText(`LV.${levelSystem.level}`);
        this.updateXpBar(levelSystem.xp, levelSystem.getXpRequired());
      }

      this.gameScene.events.on('goldChanged', (gold) => {
        if (this.goldText) this.goldText.setText(`💰 ${gold}`);
      });

      // Quest tracking
      this.gameScene.events.on('questActivated', () => this.updateQuestTracker());
      this.gameScene.events.on('questProgressUpdated', () => this.updateQuestTracker());
      this.gameScene.events.on('questCompleted', () => this.updateQuestTracker());

      // 技能槽位变化
      this.gameScene.events.on('skillSlotsChanged', () => this.refreshSkillSlots());

      // 物品快捷栏变化
      this.gameScene.events.on('itemSlotsChanged', () => this.refreshItemSlots());
    }
  }

  updateHealthBar(hp, maxHp) {
    const percentage = hp / maxHp;
    const newWidth = Math.max(0, 178 * percentage);

    if (newWidth < this.hpBar.width) {
      if (this.hpGhostTween) this.hpGhostTween.stop();
      this.hpGhost.width = this.hpBar.width;
      this.hpGhostTween = this.tweens.add({
        targets: this.hpGhost,
        width: newWidth,
        duration: 500, delay: 200,
        ease: 'Quad.easeOut'
      });
    } else {
      this.hpGhost.width = newWidth;
    }

    this.hpBar.width = newWidth;

    if (percentage > 0.6) {
      this.hpBar.setFillStyle(0xcc3333);
    } else if (percentage > 0.3) {
      this.hpBar.setFillStyle(0xdd2222);
    } else {
      this.hpBar.setFillStyle(0xff1111);
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
    this.staminaBar.width = Math.max(0, 178 * percentage);
    this.staminaText.setText(`${Math.floor(stamina)}/${maxStamina}`);
  }

  updateRageBar(rage, maxRage) {
    const percentage = rage / maxRage;
    this.rageBar.width = Math.max(0, 178 * percentage);
    this.rageText.setText(`${Math.floor(rage)}/${maxRage}`);

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

  updateKeyCount(count) {
    if (this.keyText) this.keyText.setText(`x${count}`);
  }

  updateLevelDisplay(name, index) {
    if (this.levelText) this.levelText.setText(name);
  }

  updateXpBar(xp, xpRequired) {
    if (!this.xpBar) return;
    const percentage = xpRequired > 0 ? xp / xpRequired : 0;
    this.xpBar.width = Math.max(0, 178 * percentage);
    this.xpText.setText(`XP: ${xp}/${xpRequired}`);
  }

  createQuestTracker() {
    const width = this._uiW;
    const height = this._uiH;

    this.questTrackerBg = this.add.rectangle(width - 10, height - 90, 200, 60, 0x000000, 0.5)
      .setOrigin(1, 1).setStrokeStyle(1, 0x333355).setDepth(1);

    this.questTrackerTitle = this.add.text(width - 205, height - 145, '', {
      fontSize: '10px', fill: '#ffaa44', fontFamily: 'Courier New', fontStyle: 'bold'
    }).setDepth(2);

    this.questTrackerObj1 = this.add.text(width - 205, height - 130, '', {
      fontSize: '9px', fill: '#aaaaaa', fontFamily: 'Courier New'
    }).setDepth(2);

    this.questTrackerObj2 = this.add.text(width - 205, height - 115, '', {
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
    this.updateItemBar();
    this.updateMinimap();
  }

  updateSkillBar() {
    if (!this.skillSlots || !this.gameScene?.player?.skillEngine) return;
    const engine = this.gameScene.player.skillEngine;

    for (const slot of this.skillSlots) {
      if (!slot.skillId) continue;

      const cdInfo = engine.getCooldownInfo(slot.skillId);
      const level = engine.getSkillLevel(slot.skillId);

      slot.lvText.setText(`Lv${level}`);

      if (cdInfo.remaining > 0) {
        const fraction = cdInfo.fraction;
        slot.cdOverlay.setSize(slot.size - 2, (slot.size - 2) * fraction);
        slot.cdOverlay.setPosition(slot.x, slot.y + (slot.size - 2) / 2);
        slot.cdText.setText(`${(cdInfo.remaining / 1000).toFixed(1)}`);
        slot.cdText.setVisible(true);
        slot.bg.setStrokeStyle(1, 0x444444);
      } else {
        slot.cdOverlay.setSize(slot.size - 2, 0);
        slot.cdText.setVisible(false);

        const check = engine.canUse(slot.skillId);
        if (check.canUse) {
          slot.bg.setStrokeStyle(1, 0x66aaff);
        } else {
          slot.bg.setStrokeStyle(1, 0x664444);
        }
      }

      if (engine.activeSkillId === slot.skillId) {
        slot.bg.setStrokeStyle(2, 0xffdd44);
      }
    }
  }

  updateItemBar() {
    // 复用 refreshItemSlots，逻辑一致
    this.refreshItemSlots();
  }

  // ═══════════════════════════════════════════════════════════
  //  小地图
  // ═══════════════════════════════════════════════════════════

  createMinimap() {
    const mapX = 15;       // 左上角起始 X
    const mapY = 15;       // 左上角起始 Y
    const cellSize = 10;   // 每个 chunk 格子像素
    const gridCount = 16;  // 16×16 chunks
    const mapSize = cellSize * gridCount; // 160px
    this._mm = { mapX, mapY, cellSize, gridCount, mapSize };

    // 半透明底板
    this._mmBg = this.add.rectangle(mapX, mapY, mapSize + 4, mapSize + 4, 0x000000, 0.7)
      .setOrigin(0, 0).setStrokeStyle(1, 0x555577).setDepth(8);

    // 用 Graphics 绘制 chunk 格子
    this._mmGfx = this.add.graphics().setDepth(9);

    // 特殊地点标记层
    this._mmMarkers = this.add.graphics().setDepth(10);
    this._drawMinimapMarkers();

    // 玩家位置指示器（小亮点）
    this._mmPlayerDot = this.add.circle(0, 0, 3, 0x00ff00).setDepth(11);
    // 闪烁动画
    this.tweens.add({
      targets: this._mmPlayerDot,
      alpha: 0.3, duration: 600, yoyo: true, repeat: -1
    });

    // 信息文字（地图下方）
    this._mmInfoText = this.add.text(mapX, mapY + mapSize + 10, '', {
      fontSize: '10px', fill: '#cccccc', fontFamily: 'Courier New',
      lineSpacing: 2
    }).setDepth(8);

    // 坐标文字
    this._mmCoordText = this.add.text(mapX + mapSize + 4, mapY + mapSize + 10, '', {
      fontSize: '10px', fill: '#888888', fontFamily: 'Courier New'
    }).setOrigin(1, 0).setDepth(8);

    // 缓存上次玩家所在 chunk 以减少重绘
    this._mmLastCx = null;
    this._mmLastCy = null;
    // 强制首次绘制
    this._mmNeedsRedraw = true;
  }

  /** 绘制特殊地点标记（城镇/营地/Boss），只在初始化时调用一次 */
  _drawMinimapMarkers() {
    const g = this._mmMarkers;
    const { mapX, mapY, cellSize } = this._mm;
    const ox = mapX + 2; // 底板 padding

    // 城镇 — 白色方块
    const town = WORLD_LAYOUT.town;
    g.fillStyle(0xffffff, 0.9);
    g.fillRect(ox + town.chunkX * cellSize + 2, mapY + 2 + town.chunkY * cellSize + 2, cellSize - 4, cellSize - 4);

    // 营地 — 黄色小三角
    for (const camp of WORLD_LAYOUT.camps) {
      const cx = ox + camp.chunkX * cellSize + cellSize / 2;
      const cy = mapY + 2 + camp.chunkY * cellSize + cellSize / 2;
      g.fillStyle(0xffdd44, 0.9);
      g.fillTriangle(cx, cy - 3, cx - 3, cy + 2, cx + 3, cy + 2);
    }

    // Boss — 红色菱形
    for (const boss of WORLD_LAYOUT.bosses) {
      const cx = ox + boss.chunkX * cellSize + cellSize / 2;
      const cy = mapY + 2 + boss.chunkY * cellSize + cellSize / 2;
      g.fillStyle(0xff3333, 0.9);
      g.fillTriangle(cx, cy - 4, cx - 3, cy, cx + 3, cy);
      g.fillTriangle(cx, cy + 4, cx - 3, cy, cx + 3, cy);
    }
  }

  updateMinimap() {
    if (!this._mm) return;
    const gs = this.gameScene;
    if (!gs || !gs.useOpenWorld) return;

    const player = gs.player;
    if (!player?.sprite) return;

    const px = player.sprite.x;
    const py = player.sprite.y;
    const CHUNK_PX = 1024;
    const cx = Math.floor(px / CHUNK_PX);
    const cy = Math.floor(py / CHUNK_PX);

    const { mapX, mapY, cellSize, gridCount, mapSize } = this._mm;
    const ox = mapX + 2;
    const oy = mapY + 2;

    // 更新玩家亮点位置（亚格精度）
    const fracX = (px / CHUNK_PX) / gridCount; // 0~1
    const fracY = (py / CHUNK_PX) / gridCount;
    this._mmPlayerDot.setPosition(
      ox + fracX * mapSize,
      oy + fracY * mapSize
    );

    // 只有玩家进入新 chunk 时重绘格子
    if (cx !== this._mmLastCx || cy !== this._mmLastCy || this._mmNeedsRedraw) {
      this._mmLastCx = cx;
      this._mmLastCy = cy;
      this._mmNeedsRedraw = false;
      this._redrawMinimapGrid(cx, cy);
    }

    // 更新信息文字
    const gen = gs.worldGenerator;
    if (gen) {
      const biomeId = gen.getBiome(cx, cy);
      const biomeInfo = BIOMES[biomeId];
      const diff = getDifficultyAtChunk(cx, cy);
      const diffStr = diff < 0.3 ? '安全' : diff < 0.6 ? '普通' : diff < 0.85 ? '危险' : '极危';
      this._mmInfoText.setText(`${biomeInfo?.name || biomeId}  ${diffStr}`);
      this._mmCoordText.setText(`(${cx},${cy})`);

      // 更新右上角区域名
      if (this.levelText) {
        this.levelText.setText(biomeInfo?.name || biomeId);
      }
    }
  }

  /** 重绘小地图 chunk 格子（biome 颜色 + 已探索高亮） */
  _redrawMinimapGrid(playerCx, playerCy) {
    const g = this._mmGfx;
    g.clear();

    const { mapX, mapY, cellSize, gridCount } = this._mm;
    const ox = mapX + 2;
    const oy = mapY + 2;
    const gen = this.gameScene?.worldGenerator;
    const ws = this.gameScene?.worldState;

    for (let gy = 0; gy < gridCount; gy++) {
      for (let gx = 0; gx < gridCount; gx++) {
        const biomeId = gen ? gen.getBiome(gx, gy) : 'forest';
        const biomeInfo = BIOMES[biomeId];
        const color = biomeInfo?.color || 0x333333;

        const explored = ws?.exploredChunks?.has(`${gx},${gy}`);
        const alpha = explored ? 0.85 : 0.25;

        g.fillStyle(color, alpha);
        g.fillRect(ox + gx * cellSize, oy + gy * cellSize, cellSize - 1, cellSize - 1);
      }
    }

    // 当前玩家所在 chunk 高亮边框
    if (playerCx >= 0 && playerCx < gridCount && playerCy >= 0 && playerCy < gridCount) {
      g.lineStyle(1, 0x00ff00, 0.9);
      g.strokeRect(ox + playerCx * cellSize, oy + playerCy * cellSize, cellSize - 1, cellSize - 1);
    }
  }

  createDebugButton() {
    const btn = this.add.text(this._uiW - 10, 40, '🛠 +材料', {
      fontSize: '12px', fill: '#ff6666', fontFamily: 'Courier New',
      backgroundColor: '#1a1a2e', padding: { x: 6, y: 4 }
    }).setOrigin(1, 0).setDepth(10).setInteractive({ useHandCursor: true });

    btn.on('pointerover', () => btn.setColor('#ffaaaa'));
    btn.on('pointerout', () => btn.setColor('#ff6666'));
    btn.on('pointerdown', () => {
      const inventory = this.gameScene?.inventory;
      if (!inventory) return;

      // 所有材料各加 9999
      const matIds = [
        'iron_shard', 'enhance_stone', 'ancient_core',
        'chaos_essence', 'soul_crystal', 'divine_heart',
        'world_core', 'refining_stone', 'star_fragment'
      ];
      matIds.forEach(id => {
        const data = itemData.items?.[id];
        if (data) inventory.addItem({ ...data }, 9999);
      });

      // 金币 +99999
      inventory.gold += 99999;
      this.gameScene.events.emit('goldChanged', inventory.gold);

      // 提示
      const msg = this.add.text(this._uiW / 2, 80, '已添加全部材料 ×9999 + 金币 ×99999', {
        fontSize: '14px', color: '#44ff44', fontFamily: 'Courier New',
        fontStyle: 'bold', stroke: '#000000', strokeThickness: 3
      }).setOrigin(0.5).setDepth(9999);
      this.tweens.add({
        targets: msg, alpha: 0, y: msg.y - 30,
        duration: 1500, delay: 800,
        onComplete: () => msg.destroy()
      });
    });
  }
}
