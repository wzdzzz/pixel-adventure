import Phaser from 'phaser';
import { getClassLabel, THEME_CONFIG } from '../config/themeConfig.js';
import { UI_THEME } from '../config/uiTheme.js';

/**
 * TrainerPanel — 训练师 UI（in-scene overlay，与 ShopPanel/DialoguePanel 同模式）
 *
 * 显示训练师可教的技能列表；左键学习；底部按钮重置天赋。
 */
export class TrainerPanel {
  constructor(scene, trainerService, displayScene = null) {
    this.scene = scene;
    this.displayScene = displayScene || scene;
    this.service = trainerService;
    this.visible = false;
    this.rows = [];

    this._build();
    this._listen();
  }

  _build() {
    const W = 760, H = 540;
    const cx = 1920 / 2, cy = 1080 / 2;
    this.container = this.displayScene.add.container(cx, cy)
      .setDepth(9991).setScrollFactor(0).setVisible(false);

    this.bg = this.displayScene.add.rectangle(0, 0, W, H, UI_THEME.colors.panel, 0.98)
      .setStrokeStyle(2, UI_THEME.colors.jade);
    this.border = this.displayScene.add.rectangle(0, 0, W + 6, H + 6, 0, 0)
      .setStrokeStyle(1, UI_THEME.colors.jade, 0.3);

    this.titleText = this.displayScene.add.text(0, -H / 2 + 22, '传功教习', {
      fontSize: '24px', fill: UI_THEME.text.jadeBright, fontFamily: UI_THEME.font.body, fontStyle: 'bold'
    }).setOrigin(0.5, 0);

    this.subText = this.displayScene.add.text(0, -H / 2 + 56, '', {
      fontSize: '14px', fill: UI_THEME.text.muted, fontFamily: UI_THEME.font.body
    }).setOrigin(0.5, 0);

    this.goldText = this.displayScene.add.text(0, H / 2 - 60, '', {
      fontSize: '16px', fill: UI_THEME.text.brass, fontFamily: UI_THEME.font.body
    }).setOrigin(0.5, 0.5);

    // 重置按钮
    this.resetBtn = this.displayScene.add.text(0, H / 2 - 30, '[ 重悟传承 ]', {
      fontSize: '16px', fill: UI_THEME.text.cinnabarBright, fontFamily: UI_THEME.font.body, fontStyle: 'bold'
    }).setOrigin(0.5, 0.5).setInteractive({ useHandCursor: true });
    this.resetBtn.on('pointerover', () => this.resetBtn.setFill(UI_THEME.text.paper));
    this.resetBtn.on('pointerout', () => this.resetBtn.setFill(UI_THEME.text.cinnabarBright));
    this.resetBtn.on('pointerdown', () => this.service.resetTalents());

    this.hintText = this.displayScene.add.text(0, H / 2 - 8, '[ESC] 关闭', {
      fontSize: '12px', fill: UI_THEME.text.muted, fontFamily: UI_THEME.font.mono
    }).setOrigin(0.5, 0.5);

    this.container.add([
      this.border, this.bg, this.titleText, this.subText,
      this.goldText, this.resetBtn, this.hintText
    ]);

    this.displayScene.input.keyboard.on('keydown-ESC', () => {
      if (this.visible) this.hide();
    });
  }

  _listen() {
    // 存引用以便 shutdown 时解绑（MainGameScene 单例复用，否则陈旧面板
    // 监听器会在已销毁的 UIScene 文本上操作导致 drawImage 崩溃）
    this._handlers = {
      trainerOpened: ({ trainerId, npc }) => this.show(trainerId, npc),
      trainerClosed: () => this.hide(),
      skillLearned: () => this.refresh(),
      talentsReset: () => this.refresh(),
      goldChanged: () => { if (this.visible) this._refreshGold(); },
      skillPointsChanged: () => { if (this.visible) this.refresh(); },
    };
    for (const ev in this._handlers) this.scene.events.on(ev, this._handlers[ev]);
    this.scene.events.once('shutdown', this.destroy, this);
    this.scene.events.once('destroy', this.destroy, this);
  }

  /** 解绑场景事件 + 销毁显示对象，防止场景重启后监听器泄漏。 */
  destroy() {
    if (this._destroyed) return;
    this._destroyed = true;
    if (this.scene && this.scene.events && this._handlers) {
      for (const ev in this._handlers) this.scene.events.off(ev, this._handlers[ev]);
    }
    if (this.container) { try { this.container.destroy(); } catch (e) { /* UIScene 可能已销毁 */ } this.container = null; }
  }

  show(trainerId, npc) {
    this.trainerId = trainerId;
    this.npc = npc;
    this.visible = true;
    this.container.setVisible(true);
    const cfg = this.service.getConfig();
    this.titleText.setText(`${npc?.name || cfg?.name || '传功教习'}`);
    const player = this.scene.player;
    const ls = this.scene.levelSystem;
    this.subText.setText(`路数：${getClassLabel(player?.classType)}   修为等级：${ls?.level || 1}   ${THEME_CONFIG.skillPoint}：${ls?.skillPoints || 0}`);
    this.refresh();
    if (this.scene.player) this.scene.player.canInteract = false;
    this.scene.uiBlocking = true;
  }

  hide() {
    if (!this.visible) return;
    this.visible = false;
    this.container.setVisible(false);
    this._clearRows();
    if (this.service.currentTrainerId) this.service.close();
    if (this.scene.player) this.scene.player.canInteract = true;
    this.scene.uiBlocking = false;
  }

  refresh() {
    if (!this.visible) return;
    const cfg = this.service.getConfig();
    if (!cfg) return;
    const ls = this.scene.levelSystem;
    this.subText.setText(`路数：${getClassLabel(this.scene.player?.classType)}   修为等级：${ls?.level || 1}   ${THEME_CONFIG.skillPoint}：${ls?.skillPoints || 0}`);
    this._clearRows();
    this._renderSkills();
    this._refreshGold();
  }

  _refreshGold() {
    const gold = this.scene.inventory?.gold ?? 0;
    const cfg = this.service.getConfig();
    const cost = cfg?.talentResetCost || 5000;
    this.goldText.setText(`${THEME_CONFIG.currency}：${gold}    （重悟传承需 ${cost}）`);
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
      const t = this.displayScene.add.text(0, baseY, '（该教习暂无可授传承）', {
        fontSize: '14px', fill: UI_THEME.text.disabled, fontFamily: UI_THEME.font.body
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
        maxed: UI_THEME.text.muted, unlocked: UI_THEME.text.jadeBright, available: UI_THEME.text.paper, locked: UI_THEME.text.disabled
      };
      const color = check.ok ? UI_THEME.text.paper : colorMap[state] || UI_THEME.text.disabled;
      const text = `${name}${rankInfo} ${stateLabel}\n  ${desc}  [Lv${entry.levelReq} / ${entry.goldCost}${THEME_CONFIG.currency}]`;
      const row = this.displayScene.add.text(-360, baseY + i * rowH, text, {
        fontSize: '13px', fill: color, fontFamily: UI_THEME.font.body
      }).setOrigin(0, 0);
      if (check.ok) {
        row.setInteractive({ useHandCursor: true });
        row.on('pointerover', () => row.setBackgroundColor('#233a31'));
        row.on('pointerout', () => row.setBackgroundColor(null));
        row.on('pointerdown', () => this.service.learn(entry));
      }
      this.container.add(row);
      this.rows.push(row);
    }
  }
}
