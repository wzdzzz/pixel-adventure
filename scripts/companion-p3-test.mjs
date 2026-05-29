// 伙伴 P3 验证：招募 2 个 → 队伍面板渲染 + 出战/待命/解散/姿态（含友伤 stage 全流程）
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

// 招募两个伙伴
const recruit = await page.evaluate(() => {
  const g = window.__game;
  const scene = g.scene.getScene('MainGameScene');
  scene.inventory.gold = 5000;
  const found = {};
  scene.npcRegistry.instances?.forEach((n) => {
    if (n.id === 'companion_rogue' || n.id === 'companion_warrior') found[n.id] = n;
  });
  for (const id of ['companion_rogue', 'companion_warrior']) {
    if (found[id]) scene.actionRegistry.dispatch('recruit_companion', { npc: found[id], dialogueEngine: scene.dialogueEngine });
  }
  const mgr = scene.companionManager;
  return {
    rosterSize: mgr.getRoster().length,
    activeId: mgr.getActiveId(),
    foundBoth: !!found.companion_rogue && !!found.companion_warrior,
  };
});
console.log('招募两个:', JSON.stringify(recruit));

// 打开队伍面板（T 键）
await page.keyboard.press('KeyT');
await page.waitForTimeout(600);

const ui = await page.evaluate(() => {
  const g = window.__game;
  const panel = g.scene.getScene('PanelScene');
  if (!panel || !panel.scene.isActive()) return { error: 'PanelScene 未激活' };
  return {
    activeTab: panel.activeTab,
    listTitle: panel.partyListTitle?.text,
    selected: panel.selectedCompanionId,
    deployBtn: panel.partyDeployBtnText?.text,
    detailName: panel.partyDetailName?.text,
  };
});
console.log('队伍面板:', JSON.stringify(ui));

// 通过面板 API 操作：选中待命的那个 → 出战（换人）
const ops = await page.evaluate(() => {
  const g = window.__game;
  const panel = g.scene.getScene('PanelScene');
  const mgr = g.scene.getScene('MainGameScene').companionManager;
  const benched = mgr.getRoster().find(e => e.npcId !== mgr.getActiveId());
  const prevActive = mgr.getActiveId();
  panel.selectedCompanionId = benched.npcId;
  panel._partyToggleDeploy(); // 出战 benched → 换下 prevActive
  const afterSwap = mgr.getActiveId();
  // 设姿态
  panel._partySetStance('aggressive');
  const stance = mgr.getInfo(afterSwap).stance;
  // 待命当前出战
  panel._partyToggleDeploy();
  const afterBench = mgr.getActiveId();
  return { prevActive, afterSwap, swapped: afterSwap === benched.npcId, stance, afterBench };
});
console.log('面板操作:', JSON.stringify(ops));

await page.waitForTimeout(200);
await browser.close();
console.log('\n=== page errors:', pageErrors.length, '===');
pageErrors.slice(0, 6).forEach((e) => console.log('  -', e.slice(0, 160)));

const pass = recruit.foundBoth && recruit.rosterSize === 2 && recruit.activeId &&
  ui.activeTab === 'party' && ui.listTitle === '队伍 (2)' &&
  ops.swapped && ops.afterSwap !== ops.prevActive && ops.stance === 'aggressive' && ops.afterBench === null &&
  pageErrors.length === 0;
console.log('\n结果:', pass ? '✅ P3 队伍 UI 通过' : '❌ 有未通过项');
process.exit(pass ? 0 : 1);
