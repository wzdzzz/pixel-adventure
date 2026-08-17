// 世界宝箱战利品验证：普通/稀有宝箱掉落真实战利品（金币+装备+材料）
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
console.log('URL =', URL);

await page.goto(URL, { waitUntil: 'networkidle' });
await page.waitForSelector('canvas');
await page.waitForTimeout(1000);
await enterFreshGame(page);

const r = await page.evaluate(() => {
  const scene = window.__game.scene.getScene('MainGameScene');
  
  const p = scene.player.sprite;

  const openChestAndCount = (rare) => {
    let drops = 0;
    const onSpawn = () => drops++;
    scene.events.on('spawnItem', onSpawn);
    scene._spawnChest(p.x + 60, p.y + 60, { type: 'chest', id: 'tc_' + (rare ? 'r' : 'c') + Math.floor(p.x), rare }, []);
    const chest = scene.chests[scene.chests.length - 1];
    const table = chest.lootTable;
    // 直接开箱
    scene.handleChestInteract(chest);
    scene.events.off('spawnItem', onSpawn);
    return { table, drops };
  };

  const common = openChestAndCount(false);
  const rareC = openChestAndCount(true);
  return { common, rareC };
});
console.log(JSON.stringify(r));

await page.waitForTimeout(200);
await browser.close();
console.log('\n=== page errors:', pageErrors.length, '===');
pageErrors.slice(0, 6).forEach(e => console.log('  -', e.slice(0, 160)));

const pass =
  r.common.table === 'treasure_common' && r.common.drops >= 1 &&
  r.rareC.table === 'treasure_rare' && r.rareC.drops >= 3 &&
  pageErrors.length === 0;
console.log('\n结果:', pass ? '✅ 宝箱战利品 通过' : '❌ 有未通过项', '| 普通掉落', r.common.drops, '稀有掉落', r.rareC.drops);
process.exit(pass ? 0 : 1);
