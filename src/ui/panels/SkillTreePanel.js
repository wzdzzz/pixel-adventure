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
      contentW, contentH, 0x12121e, 0.8
    ).setStrokeStyle(1, 0x3a3a5a);
    container.add(contentBg);

    // Skill points display
    this.skillPointsText = this.add.text(this.panelLeft + 20, contentTop + 10, '技能点: 0', {
      fontSize: '13px', fill: '#00ccff', fontFamily: 'Courier New'
    });
    container.add(this.skillPointsText);

    // --- Skill Cards (read from player dynamically) ---
    const cardStartY = contentTop + 40;
    const cardW = contentW - 40;
    const cardH = 90;
    const cardGap = 10;
    const cardX = this.panelX;

    this.skillCards = {};

    const player = this.gameScene?.player;
    const skillDefs = player?.skillEngine?.getSkillDefs() || {};
    const playerSlots = player?.skillSlots || [];

    const allSkillIds = Object.keys(skillDefs);
    allSkillIds.forEach((skillId, idx) => {
      const base = skillDefs[skillId];
      const cy = cardStartY + idx * (cardH + cardGap) + cardH / 2;

      // Card background
      const cardBg = this.add.rectangle(cardX, cy, cardW, cardH, 0x1e1e30, 0.9)
        .setStrokeStyle(1, 0x4a4a6a);
      container.add(cardBg);

      // Skill icon (large)
      const iconText = this.add.text(cardX - cardW / 2 + 30, cy, base.icon || '?', {
        fontSize: '24px', fontFamily: 'Courier New'
      }).setOrigin(0.5);
      container.add(iconText);

      // Skill name
      const nameText = this.add.text(cardX - cardW / 2 + 60, cy - 28, base.name, {
        fontSize: '13px', fill: '#ffffff', fontFamily: 'Courier New', fontStyle: 'bold'
      });
      container.add(nameText);

      // Level text
      const lvText = this.add.text(cardX - cardW / 2 + 60 + 100, cy - 28, 'Lv.1/5', {
        fontSize: '11px', fill: '#aaccff', fontFamily: 'Courier New'
      });
      container.add(lvText);

      // Description
      const descText = this.add.text(cardX - cardW / 2 + 60, cy - 10, '', {
        fontSize: '10px', fill: '#aaaaaa', fontFamily: 'Courier New',
        wordWrap: { width: cardW - 180 }
      });
      container.add(descText);

      // Stats line (cost, cooldown)
      const statsText = this.add.text(cardX - cardW / 2 + 60, cy + 22, '', {
        fontSize: '9px', fill: '#888899', fontFamily: 'Courier New'
      });
      container.add(statsText);

      // Slot key hint
      const slotIdx = playerSlots.indexOf(skillId);
      if (slotIdx >= 0) {
        const keyHint = this.add.text(cardX - cardW / 2 + 12, cy - 30, `[${slotIdx + 1}]`, {
          fontSize: '9px', fill: '#666688', fontFamily: 'Courier New'
        });
        container.add(keyHint);
      }

      // Upgrade button
      const btnX = cardX + cardW / 2 - 45;
      const btnW = 70;
      const btnH = 26;
      const btnBg = this.add.rectangle(btnX, cy + 5, btnW, btnH, 0x2a3a2a)
        .setStrokeStyle(1, 0x44bb44).setInteractive({ useHandCursor: true });
      container.add(btnBg);

      const btnText = this.add.text(btnX, cy + 5, '升级', {
        fontSize: '11px', fill: '#44bb44', fontFamily: 'Courier New'
      }).setOrigin(0.5);
      container.add(btnText);

      // Next level preview
      const nextLvText = this.add.text(btnX, cy + 24, '', {
        fontSize: '8px', fill: '#666688', fontFamily: 'Courier New'
      }).setOrigin(0.5);
      container.add(nextLvText);

      btnBg.on('pointerdown', () => {
        this.handleSkillUpgrade(skillId);
      });
      btnBg.on('pointerover', () => {
        btnBg.setFillStyle(0x3a4a3a);
      });
      btnBg.on('pointerout', () => {
        btnBg.setFillStyle(0x2a3a2a);
      });

      this.skillCards[skillId] = { cardBg, iconText, nameText, lvText, descText, statsText, btnBg, btnText, nextLvText };
    });

    // Bottom hint
    const hintY = cardStartY + allSkillIds.length * (cardH + cardGap) + 10;
    this.skillHintText = this.add.text(this.panelX, hintY, '每3级获得1个技能点', {
      fontSize: '10px', fill: '#555566', fontFamily: 'Courier New'
    }).setOrigin(0.5, 0);
    container.add(this.skillHintText);

    this.refreshSkillTreeTab();
  },

  refreshSkillTreeTab() {
    const levelSystem = this.registry.get('levelSystem');
    const player = this.gameScene?.player;
    const engine = player?.skillEngine;
    if (!engine || !this.skillCards) return;

    if (this.skillPointsText) {
      this.skillPointsText.setText(`技能点: ${levelSystem ? levelSystem.skillPoints : 0}`);
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
      card.lvText.setColor(isMaxed ? '#ffd700' : '#aaccff');

      // Update description
      if (skillModule?.getSkillDescription) {
        card.descText.setText(skillModule.getSkillDescription(skillId, level));
      }

      // Update stats line
      const resourceNames = { stamina: '体力', rage: '怒气', mana: '魔力' };
      const resourceName = resourceNames[base.resource] || '';
      const dmgText = scaled.effect?.damageMultiplier ? ` | 伤害: ${Math.round(scaled.effect.damageMultiplier * 100)}%` : '';
      card.statsText.setText(`${resourceName}: ${scaled.cost} | 冷却: ${(scaled.cooldown / 1000).toFixed(1)}s${dmgText}`);

      // Update card border
      card.cardBg.setStrokeStyle(1, isMaxed ? 0xffd700 : 0x4a4a6a);

      // Update upgrade button
      if (isMaxed) {
        card.btnText.setText('已满级');
        card.btnText.setColor('#ffd700');
        card.btnBg.setStrokeStyle(1, 0x665500);
        card.btnBg.setFillStyle(0x2a2a1a);
        card.btnBg.disableInteractive();
        card.nextLvText.setText('');
      } else if (skillPoints >= base.upgradeCost) {
        card.btnText.setText(`升级 (${base.upgradeCost}点)`);
        card.btnText.setColor('#44bb44');
        card.btnBg.setStrokeStyle(1, 0x44bb44);
        card.btnBg.setFillStyle(0x2a3a2a);
        card.btnBg.setInteractive({ useHandCursor: true });
        // Next level preview
        const nextScaled = engine.getScaledSkill(skillId);
        const nextDmg = nextScaled.effect?.damageMultiplier ? Math.round(nextScaled.effect.damageMultiplier * 100) : 0;
        card.nextLvText.setText(nextDmg ? `下级: ${nextDmg}%伤害` : '');
        card.nextLvText.setColor('#558855');
      } else {
        card.btnText.setText(`升级 (${base.upgradeCost}点)`);
        card.btnText.setColor('#666666');
        card.btnBg.setStrokeStyle(1, 0x444444);
        card.btnBg.setFillStyle(0x2a2a2a);
        card.btnBg.disableInteractive();
        card.nextLvText.setText('技能点不足');
        card.nextLvText.setColor('#664444');
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
        card.cardBg.setStrokeStyle(2, 0xffdd44);
        this.time.delayedCall(300, () => {
          if (card.cardBg) card.cardBg.setStrokeStyle(1, 0x4a4a6a);
        });
      }
      this.refreshSkillTreeTab();
      this.refreshCharacterTab();
    }
  }
};
