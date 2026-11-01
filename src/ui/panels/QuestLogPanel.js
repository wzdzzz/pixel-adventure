import { THEME_CONFIG } from '../../config/themeConfig.js';
import { UI_THEME } from '../../config/uiTheme.js';

export const QuestLogPanel = {
  createQuestLogTab() {
    const container = this.add.container(0, 0).setDepth(5).setVisible(false);
    this.tabContainers.questLog = container;

    const contentTop = this.panelTop + 50;
    const contentW = this.panelW - 20;
    const contentH = this.panelH - 60;

    // Content background
    const contentBg = this.add.rectangle(
      this.panelX, contentTop + contentH / 2,
      contentW, contentH, UI_THEME.colors.backdrop, 0.88
    ).setStrokeStyle(1, UI_THEME.colors.borderMuted);
    container.add(contentBg);

    // Left panel (30%) - quest list
    const leftW = contentW * 0.3;
    const leftX = this.panelLeft + 10;
    const listBg = this.add.rectangle(
      leftX + leftW / 2, contentTop + contentH / 2,
      leftW, contentH - 10, UI_THEME.colors.panelRaised, 0.9
    ).setStrokeStyle(1, UI_THEME.colors.borderMuted);
    container.add(listBg);

    // Quest list title
    const listTitle = this.add.text(leftX + 10, contentTop + 10, '游历与悬赏', {
      fontSize: '15px', fill: UI_THEME.text.muted, fontFamily: UI_THEME.font.body, fontStyle: 'bold'
    });
    container.add(listTitle);

    // Quest list area
    this.questListItems = [];
    this.questListContainer = this.add.container(0, 0);
    container.add(this.questListContainer);

    // Right panel (70%) - quest detail
    const rightX = leftX + leftW + 10;
    const rightW = contentW - leftW - 20;

    // Detail panel title
    this.questDetailTitle = this.add.text(rightX + 10, contentTop + 10, '', {
      fontSize: '17px', fill: UI_THEME.text.paper, fontFamily: UI_THEME.font.body, fontStyle: 'bold'
    });
    container.add(this.questDetailTitle);

    // Quest type badge
    this.questDetailType = this.add.text(rightX + 10, contentTop + 32, '', {
      fontSize: '13px', fill: UI_THEME.text.muted, fontFamily: UI_THEME.font.body
    });
    container.add(this.questDetailType);

    // Description
    this.questDetailDesc = this.add.text(rightX + 10, contentTop + 52, '', {
      fontSize: '14px', fill: UI_THEME.text.muted, fontFamily: UI_THEME.font.body,
      wordWrap: { width: rightW - 30 }
    });
    container.add(this.questDetailDesc);

    // Objectives section
    this.questObjTitle = this.add.text(rightX + 10, contentTop + 100, '', {
      fontSize: '14px', fill: UI_THEME.text.jade, fontFamily: UI_THEME.font.body
    });
    container.add(this.questObjTitle);

    this.questObjTexts = [];
    for (let i = 0; i < 5; i++) {
      const objText = this.add.text(rightX + 20, contentTop + 120 + i * 22, '', {
        fontSize: '14px', fill: UI_THEME.text.paper, fontFamily: UI_THEME.font.body
      });
      this.questObjTexts.push(objText);
      container.add(objText);
    }

    // Rewards section
    this.questRewardsTitle = this.add.text(rightX + 10, contentTop + 240, '', {
      fontSize: '14px', fill: UI_THEME.text.jade, fontFamily: UI_THEME.font.body
    });
    container.add(this.questRewardsTitle);

    this.questRewardsText = this.add.text(rightX + 20, contentTop + 260, '', {
      fontSize: '14px', fill: UI_THEME.text.brass, fontFamily: UI_THEME.font.body
    });
    container.add(this.questRewardsText);

    // 追踪按钮
    const trackBtnY = contentTop + contentH - 30;
    this.questTrackBtnBg = this.add.rectangle(rightX + rightW / 2, trackBtnY, 120, 26, UI_THEME.colors.panelRaised)
      .setStrokeStyle(1, UI_THEME.colors.jade).setInteractive({ useHandCursor: true });
    this.questTrackBtnText = this.add.text(rightX + rightW / 2, trackBtnY, '追踪任务', {
      fontSize: '14px', fill: UI_THEME.text.jade, fontFamily: UI_THEME.font.body
    }).setOrigin(0.5);
    this.questTrackBtnBg.on('pointerdown', () => {
      if (!this.selectedQuestId) return;
      const questSystem = this.gameScene?.questSystem || this.registry.get('questSystem');
      if (!questSystem) return;
      if (this._questBtnMode === 'accept') {
        questSystem.acceptQuest(this.selectedQuestId);
      } else if (this._questBtnMode === 'track') {
        questSystem.setTrackedQuest(this.selectedQuestId);
      }
      this.refreshQuestLogTab();
    });
    container.add([this.questTrackBtnBg, this.questTrackBtnText]);

    // 任务列表滚动遮罩
    const listMask = this.add.rectangle(leftX + leftW / 2, contentTop + contentH / 2, leftW, contentH - 35, 0xffffff)
      .setOrigin(0.5).setVisible(false);
    this.questListContainer.setMask(new Phaser.Display.Masks.GeometryMask(this, listMask));
    this._questListMask = listMask;
    this._questListScrollY = 0;
    this._questListMaxH = contentH - 35;

    // 滚轮滚动
    this.input.on('wheel', (pointer, gameObjects, deltaX, deltaY) => {
      if (this.activeTab !== 'questLog') return;
      if (pointer.x < leftX || pointer.x > leftX + leftW) return;
      this._questListScrollY = Phaser.Math.Clamp(
        this._questListScrollY - deltaY * 0.5, -(this._questListContentH || 0), 0
      );
      this.questListContainer.y = this._questListScrollY;
    });

    this.selectedQuestId = null;
  },

  refreshQuestLogTab() {
    const questSystem = this.registry.get('questSystem');
    if (!questSystem || !this.questListContainer) return;

    // Clear existing list items
    this.questListContainer.removeAll(true);
    this.questListItems = [];

    const contentTop = this.panelTop + 50;
    const leftX = this.panelLeft + 10;
    let y = contentTop + 35;

    // Group quests
    const groups = [
      { label: '-- 可接取 --', quests: questSystem.quests.filter(q => q.status === 'available') },
      { label: '-- 进行中 --', quests: questSystem.quests.filter(q => q.status === 'active') },
      { label: '-- 已完成 --', quests: questSystem.quests.filter(q => q.status === 'completed') }
    ];

    groups.forEach(group => {
      if (group.quests.length === 0) return;

      // Group header
      const header = this.add.text(leftX + 15, y, group.label, {
        fontSize: '13px', fill: UI_THEME.text.disabled, fontFamily: UI_THEME.font.body
      });
      this.questListContainer.add(header);
      y += 18;

      group.quests.forEach(quest => {
        const isSelected = quest.id === this.selectedQuestId;
        const isCompleted = quest.status === 'completed';
        const color = isCompleted ? UI_THEME.text.disabled : (quest.type === 'main' ? UI_THEME.text.brass : UI_THEME.text.muted);

        const item = this.add.text(leftX + 20, y,
          `${isCompleted ? '\u2713 ' : '\u25CF '}${quest.title}`, {
            fontSize: '14px', fill: isSelected ? UI_THEME.text.jadeBright : color,
            fontFamily: UI_THEME.font.body,
            backgroundColor: isSelected ? '#233a31' : undefined,
            padding: isSelected ? { x: 4, y: 2 } : undefined
          }
        ).setInteractive({ useHandCursor: true });

        item.on('pointerdown', () => this.selectQuest(quest.id));
        item.on('pointerover', () => { if (!isSelected) item.setColor(UI_THEME.text.paper); });
        item.on('pointerout', () => { if (quest.id !== this.selectedQuestId) item.setColor(color); });

        this.questListContainer.add(item);
        this.questListItems.push({ text: item, questId: quest.id });
        y += 20;
      });

      y += 5;
    });

    // 记录列表内容总高度（用于滚动限制）
    this._questListContentH = Math.max(0, y - contentTop - 35 - this._questListMaxH);
    this.questListContainer.y = 0;
    this._questListScrollY = 0;

    // 默认选中：优先进行中，其次可接取
    const stillValid = this.selectedQuestId && questSystem.quests.find(q => q.id === this.selectedQuestId && q.status !== 'locked');
    if (stillValid) {
      this.selectQuest(this.selectedQuestId);
    } else {
      const first = questSystem.getActiveQuests()[0] || questSystem.getAvailableQuests()[0];
      if (first) this.selectQuest(first.id);
      else this.selectQuest(null);
    }
  },

  selectQuest(questId) {
    const questSystem = this.registry.get('questSystem');
    if (!questSystem) return;

    this.selectedQuestId = questId;
    const quest = questSystem.quests.find(q => q.id === questId);
    if (!quest) {
      this.questDetailTitle.setText('');
      this.questDetailType.setText('');
      this.questDetailDesc.setText('选择一个任务查看详情');
      this.questObjTitle.setText('');
      this.questObjTexts.forEach(t => t.setText(''));
      this.questRewardsTitle.setText('');
      this.questRewardsText.setText('');
      this._questBtnMode = null;
      if (this.questTrackBtnBg) this.questTrackBtnBg.setVisible(false);
      if (this.questTrackBtnText) this.questTrackBtnText.setVisible(false);
      return;
    }

    const typeLabels = { main: '[主线]', side: '[支线]' };
    const statusLabels = { active: '进行中', completed: '已完成', locked: '未解锁' };

    this.questDetailTitle.setText(quest.title);
    this.questDetailType.setText(`${typeLabels[quest.type] || ''} ${statusLabels[quest.status] || ''}`);
    this.questDetailType.setColor(quest.type === 'main' ? UI_THEME.text.brass : UI_THEME.text.muted);
    this.questDetailDesc.setText(quest.description);

    // Objectives
    this.questObjTitle.setText('-- 目标 --');
    quest.objectives.forEach((obj, i) => {
      if (i < this.questObjTexts.length) {
        const done = obj.current >= obj.required;
        const prefix = done ? '\u2713' : '\u25CB';
        this.questObjTexts[i].setText(`${prefix} ${obj.text} (${obj.current}/${obj.required})`);
        this.questObjTexts[i].setColor(done ? UI_THEME.text.jadeBright : UI_THEME.text.paper);
      }
    });
    // Clear remaining objective lines
    for (let i = quest.objectives.length; i < this.questObjTexts.length; i++) {
      this.questObjTexts[i].setText('');
    }

    // Rewards
    this.questRewardsTitle.setText('-- 奖励 --');
    let rewardStr = '';
    if (quest.rewards.xp) rewardStr += `${THEME_CONFIG.experience}: ${quest.rewards.xp}  `;
    if (quest.rewards.gold) rewardStr += `${THEME_CONFIG.currency}: ${quest.rewards.gold}`;
    if (quest.rewards.items) {
      quest.rewards.items.forEach(ri => { rewardStr += `  ${ri.name || ri.id} x${ri.count || 1}`; });
    }
    this.questRewardsText.setText(rewardStr);

    // 底部按钮：可接取 → 接受任务；进行中 → 追踪；其他隐藏
    const isTracked = questSystem._trackedQuestId === quest.id;
    if (this.questTrackBtnBg && this.questTrackBtnText) {
      if (quest.status === 'available') {
        this._questBtnMode = 'accept';
        this.questTrackBtnBg.setVisible(true);
        this.questTrackBtnText.setVisible(true);
        this.questTrackBtnText.setText('接受任务');
        this.questTrackBtnText.setColor(UI_THEME.text.jadeBright);
        this.questTrackBtnBg.setStrokeStyle(1, UI_THEME.colors.jadeBright);
      } else if (quest.status === 'active') {
        this._questBtnMode = 'track';
        this.questTrackBtnBg.setVisible(true);
        this.questTrackBtnText.setVisible(true);
        this.questTrackBtnText.setText(isTracked ? '已追踪' : '追踪任务');
        this.questTrackBtnText.setColor(isTracked ? UI_THEME.text.brass : UI_THEME.text.jade);
        this.questTrackBtnBg.setStrokeStyle(1, isTracked ? UI_THEME.colors.brass : UI_THEME.colors.jade);
      } else {
        this._questBtnMode = null;
        this.questTrackBtnBg.setVisible(false);
        this.questTrackBtnText.setVisible(false);
      }
    }
  }
};
