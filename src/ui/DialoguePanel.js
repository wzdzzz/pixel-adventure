/**
 * DialoguePanel — 节点化对话 UI
 *
 * 由 DialogueEngine 通过 'dialogueNodeEntered' 事件驱动渲染。
 * 用户输入：
 *   - 数字键 1-9 / 鼠标点击选项
 *   - E / Space：无选项时点继续；最后一句关闭
 *   - ESC：强制关闭
 *
 * 复用 UIManager 的样式（黑底绿边 + 打字机效果）。
 */
import Phaser from 'phaser';

export class DialoguePanel {
  constructor(scene, dialogueEngine) {
    this.scene = scene;
    this.engine = dialogueEngine;
    this.visible = false;

    this._build();
    this._listen();
  }

  _build() {
    const W = 900, H = 240;
    const cx = 960, cy = 1080 - H / 2 - 40;

    this.container = this.scene.add.container(cx, cy)
      .setDepth(9990).setScrollFactor(0).setVisible(false);

    this.bg = this.scene.add.rectangle(0, 0, W, H, 0x000000, 0.92)
      .setStrokeStyle(2, 0x00ff88);
    this.border = this.scene.add.rectangle(0, 0, W + 4, H + 4, 0, 0)
      .setStrokeStyle(1, 0x00ff88, 0.3);

    this.nameText = this.scene.add.text(-W / 2 + 24, -H / 2 + 14, '', {
      fontSize: '18px',
      fill: '#00bfff',
      fontFamily: 'Courier New',
      fontStyle: 'bold'
    });

    this.bodyText = this.scene.add.text(-W / 2 + 24, -H / 2 + 50, '', {
      fontSize: '17px',
      fill: '#ffffff',
      fontFamily: 'Courier New',
      wordWrap: { width: W - 48 }
    });

    // 选项列表（最多 9 项）
    this.optionTexts = [];
    for (let i = 0; i < 9; i++) {
      const t = this.scene.add.text(-W / 2 + 32, 0, '', {
        fontSize: '16px',
        fill: '#cccccc',
        fontFamily: 'Courier New'
      }).setInteractive({ useHandCursor: true });
      t.on('pointerover', () => t.setFill('#ffff66'));
      t.on('pointerout',  () => t.setFill('#cccccc'));
      t.on('pointerdown', () => this._choose(i));
      this.optionTexts.push(t);
    }

    this.hintText = this.scene.add.text(W / 2 - 24, H / 2 - 18, '', {
      fontSize: '13px',
      fill: '#888888',
      fontFamily: 'Courier New'
    }).setOrigin(1, 1);

    this.container.add([this.border, this.bg, this.nameText, this.bodyText, ...this.optionTexts, this.hintText]);

    // 键盘
    this.keys = this.scene.input.keyboard.addKeys({
      adv1: Phaser.Input.Keyboard.KeyCodes.E,
      adv2: Phaser.Input.Keyboard.KeyCodes.SPACE,
      esc: Phaser.Input.Keyboard.KeyCodes.ESC,
      num1: Phaser.Input.Keyboard.KeyCodes.ONE,
      num2: Phaser.Input.Keyboard.KeyCodes.TWO,
      num3: Phaser.Input.Keyboard.KeyCodes.THREE,
      num4: Phaser.Input.Keyboard.KeyCodes.FOUR,
      num5: Phaser.Input.Keyboard.KeyCodes.FIVE,
      num6: Phaser.Input.Keyboard.KeyCodes.SIX,
      num7: Phaser.Input.Keyboard.KeyCodes.SEVEN,
      num8: Phaser.Input.Keyboard.KeyCodes.EIGHT,
      num9: Phaser.Input.Keyboard.KeyCodes.NINE
    });

    this.scene.input.keyboard.on('keydown', (e) => this._onKey(e));

    // 打字机
    this._typeTimer = null;
    this._typeDone = true;
    this._fullText = '';
    this._curIdx = 0;

    this._options = [];
    this._isEnd = false;
  }

  _listen() {
    this.scene.events.on('dialogueStarted', () => this.show());
    this.scene.events.on('dialogueEnded', () => this.hide());
    this.scene.events.on('dialogueNodeEntered', (data) => this.renderNode(data));
  }

  show() {
    this.container.setVisible(true);
    this.visible = true;
  }

  hide() {
    this.container.setVisible(false);
    this.visible = false;
    this._stopTypewriter();
    for (const t of this.optionTexts) t.setText('').setVisible(false);
  }

  renderNode(data) {
    if (!data) return;
    this.nameText.setText(data.speaker || '???');
    this._isEnd = !!data.isEnd;
    this._options = data.options || [];

    this._fullText = data.text || '';
    this.bodyText.setText('');
    this._typewriter(this._fullText, () => this._showOptions());
  }

  _showOptions() {
    const baseY = -240 / 2 + 60 + this.bodyText.height + 16;
    for (let i = 0; i < this.optionTexts.length; i++) {
      const t = this.optionTexts[i];
      const opt = this._options[i];
      if (opt) {
        t.setText(`${i + 1}. ${opt.text}`);
        t.setPosition(-900 / 2 + 32, baseY + i * 22);
        t.setVisible(true);
        t.setFill('#cccccc');
      } else {
        t.setText('').setVisible(false);
      }
    }
    if (this._options.length === 0) {
      this.hintText.setText(this._isEnd ? '[E] 关闭' : '[E] 继续');
    } else {
      this.hintText.setText('[1-9 / 鼠标] 选择');
    }
  }

  _typewriter(text, onDone) {
    this._stopTypewriter();
    this._typeDone = false;
    this._curIdx = 0;
    if (!text) {
      this._typeDone = true;
      onDone?.();
      return;
    }
    this.hintText.setText('...');
    this._typeTimer = this.scene.time.addEvent({
      delay: 25,
      repeat: text.length - 1,
      callback: () => {
        this._curIdx++;
        this.bodyText.setText(text.substring(0, this._curIdx));
        if (this._curIdx >= text.length) {
          this._typeDone = true;
          this._stopTypewriter();
          onDone?.();
        }
      }
    });
  }

  _stopTypewriter() {
    if (this._typeTimer) { this._typeTimer.remove(); this._typeTimer = null; }
  }

  _onKey(e) {
    if (!this.visible) return;
    const code = e.code;
    if (code === 'Escape') { this.engine?.stop(); return; }

    // 打字机未完成 → 立即显示全文
    if (!this._typeDone) {
      this._stopTypewriter();
      this.bodyText.setText(this._fullText);
      this._typeDone = true;
      this._showOptions();
      return;
    }

    // 数字键选择
    const numMatch = code.match(/^(?:Digit|Numpad)([1-9])$/);
    if (numMatch && this._options.length > 0) {
      const idx = parseInt(numMatch[1], 10) - 1;
      if (idx < this._options.length) this._choose(idx);
      return;
    }

    // E / Space 推进
    if (code === 'KeyE' || code === 'Space') {
      if (this._options.length > 0) return;  // 等选项
      this.engine?.advance();
    }
  }

  _choose(idx) {
    if (!this.visible || !this._typeDone) return;
    this.engine?.choose(idx);
  }
}
