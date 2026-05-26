/**
 * NPC 配置表（纯数据，零代码）
 *
 * 字段说明：
 *   id              唯一标识，记忆/对话/存档都用它
 *   name            显示名
 *   sprite          AssetManager 贴图 key（暂统一用 'npc'）
 *   faction         所属阵营（见 data/factions.js）
 *   essential       是否关键 NPC（HP=1 时投降而非死亡）
 *   persistent      是否永久存在（不随 chunk 卸载销毁，用于同伴）
 *   spawn           { chunkX, chunkY, localX, localY } 出生位置
 *   initialStage    NPCMemory 中 stage 缺失时的默认 stage
 *   dialogueModule  对应 data/dialogues/<module>.js
 *   movement        'stand' | { type: 'patrol', radius: 96 }
 *   services        可用服务（仅用于 UI 提示）
 *   shopId          引用 data/shops.js
 *   trainerId       引用 data/trainers.js
 *   combatStats     战斗 NPC 配置（{ level, hp, skills, primaryAttackStat }）
 *   recruitCost     招募代价 { gold: N }
 *   giftPreferences { loved: [...], liked: [...], hated: [...] }
 *   surrenderDialogue 投降时显示的对话文本（可选，默认走通用兜底）
 *   transitions     stage 自动转换 [{ from, to, on: 'event:str' }]
 */
export const NPCS = {
  blacksmith_tom: {
    id: 'blacksmith_tom',
    name: '铁匠汤姆',
    sprite: 'npc',
    faction: 'townfolk',
    essential: true,
    spawn: { chunkX: 8, chunkY: 8, localX: 12, localY: 16 },
    initialStage: 'greet',
    dialogueModule: 'blacksmith_tom',
    movement: 'stand',
    services: ['shop', 'enhance', 'reforge', 'gem_inlay'],
    shopId: 'tom_shop',
    giftPreferences: {
      loved: ['iron_ore', 'star_fragment'],
      liked: ['refining_stone'],
      hated: []
    },
    transitions: [
      { from: 'awaiting_ore', to: 'trusted', on: 'quest:tom_intro:completed' }
    ]
  }
};

export function getNpcConfig(id) {
  return NPCS[id] || null;
}

export function getAllNpcs() {
  return Object.values(NPCS);
}

export function getNpcsInChunk(chunkX, chunkY) {
  return Object.values(NPCS).filter(n =>
    n.spawn && n.spawn.chunkX === chunkX && n.spawn.chunkY === chunkY
  );
}
