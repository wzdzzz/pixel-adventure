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
    name: '战神祭坛',
    icon: '⚔',
    glow: 0xff5544,
    msg: '战神之力涌入你的身躯！攻击力大幅提升。',
    buff: { id: 'shrine_might', type: 'buff', name: '战神祝福', icon: '⚔', duration: 90000, modifiers: { attack: 0.30 }, description: '攻击 +30%' },
  },
  swift: {
    kind: 'buff',
    name: '疾风祭坛',
    icon: '»',
    glow: 0x44ddff,
    msg: '疾风缠绕双腿，你的脚步快如闪电。',
    buff: { id: 'shrine_swift', type: 'buff', name: '疾风祝福', icon: '»', duration: 90000, modifiers: { moveSpeed: 0.30 }, description: '移速 +30%' },
  },
  vigor: {
    kind: 'heal',
    name: '生命圣泉',
    icon: '+',
    glow: 0x55ff88,
    msg: '清澈的泉水治愈了你的所有伤痛。',
  },
  relic: {
    kind: 'reward',
    name: '远古石碑',
    icon: '◆',
    glow: 0xffdd44,
    msg: '你解读了石碑上的远古知识，获得了财富与感悟。',
    reward: { gold: 80, xp: 120 },
  },
};

export const SHRINE_KEYS = Object.keys(SHRINE_TYPES);
