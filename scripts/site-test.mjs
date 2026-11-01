// scripts/site-test.mjs
// 秘境全流程冒烟测试:进入 → 断言内容 → 规则验证 → 出口回大世界 → 再进重置验证
import { chromium } from 'playwright';
import { enterFreshGame } from './helpers/game-navigation.mjs';

const pageErrors = [];
const browser = await chromium.launch({
  headless: true,
  args: ['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist'],
});
const ctx = await browser.newContext({ viewport: { width: 1920, height: 1080 } });
const page = await ctx.newPage();
page.on('pageerror', (e) => pageErrors.push(e.message));

let URL = process.env.GAME_URL;
if (!URL) {
  for (const p of [3000, 3001, 3002, 3003]) {
    try {
      const r = await fetch('http://localhost:' + p);
      if (r.ok) { URL = 'http://localhost:' + p; break; }
    } catch {}
  }
}
await page.goto(URL, { waitUntil: 'networkidle' });
await page.waitForSelector('canvas');
await page.waitForTimeout(1000);
await enterFreshGame(page);

// ─── 1. 记录进入前坐标，在玩家旁生成洞口传送门并进入 ────────────────────────
const preSitePos = await page.evaluate(() => {
  const scene = window.__game.scene.getScene('MainGameScene');
  const px = scene.player.sprite.x;
  const py = scene.player.sprite.y;
  // 在玩家正前方生成洞口传送门（entrance）
  scene._spawnSitePortal(px + 40, py, { kind: 'entrance', siteId: 'trial_cave', label: '试炼洞窟' }, []);
  return { x: px, y: py };
});

// 触发 handleSitePortalInteract
await page.evaluate(() => {
  const scene = window.__game.scene.getScene('MainGameScene');
  const portal = scene._sitePortals.find(p => p.kind === 'entrance' && p.siteId === 'trial_cave');
  if (!portal) throw new Error('找不到洞口传送门');
  scene.handleSitePortalInteract(portal);
});

// 等待淡出 + 构建 + 淡入（450ms 合计，加 450ms 余量 = 900ms）
await page.waitForTimeout(900);

// ─── 2. 进入后断言 ──────────────────────────────────────────────────────────
const afterEnter = await page.evaluate(() => {
  const scene = window.__game.scene.getScene('MainGameScene');
  return {
    contextType: scene.worldContext?.type,
    contextSiteId: scene.worldContext?.siteId,
    activeChunksSize: scene.chunkManager.activeChunks.size,
    enemiesLength: scene.enemies.length,
    chestsLength: scene.chests.length,
    boundsWidth: scene.physics.world.bounds.width,
    boundsHeight: scene.physics.world.bounds.height,
    hasWallLayer: !!scene._siteHandle?.wallLayer,
    hasExitPortal: scene._sitePortals.some(p => p.kind === 'exit'),
    returnPos: scene.worldContext?.returnPos,
  };
});

// 门控：再等 600ms，流式 chunk 应仍为 0
await page.waitForTimeout(600);
const afterGate = await page.evaluate(() => {
  const scene = window.__game.scene.getScene('MainGameScene');
  return { activeChunksSize: scene.chunkManager.activeChunks.size };
});

// ─── 3. 秘境规则断言 ─────────────────────────────────────────────────────────
// 3a. 把第一只怪 hp 减半
const dmgResult = await page.evaluate(() => {
  const scene = window.__game.scene.getScene('MainGameScene');
  const enemy = scene.enemies.find(e => e.hp > 0);
  if (!enemy) return { error: '秘境内没有活着的怪' };
  const halfHp = Math.max(1, Math.floor(enemy.maxHp / 2));
  enemy.hp = halfHp;
  return { id: enemy.entityId, hp: enemy.hp, maxHp: enemy.maxHp };
});
if (dmgResult.error) { console.error(dmgResult.error); await browser.close(); process.exit(1); }

// 3b. 开箱
await page.evaluate(() => {
  const scene = window.__game.scene.getScene('MainGameScene');
  const chest = scene.chests[0];
  if (!chest) throw new Error('秘境内找不到宝箱');
  scene.handleChestInteract(chest);
});

// 3c. 制造掉落物
await page.evaluate(() => {
  const scene = window.__game.scene.getScene('MainGameScene');
  const px = scene.player.sprite.x;
  const py = scene.player.sprite.y;
  scene.events.emit('enemyDropLoot', 'barrel', px + 20, py, 1, false, 'normal');
});
await page.waitForTimeout(300);
const dropResult = await page.evaluate(() => {
  const scene = window.__game.scene.getScene('MainGameScene');
  return { itemsLength: scene.items.length };
});

// 3d. returnPos 代理断言
const returnPosCheck = await page.evaluate(() => {
  const scene = window.__game.scene.getScene('MainGameScene');
  return { returnPos: scene.worldContext?.returnPos };
});

