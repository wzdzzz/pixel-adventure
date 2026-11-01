export async function enterFreshGame(page, { afterStartMs = 2800, skipPrologue = true } = {}) {
  await page.mouse.click(24, 24);
  await page.waitForTimeout(100);
  await page.evaluate(() => {
    const menu = window.__game.scene.getScene('MainMenuScene');
    menu.showSelectPhase();
    menu.confirmSelection();
  });
  await page.waitForTimeout(afterStartMs);

  // 新档会播放序章字幕卡并暂停游戏（StoryArc）；按键跳过直到恢复运行
  if (skipPrologue) {
    for (let i = 0; i < 16; i++) {
      const paused = await page.evaluate(() => {
        const scene = window.__game.scene.getScene('MainGameScene');
        return !!scene?._pauseReasons?.has('story');
      });
      if (!paused) break;
      await page.keyboard.press('Space');
      await page.waitForTimeout(500);
    }
  }
}
