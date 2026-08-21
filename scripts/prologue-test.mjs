/**
 * 序章 + 主线链条 smoke 测试
 * 新档 → 字幕卡暂停/跳过 → 引导任务追踪 → 雷九登记（接第一幕 + 发回春散）→
 * 模拟清剿浊水精 → 雷九 stage 推进 → 接第二幕。
 */
import assert from 'node:assert/strict';
import { chromium } from 'playwright';
import { enterFreshGame } from './helpers/game-navigation.mjs';

const URL = process.env.GAME_URL || 'http://localhost:3000';
const pageErrors = [];
const browser = await chromium.launch({
  headless: true,
  args: ['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist'],
});
const page = await (await browser.newContext({ viewport: { width: 1920, height: 1080 } })).newPage();
page.on('pageerror', (e) => pageErrors.push(e.stack || e.message));

try {
  await page.goto(URL, { waitUntil: 'networkidle' });
  await page.waitForSelector('canvas');
  await page.evaluate(() => localStorage.clear());
  await page.waitForTimeout(800);

  // 1) 新档：字幕卡应暂停游戏（skipPrologue:false 观察原始状态）
  await enterFreshGame(page, { afterStartMs: 1600, skipPrologue: false });
  const duringCard = await page.evaluate(() => {
    const scene = window.__game.scene.getScene('MainGameScene');
    return {
      storyPaused: !!scene._pauseReasons?.has('story'),
      prologueStatus: scene.questSystem.quests.find(q => q.id === 'ow_prologue')?.status,
      mainsLocked: ['ow_first_hunt', 'ow_goblin_threat', 'ow_bone_legion', 'ow_slay_king']
        .every(id => scene.questSystem.quests.find(q => q.id === id)?.status === 'locked'),
    };
  });
  assert.equal(duringCard.storyPaused, true, '开场字幕卡应暂停游戏');
  assert.equal(duringCard.prologueStatus, 'active', '引导任务应已激活');
  assert.equal(duringCard.mainsLocked, true, '四幕主线应全部锁定');

  // 2) 跳过字幕卡
  for (let i = 0; i < 12; i++) {
    const paused = await page.evaluate(() =>
      !!window.__game.scene.getScene('MainGameScene')._pauseReasons?.has('story'));
    if (!paused) break;
    await page.keyboard.press('Space');
    await page.waitForTimeout(400);
  }
  const afterCard = await page.evaluate(() =>
    !!window.__game.scene.getScene('MainGameScene')._pauseReasons?.has('story'));
  assert.equal(afterCard, false, '字幕卡应可按键跳过');

  // 3) 与雷九交互：完成引导任务 + 打开登记对话
  const reg = await page.evaluate(() => {
    const scene = window.__game.scene.getScene('MainGameScene');
    const npcSprite = scene.children.list.find(o => o.npcId === 'bounty_officer');
    if (!npcSprite) return { error: 'bounty_officer 未生成' };
    // 先读指示器（对话开启后会变为「...」）
    const indicator = npcSprite.npcInstance?.stateIndicator?.text;
    scene.player.sprite.body.reset(npcSprite.x + 40, npcSprite.y);
    scene.events.emit('playerInteract', npcSprite);
    return {
      stage: scene.npcMemory.getStage('bounty_officer', 'intro'),
      indicator,
    };
  });
  assert.equal(reg.error, undefined, reg.error);
  assert.equal(reg.stage, 'intro');
  assert.equal(reg.indicator, '！', '雷九头顶应显示交接标记');
  await page.waitForTimeout(500);

  // 4) 对话：领第一桩差事 → 接下差事（发药 + prologue_done + 接 ow_first_hunt）
  const afterDialogue = await page.evaluate(async () => {
    const scene = window.__game.scene.getScene('MainGameScene');
    const engine = scene.dialogueEngine;
    engine.choose(0); // 领第一桩差事 → first_job
    await new Promise(r => setTimeout(r, 200));
    engine.choose(0); // 接下差事（actions）
    await new Promise(r => setTimeout(r, 300));
    const potion = scene.inventory.slots.find(s => s && s.id === 'potion');
    return {
      prologue: scene.questSystem.quests.find(q => q.id === 'ow_prologue')?.status,
      firstHunt: scene.questSystem.quests.find(q => q.id === 'ow_first_hunt')?.status,
      potionCount: potion?.quantity || 0,
      prologueFlag: !!scene.worldState.getFlag('prologue_done'),
      stage: scene.npcMemory.getStage('bounty_officer', 'intro'),
    };
  });
  assert.equal(afterDialogue.prologue, 'completed', '引导任务应在见到雷九时完成');
  assert.equal(afterDialogue.firstHunt, 'active', '第一幕应已接取');
  assert.ok(afterDialogue.potionCount >= 3, `登记应发回春散×3（实得 ${afterDialogue.potionCount}）`);
  assert.equal(afterDialogue.prologueFlag, true);
  assert.equal(afterDialogue.stage, 'act1', '接取第一幕后雷九应进入 act1');

  // 5) 模拟清剿 5 只浊水精 → 第一幕完成 → 雷九 act1_done → 接第二幕
  const chain = await page.evaluate(async () => {
    const scene = window.__game.scene.getScene('MainGameScene');
    for (let i = 0; i < 5; i++) scene.events.emit('enemyDeath', { config: { id: 'slime' } });
    await new Promise(r => setTimeout(r, 200));
    const afterAct1 = {
      firstHunt: scene.questSystem.quests.find(q => q.id === 'ow_first_hunt')?.status,
      stage: scene.npcMemory.getStage('bounty_officer', 'intro'),
    };
    // 回访雷九接第二幕
    const npcSprite = scene.children.list.find(o => o.npcId === 'bounty_officer');
    scene.events.emit('playerInteract', npcSprite);
    await new Promise(r => setTimeout(r, 200));
    scene.dialogueEngine.choose(0); // 接下差事 → accept ow_goblin_threat
    await new Promise(r => setTimeout(r, 300));
    return {
      ...afterAct1,
      goblin: scene.questSystem.quests.find(q => q.id === 'ow_goblin_threat')?.status,
      stageAfter: scene.npcMemory.getStage('bounty_officer', 'intro'),
      boneLocked: scene.questSystem.quests.find(q => q.id === 'ow_bone_legion')?.status === 'locked',
    };
  });
  assert.equal(chain.firstHunt, 'completed');
  assert.equal(chain.stage, 'act1_done', '第一幕完成后雷九应进入 act1_done');
  assert.equal(chain.goblin, 'active', '第二幕应可从对话接取');
  assert.equal(chain.stageAfter, 'act2');
  assert.equal(chain.boneLocked, true, '第三幕应仍然锁定');

  assert.equal(pageErrors.length, 0, `page errors: ${pageErrors.join('\n')}`);
  console.log('Result: PASS - 序章引导与主线链条（字幕卡/登记/发药/幕间交接/锁链）');
} catch (e) {
  console.error('Result: FAIL -', e.message);
  console.error('pageErrors:', pageErrors);
  process.exitCode = 1;
} finally {
  await browser.close();
}
