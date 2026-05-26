import Phaser from 'phaser';

/**
 * TrainerPanel — 训练师 UI（in-scene overlay，与 ShopPanel/DialoguePanel 同模式）
 *
 * 显示训练师可教的技能列表；左键学习；底部按钮重置天赋。
 */
export class TrainerPanel {
  constructor(scene, trainerService) {
    this.scene = scene;
    this.service = trainerService;
    this.visible = false;
    this.rows = [];

    this._build();
    this._listen();
  }

  _build() {
    const W = 760, H = 540;
    const cx = 1920 / 2, cy = 1080 / 2;
    this.container = this.scene.add.container(cx, cy)
      .setDepth(9991).setScrollFactor(0).setVisible(false);

    this.bg = this.scene.add.rectangle(0, 0, W, H, 0x141420, 0.97)
      .setStrokeStyle(2, 0x66ccff);
    this.border = this.scene.add.rectangle(0, 0, W + 6, H + 6, 0, 0)
      .setStrokeStyle(1, 0x66ccff, 0.3);

    this.titleText = this.scene.add.text(0, -H / 2 + 22, '训练师', {
      fontSize: '24px', fill: '#66ccff', fontFamily: 'Courier New', fontStyle: 'bold'
    }).setOrigin(0.5, 0);

    this.subText = this.scene.add.text(0, -H / 2 + 56, '', {
      fontSize: '14px', fill: '#aaaaaa', fontFamily: 'Courier New'
    }).setOrigin(0.5, 0);

    this.goldText = this.scene.add.text(0, H / 2 - 60, '', {
      fontSize: '16px', fill: '#ffdd44', fontFamily: 'Courier New'
    }).setOrigin(0.5, 0.5);

    // 重置按钮
    this.resetBtn = this.scene.add.text(0, H / 2 - 30, '[ 重置天赋 ]', {
      fontSize: '16px', fill: '#ff8888', fontFamily: 'Courier New', fontStyle: 'bold'
    }).setOrigin(0.5, 0.5).setInteractive({ useHandCursor: true });
    this.resetBtn.on('pointerover', () => this.resetBtn.setFill('#ffcccc'));
    this.resetBtn.on('pointerout', () => this.resetBtn.setFill('#ff8888'));
    this.resetBtn.on('pointerdown', () => this.service.resetTalents());

    this.hintText = this.scene.add.text(0, H / 2 - 8, '[ESC] 关闭', {
      fontSize: '12px', fill: '#888888', fontFamily: 'Courier New'
    }).setOrigin(0.5, 0.5);

    this.container.add([
      this.border, this.bg, this.titleText, this.subText,
      this.goldText, this.resetBtn, this.hintText
    ]);

    this.scene.input.keyboard.on('keydown-ESC', () => {
      if (this.visible) this.hide();
    });
  }

  _listen() {
    this.scene.events.on('trainerOpened', ({ trainerId, npc }) => this.show(trainerId, npc));
    this.scene.events.on('trainerClosed', () => this.hide());
    this.scene.events.on('skillLearned', () => this.refresh());
    this.scene.events.on('talentsReset', () => this.refresh());
    this.scene.events.on('goldChanged', () => { if (this.visible) this._refreshGold(); });
    this.scene.events.on('skillPointsChanged', () => { if (this.visible) this.refresh(); });
  }

  show(trainerId, npc) {
    this.trainerId = trainerId;
    this.npc = npc;
    this.visible = true;
    this.container.setVisible(true);
    const cfg = this.service.getConfig();
    this.titleText.setText(`${npc?.name || cfg?.name || '训练师'}`);
    const player = this.scene.player;
    const ls = this.scene.levelSystem;
    this.subText.setText(`职业：${player?.classType || '?'}   等级：${ls?.level || 1}   技能点：${ls?.skillPoints || 0}`);
    this.refresh();
    if (this.scene.player) this.scene.player.canInteract = false;
  }

  hide() {
    if (!this.visible) return;
    this.visible = false;
    this.container.setVisible(false);
    this._clearRows();
    if (this.service.currentTrainerId) this.service.close();
    if (this.scene.player) this.scene.player.canInteract = true;
  }

  refresh() {
    if (!this.visible) return;
    const cfg = this.service.getConfig();
    if (!cfg) return;
    const ls = this.scene.levelSystem;
    this.subText.setText(`职业：${this.scene.player?.classType || '?'}   等级：${ls?.level || 1}   技能点：${ls?.skillPoints || 0}`);
    this._clearRows();
    this._renderSkills();
    this._refreshGold();
  }

  _refreshGold() {
    const gold = this.scene.inventory?.gold ?? 0;
    const cfg = this.service.getConfig();
    const cost = cfg?.talentResetCost || 5000;
    this.goldText.setText(`金币：${gold} G    （重置天赋需 ${cost} G）`);
  }

  _clearRows() {
    for (const r of this.rows) r.destroy();
    this.rows = [];
  }

  _renderSkills() {
    const cfg = this.service.getConfig();
    if (!cfg) return;
    const baseY = -540 / 2 + 110;
    const rowH = 42;
    const tree = this.scene.skillTreeSystem;
    if (!cfg.skills.length) {
      const t = this.scene.add.text(0, baseY, '（该训练师暂无可教技能）', {
        fontSize: '14px', fill: '#777777', fontFamily: 'Courier New'
      }).setOrigin(0.5, 0);
      this.container.add(t);
      this.rows.push(t);
      return;
    }
    for (let i = 0; i < cfg.skills.length; i++) {
      const entry = cfg.skills[i];
      const node = tree?.getNode(entry.skillId);
      const state = tree?.getNodeState(entry.skillId);
      const check = this.service.canLearn(entry);
      const name = node?.name || entry.skillId;
      const desc = node?.description || '';
      const rankInfo = node ? ` (${node.currentRank}/${node.maxRank})` : '';
      const stateLabel = state === 'maxed' ? '【已学满】' : state === 'unlocked' ? '【已学】' : '';
      const colorMap = {
        maxed: '#888888', unlocked: '#aaffaa', available: '#ffffff', locked: '#777777'
      };
      const color = check.ok ? '#ffffff' : colorMap[state] || '#777777';
      const text = `${name}${rankInfo} ${stateLabel}\n  ${desc}  [Lv${entry.levelReq} / ${entry.goldCost}G]`;
      const row = this.scene.add.text(-360, baseY + i * rowH, text, {
        fontSize: '13px', fill: color, fontFamily: 'Courier New'
      }).setOrigin(0, 0);
      if (check.ok) {
        row.setInteractive({ useHandCursor: true });
        row.on('pointerover', () => row.setBackgroundColor('#2a3a4a'));
        row.on('pointerout', () => row.setBackgroundColor(null));
        row.on('pointerdown', () => this.service.learn(entry));
      }
      this.container.add(row);
      this.rows.push(row);
    }
  }
}
