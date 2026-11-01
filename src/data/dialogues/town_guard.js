/**
 * 城镇卫兵对话
 * 2 个 stage：patrol（巡逻问候） + __surrendered__（投降兜底，CombatNPC 也可用）
 */
export default {
  patrol: {
    start: {
      speaker: '执法修士',
      text: '出坊后多留神，近来山里的劫修不太安分。',
      options: [
        { text: '辛苦了', goto: 'thank' },
        { text: '告辞', goto: 'end' }
      ]
    },
    thank: {
      speaker: '执法修士',
      text: '去忙吧，别在坊门前久留。',
      set: { relationDelta: 1 },
      next: 'end'
    },
    end: { end: true }
  },

  // 系统兜底 stage（被打到血量为 1 的 essential 才会进入；
  // 普通 combat NPC 死亡时直接 markDead 不走这里）
  __surrendered__: {
    start: {
      speaker: '执法修士',
      text: '住手！我认输便是。',
      next: 'end'
    },
    end: { end: true }
  }
};
