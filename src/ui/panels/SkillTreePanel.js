import Phaser from 'phaser';
import { RESOURCE_LABELS, THEME_CONFIG } from '../../config/themeConfig.js';
import { UI_THEME } from '../../config/uiTheme.js';

export const SkillTreePanel = {
  createSkillTreeTab() {
    const container = this.add.container(0, 0).setDepth(5).setVisible(false);
    this.tabContainers.skillTree = container;

    const contentTop = this.panelTop + 50;
    const contentW = this.panelW - 20;
    const contentH = this.panelH - 60;

    // Content background
    const contentBg = this.add.rectangle(
      this.panelX, contentTop + contentH / 2,
      contentW, contentH, UI_THEME.colors.backdrop, 0.88
    ).setStrokeStyle(1, UI_THEME.colors.borderMuted);
    container.add(contentBg);

    // Skill points display
    this.skillPointsText = this.add.text(this.panelLeft + 20, contentTop + 10, `${THEME_CONFIG.skillPoint}: 0`, {
      fontSize: '15px', fill: UI_THEME.text.jadeBright, fontFamily: UI_THEME.font.body
    });
    container.add(this.skillPointsText);

    // --- Skill Cards (2 列网格) ---
    const cardStartY = contentTop + 40;
    const cols = 2;
    const sideMargin = 15;
    const colGap = 10;
    const cardW = Math.floor((contentW - 2 * sideMargin - colGap) / cols);
    const cardH = 90;
    const cardGap = 10;

    // 滚动区可视范围
    const viewTop = contentTop + 35;
    const viewBottom = contentTop + contentH - 15;
    const viewH = viewBottom - viewTop;

    // 卡片内层 container（受 mask 裁剪 + 可滚动）
    const cardsContainer = this.add.container(0, 0).setDepth(5);
    container.add(cardsContainer);
    this.skillCardsContainer = cardsContainer;

    // Geometry mask 裁剪到可视范围
    const maskShape = this.make.graphics({}, false);
    maskShape.fillStyle(0xffffff);
    maskShape.fillRect(this.panelLeft + 10, viewTop, contentW, viewH);
    cardsContainer.setMask(maskShape.createGeometryMask());
    this._skillTreeMask = maskShape;

    this.skillCards = {};

    const player = this.gameScene?.player;
    const skillDefs = player?.skillEngine?.getSkillDefs() || {};
    const playerSlots = player?.skillSlots || [];

    const allSkillIds = Object.keys(skillDefs);
    allSkillIds.forEach((skillId, idx) => {
      const base = skillDefs[skillId];
      const col = idx % cols;
      const row = Math.floor(idx / cols);
      const cardX = this.panelLeft + sideMargin + cardW / 2 + col * (cardW + colGap);
      const cy = cardStartY + row * (cardH + cardGap) + cardH / 2;

      // Card background
      const cardBg = this.add.rectangle(cardX, cy, cardW, cardH, UI_THEME.colors.panelRaised, 0.92)
        .setStrokeStyle(1, UI_THEME.colors.borderMuted);
      cardsContainer.add(cardBg);

      // Skill icon (large) — interactive 用于 tooltip
      const iconText = this.add.text(cardX - cardW / 2 + 26, cy, base.icon || '?', {
        fontSize: '24px', fontFamily: UI_THEME.font.body
      }).setOrigin(0.5);
      iconText.setInteractive({ useHandCursor: false });
      cardsContainer.add(iconText);

      if (this.hoverTooltip) {
        this.hoverTooltip.attach(iconText, () => {
          const player = this.gameScene?.player;
          const engine = player?.skillEngine;
          if (!engine) return null;
          const lv = engine.getSkillLevel(skillId);
          const skill = engine.getScaledSkill(skillId);
          if (!skill) return null;
          const desc = player._skillModule?.getSkillDescription?.(skillId, lv) || skill.description || '';
          const cdSec = (skill.cooldown / 1000).toFixed(1);
          const r = RESOURCE_LABELS[skill.resource] || '';
          const costLine = skill.resource === 'none'
            ? `冷却: ${cdSec}s`
            : `冷却: ${cdSec}s   ${r}: ${skill.cost}`;
          return {
            title: `${skill.icon || ''} ${skill.name}  Lv.${lv}/${skill.maxLevel}`,
            body: `${desc}\n${costLine}`
          };
        });
      }

      const textLeft = cardX - cardW / 2 + 50;
      const cardRight = cardX + cardW / 2;

      // Slot equip buttons [1][2][3][4] — 右上角
      const slotBtns = [];
      const sbW = 18;
      const sbH = 14;
      const sbGap = 3;
      const sbY = cy - 32;
      const sbTotalW = 4 * sbW + 3 * sbGap;
      const sbLeftEdge = cardRight - 6 - sbTotalW;
      for (let s = 0; s < 4; s++) {
        const sx = sbLeftEdge + s * (sbW + sbGap) + sbW / 2;
        const sbg = this.add.rectangle(sx, sbY, sbW, sbH, UI_THEME.colors.ink)
          .setStrokeStyle(1, UI_THEME.colors.borderMuted)
          .setInteractive({ useHandCursor: true });
        const stx = this.add.text(sx, sbY, `${s + 1}`, {
          fontSize: '13px', fill: UI_THEME.text.muted, fontFamily: UI_THEME.font.mono
        }).setOrigin(0.5);
        cardsContainer.add(sbg);
        cardsContainer.add(stx);

        sbg.on('pointerdown', () => {
          const p = this.gameScene?.player;
          if (!p) return;
          const cur = p.skillSlots[s];
          p.setSkillSlot(s, cur === skillId ? null : skillId);
          this.refreshSkillTreeTab();
        });

        slotBtns.push({ bg: sbg, text: stx });
      }

      // 文本区右边界：避开 slot 按钮和 upgrade 按钮
      const textRight = sbLeftEdge - 6;
      const textW = Math.max(80, textRight - textLeft);

      // Skill name
      const nameText = this.add.text(textLeft, cy - 28, base.name, {
        fontSize: '15px', fill: UI_THEME.text.paper, fontFamily: UI_THEME.font.body, fontStyle: 'bold'
      });
      cardsContainer.add(nameText);

      // Level text — 紧跟名字
      const lvText = this.add.text(textLeft, cy - 12, 'Lv.1/5', {
        fontSize: '13px', fill: UI_THEME.text.jadeBright, fontFamily: UI_THEME.font.mono
      });
      cardsContainer.add(lvText);

      // Description（限制宽度避免覆盖按钮）
      const descText = this.add.text(textLeft, cy + 2, '', {
        fontSize: '12px', fill: UI_THEME.text.muted, fontFamily: UI_THEME.font.body,
        wordWrap: { width: textW }
      });
      cardsContainer.add(descText);

      // Stats line
      const statsText = this.add.text(textLeft, cy + cardH / 2 - 14, '', {
        fontSize: '12px', fill: UI_THEME.text.muted, fontFamily: UI_THEME.font.body
      });
      cardsContainer.add(statsText);

      // Upgrade button — 右下角
      const btnW = 60;
      const btnH = 22;
      const btnX = cardRight - btnW / 2 - 6;
      const btnY = cy + cardH / 2 - btnH / 2 - 4;
      const btnBg = this.add.rectangle(btnX, btnY, btnW, btnH, UI_THEME.colors.panelRaised)
        .setStrokeStyle(1, UI_THEME.colors.jade).setInteractive({ useHandCursor: true });
      cardsContainer.add(btnBg);

      const btnText = this.add.text(btnX, btnY, '升级', {
        fontSize: '13px', fill: UI_THEME.text.jade, fontFamily: UI_THEME.font.body
      }).setOrigin(0.5);
      cardsContainer.add(btnText);

      // Next level preview — 升级按钮左侧小提示
      const nextLvText = this.add.text(btnX - btnW / 2 - 4, btnY, '', {
        fontSize: '11px', fill: UI_THEME.text.disabled, fontFamily: UI_THEME.font.body
      }).setOrigin(1, 0.5);
      cardsContainer.add(nextLvText);

      btnBg.on('pointerdown', () => {
        this.handleSkillUpgrade(skillId);
      });
      btnBg.on('pointerover', () => {
        btnBg.setFillStyle(UI_THEME.colors.panelHover);
      });
      btnBg.on('pointerout', () => {
        btnBg.setFillStyle(UI_THEME.colors.panelRaised);
      });

      this.skillCards[skillId] = { cardBg, iconText, nameText, lvText, descText, statsText, btnBg, btnText, nextLvText, slotBtns };
    });

    // Bottom hint（固定，不随滚动）
    this.skillHintText = this.add.text(this.panelX, viewBottom + 4, `每3级获得1个${THEME_CONFIG.skillPoint} · 滚轮可滚动`, {
      fontSize: '13px', fill: UI_THEME.text.disabled, fontFamily: UI_THEME.font.body
    }).setOrigin(0.5, 0);
    container.add(this.skillHintText);

    // 滚动设置
    const rowsCount = Math.ceil(allSkillIds.length / cols);
    const totalCardsH = rowsCount * (cardH + cardGap);
    this._skillScrollMin = Math.min(0, viewH - totalCardsH);  // 负值；最大滚动距离
    this._skillScrollMax = 0;
    this._skillScrollY = 0;

    // 滚动条（右侧细条）
    if (totalCardsH > viewH) {
      const sbX = this.panelLeft + this.panelW - 8;
      const sbTrackH = viewH;
      const sbThumbH = Math.max(20, (viewH / totalCardsH) * sbTrackH);
      this._skillScrollTrack = this.add.rectangle(sbX, viewTop, 4, sbTrackH, UI_THEME.colors.ink, 0.7).setOrigin(0, 0);
      this._skillScrollThumb = this.add.rectangle(sbX, viewTop, 4, sbThumbH, UI_THEME.colors.jade, 0.9).setOrigin(0, 0);
      container.add(this._skillScrollTrack);
      container.add(this._skillScrollThumb);
    }

    // 鼠标滚轮：仅当本 tab 激活时响应
    if (!this._skillWheelHandler) {
      this._skillWheelHandler = (pointer, gameObjects, dx, dy) => {
        if (this.activeTab !== 'skillTree') return;
        if (this._skillScrollMin >= 0) return; // 不需要滚动
        this._skillScrollY = Phaser.Math.Clamp(
          this._skillScrollY - dy * 0.5,
          this._skillScrollMin,
          this._skillScrollMax
        );
        this.skillCardsContainer.y = this._skillScrollY;
        // 更新滚动条 thumb 位置
        if (this._skillScrollThumb && this._skillScrollTrack) {
          const ratio = this._skillScrollMin === 0 ? 0 : this._skillScrollY / this._skillScrollMin;
          const trackH = this._skillScrollTrack.height;
          const thumbH = this._skillScrollThumb.height;
          this._skillScrollThumb.y = viewTop + ratio * (trackH - thumbH);
        }
      };
      this.input.on('wheel', this._skillWheelHandler);
    }

    this.refreshSkillTreeTab();
  },

  refreshSkillTreeTab() {
    const levelSystem = this.registry.get('levelSystem');
    const player = this.gameScene?.player;
    const engine = player?.skillEngine;
    if (!engine || !this.skillCards) return;

    if (this.skillPointsText) {
      this.skillPointsText.setText(`${THEME_CONFIG.skillPoint}: ${levelSystem ? levelSystem.skillPoints : 0}`);
    }

    const skillPoints = levelSystem ? levelSystem.skillPoints : 0;
    const skillDefs = engine.getSkillDefs();
    // Get the skill module's description/scaling functions from player
    const skillModule = player._skillModule;

    Object.keys(skillDefs).forEach(skillId => {
      const card = this.skillCards[skillId];
      if (!card) return;

      const base = skillDefs[skillId];
      const level = engine.getSkillLevel(skillId);
      const scaled = engine.getScaledSkill(skillId);
      const isMaxed = level >= base.maxLevel;

      // Update level
      card.lvText.setText(`Lv.${level}/${base.maxLevel}`);
      card.lvText.setColor(isMaxed ? UI_THEME.text.brass : UI_THEME.text.jadeBright);

      // Update description
      if (skillModule?.getSkillDescription) {
        card.descText.setText(skillModule.getSkillDescription(skillId, level));
      }

      // Update stats line
      const resourceName = RESOURCE_LABELS[base.resource] || '';
      const dmgText = scaled.effect?.damageMultiplier ? ` | 伤害: ${Math.round(scaled.effect.damageMultiplier * 100)}%` : '';
      card.statsText.setText(`${resourceName}: ${scaled.cost} | 冷却: ${(scaled.cooldown / 1000).toFixed(1)}s${dmgText}`);

      // Update card border
      card.cardBg.setStrokeStyle(1, isMaxed ? UI_THEME.colors.brass : UI_THEME.colors.borderMuted);

      // Update slot buttons (highlight equipped slot)
      const playerSlotsCur = player.skillSlots || [];
      if (card.slotBtns) {
        card.slotBtns.forEach((sb, idx) => {
          const equipped = playerSlotsCur[idx] === skillId;
          if (equipped) {
            sb.bg.setFillStyle(UI_THEME.colors.panelHover);
            sb.bg.setStrokeStyle(1, UI_THEME.colors.jadeBright);
            sb.text.setColor(UI_THEME.text.jadeBright);
          } else {
            sb.bg.setFillStyle(UI_THEME.colors.ink);
            sb.bg.setStrokeStyle(1, UI_THEME.colors.borderMuted);
            sb.text.setColor(UI_THEME.text.muted);
          }
        });
      }

      // Update upgrade button
      if (isMaxed) {
        card.btnText.setText('已满级');
        card.btnText.setColor(UI_THEME.text.brass);
        card.btnBg.setStrokeStyle(1, UI_THEME.colors.brassMuted);
        card.btnBg.setFillStyle(UI_THEME.colors.ink);
        card.btnBg.disableInteractive();
        card.nextLvText.setText('');
      } else if (skillPoints >= base.upgradeCost) {
        card.btnText.setText(`升级 (${base.upgradeCost}点)`);
        card.btnText.setColor(UI_THEME.text.jade);
        card.btnBg.setStrokeStyle(1, UI_THEME.colors.jade);
        card.btnBg.setFillStyle(UI_THEME.colors.panelRaised);
        card.btnBg.setInteractive({ useHandCursor: true });
        // Next level preview — 使用 getAtLevel 获取下一级数值
        const nextLevel = (engine.skillLevels[skillId] || 1) + 1;
        const nextScaled = engine.getAtLevel(skillId, nextLevel);
        const nextDmg = nextScaled?.effect?.damageMultiplier ? Math.round(nextScaled.effect.damageMultiplier * 100) : 0;
        card.nextLvText.setText(nextDmg ? `下级: ${nextDmg}%伤害` : '');
        card.nextLvText.setColor(UI_THEME.text.jade);
      } else {
        card.btnText.setText(`升级 (${base.upgradeCost}点)`);
        card.btnText.setColor(UI_THEME.text.disabled);
        card.btnBg.setStrokeStyle(1, UI_THEME.colors.disabled);
        card.btnBg.setFillStyle(UI_THEME.colors.ink);
        card.btnBg.disableInteractive();
        card.nextLvText.setText(`${THEME_CONFIG.skillPoint}不足`);
        card.nextLvText.setColor(UI_THEME.text.cinnabar);
      }
    });
  },

  handleSkillUpgrade(skillId) {
    const player = this.gameScene?.player;
    if (!player?.skillEngine) return;

    if (player.skillEngine.upgradeSkill(skillId)) {
      // Success animation
      const card = this.skillCards[skillId];
      if (card) {
        this.tweens.add({
          targets: card.cardBg,
          scaleX: 1.02, scaleY: 1.02,
          duration: 100, yoyo: true, ease: 'Back.easeOut'
        });
        // Flash the card border gold briefly
        card.cardBg.setStrokeStyle(2, UI_THEME.colors.brass);
        this.time.delayedCall(300, () => {
          if (card.cardBg) card.cardBg.setStrokeStyle(1, UI_THEME.colors.borderMuted);
        });
      }
      this.refreshSkillTreeTab();
      this.events.emit('panel:refresh', 'character');
    }
  }
};
