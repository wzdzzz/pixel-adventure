/**
 * storyVersion 迁移单测（node，无浏览器）
 * 覆盖设计文档第 7 节的三类老档：未开始 / 中途 / 已通关，及新档幂等。
 */
import assert from 'node:assert/strict';
import { SaveSystem } from '../src/systems/SaveSystem.js';

const ACTS = ['ow_first_hunt', 'ow_goblin_threat', 'ow_bone_legion', 'ow_slay_king'];

function makeLegacySave({ statuses, progress = {} }) {
  return {
    version: '3.0.0',
    themeVersion: 1,
    // 无 storyVersion 字段 = 老档
    meta: { classType: 'warrior', level: 5 },
    player: { position: { x: 8704, y: 8704 } },
    quests: ACTS.map((id, i) => ({
      id, status: statuses[i],
      objectives: [{ id: `${id}_obj0`, current: progress[id] || 0 }],
    })),
    worldState: { seed: 12345, permanentFlags: [['shrine_x_used', true]] },
    npcMemory: {},
  };
}

const flagsOf = (save) => new Map(save.worldState.permanentFlags);
const questOf = (save, id) => save.quests.find(q => q.id === id);

// ── Case 1：从未开始 → 四幕回锁，重走序章 ──
{
  const s = SaveSystem._normalizeSaveData(makeLegacySave({ statuses: ['available', 'available', 'available', 'available'] }));
  ACTS.forEach(id => assert.equal(questOf(s, id).status, 'locked', `${id} 应回锁`));
  assert.equal(questOf(s, 'ow_prologue'), undefined, '未开始的老档不应预填序章');
  assert.equal(flagsOf(s).get('prologue_done'), undefined, '未开始的老档不设 prologue_done');
  assert.equal(s.storyVersion, SaveSystem.STORY_VERSION);
}

// ── Case 2：中途（第一幕完成，第二幕进行中） → 保留进度，其余回锁，stage=act2 ──
{
  const s = SaveSystem._normalizeSaveData(makeLegacySave({
    statuses: ['completed', 'active', 'available', 'available'],
    progress: { ow_goblin_threat: 2 },
  }));
  assert.equal(questOf(s, 'ow_first_hunt').status, 'completed');
  assert.equal(questOf(s, 'ow_goblin_threat').status, 'active');
  assert.equal(questOf(s, 'ow_goblin_threat').objectives[0].current, 2, '进行中的击杀进度不能丢');
  assert.equal(questOf(s, 'ow_bone_legion').status, 'locked');
  assert.equal(questOf(s, 'ow_slay_king').status, 'locked');
  assert.equal(questOf(s, 'ow_prologue').status, 'completed', '已开始的老档跳过序章');
  assert.equal(flagsOf(s).get('prologue_done'), true);
  assert.equal(s.npcMemory.bounty_officer.stage, 'act2');
  assert.equal(flagsOf(s).get('world_calm'), undefined);
}

// ── Case 3：已通关 → post + world_calm，ending_done 不设（可补看结局） ──
{
  const s = SaveSystem._normalizeSaveData(makeLegacySave({ statuses: ['completed', 'completed', 'completed', 'completed'] }));
  assert.equal(s.npcMemory.bounty_officer.stage, 'post');
  assert.equal(flagsOf(s).get('world_calm'), true);
  assert.equal(flagsOf(s).get('ending_done'), undefined, '老档通关玩家应可补看结局');
  assert.equal(flagsOf(s).get('shrine_x_used'), true, '既有 flag 不能丢');
}

// ── Case 4：新档（已带 storyVersion） → 迁移不触发，幂等 ──
{
  const fresh = makeLegacySave({ statuses: ['locked', 'locked', 'locked', 'locked'] });
  fresh.storyVersion = SaveSystem.STORY_VERSION;
  const before = JSON.stringify(fresh.quests);
  const s = SaveSystem._normalizeSaveData(fresh);
  assert.equal(JSON.stringify(s.quests), before, '已迁移存档不应再被改写');
}

// ── Case 5：极老档无 quests/worldState → 不崩溃、不造壳 ──
{
  const s = SaveSystem._normalizeSaveData({ version: '2.0.0', player: {} });
  assert.equal(s.worldState, undefined, '不得凭空创建 worldState（会丢世界种子）');
  assert.equal(s.storyVersion, SaveSystem.STORY_VERSION);
}

console.log('Result: PASS - storyVersion 迁移（未开始/中途/通关/幂等/极老档）');
