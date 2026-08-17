import assert from 'node:assert/strict';
import { chromium } from 'playwright';
import { enterFreshGame } from './helpers/game-navigation.mjs';

const URL = process.env.GAME_URL || 'http://localhost:3000';
const pageErrors = [];
const browser = await chromium.launch({
  headless: true,
  args: ['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist'],
});
const context = await browser.newContext({ viewport: { width: 1920, height: 1080 } });
const page = await context.newPage();
page.on('pageerror', error => pageErrors.push(error.stack || error.message));

try {
  await page.goto(URL, { waitUntil: 'networkidle' });
  await page.waitForSelector('canvas');
  await page.waitForTimeout(1000);

  const menuAsset = await page.evaluate(() => {
    const source = window.__game.textures.get('theme_menu_cloud_wastes').getSourceImage();
    return { width: source.width, height: source.height };
  });
  assert.deepEqual(menuAsset, { width: 1920, height: 1080 });

  await enterFreshGame(page, { afterStartMs: 3000 });
  const visualState = await page.evaluate(() => {
    const game = window.__game;
    const scene = game.scene.getScene('MainGameScene');
    const dimensions = Object.fromEntries([
      'hero_00', 'slime_00', 'bat_00', 'spider_00', 'goblin_02',
    ].map(key => {
      const source = game.textures.get(key).getSourceImage();
      return [key, { width: source.width, height: source.height }];
    }));
    const grassPixel = game.textures.getPixel(0, 0, 'world_tileset');
    const stonePixel = game.textures.getPixel(5 * 32, 0, 'world_tileset');
    return {
      dimensions,
      skillIconDimensions: Object.fromEntries([
        'skill_icon_heavyStrike', 'skill_icon_piercingShot', 'skill_icon_fireball',
        'skill_icon_warrior', 'skill_icon_archer', 'skill_icon_mage',
      ].map(key => {
        const source = game.textures.get(key).getSourceImage();
        return [key, { width: source.width, height: source.height }];
      })),
      activePlayerTexture: scene.player.sprite.texture.key,
      nearbyEnemyTypes: [...new Set(scene.enemies.map(enemy => enemy.config.id))].sort(),
      grassPixel: grassPixel ? grassPixel.color : null,
      stonePixel: stonePixel ? stonePixel.color : null,
      displayObjects: scene.children.list.length,
    };
  });

  assert.deepEqual(visualState.dimensions, {
    hero_00: { width: 72, height: 104 },
    slime_00: { width: 80, height: 68 },
    bat_00: { width: 88, height: 68 },
    spider_00: { width: 88, height: 72 },
    goblin_02: { width: 92, height: 88 },
  });
  for (const dimensions of Object.values(visualState.skillIconDimensions)) {
    assert.deepEqual(dimensions, { width: 64, height: 64 });
  }
  assert.match(visualState.activePlayerTexture, /^hero_/);
  assert.deepEqual(visualState.nearbyEnemyTypes, ['bat', 'slime', 'spider']);
  assert.equal(visualState.grassPixel, 0x315846);
  assert.equal(visualState.stonePixel, 0x687875);

  await page.evaluate(() => window.__game.scene.getScene('MainGameScene').player.trySkill(0));
  await page.waitForTimeout(1200);
  const objectsAfterSkill = await page.evaluate(() =>
    window.__game.scene.getScene('MainGameScene').children.list.length
  );
  assert.ok(
    objectsAfterSkill <= visualState.displayObjects + 5,
    `short-lived skill visuals were not released: ${visualState.displayObjects} -> ${objectsAfterSkill}`
  );
  assert.deepEqual(pageErrors, []);

  console.log('Result: PASS - generated menu art, xianxia character frames, world tiles, and skill visual cleanup');
} finally {
  await browser.close();
}
