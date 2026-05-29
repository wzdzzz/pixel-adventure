// 开放世界任务&赏金 验证：可接取/接受/击杀进度/自动发奖/赏金生成/刷新/UI/存档
import { chromium } from 'playwright';
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
await page.mouse.click(960, 540);
await page.waitForTimeout(400);
await page.mouse.click(960, 572);
await page.waitForTimeout(500);
await page.mouse.click(960, 410);
await page.waitForTimeout(2800);

// 1) 初始可接取（autoAvailable + 3 赏金）+ 接受 + 击杀进度 + 自动发奖
const flow = await page.evaluate(() => {
  const scene = window.__game.scene.getScene('MainGameScene');
  const qs = scene.questSystem;
  const out = {};
  out.availableCount = qs.getAvailableQuests().length;
  out.bountyCount = qs.quests.filter(q => q.type === 'bounty' && q.status === 'available').length;

  // 接受 ow_first_hunt（击杀 5 史莱姆）
  const accepted = qs.acceptQuest('ow_first_hunt');
  const q = qs.quests.find(x => x.id === 'ow_first_hunt');
  out.accepted = accepted && q.status === 'active';

  const goldBefore = scene.inventory.gold;
  const xpBefore = scene.levelSystem.xp;
  // 模拟击杀 5 只史莱姆
  for (let i = 0; i < 5; i++) scene.events.emit('enemyDeath', { config: { id: 'slime' } });
  out.questStatus = q.status;
  out.objProgress = q.objectives[0].current;
  out.goldGain = scene.inventory.gold - goldBefore;
  out.xpGain = scene.levelSystem.xp - xpBefore;

  // 刷新赏金
  const before = qs.quests.filter(q => q.type === 'bounty' && q.status === 'available').map(q => q.id).join(',');
  qs.refreshBounties(3);
  const after = qs.quests.filter(q => q.type === 'bounty' && q.status === 'available').map(q => q.id).join(',');
  out.refreshChanged = before !== after;
  out.afterRefreshBounties = qs.quests.filter(q => q.type === 'bounty' && q.status === 'available').length;

  return out;
});
console.log('1) 任务流程:', JSON.stringify(flow));

// 2) 任务日志面板：可接取分组 + 接受按钮
await page.keyboard.press('KeyL');
await page.waitForTimeout(600);
const ui = await page.evaluate(() => {
  const panel = window.__game.scene.getScene('PanelScene');
  if (!panel || !panel.scene.isActive()) return { error: 'PanelScene 未激活' };
  // 选中一个可接取赏金并点接受
  const qs = window.__game.scene.getScene('MainGameScene').questSystem;
  const avail = qs.getAvailableQuests()[0];
  panel.selectedQuestId = avail.id;
  panel.refreshQuestLogTab();
  const btnMode = panel._questBtnMode;
  const btnText = panel.questTrackBtnText?.text;
  // 模拟点接受
  panel.questTrackBtnBg.emit('pointerdown');
  const acceptedNow = qs.quests.find(q => q.id === avail.id)?.status;
  return { activeTab: panel.activeTab, btnMode, btnText, acceptedNow };
});
console.log('2) 任务日志 UI:', JSON.stringify(ui));

// 3) 存档：赏金 + 进度 round-trip
const save = await page.evaluate(() => {
  const qs = window.__game.scene.getScene('MainGameScene').questSystem;
  // 给一个赏金加进度
  const b = qs.quests.find(q => q.type === 'bounty' && q.status === 'active') || qs.quests.find(q => q.type === 'bounty');
  if (b && b.status === 'available') qs.acceptQuest(b.id);
  if (b) b.objectives[0].current = 2;
  const json = qs.toJSON();
  // 模拟读档
  qs.fromJSON(json);
  const restored = qs.quests.find(q => q.id === b.id);
  return { bountyId: b?.id, restoredExists: !!restored, restoredProgress: restored?.objectives[0].current, restoredStatus: restored?.status };
});
console.log('3) 存档 round-trip:', JSON.stringify(save));

await page.waitForTimeout(200);
await browser.close();
console.log('\n=== page errors:', pageErrors.length, '===');
pageErrors.slice(0, 6).forEach(e => console.log('  -', e.slice(0, 160)));

const pass =
  flow.availableCount >= 5 && flow.bountyCount === 3 && flow.accepted &&
  flow.questStatus === 'completed' && flow.objProgress === 5 && flow.goldGain === 60 && flow.xpGain >= 80 &&
  flow.refreshChanged && flow.afterRefreshBounties === 3 &&
  ui.activeTab === 'questLog' && ui.btnMode === 'accept' && ui.btnText === '接受任务' && ui.acceptedNow === 'active' &&
  save.restoredExists && save.restoredProgress === 2 &&
  pageErrors.length === 0;
console.log('\n结果:', pass ? '✅ 任务&赏金系统 通过' : '❌ 有未通过项');
process.exit(pass ? 0 : 1);
