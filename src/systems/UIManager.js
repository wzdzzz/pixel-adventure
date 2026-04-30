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

    const closeHint = this.scene.add.text(width / 2 - 20, height / 2 - 15, '[E] 下一页', {
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
      typewriterTimer: null,
      // Pagination state
      pages: [],
      currentPage: 0,
      typewriterDone: false
    };
  }

  /**
   * Open a paginated dialogue window.
   * @param {object} windowObj
   * @param {string} name - speaker name
   * @param {string|string[]} pages - single text or array of pages
   * @param {Function} onAllComplete - called when ALL pages are read and closed
   */
  openWindow(windowObj, name, pages, onAllComplete) {
    if (windowObj.isOpen) return;
    windowObj.isOpen = true;
    windowObj.typewriterDone = false;

    // Normalize to array
    windowObj.pages = Array.isArray(pages) ? pages : [pages];
    windowObj.currentPage = 0;
    windowObj.onAllComplete = onAllComplete || null;

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
        this.showPage(windowObj);
      }
    });
  }

  showPage(windowObj) {
    const text = windowObj.pages[windowObj.currentPage];
    const isLastPage = windowObj.currentPage >= windowObj.pages.length - 1;

    windowObj.typewriterDone = false;
    windowObj.dialogueText.setText('');
    windowObj.closeHint.setText('...');

    this.typewriterEffect(windowObj, text, () => {
      windowObj.typewriterDone = true;
      windowObj.closeHint.setText(isLastPage ? '[E] 关闭' : '[E] 下一页');
    });
  }

  /**
   * Advance to next page or close if on last page.
   * Returns true if window was closed.
   */
  advancePage(windowObj) {
    if (!windowObj.isOpen) return true;

    // If typewriter still running, skip to full text
    if (!windowObj.typewriterDone) {
      if (windowObj.typewriterTimer) {
        windowObj.typewriterTimer.remove();
        windowObj.typewriterTimer = null;
      }
      const text = windowObj.pages[windowObj.currentPage];
      windowObj.dialogueText.setText(text);
      windowObj.typewriterDone = true;
      const isLastPage = windowObj.currentPage >= windowObj.pages.length - 1;
      windowObj.closeHint.setText(isLastPage ? '[E] 关闭' : '[E] 下一页');
      return false;
    }

    // Advance to next page
    windowObj.currentPage++;
    if (windowObj.currentPage < windowObj.pages.length) {
      this.showPage(windowObj);
      return false;
    }

    // All pages read - close
    this.closeWindow(windowObj);
    if (windowObj.onAllComplete) windowObj.onAllComplete();
    return true;
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
