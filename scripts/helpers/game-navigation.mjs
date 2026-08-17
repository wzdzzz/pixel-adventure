export async function enterFreshGame(page, { afterStartMs = 2800 } = {}) {
  await page.mouse.click(24, 24);
  await page.waitForTimeout(100);
  await page.evaluate(() => {
    const menu = window.__game.scene.getScene('MainMenuScene');
    menu.showSelectPhase();
    menu.confirmSelection();
  });
  await page.waitForTimeout(afterStartMs);
}
