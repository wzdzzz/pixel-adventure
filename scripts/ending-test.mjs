/**
 * 结局仪式 smoke 测试
 * 召唤并击杀白骨鬼王 → 灵潮平息 + 古印掉落 → 拾取 → 结语字幕卡 →
 * 自动写档 → VictoryScene（制作名单/双选项）→ 继续游历回到世界（post-game）。
 */
import assert from 'node:assert/strict';
import { chromium } from 'playwright';
import { enterFreshGame } from './helpers/game-navigation.mjs';

const URL = process.env.GAME_URL || 'http://localhost:3000';
const pageErrors = [];
const browser = await chromium.launch({
  headless: true,
  args: ['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist'],
});
const page = await (await browser.newContext({ viewport: { width: 1920, height: 1080 } })).newPage();
page.on('pageerror', (e) => pageErrors.push(e.stack || e.message));

try {
  await page.goto(URL, { waitUntil: 'networkidle' });
  await page.waitForSelector('canvas');
  await page.evaluate(() => localStorage.clear());
  await page.waitForTimeout(800);
  await enterFreshGame(page, { afterStartMs: 2800 });

  // 1) 召唤鬼王并击杀
  const kill = await page.evaluate(async () => {
    const scene = window.__game.scene.getScene('MainGameScene');
    const p = scene.player.sprite;
    p.body.checkCollision.none = true;
    scene._spawnEnemy(p.x + 60, p.y, { type: 'skeleton_king', level: 5, isBoss: true, id: 'test_king' }, []);
    const boss = scene.enemies.find(e => e.config?.id === 'skeleton_king');
    if (!boss) return { error: 'boss 未生成' };
    boss.takeDamage(1, p.x, p.y);
    await new Promise(r => setTimeout(r, 400));
    boss.hp = 1;
    boss.isInvulnerable = false;
    boss.iFramesTimer = 0;
    boss.takeDamage(9999, p.x, p.y);
    await new Promise(r => setTimeout(r, 2200));
    return {
      worldCalm: !!scene.worldState.getFlag('world_calm'),
      sealSpawned: !!scene._sealPickup?.active,
    };
  });
  assert.equal(kill.error, undefined, kill.error);
  assert.equal(kill.worldCalm, true, '击杀鬼王应设 world_calm');
  assert.equal(kill.sealSpawned, true, '应掉落镇界古印拾取物');

  // 2) 拾取古印 → 结局序列（结语字幕卡）
  const pickup = await page.evaluate(async () => {
    const scene = window.__game.scene.getScene('MainGameScene');
    const seal = scene._sealPickup;
    scene.player.sprite.body.checkCollision.none = false; // 恢复碰撞（召唤时曾关闭）
    scene.player.sprite.body.reset(seal.x, seal.y);
    await new Promise(r => setTimeout(r, 700));
    return {
      endingFlag: !!scene.worldState.getFlag('ending_done'),
      hasArtifact: !!(scene.registry.get('gameState') || {}).hasArtifact,
    };
  });
  assert.equal(pickup.endingFlag, true, '拾印应设 ending_done');
  assert.equal(pickup.hasArtifact, true);

  // 3) 结语字幕卡 → 跳过 → VictoryScene
  await page.waitForTimeout(2500);
  for (let i = 0; i < 14; i++) {
    const onVictory = await page.evaluate(() => window.__game.scene.isActive('VictoryScene'));
    if (onVictory) break;
    await page.keyboard.press('Space');
    await page.waitForTimeout(600);
  }
  const victory = await page.evaluate(() => ({
    active: window.__game.scene.isActive('VictoryScene'),
    slot: window.__game.registry.get('lastVictorySlot'),
    saved: (() => {
      try {
        const s = JSON.parse(localStorage.getItem('pixel_adventure_save_' + (window.__game.registry.get('lastVictorySlot') || 1)));
        return { story: s?.storyVersion, calm: (s?.worldState?.permanentFlags || []).some(([k, v]) => k === 'ending_done' && v) };
      } catch { return null; }
    })(),
  }));
  assert.equal(victory.active, true, '应进入 VictoryScene');
  assert.ok(victory.saved?.story >= 1, '通关应已自动写档');
  assert.equal(victory.saved?.calm, true, '写档应含 ending_done');

  // 4) 继续游历 → 回到世界（post-game）
  await page.waitForTimeout(3600); // 等按钮淡入
  await page.mouse.click(960 - 136, 540 + 256);
  await page.waitForTimeout(4000);
  const postGame = await page.evaluate(() => {
    const scene = window.__game.scene.getScene('MainGameScene');
    return {
      inWorld: window.__game.scene.isActive('MainGameScene'),
      endingDone: !!scene?.worldState?.getFlag('ending_done'),
      sealRespawn: !!scene?._sealPickup?.active,
      playerAlive: !!scene?.player?.sprite?.active,
    };
  });
  assert.equal(postGame.inWorld, true, '继续游历应回到世界');
  assert.equal(postGame.endingDone, true, 'post-game 应保留通关状态');
  assert.equal(postGame.sealRespawn, false, '结局已看过不应再生成古印');
  assert.equal(postGame.playerAlive, true);

  assert.equal(pageErrors.length, 0, `page errors: ${pageErrors.join('\n')}`);
  console.log('Result: PASS - 结局仪式（平息演出/古印/结语卡/写档/结算/继续游历）');
} catch (e) {
  console.error('Result: FAIL -', e.message);
  console.error('pageErrors:', pageErrors);
  process.exitCode = 1;
} finally {
  await browser.close();
}
