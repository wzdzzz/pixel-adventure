// scripts/enemy-snapshot-test.mjs
// 怪物快照:打残 → 传送走(卸载) → 传送回 → 血量/位置保持
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
if (!URL) { for (const p of [3000,3001,3002,3003]) { try { const r = await fetch('http://localhost:'+p); if (r.ok) { URL='http://localhost:'+p; break; } } catch {} } }
await page.goto(URL, { waitUntil: 'networkidle' });
await page.waitForSelector('canvas');
await page.waitForTimeout(1000);
await enterFreshGame(page);

// 1) 传送到野区 (6,6),等分帧队列生成邻居与实体,打残第一只怪
await page.evaluate(() => {
  const scene = window.__game.scene.getScene('MainGameScene');
  scene.chunkManager.teleportReset(6 * 1024 + 512, 6 * 1024 + 512);
  scene.player.sprite.setPosition(6 * 1024 + 512, 6 * 1024 + 512);
});
await page.waitForTimeout(1500);

const r2 = await page.evaluate(() => {
  const scene = window.__game.scene.getScene('MainGameScene');
  const enemy = scene.enemies.find(e => e.entityId && e.hp > 0);
  if (!enemy) return { error: '野区没有可用敌人' };
  enemy.hp = Math.max(1, Math.floor(enemy.maxHp / 2)); // 打残到半血
  return {
    id: enemy.entityId, hp: enemy.hp, x: enemy.sprite.x, y: enemy.sprite.y,
    spawnX0: enemy.spawnX, spawnY0: enemy.spawnY, // 原锚点(栓绳圆心),用于断言无漂移
  };
});
if (r2.error) { console.error(r2.error); process.exit(1); }

// 2) 传送到远处(卸载写快照),检查快照; 同步移动玩家以防 update() 把快照覆盖
await page.evaluate(() => {
  const scene = window.__game.scene.getScene('MainGameScene');
  scene.chunkManager.teleportReset(12 * 1024 + 512, 12 * 1024 + 512);
  scene.player.sprite.setPosition(12 * 1024 + 512, 12 * 1024 + 512);
});
await page.waitForTimeout(500);
const r3 = await page.evaluate((id) => {
  const scene = window.__game.scene.getScene('MainGameScene');
  return { snap: scene.worldState.getEntitySnapshot(id) };
}, r2.id);

// 3) 传送回野区,确认同一 entityId 的怪:血量恢复、精灵在快照位置附近、锚点无漂移
await page.evaluate(() => {
  const scene = window.__game.scene.getScene('MainGameScene');
  scene.chunkManager.teleportReset(6 * 1024 + 512, 6 * 1024 + 512);
  scene.player.sprite.setPosition(6 * 1024 + 512, 6 * 1024 + 512);
});
await page.waitForTimeout(900);
const r4 = await page.evaluate((id) => {
  const scene = window.__game.scene.getScene('MainGameScene');
  const enemy = scene.enemies.find(e => e.entityId === id);
  return enemy ? {
    hp: enemy.hp, maxHp: enemy.maxHp,
    x: enemy.sprite.x, y: enemy.sprite.y,          // 创建时在快照位置,等待期间 AI 可能小幅巡逻
    spawnX: enemy.spawnX, spawnY: enemy.spawnY,    // 锚点应精确等于原生成坐标
  } : { error: '敌人未重生' };
}, r2.id);

const pass =
  r3.snap && r3.snap.hp === r2.hp &&
  r4.hp === r2.hp && r4.hp < r4.maxHp &&
  r4.spawnX === r2.spawnX0 && r4.spawnY === r2.spawnY0 && // 锚点无漂移(精确相等)
  Math.abs(r4.x - r2.x) < 200 && Math.abs(r4.y - r2.y) < 200 && // 精灵位置在快照附近(容忍巡逻)
  pageErrors.length === 0;
console.log(JSON.stringify({ 打残后: r2, 卸载快照: r3, 回来后: r4, pageErrors }, null, 2));
console.log(pass ? 'enemy-snapshot-test 通过 ✓' : 'enemy-snapshot-test 失败 ✗');
await browser.close();
process.exit(pass ? 0 : 1);
