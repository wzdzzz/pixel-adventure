/**
 * PartyPanel — 队伍 / 伙伴面板（PanelScene mixin）
 *
 * 左栏：名册列表（无上限，滚轮滚动）；右栏：选中伙伴详情 + 姿态 + 出战/待命/解散。
 * 数据源：this.gameScene.companionManager。
 * 刷新：tab 切换时 + 每次操作后手动 refreshPartyTab（PanelScene 频繁开关，不挂持久监听以免泄漏）。
 */
const STANCES = [
  { key: 'follow', label: '跟紧' },
  { key: 'hold', label: '原地' },
  { key: 'aggressive', label: '激进' },
  { key: 'defensive', label: '防守' },
];

export const PartyPanel = {
  createPartyTab() {
    const container = this.add.container(0, 0).setDepth(5).setVisible(false);
    this.tabContainers.party = container;

    const contentTop = this.panelTop + 50;
    const contentW = this.panelW - 20;
    const contentH = this.panelH - 60;

    const contentBg = this.add.rectangle(
      this.panelX, contentTop + contentH / 2, contentW, contentH, 0x12121e, 0.8
    ).setStrokeStyle(1, 0x3a3a5a);
    container.add(contentBg);

    // 左栏（35%）：名册列表
    const leftW = contentW * 0.35;
    const leftX = this.panelLeft + 10;
    const listBg = this.add.rectangle(
      leftX + leftW / 2, contentTop + contentH / 2, leftW, contentH - 10, 0x1a1a28, 0.9
    ).setStrokeStyle(1, 0x3a3a4a);
    container.add(listBg);

    this.partyListTitle = this.add.text(leftX + 10, contentTop + 10, '同行 (0)', {
      fontSize: '15px', fill: '#aaaacc', fontFamily: 'Courier New', fontStyle: 'bold'
    });
    container.add(this.partyListTitle);

    this.partyListContainer = this.add.container(0, 0);
    container.add(this.partyListContainer);

    // 列表滚动遮罩
    this._partyListTop = contentTop + 35;
    this._partyListH = contentH - 45;
    const listMask = this.add.rectangle(
      leftX + leftW / 2, this._partyListTop + this._partyListH / 2, leftW, this._partyListH, 0xffffff
    ).setOrigin(0.5).setVisible(false);
    this.partyListContainer.setMask(new Phaser.Display.Masks.GeometryMask(this, listMask));
    this._partyListScrollY = 0;
    this._partyListContentH = 0;

    this.input.on('wheel', (pointer, gameObjects, deltaX, deltaY) => {
      if (this.activeTab !== 'party') return;
      if (pointer.x < leftX || pointer.x > leftX + leftW) return;
      this._partyListScrollY = Phaser.Math.Clamp(
        this._partyListScrollY - deltaY * 0.5, -(this._partyListContentH || 0), 0
      );
      this.partyListContainer.y = this._partyListScrollY;
    });

    // 右栏：详情
    const rightX = leftX + leftW + 14;
    const rightW = contentW - leftW - 24;
    this._partyRightX = rightX;
    this._partyRightW = rightW;

    this.partyDetailName = this.add.text(rightX + 6, contentTop + 12, '', {
      fontSize: '18px', fill: '#ffffff', fontFamily: 'Courier New', fontStyle: 'bold'
    });
    this.partyDetailSub = this.add.text(rightX + 6, contentTop + 40, '', {
      fontSize: '14px', fill: '#aaaacc', fontFamily: 'Courier New'
    });
    this.partyDetailSkills = this.add.text(rightX + 6, contentTop + 64, '', {
      fontSize: '13px', fill: '#88aacc', fontFamily: 'Courier New', wordWrap: { width: rightW - 16 }
    });
    container.add([this.partyDetailName, this.partyDetailSub, this.partyDetailSkills]);

    // 姿态行
    this.partyStanceLabel = this.add.text(rightX + 6, contentTop + 100, '姿态:', {
      fontSize: '14px', fill: '#8888aa', fontFamily: 'Courier New'
    });
    container.add(this.partyStanceLabel);
    this.partyStanceBtns = [];
    STANCES.forEach((s, i) => {
      const bx = rightX + 70 + i * 84;
      const by = contentTop + 100;
      const bg = this.add.rectangle(bx, by + 8, 76, 26, 0x222238)
        .setOrigin(0, 0.5).setStrokeStyle(1, 0x555577).setInteractive({ useHandCursor: true });
      const txt = this.add.text(bx + 38, by + 8, s.label, {
        fontSize: '13px', fill: '#cccccc', fontFamily: 'Courier New'
      }).setOrigin(0.5);
      bg.on('pointerdown', () => this._partySetStance(s.key));
      container.add([bg, txt]);
      this.partyStanceBtns.push({ bg, txt, key: s.key });
    });

    // 操作按钮：出战/待命 + 解散
    const btnY = contentTop + contentH - 32;
    this.partyDeployBtnBg = this.add.rectangle(rightX + 80, btnY, 140, 30, 0x1a2e1a)
      .setStrokeStyle(2, 0x44ff66).setInteractive({ useHandCursor: true });
    this.partyDeployBtnText = this.add.text(rightX + 80, btnY, '出战', {
      fontSize: '15px', fill: '#44ff66', fontFamily: 'Courier New', fontStyle: 'bold'
    }).setOrigin(0.5);
    this.partyDeployBtnBg.on('pointerdown', () => this._partyToggleDeploy());

    this.partyDismissBtnBg = this.add.rectangle(rightX + 240, btnY, 120, 30, 0x2e1a1a)
      .setStrokeStyle(2, 0xff6666).setInteractive({ useHandCursor: true });
    this.partyDismissBtnText = this.add.text(rightX + 240, btnY, '解散', {
      fontSize: '15px', fill: '#ff6666', fontFamily: 'Courier New', fontStyle: 'bold'
    }).setOrigin(0.5);
    this.partyDismissBtnBg.on('pointerdown', () => this._partyDismiss());

    container.add([this.partyDeployBtnBg, this.partyDeployBtnText, this.partyDismissBtnBg, this.partyDismissBtnText]);

    this.partyEmptyHint = this.add.text(rightX + 6, contentTop + 160, '', {
      fontSize: '14px', fill: '#666688', fontFamily: 'Courier New', wordWrap: { width: rightW - 16 }
    });
    container.add(this.partyEmptyHint);

    this.selectedCompanionId = null;
  },

  _partyMgr() {
    return this.gameScene?.companionManager || null;
  },

  refreshPartyTab() {
    const mgr = this._partyMgr();
    if (!mgr || !this.partyListContainer) return;

    this.partyListContainer.removeAll(true);
    const roster = mgr.getRoster();
    this.partyListTitle.setText(`同行 (${roster.length})`);

    const leftX = this.panelLeft + 10;
    let y = this._partyListTop;

    if (roster.length === 0) {
      const empty = this.add.text(leftX + 14, y, '（暂无伙伴）', {
        fontSize: '13px', fill: '#666688', fontFamily: 'Courier New'
      });
      this.partyListContainer.add(empty);
      this.selectedCompanionId = null;
    } else {
      // 选中失效则默认选出战者或第一个
      if (!this.selectedCompanionId || !roster.find(e => e.npcId === this.selectedCompanionId)) {
        this.selectedCompanionId = mgr.getActiveId() || roster[0].npcId;
      }
      roster.forEach((entry) => {
        const info = mgr.getInfo(entry.npcId);
        const selected = entry.npcId === this.selectedCompanionId;
        const statusTag = info.active ? '出战中' : (info.dead ? '倒下' : '待命');
        const statusColor = info.active ? '#44ff66' : (info.dead ? '#ff5555' : '#8899aa');
        const label = `${info.active ? '▶ ' : '  '}${info.name}  Lv${info.level}`;

        const item = this.add.text(leftX + 14, y, label, {
          fontSize: '14px', fill: selected ? '#ffffff' : '#cccccc',
          fontFamily: 'Courier New',
          backgroundColor: selected ? '#3a3a5e' : undefined,
          padding: selected ? { x: 4, y: 2 } : undefined
        }).setInteractive({ useHandCursor: true });
        item.on('pointerdown', () => { this.selectedCompanionId = entry.npcId; this.refreshPartyTab(); });

        const tag = this.add.text(leftX + 14 + 220, y, statusTag, {
          fontSize: '12px', fill: statusColor, fontFamily: 'Courier New'
        });
        this.partyListContainer.add([item, tag]);
        y += 26;
      });
    }

    this._partyListContentH = Math.max(0, (y - this._partyListTop) - this._partyListH);
    this.partyListContainer.y = 0;
    this._partyListScrollY = 0;

    this._refreshPartyDetail();
  },

  _refreshPartyDetail() {
    const mgr = this._partyMgr();
    const info = (mgr && this.selectedCompanionId) ? mgr.getInfo(this.selectedCompanionId) : null;

    const showDetail = !!info;
    this.partyStanceLabel.setVisible(showDetail);
    this.partyStanceBtns.forEach(b => { b.bg.setVisible(showDetail); b.txt.setVisible(showDetail); });
    this.partyDeployBtnBg.setVisible(showDetail);
    this.partyDeployBtnText.setVisible(showDetail);
    this.partyDismissBtnBg.setVisible(showDetail);
    this.partyDismissBtnText.setVisible(showDetail);

    if (!info) {
      this.partyDetailName.setText('');
      this.partyDetailSub.setText('');
      this.partyDetailSkills.setText('');
      this.partyEmptyHint.setColor('#666688');
      this.partyEmptyHint.setText('在栖云坊市寻找愿意同行的修士。\n同时只能有 1 名同伴出战。');
      return;
    }
    this.partyEmptyHint.setText('');

    this.partyDetailName.setText(info.name);
    const statusTxt = info.active ? '【出战中】' : (info.dead ? '【倒下】' : '【待命】');
    this.partyDetailSub.setText(`Lv${info.level}   HP ${info.hp}/${info.hpMax}   ${statusTxt}`);
    this.partyDetailSub.setColor(info.active ? '#88ffaa' : (info.dead ? '#ff7777' : '#aaaacc'));
    this.partyDetailSkills.setText(`技能: ${(info.skills || []).join(', ') || '无'}`);

    // 倒下提示
    this.partyEmptyHint.setText(info.dead ? '⚠ 该伙伴已倒下 — 在篝火旁休息以恢复全队后方可再次出战' : '');
    this.partyEmptyHint.setColor(info.dead ? '#ff8888' : '#666688');

    // 姿态高亮
    this.partyStanceBtns.forEach(b => {
      const on = b.key === info.stance;
      b.bg.setFillStyle(on ? 0x2a3a5a : 0x222238);
      b.bg.setStrokeStyle(1, on ? 0x66aaff : 0x555577);
      b.txt.setColor(on ? '#aaddff' : '#cccccc');
    });

    // 出战/待命 按钮
    if (info.active) {
      this.partyDeployBtnText.setText('待命');
      this.partyDeployBtnBg.setStrokeStyle(2, 0xffaa44);
      this.partyDeployBtnText.setColor('#ffaa44');
    } else {
      this.partyDeployBtnText.setText(info.dead ? '已倒下' : '出战');
      this.partyDeployBtnBg.setStrokeStyle(2, info.dead ? 0x666666 : 0x44ff66);
      this.partyDeployBtnText.setColor(info.dead ? '#888888' : '#44ff66');
    }
  },

  _partyToggleDeploy() {
    const mgr = this._partyMgr();
    if (!mgr || !this.selectedCompanionId) return;
    const info = mgr.getInfo(this.selectedCompanionId);
    if (!info) return;
    if (info.active) mgr.bench(this.selectedCompanionId);
    else mgr.deploy(this.selectedCompanionId);
    this.refreshPartyTab();
  },

  _partyDismiss() {
    const mgr = this._partyMgr();
    if (!mgr || !this.selectedCompanionId) return;
    mgr.dismiss(this.selectedCompanionId);
    this.selectedCompanionId = null;
    this.refreshPartyTab();
  },

  _partySetStance(stance) {
    const mgr = this._partyMgr();
    if (!mgr || !this.selectedCompanionId) return;
    mgr.setStance(this.selectedCompanionId, stance);
    this.refreshPartyTab();
  },
};