// ─── 4. 走出口回大世界 ────────────────────────────────────────────────────────
await page.evaluate(() => {
  const scene = window.__game.scene.getScene('MainGameScene');
  const exitPortal = scene._sitePortals.find(p => p.kind === 'exit');
  if (!exitPortal) throw new Error('找不到出口传送门');
  scene.handleSitePortalInteract(exitPortal);
});
// 等淡出(250ms) + 重建大世界 + 淡入(250ms) + 余量(700ms) = 1200ms
await page.waitForTimeout(1200);

const afterExit = await page.evaluate(() => {
  const scene = window.__game.scene.getScene('MainGameScene');
  return {
    contextType: scene.worldContext?.type,
    activeChunksSize: scene.chunkManager.activeChunks.size,
    playerX: Math.round(scene.player.sprite.x),
    playerY: Math.round(scene.player.sprite.y),
    siteHandleNull: scene._siteHandle === null,
    itemsLength: scene.items.length,
  };
});

// ─── 5. 再进一次：验证重置（怪满血、宝箱永久已开、快照清除） ──────────────────
// 再次生成洞口并进入
await page.evaluate(() => {
  const scene = window.__game.scene.getScene('MainGameScene');
  const px = scene.player.sprite.x;
  const py = scene.player.sprite.y;
  scene._spawnSitePortal(px + 40, py, { kind: 'entrance', siteId: 'trial_cave', label: '试炼洞窟' }, []);
});
await page.evaluate(() => {
  const scene = window.__game.scene.getScene('MainGameScene');
  const portal = scene._sitePortals.find(p => p.kind === 'entrance' && p.siteId === 'trial_cave');
  if (!portal) throw new Error('第二次找不到洞口传送门');
  scene.handleSitePortalInteract(portal);
});
await page.waitForTimeout(900);

const secondEnter = await page.evaluate((firstEnemyId) => {
  const scene = window.__game.scene.getScene('MainGameScene');
  const enemy = scene.enemies[0];
  const snapNull = scene.worldState.getEntitySnapshot('site:trial_cave:e1') === null;
  return {
    enemiesAllFullHp: scene.enemies.every(e => e.hp === e.maxHp),
    chestsLength: scene.chests.length,          // 宝箱永久：不复活 = 0
    e1SnapNull: snapNull,                        // 快照已清除
  };
}, dmgResult.id);

// 再出来
await page.evaluate(() => {
  const scene = window.__game.scene.getScene('MainGameScene');
  const exitPortal = scene._sitePortals.find(p => p.kind === 'exit');
  if (!exitPortal) throw new Error('第二次找不到出口传送门');
  scene.handleSitePortalInteract(exitPortal);
});
await page.waitForTimeout(1200);

const finalCtx = await page.evaluate(() => {
  const scene = window.__game.scene.getScene('MainGameScene');
  return { contextType: scene.worldContext?.type };
});

// ─── 判定 ─────────────────────────────────────────────────────────────────────
const pass =
  // 2. 进入后
  afterEnter.contextType === 'site' &&
  afterEnter.contextSiteId === 'trial_cave' &&
  afterEnter.activeChunksSize === 0 &&
  afterEnter.enemiesLength === 4 &&
  afterEnter.chestsLength === 1 &&
  afterEnter.boundsWidth === 1280 &&
  afterEnter.boundsHeight === 1280 &&
  afterEnter.hasWallLayer === true &&
  afterEnter.hasExitPortal === true &&
  // 门控
  afterGate.activeChunksSize === 0 &&
  // 3. 规则
  dmgResult.hp < dmgResult.maxHp &&
  dropResult.itemsLength > 0 &&
  // 3d. returnPos 与进入前坐标一致
  Math.abs((returnPosCheck.returnPos?.x ?? NaN) - preSitePos.x) < 2 &&
  Math.abs((returnPosCheck.returnPos?.y ?? NaN) - preSitePos.y) < 2 &&
  // 4. 回大世界
  afterExit.contextType === 'overworld' &&
  afterExit.activeChunksSize > 0 &&
  Math.abs(afterExit.playerX - preSitePos.x) <= 2 &&
  Math.abs(afterExit.playerY - preSitePos.y) <= 2 &&
  afterExit.siteHandleNull === true &&
  afterExit.itemsLength === 0 &&
  // 5. 再进一次
  secondEnter.enemiesAllFullHp === true &&
  secondEnter.chestsLength === 0 &&
  secondEnter.e1SnapNull === true &&
  // 7. 最终回大世界 + 无页面错误
  finalCtx.contextType === 'overworld' &&
  pageErrors.length === 0;

console.log(JSON.stringify({
  preSitePos,
  afterEnter,
  afterGate,
  dmgResult,
  dropResult,
  returnPosCheck,
  afterExit,
  secondEnter,
  finalCtx,
  pageErrors,
}, null, 2));
console.log(pass ? 'site-test 通过 ✓' : 'site-test 失败 ✗');
await browser.close();
process.exit(pass ? 0 : 1);
