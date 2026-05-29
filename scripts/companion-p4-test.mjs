// 伙伴 P4 验证：存档恢复逻辑（deserialize+restoreInstances）+ 篝火复活 + 老档兼容
import { chromium } from 'playwright';
const URL = process.env.GAME_URL || 'http://localhost:3002';
const pageErrors = [];
const browser = await chromium.launch({
  headless: true,
  args: ['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist'],
});
const ctx = await browser.newContext({ viewport: { width: 1920, height: 1080 } });
const page = await ctx.newPage();
page.on('pageerror', (e) => pageErrors.push(e.message));

await page.goto(URL, { waitUntil: 'networkidle' });
await page.waitForSelector('canvas');
await page.waitForTimeout(1000);
await page.mouse.click(960, 540);
await page.waitForTimeout(400);
await page.mouse.click(960, 572);
await page.waitForTimeout(500);
await page.mouse.click(960, 410);
await page.waitForTimeout(2800);

const result = await page.evaluate(() => {
  const g = window.__game;
  const scene = g.scene.getScene('MainGameScene');
  const mgr = scene.companionManager;
  scene.inventory.gold = 5000;
  const found = {};
  scene.npcRegistry.instances?.forEach((n) => { if (n.id?.startsWith('companion_')) found[n.id] = n; });
  for (const id of ['companion_rogue', 'companion_warrior']) {
    if (found[id]) scene.actionRegistry.dispatch('recruit_companion', { npc: found[id], dialogueEngine: scene.dialogueEngine });
  }
  // 部署 warrior + 设姿态
  mgr.deploy('companion_warrior');
  mgr.setStance('companion_rogue', 'hold');
  mgr.setStance('companion_warrior', 'aggressive');

  const saved = mgr.serialize();

  // ── 模拟读档：deserialize + restoreInstances ──
  mgr.deserialize(saved);
  mgr.restoreInstances();
  const rogue = mgr.getInfo('companion_rogue');
  const warrior = mgr.getInfo('companion_warrior');
  const afterLoad = {
    rosterSize: mgr.getRoster().length,
    activeId: mgr.getActiveId(),
    warriorActive: warrior.active, warriorStance: warrior.stance,
    rogueActive: rogue.active, rogueStance: rogue.stance,
  };

  // ── 篝火复活：杀死出战者再 reviveAll ──
  const active = mgr.getActiveNpc();
  active.hp = 0; active.state = 'DEAD';
  mgr.reviveAll();
  const afterRevive = { hp: mgr.getActiveNpc().hp, hpMax: mgr.getActiveNpc().maxHp, state: mgr.getActiveNpc().state };

  // ── 老档兼容：单 companion 字段 ──
  const mgr2 = scene.companionManager;
  mgr2.deserialize({ companionId: 'companion_rogue' });
  const legacy = { rosterSize: mgr2.getRoster().length, has: mgr2.isRecruited('companion_rogue'), pending: mgr2._pendingActiveId };

  return { saved, afterLoad, afterRevive, legacy };
});
console.log(JSON.stringify(result, null, 2));

await page.waitForTimeout(200);
await browser.close();
console.log('\n=== page errors:', pageErrors.length, '===');
pageErrors.slice(0, 6).forEach((e) => console.log('  -', e.slice(0, 160)));

const r = result;
const pass =
  r.saved.roster.length === 2 && r.saved.activeId === 'companion_warrior' &&
  r.afterLoad.rosterSize === 2 && r.afterLoad.activeId === 'companion_warrior' &&
  r.afterLoad.warriorActive === true && r.afterLoad.warriorStance === 'aggressive' &&
  r.afterLoad.rogueActive === false && r.afterLoad.rogueStance === 'hold' &&
  r.afterRevive.hp === r.afterRevive.hpMax && r.afterRevive.state !== 'DEAD' &&
  r.legacy.rosterSize === 1 && r.legacy.has === true && r.legacy.pending === 'companion_rogue' &&
  pageErrors.length === 0;
console.log('\n结果:', pass ? '✅ P4 存档/复活/老档兼容 通过' : '❌ 有未通过项');
process.exit(pass ? 0 : 1);
