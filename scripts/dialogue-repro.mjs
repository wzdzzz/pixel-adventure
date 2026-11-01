// 对话框 drawImage 崩溃 — 复现：场景重启导致事件监听器泄漏
import { chromium } from 'playwright';
import { enterFreshGame } from './helpers/game-navigation.mjs';
const URL = 'http://localhost:3000';
const pageErrors = [];
const browser = await chromium.launch({
  headless: true,
  args: ['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist'],
});
const ctx = await browser.newContext({ viewport: { width: 1920, height: 1080 } });
const page = await ctx.newPage();
page.on('pageerror', (e) => pageErrors.push(e.message));

const enterGame = async () => {
  await enterFreshGame(page, { afterStartMs: 2500 });
};

const probe = async (label) => {
  const s = await page.evaluate(() => {
    const g = window.__game;
    const scene = g.scene.getScene('MainGameScene');
    return {
      dlgNodeListeners: scene.events.listenerCount('dialogueNodeEntered'),
      dlgStartListeners: scene.events.listenerCount('dialogueStarted'),
    };
  });
  console.log(`  [${label}] dialogueNodeEntered 监听数=${s.dlgNodeListeners}, dialogueStarted 监听数=${s.dlgStartListeners}`);
  return s;
};

console.log('→ 加载 + 解锁...');
await page.goto(URL, { waitUntil: 'networkidle' });
await page.waitForSelector('canvas');
await page.waitForTimeout(1000);
await page.mouse.click(24, 24); // 解锁
await page.waitForTimeout(400);

console.log('→ 第 1 次进入游戏...');
await enterGame();
await probe('session 1');

console.log('→ ESC → 返回主菜单...');
await page.keyboard.press('Escape');
await page.waitForTimeout(500);
await page.mouse.click(960, 545); // 返回主菜单
await page.waitForTimeout(1500);

console.log('→ 第 2 次进入游戏（复用 MainGameScene 单例）...');
await enterGame();
const s2 = await probe('session 2');

console.log('→ 发射 dialogueNodeEntered（触发所有监听器，含可能的陈旧监听器）...');
const result = await page.evaluate(() => {
  const g = window.__game;
  const scene = g.scene.getScene('MainGameScene');
  try {
    scene.events.emit('dialogueNodeEntered', { speaker: '测试', text: '测试文本', options: [], isEnd: true });
    return 'emit-ok';
  } catch (e) { return 'emit-threw: ' + e.message; }
});
await page.waitForTimeout(300);
console.log('  emit 结果:', result);

await browser.close();
console.log('\n=== page errors:', pageErrors.length, '===');
pageErrors.slice(0, 5).forEach((e) => console.log('  -', e.slice(0, 160)));

const leaked = s2.dlgNodeListeners > 2;
console.log('\n结论:', leaked ? `❌ 监听器泄漏（${s2.dlgNodeListeners} > 2 预期）` : '未泄漏', '| 崩溃:', pageErrors.length ? '是' : '否');
