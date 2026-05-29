/**
 * 佣兵巴克对话 — 招募候选（重甲近战）
 */
export default {
  recruitable: {
    start: {
      speaker: '佣兵巴克',
      text: '想雇个能扛能打的？800 金币，我替你挡刀。',
      options: [
        { text: '招募（800 G）', action: 'recruit_companion' },
        { text: '改天再说', goto: 'end' }
      ]
    },
    end: { end: true }
  },

  recruited: {
    start: {
      speaker: '佣兵巴克',
      text: '听你的，队长。',
      options: [
        { text: '打开队伍面板', action: 'open_party_panel' },
        { text: '原地待命', action: 'set_stance:hold' },
        { text: '跟紧我', action: 'set_stance:follow' },
        { text: '主动出击', action: 'set_stance:aggressive' },
        { text: '解散你', action: 'dismiss_companion' },
        { text: '继续吧', goto: 'end' }
      ]
    },
    end: { end: true }
  },

  __surrendered__: {
    start: { speaker: '佣兵巴克', text: '给我点时间……', next: 'end' },
    end: { end: true }
  }
};
