// 伙伴战斗 + 实时跟随 验证
import { chromium } from 'playwright';
const pageErrors = [];
const browser = await chromium.launch({
  headless: true,
  args: ['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist'],
});
const ctx = await browser.newContext({ viewport: { width: 1920, height: 1080 } });
const page = await ctx.newPage();
page.on('pageerror', (e) => pageErrors.push(e.message));

// 探测端口
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

// 招募+出战
await page.evaluate(() => {
  const scene = window.__game.scene.getScene('MainGameScene');
  scene.inventory.gold = 2000;
  let npc = null; scene.npcRegistry.instances?.forEach(n => { if (n.id === 'companion_rogue') npc = n; });
  scene.actionRegistry.dispatch('recruit_companion', { npc, dialogueEngine: scene.dialogueEngine });
});
await page.waitForTimeout(500);

// 1) 实时跟随：玩家移动 150px，伙伴应靠近到 ~70 内
const follow = await page.evaluate(() => {
  const scene = window.__game.scene.getScene('MainGameScene');
  const c = scene.companionManager.getActiveNpc();
  const p = scene.player.sprite;
  p.setPosition(p.x + 150, p.y);
  return { before: Math.round(Math.hypot(c.sprite.x - p.x, c.sprite.y - p.y)) };
});
await page.waitForTimeout(1800);
const follow2 = await page.evaluate(() => {
  const scene = window.__game.scene.getScene('MainGameScene');
  const c = scene.companionManager.getActiveNpc();
  const p = scene.player.sprite;
  return { after: Math.round(Math.hypot(c.sprite.x - p.x, c.sprite.y - p.y)) };
});
console.log('1) 跟随:', JSON.stringify({ ...follow, ...follow2 }), follow2.after <= 80 ? '✅ 紧跟' : '❌ 太远');

// 2) 战斗：造假敌人贴在伙伴旁，验证伙伴 hitbox 伤敌 + 敌 hitbox 伤伴 + 目标选择
const combat = await page.evaluate(async () => {
  const scene = window.__game.scene.getScene('MainGameScene');
  const c = scene.companionManager.getActiveNpc();
  const cx = c.sprite.x, cy = c.sprite.y;

  // 造一个真实物理体假敌人，紧贴伙伴
  const es = scene.add.rectangle(cx + 10, cy, 28, 32, 0x00ff00, 0.001);
  scene.physics.add.existing(es);
  const fake = { sprite: es, faction: 'monster', finalLevel: 1, hp: 100, maxHp: 100, isInvulnerable: false, state: 'PATROL',
    _isDestroyed: false, update() {}, takeDamage(d) { this.hp = Math.max(0, this.hp - d); } };
  es.enemyInstance = fake;
  scene.enemies.push(fake);

  // 目标选择：假敌人离伙伴更近 → _enemyTarget 应返回伙伴
  const tgt = scene._enemyTarget(fake);
  const targetIsCompanion = tgt === c.sprite;

  // 2a) 伙伴(ally) hitbox → 敌人
  const hb = scene.add.rectangle(cx + 10, cy, 40, 40, 0xff0000, 0.001);
  scene.physics.add.existing(hb);
  hb._enemyOwner = c; hb._enemySkillDamage = 25;
  scene.events.emit('enemyHitboxSpawned', hb, 400);

  // 2b) 敌人 hitbox → 伙伴
  const hb2 = scene.add.rectangle(c.sprite.x, c.sprite.y, 40, 40, 0xff8800, 0.001);
  scene.physics.add.existing(hb2);
  hb2._enemyOwner = fake; hb2._enemySkillDamage = 15;
  const compHpBefore = c.hp;
  scene.events.emit('enemyHitboxSpawned', hb2, 400);

  await new Promise(r => setTimeout(r, 450));
  return {
    targetIsCompanion,
    enemyHp: fake.hp, enemyDamaged: fake.hp < 100,
    compHpBefore, compHpAfter: c.hp, compDamaged: c.hp < compHpBefore,
  };
});
console.log('2) 战斗:', JSON.stringify(combat));
console.log('   目标选择(敌瞄伙伴):', combat.targetIsCompanion ? '✅' : '❌',
  '| 伙伴伤敌:', combat.enemyDamaged ? '✅' : '❌',
  '| 敌伤伙伴:', combat.compDamaged ? '✅' : '❌');

await page.waitForTimeout(200);
await browser.close();
console.log('\n=== page errors:', pageErrors.length, '===');
pageErrors.slice(0, 6).forEach(e => console.log('  -', e.slice(0, 160)));

const pass = follow2.after <= 80 && combat.targetIsCompanion && combat.enemyDamaged && combat.compDamaged && pageErrors.length === 0;
console.log('\n结果:', pass ? '✅ 战斗+跟随 通过' : '❌ 有未通过项');
process.exit(pass ? 0 : 1);
