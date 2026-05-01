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
      contentW, contentH, 0x12121e, 0.8
    ).setStrokeStyle(1, 0x3a3a5a);
    container.add(contentBg);

    // Left panel (30%) - quest list
    const leftW = contentW * 0.3;
    const leftX = this.panelLeft + 10;
    const listBg = this.add.rectangle(
      leftX + leftW / 2, contentTop + contentH / 2,
      leftW, contentH - 10, 0x1a1a28, 0.9
    ).setStrokeStyle(1, 0x3a3a4a);
    container.add(listBg);

    // Quest list title
    const listTitle = this.add.text(leftX + 10, contentTop + 10, '任务列表', {
      fontSize: '13px', fill: '#aaaacc', fontFamily: 'Courier New', fontStyle: 'bold'
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
      fontSize: '15px', fill: '#ffffff', fontFamily: 'Courier New', fontStyle: 'bold'
    });
    container.add(this.questDetailTitle);

    // Quest type badge
    this.questDetailType = this.add.text(rightX + 10, contentTop + 32, '', {
      fontSize: '10px', fill: '#888888', fontFamily: 'Courier New'
    });
    container.add(this.questDetailType);

    // Description
    this.questDetailDesc = this.add.text(rightX + 10, contentTop + 52, '', {
      fontSize: '11px', fill: '#aaaaaa', fontFamily: 'Courier New',
      wordWrap: { width: rightW - 30 }
    });
    container.add(this.questDetailDesc);

    // Objectives section
    this.questObjTitle = this.add.text(rightX + 10, contentTop + 100, '', {
      fontSize: '12px', fill: '#8888aa', fontFamily: 'Courier New'
    });
    container.add(this.questObjTitle);

    this.questObjTexts = [];
    for (let i = 0; i < 5; i++) {
      const objText = this.add.text(rightX + 20, contentTop + 120 + i * 22, '', {
        fontSize: '11px', fill: '#cccccc', fontFamily: 'Courier New'
      });
      this.questObjTexts.push(objText);
      container.add(objText);
    }

    // Rewards section
    this.questRewardsTitle = this.add.text(rightX + 10, contentTop + 240, '', {
      fontSize: '12px', fill: '#8888aa', fontFamily: 'Courier New'
    });
    container.add(this.questRewardsTitle);

    this.questRewardsText = this.add.text(rightX + 20, contentTop + 260, '', {
      fontSize: '11px', fill: '#ffd700', fontFamily: 'Courier New'
    });
    container.add(this.questRewardsText);

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
      { label: '-- 主线任务 --', quests: questSystem.quests.filter(q => q.type === 'main' && q.status === 'active') },
      { label: '-- 支线任务 --', quests: questSystem.quests.filter(q => q.type === 'side' && q.status === 'active') },
      { label: '-- 已完成 --', quests: questSystem.quests.filter(q => q.status === 'completed') }
    ];

    groups.forEach(group => {
      if (group.quests.length === 0) return;

      // Group header
      const header = this.add.text(leftX + 15, y, group.label, {
        fontSize: '10px', fill: '#666688', fontFamily: 'Courier New'
      });
      this.questListContainer.add(header);
      y += 18;

      group.quests.forEach(quest => {
        const isSelected = quest.id === this.selectedQuestId;
        const isCompleted = quest.status === 'completed';
        const color = isCompleted ? '#555555' : (quest.type === 'main' ? '#ffaa44' : '#aaaacc');

        const item = this.add.text(leftX + 20, y,
          `${isCompleted ? '\u2713 ' : '\u25CF '}${quest.title}`, {
            fontSize: '11px', fill: isSelected ? '#ffffff' : color,
            fontFamily: 'Courier New',
            backgroundColor: isSelected ? '#3a3a5e' : undefined,
            padding: isSelected ? { x: 4, y: 2 } : undefined
          }
        ).setInteractive({ useHandCursor: true });

        item.on('pointerdown', () => this.selectQuest(quest.id));
        item.on('pointerover', () => { if (!isSelected) item.setColor('#ffffff'); });
        item.on('pointerout', () => { if (quest.id !== this.selectedQuestId) item.setColor(color); });

        this.questListContainer.add(item);
        this.questListItems.push({ text: item, questId: quest.id });
        y += 20;
      });

      y += 5;
    });

    // Auto-select first active quest if none selected
    if (!this.selectedQuestId) {
      const firstActive = questSystem.getActiveQuests()[0];
      if (firstActive) this.selectQuest(firstActive.id);
    } else {
      this.selectQuest(this.selectedQuestId);
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
      return;
    }

    const typeLabels = { main: '[主线]', side: '[支线]' };
    const statusLabels = { active: '进行中', completed: '已完成', locked: '未解锁' };

    this.questDetailTitle.setText(quest.title);
    this.questDetailType.setText(`${typeLabels[quest.type] || ''} ${statusLabels[quest.status] || ''}`);
    this.questDetailType.setColor(quest.type === 'main' ? '#ffaa44' : '#8888aa');
    this.questDetailDesc.setText(quest.description);

    // Objectives
    this.questObjTitle.setText('-- 目标 --');
    quest.objectives.forEach((obj, i) => {
      if (i < this.questObjTexts.length) {
        const done = obj.current >= obj.required;
        const prefix = done ? '\u2713' : '\u25CB';
        this.questObjTexts[i].setText(`${prefix} ${obj.text} (${obj.current}/${obj.required})`);
        this.questObjTexts[i].setColor(done ? '#44bb44' : '#cccccc');
      }
    });
    // Clear remaining objective lines
    for (let i = quest.objectives.length; i < this.questObjTexts.length; i++) {
      this.questObjTexts[i].setText('');
    }

    // Rewards
    this.questRewardsTitle.setText('-- 奖励 --');
    let rewardStr = '';
    if (quest.rewards.xp) rewardStr += `经验: ${quest.rewards.xp}  `;
    if (quest.rewards.gold) rewardStr += `金币: ${quest.rewards.gold}`;
    this.questRewardsText.setText(rewardStr);
  }
};
