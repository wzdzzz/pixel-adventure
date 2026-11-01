/**
 * 世界地标 POI — 神殿 / 祭坛 / 事件点
 *
 * 散布于开放世界的可交互地标，每个一次性使用（worldState 持久化）。
 * kind:
 *   'buff'   施加一个限时增益（StatusEffectSystem，modifiers 为乘法系数）
 *   'heal'   立即回满 HP
 *   'reward' 一次性发放金币 + 经验（事件点/远古石碑）
 */
export const SHRINE_TYPES = {
  might: {
    kind: 'buff',
    name: '玄罡武碑',
    icon: '⚔',
    glow: 0xff5544,
    msg: '碑中玄罡涌入经脉，攻势随之增强。',
    buff: { id: 'shrine_might', type: 'buff', name: '玄罡淬体', icon: '⚔', duration: 90000, modifiers: { attack: 0.30 }, description: '攻击 +30%' },
  },
  swift: {
    kind: 'buff',
    name: '流云剑痕',
    icon: '»',
    glow: 0x44ddff,
    msg: '剑痕中流风未散，你的身法变得轻灵。',
    buff: { id: 'shrine_swift', type: 'buff', name: '流云身法', icon: '»', duration: 90000, modifiers: { moveSpeed: 0.30 }, description: '移速 +30%' },
  },
  vigor: {
    kind: 'heal',
    name: '回春灵泉',
    icon: '+',
    glow: 0x55ff88,
    msg: '温润灵泉洗去伤痛，气血已经恢复。',
  },
  relic: {
    kind: 'reward',
    name: '无字道碑',
    icon: '◆',
    glow: 0xffdd44,
    msg: '你从无字道碑中悟得一缕道意，也发现了前人留下的灵石。',
    reward: { gold: 80, xp: 120 },
  },
};

export const SHRINE_KEYS = Object.keys(SHRINE_TYPES);
