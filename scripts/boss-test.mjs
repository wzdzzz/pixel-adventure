// Boss 战斗体验验证：登场事件 + 血条 HUD + 阶段狂暴 + 攻击提升 + 击败反馈 + boss 音乐
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
  const ui = window.__game.scene.getScene('UIScene');
  const out = { events: [] };

  scene.events.on('bossEngaged', (b) => out.events.push('engaged'));
  scene.events.on('bossPhase', (b, p) => out.events.push('phase' + p));
  scene.events.on('bossDefeated', (b) => out.events.push('defeated'));

  const p = scene.player.sprite;
  scene._spawnEnemy(p.x + 50, p.y, { type: 'skeleton_king', level: 5, isBoss: true, id: 'test_boss' }, []);
  const boss = scene.enemies.find(e => e.config?.id === 'skeleton_king');
  if (!boss) return { error: 'boss 未生成（itemData.enemies.skeleton_king 缺失？）' };
  out.isBoss = boss.isBoss;
  out.displayName = boss.displayName;

  // 触发登场（一次 takeDamage 进战斗）
  boss.takeDamage(1, p.x, p.y);
  out.engagedFired = out.events.includes('engaged');
  out.barVisibleAfterEngage = ui.bossBar?.visible === true;
  out.barName = ui.bossNameText?.text;
  out.inBossMusic = scene.soundManager?._inBoss === true;

  const atkBase = boss.getAttack();

  // 阶段1：HP→50%（<66%）
  boss.hp = boss.maxHp * 0.5; boss._checkBossPhase();
  out.phase1 = boss._bossPhase; out.enrage1 = boss._enrageMult;
  const atkP1 = boss.getAttack();
  out.atkIncreased = atkP1 > atkBase;

  // 阶段2：HP→20%（<33%）
  boss.hp = boss.maxHp * 0.2; boss._checkBossPhase();
  out.phase2 = boss._bossPhase; out.enrage2 = boss._enrageMult;

  // 击败
  boss.hp = 1; boss.isInvulnerable = false;
  boss.die();
  out.defeatedFired = out.events.includes('defeated');

  return out;
});
console.log(JSON.stringify(r, null, 2));

await page.waitForTimeout(300);
// 击败后血条应隐藏（update 帧处理）
const after = await page.evaluate(() => {
  const ui = window.__game.scene.getScene('UIScene');
  return { barHidden: ui.bossBar?.visible === false, inBoss: window.__game.scene.getScene('MainGameScene').soundManager?._inBoss };
});
console.log('击败后:', JSON.stringify(after));

await browser.close();
console.log('\n=== page errors:', pageErrors.length, '===');
pageErrors.slice(0, 6).forEach(e => console.log('  -', e.slice(0, 160)));

const pass = !r.error && r.isBoss && r.displayName === '白骨鬼王' &&
  r.engagedFired && r.barVisibleAfterEngage && r.barName === '白骨鬼王' && r.inBossMusic &&
  r.phase1 === 1 && Math.abs(r.enrage1 - 1.3) < 0.001 && r.atkIncreased &&
  r.phase2 === 2 && Math.abs(r.enrage2 - 1.6) < 0.001 &&
  r.defeatedFired && after.barHidden && after.inBoss === false &&
  pageErrors.length === 0;
console.log('\n结果:', pass ? '✅ Boss 战斗体验 通过' : '❌ 有未通过项');
process.exit(pass ? 0 : 1);
