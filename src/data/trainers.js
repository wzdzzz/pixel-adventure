/**
 * 训练师配置（纯数据）
 *
 * 字段：
 *   id            唯一 id
 *   name          显示名
 *   classFilter   仅对特定职业开放，null = 任意职业
 *   skills        可学技能节点（skillId 对应 SkillTreeSystem.nodes.id）
 *                 { skillId, goldCost, levelReq }
 *   talentResetCost   重置天赋金币
 */
export const TRAINERS = {
  warrior_trainer: {
    id: 'warrior_trainer',
    name: '体修教习石崇山',
    classFilter: 'warrior',
    skills: [
      { skillId: 'ber_1', goldCost: 100, levelReq: 2 },
      { skillId: 'ber_2', goldCost: 200, levelReq: 3 },
      { skillId: 'grd_1', goldCost: 100, levelReq: 2 },
      { skillId: 'grd_2', goldCost: 200, levelReq: 3 }
    ],
    talentResetCost: 5000
  },
  archer_trainer: {
    id: 'archer_trainer',
    name: '剑修沈青萝',
    classFilter: 'archer',
    skills: [],
    talentResetCost: 5000
  },
  mage_trainer: {
    id: 'mage_trainer',
    name: '术修教习',
    classFilter: 'mage',
    skills: [],
    talentResetCost: 5000
  }
};

export function getTrainerConfig(id) {
  return TRAINERS[id] || null;
}
