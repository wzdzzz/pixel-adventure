/**
 * 城镇卫兵对话
 * 2 个 stage：patrol（巡逻问候） + __surrendered__（投降兜底，CombatNPC 也可用）
 */
export default {
  patrol: {
    start: {
      speaker: '城镇卫兵',
      text: '保持警惕，最近山里的强盗不太老实。',
      options: [
        { text: '辛苦了', goto: 'thank' },
        { text: '告辞', goto: 'end' }
      ]
    },
    thank: {
      speaker: '城镇卫兵',
      text: '走开吧，别耽误执勤。',
      set: { relationDelta: 1 },
      next: 'end'
    },
    end: { end: true }
  },

  // 系统兜底 stage（被打到血量为 1 的 essential 才会进入；
  // 普通 combat NPC 死亡时直接 markDead 不走这里）
  __surrendered__: {
    start: {
      speaker: '城镇卫兵',
      text: '别杀我！我什么都答应！',
      next: 'end'
    },
    end: { end: true }
  }
};
