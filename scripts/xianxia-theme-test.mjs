import assert from 'node:assert/strict';
import itemData from '../src/data/items.json' with { type: 'json' };
import { CLASS_CONFIG } from '../src/data/classConfig.js';
import { ARCHER_SKILLS } from '../src/data/archerSkills.js';
import { MAGE_SKILLS } from '../src/data/mageSkills.js';
import { NPCS } from '../src/data/npcs.js';
import { ENEMY_NAMES } from '../src/data/quests.js';
import { WARRIOR_SKILLS } from '../src/data/warriorSkills.js';
import { BIOMES } from '../src/world/biomes/biomeConfig.js';
import { CompanionManager } from '../src/systems/CompanionManager.js';
import { syncItemDisplayFields } from '../src/systems/ItemDisplaySync.js';
import { QuestSystem } from '../src/systems/QuestSystem.js';
import { SaveSystem } from '../src/systems/SaveSystem.js';
import {
  CLASS_LABELS,
  RARITY_LABELS,
  RESOURCE_LABELS,
  STAT_LABELS,
  THEME_CONFIG,
  WEAPON_TYPE_LABELS,
} from '../src/config/themeConfig.js';
import { RARITY_THEME, UI_THEME } from '../src/config/uiTheme.js';

assert.equal(THEME_CONFIG.title, '云荒问道');
assert.deepEqual(CLASS_LABELS, { warrior: '体修', archer: '剑修', mage: '术修' });
assert.deepEqual(RESOURCE_LABELS, { rage: '罡气', stamina: '剑意', mana: '灵力', none: '' });
assert.equal(STAT_LABELS.int, '悟性');
assert.equal(RARITY_LABELS.mythic, '仙品');
assert.deepEqual(WEAPON_TYPE_LABELS, { heavy: '重兵', light: '飞剑', magic: '法器' });
assert.equal(UI_THEME.colors.jade, 0x62bc91);
assert.equal(UI_THEME.colors.cinnabar, 0xb94f43);
assert.equal(UI_THEME.colors.brass, 0xc6a45f);
assert.equal(RARITY_THEME.legendary.border, UI_THEME.colors.brass);
assert.deepEqual(
  Object.fromEntries(Object.entries(CLASS_CONFIG).map(([id, config]) => [id, config.name])),
  CLASS_LABELS
);

const legacyEquipment = {
  id: 'iron_sword',
  templateId: 'iron_sword',
  name: '铁剑',
  description: '旧主题描述',
  texture: 'legacy_texture',
  instanceId: 'eq_legacy_1',
  type: 'equipment',
  rarity: 'legendary',
  level: 17,
  enhanceLevel: 9,
  affixes: [{ id: 'attack_t1', value: 0.18 }],
  sockets: [{ gemId: 'red_gem', gemLevel: 3 }],
  baseStats: { attack: 77 },
  quantity: 1,
};

const preserved = structuredClone(legacyEquipment);
syncItemDisplayFields(legacyEquipment, itemData.items);

assert.equal(legacyEquipment.name, itemData.items.iron_sword.name);
assert.equal(legacyEquipment.description, itemData.items.iron_sword.description);
assert.equal(legacyEquipment.texture, itemData.items.iron_sword.texture);
for (const field of ['instanceId', 'rarity', 'level', 'enhanceLevel', 'affixes', 'sockets', 'baseStats', 'quantity']) {
  assert.deepEqual(legacyEquipment[field], preserved[field], `must preserve ${field}`);
}

assert.match(itemData.items.rusty_dagger.name, /剑/);
assert.doesNotMatch(itemData.items.rusty_dagger.name, /弓|弩|匕首/);
assert.doesNotMatch(itemData.items.apprentice_staff.name, /法杖|奥术/);
assert.equal(itemData.items.coin.name, THEME_CONFIG.currency);

assert.equal(WARRIOR_SKILLS.heavyStrike.name, '撼山击');
assert.equal(ARCHER_SKILLS.piercingShot.name, '贯虹剑');
assert.equal(MAGE_SKILLS.fireball.name, '离火咒');
assert.deepEqual(Object.values(BIOMES).map(biome => biome.name), [
  '青岚竹海', '太虚宗遗址', '寒渊雪岭', '赤金沙海', '瘴云泽', '焚天火域',
]);
assert.deepEqual(Object.values(ENEMY_NAMES), [
  '浊水精', '山魈', '噬魂蛛', '阴兵', '吸灵蝠', '妖族力士', '业火邪修', '尸傀将军', '白骨鬼王',
]);

const companionManager = Object.create(CompanionManager.prototype);
companionManager.roster = new Map();
companionManager.deserialize({
  roster: [{ npcId: 'companion_rogue', name: '游侠艾琳', stance: 'follow', recruitedAt: 0 }],
  activeId: 'companion_rogue',
});
assert.equal(companionManager.getRoster()[0].name, NPCS.companion_rogue.name);

const questSystem = Object.create(QuestSystem.prototype);
questSystem.scene = { events: { emit() {} } };
questSystem.quests = [];
questSystem._bountySeq = 0;
questSystem.fromJSON([{
  id: 'bounty_7',
  status: 'active',
  objectives: [{ id: 'bounty_7_obj', current: 2 }],
  dynamic: {
    title: '赏金：史莱姆',
    description: '击杀旧主题怪物后返回冒险者公会。',
    type: 'bounty',
    rewards: { xp: 100, gold: 80 },
    objectives: [{ id: 'bounty_7_obj', text: '击败史莱姆', type: 'kill', target: 'slime', required: 8 }],
  },
}]);
const migratedBounty = questSystem.quests[0];
assert.equal(migratedBounty.title, '赏金：浊水精');
assert.match(migratedBounty.description, /悬赏堂/);
assert.equal(migratedBounty.objectives[0].text, '击败浊水精');
assert.equal(migratedBounty.objectives[0].current, 2);
assert.deepEqual(migratedBounty.rewards, { xp: 100, gold: 80 });

const legacySave = SaveSystem._normalizeSaveData({
  version: '3.0.0',
  meta: { levelName: '迷雾森林' },
});
assert.equal(legacySave.themeVersion, THEME_CONFIG.version);
assert.equal(legacySave.meta.levelName, '云荒游历');

const originalLocalStorage = globalThis.localStorage;
globalThis.localStorage = {
  getItem(key) {
    if (key !== SaveSystem._key(1)) return null;
    return JSON.stringify({
      version: '3.0.0',
      timestamp: 1,
      meta: { classType: 'warrior', levelName: '迷雾森林' },
    });
  },
};
assert.equal(SaveSystem.getSaveInfo(1).levelName, '云荒游历');
globalThis.localStorage = originalLocalStorage;

console.log('Result: PASS - xianxia theme data, UI labels, and legacy display migrations');
