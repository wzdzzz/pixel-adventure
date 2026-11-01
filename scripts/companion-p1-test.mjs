// 伙伴 P1/P2 验证：名册 + 出战/待命/解散 + 序列化
import { chromium } from 'playwright';
import { enterFreshGame } from './helpers/game-navigation.mjs';
const URL = process.env.GAME_URL || 'http://localhost:3000';
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
await enterFreshGame(page);

const run = await page.evaluate(() => {
  const g = window.__game;
  const scene = g.scene.getScene('MainGameScene');
  const mgr = scene.companionManager;
  const out = {};
  let npc = null; scene.npcRegistry.instances?.forEach((n) => { if (n.id === 'companion_rogue') npc = n; });
  if (!npc) return { error: '未找到 companion_rogue' };

  scene.inventory.gold = 2000;
  // 招募 → 应入册并出战
  scene.actionRegistry.dispatch('recruit_companion', { npc, dialogueEngine: scene.dialogueEngine });
  out.afterRecruit = { rosterSize: mgr.getRoster().length, activeId: mgr.getActiveId(), spriteVisible: npc.sprite.visible };

  // 待命
  mgr.bench('companion_rogue');
  out.afterBench = { activeId: mgr.getActiveId(), spriteVisible: npc.sprite.visible, bodyEnabled: npc.sprite.body.enable, aiEnabled: npc.ai.enabled };

  // 再出战
  mgr.deploy('companion_rogue');
  out.afterDeploy = { activeId: mgr.getActiveId(), spriteVisible: npc.sprite.visible, bodyEnabled: npc.sprite.body.enable, followMode: npc.ai.followMode };

  // 姿态
  mgr.setStance('companion_rogue', 'aggressive');
  out.afterStance = { stance: mgr.getRoster()[0].stance, detection: Math.round(npc.ai.detectionRange) };

  // 序列化
  out.serialized = mgr.serialize();

  // getInfo
  out.info = mgr.getInfo('companion_rogue');

  // 解散
  mgr.dismiss('companion_rogue');
  out.afterDismiss = { rosterSize: mgr.getRoster().length, activeId: mgr.getActiveId(), stillInRegistry: !!scene.npcRegistry.get('companion_rogue') };

  return out;
});
console.log(JSON.stringify(run, null, 2));

await page.waitForTimeout(200);
await browser.close();
console.log('\n=== page errors:', pageErrors.length, '===');
pageErrors.slice(0, 5).forEach((e) => console.log('  -', e.slice(0, 160)));

const r = run;
const pass = !r.error &&
  r.afterRecruit.rosterSize === 1 && r.afterRecruit.activeId === 'companion_rogue' && r.afterRecruit.spriteVisible === true &&
  r.afterBench.activeId === null && r.afterBench.spriteVisible === false && r.afterBench.bodyEnabled === false &&
  r.afterDeploy.activeId === 'companion_rogue' && r.afterDeploy.spriteVisible === true && r.afterDeploy.followMode === true &&
  r.afterStance.stance === 'aggressive' && r.afterStance.detection > 250 &&
  r.serialized.activeId === 'companion_rogue' && r.serialized.roster.length === 1 &&
  r.afterDismiss.rosterSize === 0 && r.afterDismiss.activeId === null &&
  pageErrors.length === 0;
console.log('\n结果:', pass ? '✅ P1/P2 名册周期通过' : '❌ 有未通过项');
process.exit(pass ? 0 : 1);
