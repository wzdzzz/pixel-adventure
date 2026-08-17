/**
 * ClassRegistry — 职业定义数据（纯数据，无逻辑）
 *
 * 新增职业步骤：
 * 1. 在 CLASS_CONFIG 中添加条目
 * 2. 创建 src/data/<class>Skills.js（参考 warriorSkills.js 格式）
 * 3. 在 Player._loadSkillModule() 中添加 case
 * 4. 在 AssetManager.CHARACTERS 中添加角色纹理
 */

export const CLASS_CONFIG = {
  warrior: {
    id: 'warrior',
    name: '体修',
    description: '以体魄和重兵近身破敌，交战时积蓄罡气',
    baseStats: { con: 10, str: 8, int: 5, agi: 8, per: 5, lck: 3 },
    resource: 'rage',
    texturePrefix: 'hero',
    attackType: 'melee',
    primaryAttackStat: 'str',
    // 每级额外属性加成（在 Stats.levelUp +1 all 之上）
    levelUpBonus: { con: 1, str: 1, int: 0, agi: 0, per: 0, lck: 0 }
  },

  archer: {
    id: 'archer',
    name: '剑修',
    description: '驭使飞剑远程攻敌，以身法调整战位',
    baseStats: { con: 6, str: 5, int: 5, agi: 12, per: 8, lck: 3 },
    resource: 'stamina',
    texturePrefix: 'hero',  // TODO: archer sprites
    attackType: 'ranged',
    primaryAttackStat: 'agi',
    levelUpBonus: { con: 0, str: 0, int: 0, agi: 1, per: 1, lck: 0 }
  },

  mage: {
    id: 'mage',
    name: '术修',
    description: '施展五行术法，擅长爆发、控制与护身',
    baseStats: { con: 5, str: 3, int: 12, agi: 6, per: 6, lck: 5 },
    resource: 'mana',
    texturePrefix: 'hero',  // TODO: mage sprites
    attackType: 'magic',
    primaryAttackStat: 'int',
    levelUpBonus: { con: 0, str: 0, int: 2, agi: 0, per: 0, lck: 0 }
  }
};

export const GENDER_OPTIONS = ['male', 'female'];

export function getClassConfig(classType) {
  return CLASS_CONFIG[classType] || CLASS_CONFIG.warrior;
}
