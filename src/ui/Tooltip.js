/**
 * Tooltip — 通用悬浮提示工具
 *
 * 用法：
 *   const tip = new Tooltip(scene, { delay: 1000 });
 *   tip.attach(myInteractiveObject, () => ({ title: '战吼', body: '增加20%攻击力' }));
 *
 * - getContent 返回 null/undefined → 不显示
 * - 同一时刻只显示一个 tooltip（共享面板）
 */
export class Tooltip {
  constructor(scene, options = {}) {
    this.scene = scene;
    this.delay = options.delay ?? 1000;
    this.maxWidth = options.maxWidth ?? 240;

    this.bg = scene.add.rectangle(0, 0, 100, 40, UI_THEME.colors.ink, 0.97)
      .setOrigin(0, 0).setStrokeStyle(1, UI_THEME.colors.brassMuted).setDepth(9998)
      .setScrollFactor(0).setVisible(false);

    this.title = scene.add.text(0, 0, '', {
      fontSize: '14px', color: UI_THEME.text.brass, fontFamily: UI_THEME.font.body, fontStyle: 'bold'
    }).setDepth(9999).setScrollFactor(0).setVisible(false);

    this.body = scene.add.text(0, 0, '', {
      fontSize: '13px', color: UI_THEME.text.paper, fontFamily: UI_THEME.font.body,
      wordWrap: { width: this.maxWidth - 16 }
    }).setDepth(9999).setScrollFactor(0).setVisible(false);

    this._timer = null;
    this._activeTarget = null;
  }

  /**
   * 将 tooltip 绑定到一个 interactive 对象
   * @param {Phaser.GameObjects.GameObject} target - 必须已 setInteractive
   * @param {() => ({title?: string, body?: string} | null)} getContent
   */
  attach(target, getContent) {
    const onOver = () => this._scheduleShow(target, getContent);
    const onOut = () => this._cancel(target);
    const onDown = () => this._cancel(target);
    target.on('pointerover', onOver);
    target.on('pointerout', onOut);
    target.on('pointerdown', onDown);
    // 记录监听器以便 destroy 时解绑
    if (!this._attachedTargets) this._attachedTargets = [];
    this._attachedTargets.push({ target, onOver, onOut, onDown });
  }

  _scheduleShow(target, getContent) {
    this._cancel();
    this._activeTarget = target;
    this._timer = this.scene.time.delayedCall(this.delay, () => {
      this._timer = null;
      if (this._activeTarget !== target) return;
      const content = getContent();
      if (!content) return;
      this._show(content);
    });
  }

  _cancel(target) {
    if (target && this._activeTarget !== null && this._activeTarget !== target) return;
    if (this._timer) { this._timer.remove(); this._timer = null; }
    this._activeTarget = null;
    this._hide();
  }

  _show({ title = '', body = '' }) {
    this.title.setText(title);
    this.body.setText(body);

    const titleW = title ? this.title.width : 0;
    const bodyW = body ? this.body.width : 0;
    const innerW = Math.max(titleW, bodyW);
    const w = Math.min(this.maxWidth, Math.max(80, innerW + 16));
    const titleH = title ? this.title.height + 4 : 0;
    const bodyH = body ? this.body.height : 0;
    const h = titleH + bodyH + 10;

    const pointer = this.scene.input.activePointer;
    const camW = this.scene.cameras.main.width;
    const camH = this.scene.cameras.main.height;
    let x = pointer.x + 16;
    let y = pointer.y + 16;
    if (x + w > camW - 4) x = Math.max(4, camW - 4 - w);
    if (y + h > camH - 4) y = Math.max(4, pointer.y - h - 8);

    this.bg.setSize(w, h).setPosition(x, y).setVisible(true);
    this.title.setPosition(x + 8, y + 5).setVisible(!!title);
    this.body.setPosition(x + 8, y + 5 + titleH).setVisible(!!body);
  }

  _hide() {
    this.bg.setVisible(false);
    this.title.setVisible(false);
    this.body.setVisible(false);
  }

  destroy() {
    this._cancel();
    // 解绑所有已附加目标的事件监听
    if (this._attachedTargets) {
      for (const { target, onOver, onOut, onDown } of this._attachedTargets) {
        if (target && !target.destroyed) {
          target.off('pointerover', onOver);
          target.off('pointerout', onOut);
          target.off('pointerdown', onDown);
        }
      }
      this._attachedTargets = [];
    }
    this.bg.destroy();
    this.title.destroy();
    this.body.destroy();
  }
}
import { UI_THEME } from '../config/uiTheme.js';
