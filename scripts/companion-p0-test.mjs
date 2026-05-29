// 伙伴 P0 修复验证：招募 / 跟随 / 友伤 / 对话 stage 推进
import { chromium } from 'playwright';
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
await page.mouse.click(960, 540);   // 解锁
await page.waitForTimeout(400);
await page.mouse.click(960, 572);   // 新建游戏
await page.waitForTimeout(500);
await page.mouse.click(960, 410);   // 开始冒险（warrior）
await page.waitForTimeout(2800);    // 等进游戏 + chunk 生成 NPC

// 1) 招募（给金币 + 走 recruit_companion action 真实路径）
const recruit = await page.evaluate(() => {
  const g = window.__game;
  const scene = g.scene.getScene('MainGameScene');
  const reg = scene.npcRegistry;
  // 找到 companion_rogue 实例
  let npc = null;
  reg.instances?.forEach((n) => { if (n.id === 'companion_rogue') npc = n; });
  if (!npc) return { error: '未找到 companion_rogue（chunk 未生成？）' };
  scene.inventory.gold = 600;
  scene.actionRegistry.dispatch('recruit_companion', { npc, dialogueEngine: scene.dialogueEngine });
  const mgr = scene.companionManager;
  return {
    recruited: mgr.getCurrent() === npc,
    faction: npc.faction,
    followMode: npc.ai?.followMode,
    goldAfter: scene.inventory.gold,
    stageAfter: scene.npcMemory.getStage('companion_rogue'),
    recruitedFlag: scene.npcMemory.getFlag('companion_rogue', 'recruited'),
  };
});
console.log('1) 招募:', JSON.stringify(recruit));

// 2) 跟随：把玩家瞬移到远处，等real game loop 跑，检查伙伴是否靠近
const follow = await page.evaluate(() => {
  const g = window.__game;
  const scene = g.scene.getScene('MainGameScene');
  let npc = null; scene.npcRegistry.instances?.forEach((n) => { if (n.id === 'companion_rogue') npc = n; });
  const p = scene.player.sprite;
  // 玩家向右移 600px
  p.setPosition(p.x + 600, p.y);
  const before = Math.hypot(npc.sprite.x - p.x, npc.sprite.y - p.y);
  return { distBefore: Math.round(before) };
});
await page.waitForTimeout(2000); // 让伙伴跟随移动
const follow2 = await page.evaluate(() => {
  const g = window.__game;
  const scene = g.scene.getScene('MainGameScene');
  let npc = null; scene.npcRegistry.instances?.forEach((n) => { if (n.id === 'companion_rogue') npc = n; });
  const p = scene.player.sprite;
  const after = Math.hypot(npc.sprite.x - p.x, npc.sprite.y - p.y);
  const v = npc.sprite.body ? Math.hypot(npc.sprite.body.velocity.x, npc.sprite.body.velocity.y) : 0;
  return { distAfter: Math.round(after), velocity: Math.round(v) };
});
console.log('2) 跟随:', JSON.stringify({ ...follow, ...follow2 }), follow2.distAfter < follow.distBefore ? '✅ 靠近了' : '❌ 没跟上');

// 3) 友伤：玩家攻击命中伙伴，HP 应不变
const ff = await page.evaluate(() => {
  const g = window.__game;
  const scene = g.scene.getScene('MainGameScene');
  let npc = null; scene.npcRegistry.instances?.forEach((n) => { if (n.id === 'companion_rogue') npc = n; });
  const hpBefore = npc.hp;
  // 强制启用攻击 hitbox 并调用命中处理
  scene.player.attackHitbox.body.enable = true;
  scene.player.attackHitRegistered = false;
  scene.handleAttackHit(npc);
  return { hpBefore, hpAfter: npc.hp };
});
console.log('3) 友伤(玩家→伴):', JSON.stringify(ff), ff.hpAfter === ff.hpBefore ? '✅ 未受伤' : '❌ 仍受伤');

await page.waitForTimeout(200);
await browser.close();
console.log('\n=== page errors:', pageErrors.length, '===');
pageErrors.slice(0, 5).forEach((e) => console.log('  -', e.slice(0, 160)));

const pass = recruit.recruited && recruit.followMode === true && recruit.faction === 'ally' &&
  recruit.stageAfter === 'recruited' && follow2.distAfter < follow.distBefore &&
  ff.hpAfter === ff.hpBefore && pageErrors.length === 0;
console.log('\n结果:', pass ? '✅ P0 全部通过' : '❌ 有未通过项');
process.exit(pass ? 0 : 1);
