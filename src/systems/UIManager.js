import Phaser from 'phaser';

export class UIManager {
  constructor(scene) {
    this.scene = scene;
    this.windows = [];
    this.isPaused = false;
  }

  createDialogueWindow(config = {}) {
    const width = config.width || 600;
    const height = config.height || 120;
    const x = config.x || 400;
    const y = config.y || 480;

    const container = this.scene.add.container(x, y).setDepth(100).setScrollFactor(0);

    const bg = this.scene.add.rectangle(0, 0, width, height, 0x000000, 0.92);
    bg.setStrokeStyle(2, 0x00ff00);

    const border = this.scene.add.rectangle(0, 0, width + 4, height + 4, 0x00ff00, 0);
    border.setStrokeStyle(1, 0x00ff00, 0.3);

    const nameText = this.scene.add.text(-width / 2 + 20, -height / 2 + 12, '', {
      fontSize: '14px',
      fill: '#00bfff',
      fontFamily: 'Courier New',
      fontStyle: 'bold'
    });

    const dialogueText = this.scene.add.text(-width / 2 + 20, -height / 2 + 35, '', {
      fontSize: '13px',
      fill: '#ffffff',
      fontFamily: 'Courier New',
      wordWrap: { width: width - 40 }
    });

    const closeHint = this.scene.add.text(width / 2 - 20, height / 2 - 15, '[E]', {
      fontSize: '11px',
      fill: '#888888',
      fontFamily: 'Courier New'
    }).setOrigin(1, 1);

    container.add([border, bg, nameText, dialogueText, closeHint]);
    container.setVisible(false);
    container.setScale(0.8);
    container.setAlpha(0);

    return {
      container,
      bg,
      border,
      nameText,
      dialogueText,
      closeHint,
      isOpen: false,
      typewriterTimer: null
    };
  }

  openWindow(windowObj, name, text, onComplete) {
    if (windowObj.isOpen) return;
    windowObj.isOpen = true;

    windowObj.nameText.setText(name);
    windowObj.dialogueText.setText('');
    windowObj.container.setVisible(true);

    this.windows.push(windowObj);

    this.scene.tweens.add({
      targets: windowObj.container,
      scaleX: 1,
      scaleY: 1,
      alpha: 1,
      duration: 200,
      ease: 'Back.easeOut',
      onComplete: () => {
        this.typewriterEffect(windowObj, text, onComplete);
      }
    });
  }

  typewriterEffect(windowObj, text, onComplete) {
    let index = 0;
    const speed = 30;

    if (windowObj.typewriterTimer) {
      windowObj.typewriterTimer.remove();
    }

    windowObj.typewriterTimer = this.scene.time.addEvent({
      delay: speed,
      callback: () => {
        index++;
        windowObj.dialogueText.setText(text.substring(0, index));

        if (index >= text.length) {
          windowObj.typewriterTimer.remove();
          windowObj.typewriterTimer = null;
          if (onComplete) onComplete();
        }
      },
      repeat: text.length - 1
    });
  }

  closeWindow(windowObj) {
    if (!windowObj.isOpen) return;
    windowObj.isOpen = false;

    if (windowObj.typewriterTimer) {
      windowObj.typewriterTimer.remove();
      windowObj.typewriterTimer = null;
    }

    this.scene.tweens.add({
      targets: windowObj.container,
      scaleX: 0.8,
      scaleY: 0.8,
      alpha: 0,
      duration: 150,
      ease: 'Back.easeIn',
      onComplete: () => {
        windowObj.container.setVisible(false);
        const idx = this.windows.indexOf(windowObj);
        if (idx > -1) this.windows.splice(idx, 1);
      }
    });
  }

  closeAllWindows() {
    [...this.windows].forEach(w => this.closeWindow(w));
  }

  isAnyWindowOpen() {
    return this.windows.some(w => w.isOpen);
  }
}
