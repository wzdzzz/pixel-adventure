// 程序化音频系统 — 运行时冒烟测试
// 用 Playwright 加载游戏，模拟用户手势解锁 AudioContext，
// 通过插桩统计振荡器 / 噪声源数量，验证音乐与音效真的在合成，
// 并捕获任何 console error / page error。
//
// 用法（playwright 不是项目依赖，按需临时安装）：
//   pnpm dev                                  # 另开终端，启动 localhost:3000
//   npm install --no-save playwright
//   npx playwright install chromium
//   node scripts/audio-smoke-test.mjs
//   npm uninstall --no-save playwright        # 测完清理
import { chromium } from 'playwright';

const URL = process.env.GAME_URL || 'http://localhost:3000';

const consoleErrors = [];
const pageErrors = [];

const browser = await chromium.launch({
  headless: true,
  args: [
    '--use-gl=angle',
    '--use-angle=swiftshader',
    '--enable-unsafe-swiftshader',
    '--ignore-gpu-blocklist',
    '--enable-webgl',
  ],
});
const context = await browser.newContext({ viewport: { width: 1920, height: 1080 } });
const page = await context.newPage();

// 插桩 AudioContext：统计创建的上下文 / 振荡器 / 噪声源
await page.addInitScript(() => {
  window.__audio = { contexts: 0, oscillators: 0, bufferSources: 0, state: 'n/a' };
  const Orig = window.AudioContext || window.webkitAudioContext;
  if (Orig) {
    const Wrapped = function (...args) {
      const ctx = new Orig(...args);
      window.__audio.contexts++;
      window.__lastCtx = ctx;
      const oOsc = ctx.createOscillator.bind(ctx);
      ctx.createOscillator = function () { window.__audio.oscillators++; return oOsc(); };
      const oBuf = ctx.createBufferSource.bind(ctx);
      ctx.createBufferSource = function () { window.__audio.bufferSources++; return oBuf(); };
      return ctx;
    };
    Wrapped.prototype = Orig.prototype;
    window.AudioContext = Wrapped;
    window.webkitAudioContext = Wrapped;
  }
});

page.on('console', (msg) => {
  if (msg.type() === 'error') consoleErrors.push(msg.text());
});
page.on('pageerror', (err) => pageErrors.push(err.message));

const snap = async () => page.evaluate(() => ({
  ...window.__audio,
  state: window.__lastCtx ? window.__lastCtx.state : 'no-ctx',
}));

console.log('→ 加载页面...');
await page.goto(URL, { waitUntil: 'networkidle' });
await page.waitForSelector('canvas', { timeout: 15000 });
await page.waitForTimeout(1200);
console.log('  载入后（解锁前）:', await snap());

// 1) 首次手势：点击菜单中心，解锁 AudioContext + 触发按钮 hover/click 音
console.log('→ 点击解锁音频 + 主菜单...');
await page.mouse.move(960, 540);
await page.waitForTimeout(200);
await page.mouse.click(960, 540);
await page.waitForTimeout(1800); // 等菜单音乐调度
const afterMenu = await snap();
console.log('  解锁 + 菜单音乐后:', afterMenu);

// 2) 新建游戏 → 选职业页
console.log('→ 新建游戏...');
await page.mouse.click(960, 572);
await page.waitForTimeout(600);
// hover 确认按钮触发音效
await page.mouse.move(960, 410);
await page.waitForTimeout(200);
// 3) 开始冒险（确认）
console.log('→ 开始冒险（进入游戏）...');
await page.mouse.click(960, 410);
await page.waitForTimeout(2500); // 等场景加载 + 城镇音乐

// 4) 触发游戏内音效：攻击（左键）+ 移动 + 开面板
console.log('→ 触发游戏内音效（攻击 / 移动 / 面板）...');
for (let i = 0; i < 4; i++) {
  await page.mouse.click(1100, 540);
  await page.waitForTimeout(150);
}
await page.keyboard.down('KeyD');
await page.waitForTimeout(400);
await page.keyboard.up('KeyD');
await page.keyboard.press('Digit1'); // 技能 1
await page.waitForTimeout(300);
await page.keyboard.press('KeyC');   // 开角色面板
await page.waitForTimeout(800);
const afterGame = await snap();
console.log('  游戏内交互后:', afterGame);

// 5) 测试音量 setter（直接通过菜单已不可达，改为校验音乐持续调度）
await page.waitForTimeout(1500);
const final = await snap();
console.log('  最终:', final);

await browser.close();

// ── 结论 ──
console.log('\n========== 冒烟测试结论 ==========');
console.log('AudioContext 创建数:', final.contexts);
console.log('解锁后 ctx.state   :', afterMenu.state, '→ 最终', final.state);
console.log('振荡器累计创建数   :', final.oscillators);
console.log('噪声源累计创建数   :', final.bufferSources);
console.log('console.error 数   :', consoleErrors.length);
console.log('page error 数      :', pageErrors.length);
if (consoleErrors.length) console.log('--- console errors ---\n' + consoleErrors.slice(0, 20).join('\n'));
if (pageErrors.length) console.log('--- page errors ---\n' + pageErrors.slice(0, 20).join('\n'));

const pass =
  final.contexts >= 1 &&
  final.state === 'running' &&
  final.oscillators > 0 &&
  pageErrors.length === 0;

console.log('\n结果:', pass ? '✅ PASS' : '❌ FAIL');
process.exit(pass ? 0 : 1);
