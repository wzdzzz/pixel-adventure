import Phaser from 'phaser';
import { TEXTURES } from '../assets/AssetManager.js';
import { Tooltip } from '../ui/Tooltip.js';
import itemData from '../data/items.json';

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
    this.attachBuffSlotTooltips();
    this.setupEvents();
    this.createQuestTracker();
    this.createDebugButton();

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

  /** 物品快捷栏刷新 */
  refreshItemSlots() {
    if (!this.itemSlots) return;
    const player = this.gameScene?.player;
    const inventory = this.gameScene?.inventory;
    const itemSlotIds = player?.itemSlots || [null, null, null, null];

    this.itemSlots.forEach((slot, i) => {
      const slotIdx = itemSlotIds[i];
      if (slotIdx != null && inventory) {
        const item = inventory.getSlot(slotIdx);
        if (item && item.type === 'consumable') {
          slot.icon.setText(item.icon || '🧪');
          slot.countText.setText(item.quantity > 1 ? `${item.quantity}` : '');
          slot.bg.setStrokeStyle(1, 0x55aa55);
          return;
        }
      }
      // 空槽或无效
      slot.icon.setText('');
      slot.countText.setText('');
      slot.bg.setStrokeStyle(1, 0x3a5a3a);
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
    if (!this.itemSlots) return;
    const player = this.gameScene?.player;
    const inventory = this.gameScene?.inventory;
    if (!player || !inventory) return;

    const itemSlotIds = player.itemSlots || [null, null, null, null];
    this.itemSlots.forEach((slot, i) => {
      const slotIdx = itemSlotIds[i];
      if (slotIdx != null) {
        const item = inventory.getSlot(slotIdx);
        if (item && item.type === 'consumable') {
          slot.icon.setText(item.icon || '🧪');
          slot.countText.setText(item.quantity > 1 ? `${item.quantity}` : '');
          slot.bg.setStrokeStyle(1, 0x55aa55);
          return;
        }
      }
      slot.icon.setText('');
      slot.countText.setText('');
      slot.bg.setStrokeStyle(1, 0x3a5a3a);
    });
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
