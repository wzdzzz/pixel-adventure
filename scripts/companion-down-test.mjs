// 伙伴倒下 → 停止跟随 + 自动收回 → 篝火复活 → 可再出战
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

await page.evaluate(() => {
  const scene = window.__game.scene.getScene('MainGameScene');
  scene.inventory.gold = 2000;
  let npc = null; scene.npcRegistry.instances?.forEach(n => { if (n.id === 'companion_rogue') npc = n; });
  scene.actionRegistry.dispatch('recruit_companion', { npc, dialogueEngine: scene.dialogueEngine });
});
await page.waitForTimeout(400);

// 1) 让出战伙伴 HP 归零 → update 应自动收回
const downed = await page.evaluate(() => {
  const scene = window.__game.scene.getScene('MainGameScene');
  const mgr = scene.companionManager;
  const c = mgr.getActiveNpc();
  c.hp = 0;                 // 模拟没血
  mgr.update(16);           // 触发自动收回
  return {
    activeAfter: mgr.getActiveId(),
    spriteVisible: c.sprite.visible,
    bodyEnabled: c.sprite.body?.enable,
    dead: mgr.getInfo('companion_rogue').dead,
  };
});
console.log('1) 倒下收回:', JSON.stringify(downed), downed.activeAfter === null && !downed.spriteVisible ? '✅' : '❌');

// 2) 倒下时尝试再出战 → 被拒
const redeploy = await page.evaluate(() => {
  const mgr = window.__game.scene.getScene('MainGameScene').companionManager;
  const ok = mgr.deploy('companion_rogue');
  return { deployOk: ok, activeAfter: mgr.getActiveId() };
});
console.log('2) 倒下时出战被拒:', JSON.stringify(redeploy), redeploy.deployOk === false ? '✅' : '❌');

// 3) 篝火复活 → 可再出战
const revived = await page.evaluate(() => {
  const mgr = window.__game.scene.getScene('MainGameScene').companionManager;
  mgr.reviveAll();
  const deadAfterRevive = mgr.getInfo('companion_rogue').dead;
  const ok = mgr.deploy('companion_rogue');
  const c = mgr.getActiveNpc();
  return { deadAfterRevive, deployOk: ok, activeAfter: mgr.getActiveId(), hp: c?.hp, visible: c?.sprite?.visible };
});
console.log('3) 复活后出战:', JSON.stringify(revived), revived.deployOk && revived.activeAfter === 'companion_rogue' && !revived.deadAfterRevive ? '✅' : '❌');

// 4) 投降路径（essential die）：_isSurrendered 也应被视为倒下并收回
const surrender = await page.evaluate(() => {
  const mgr = window.__game.scene.getScene('MainGameScene').companionManager;
  const c = mgr.getActiveNpc();
  c._isSurrendered = true;   // 模拟投降
  mgr.update(16);
  return { activeAfter: mgr.getActiveId(), dead: mgr.getInfo('companion_rogue').dead };
});
console.log('4) 投降收回:', JSON.stringify(surrender), surrender.activeAfter === null && surrender.dead ? '✅' : '❌');

await page.waitForTimeout(200);
await browser.close();
console.log('\n=== page errors:', pageErrors.length, '===');
pageErrors.slice(0, 6).forEach(e => console.log('  -', e.slice(0, 160)));

const pass = downed.activeAfter === null && !downed.spriteVisible && downed.dead &&
  redeploy.deployOk === false &&
  revived.deployOk && !revived.deadAfterRevive && revived.visible &&
  surrender.activeAfter === null && surrender.dead &&
  pageErrors.length === 0;
console.log('\n结果:', pass ? '✅ 伙伴倒下收回/复活 通过' : '❌ 有未通过项');
process.exit(pass ? 0 : 1);
