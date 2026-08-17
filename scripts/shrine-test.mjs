// 世界地标 POI 验证：神殿buff / 圣泉治疗 / 石碑奖励 + 一次性耗尽 + 持久化
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
  const out = {};

  const makeShrine = (type) => {
    scene._spawnShrine(p.x + 50, p.y + 50, { type: 'shrine', shrineType: type, id: 'sh_' + type + '_' + Math.floor(p.x) }, []);
    return scene.shrines[scene.shrines.length - 1];
  };

  // 1) 战神祭坛 → 攻击 buff
  const atkBefore = scene.player.getAttack();
  const might = makeShrine('might');
  scene.handleShrineInteract(might);
  out.might = { atkBefore: Math.round(atkBefore), atkAfter: Math.round(scene.player.getAttack()), used: might.used };

  // 2) 疾风祭坛 → 移速 buff
  const spdBefore = scene.player.getMoveSpeed();
  const swift = makeShrine('swift');
  scene.handleShrineInteract(swift);
  out.swift = { spdBefore: Math.round(spdBefore), spdAfter: Math.round(scene.player.getMoveSpeed()) };

  // 3) 生命圣泉 → 回满
  scene.player.hp = 1;
  const vigor = makeShrine('vigor');
  scene.handleShrineInteract(vigor);
  out.vigor = { hpAfter: scene.player.hp, hpMax: scene.player.maxHp };

  // 4) 远古石碑 → 金币+经验
  const goldBefore = scene.inventory.gold, xpBefore = scene.levelSystem.xp;
  const relic = makeShrine('relic');
  scene.handleShrineInteract(relic);
  out.relic = { goldGain: scene.inventory.gold - goldBefore, xpGain: scene.levelSystem.xp - xpBefore };

  // 5) 二次交互无效（已耗尽）+ 持久化 flag
  const goldBefore2 = scene.inventory.gold;
  scene.handleShrineInteract(relic);
  out.reuse = { goldGainOnReuse: scene.inventory.gold - goldBefore2, flag: !!scene.worldState.getFlag(relic.entityId + '_used') };

  return out;
});
console.log(JSON.stringify(r, null, 2));

await page.waitForTimeout(200);
await browser.close();
console.log('\n=== page errors:', pageErrors.length, '===');
pageErrors.slice(0, 6).forEach(e => console.log('  -', e.slice(0, 160)));

const pass =
  r.might.atkAfter > r.might.atkBefore && r.might.used &&
  r.swift.spdAfter > r.swift.spdBefore &&
  r.vigor.hpAfter === r.vigor.hpMax &&
  r.relic.goldGain === 80 && r.relic.xpGain > 0 &&
  r.reuse.goldGainOnReuse === 0 && r.reuse.flag &&
  pageErrors.length === 0;
console.log('\n结果:', pass ? '✅ 世界地标 POI 通过' : '❌ 有未通过项');
process.exit(pass ? 0 : 1);
