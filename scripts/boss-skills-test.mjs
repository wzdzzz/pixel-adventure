// Boss 专属技能验证：阶段门槛解锁 + 散射多发弹道
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
  const out = {};
  const p = scene.player.sprite;
  scene._spawnEnemy(p.x + 150, p.y, { type: 'skeleton_king', level: 5, isBoss: true, id: 'sk_boss' }, []);
  const boss = scene.enemies.find(e => e.config?.id === 'skeleton_king');
  if (!boss) return { error: 'boss 未生成' };
  // 把玩家移到 boss 150px 内（已是）
  const ss = boss.skillSystem;
  const sampleSkills = (n) => {
    const set = new Set();
    for (let i = 0; i < n; i++) {
      // 重置冷却保证可选
      ss.skillIds.forEach(id => ss.cooldowns[id] = 0);
      const s = ss.pickSkill(p);
      if (s) set.add(s.id);
    }
    return [...set];
  };

  boss._bossPhase = 0;
  out.phase0 = sampleSkills(40);
  boss._bossPhase = 1;
  out.phase1 = sampleSkills(40);
  boss._bossPhase = 2;
  out.phase2 = sampleSkills(40);

  // 散射弹道发数
  let projCount = 0;
  const onProj = () => projCount++;
  scene.events.on('enemyProjectileSpawned', onProj);
  const volley = (window.__game.scene.getScene('MainGameScene'));
  // 直接执行 bone_volley
  const skill = boss.skillSystem._activeSkill = { id: 'bone_volley', type: 'ranged_shot', projectileCount: 5, spreadDeg: 60, projectileSpeed: 230, projectileSize: 10, projectileLifetime: 2200, color: 0xbbffbb, damage: 0.9 };
  boss.skillSystem.executeActive(skill, p);
  scene.events.off('enemyProjectileSpawned', onProj);
  out.volleyProjectiles = projCount;

  return out;
});
console.log(JSON.stringify(r, null, 2));

await page.waitForTimeout(200);
await browser.close();
console.log('\n=== page errors:', pageErrors.length, '===');
pageErrors.slice(0, 6).forEach(e => console.log('  -', e.slice(0, 160)));

const has = (arr, id) => arr && arr.includes(id);
const pass = !r.error &&
  !has(r.phase0, 'boss_quake') && !has(r.phase0, 'death_nova') &&
  has(r.phase1, 'boss_quake') && !has(r.phase1, 'death_nova') &&
  has(r.phase2, 'death_nova') &&
  r.volleyProjectiles === 5 &&
  pageErrors.length === 0;
console.log('\n结果:', pass ? '✅ Boss 专属技能 通过' : '❌ 有未通过项');
process.exit(pass ? 0 : 1);
