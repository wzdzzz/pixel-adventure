/**
 * 游侠艾琳对话 — 招募候选
 */
export default {
  recruitable: {
    start: {
      speaker: '剑修沈青萝',
      text: '独自游历久了也有些乏。500 灵石，我与你同行除祟。',
      options: [
        { text: '邀请同行（500 灵石）', action: 'recruit_companion' },
        { text: '改天再说', goto: 'end' }
      ]
    },
    end: { end: true }
  },

  // 招募后切到此 stage（事件驱动 transitions）
  recruited: {
    start: {
      speaker: '剑修沈青萝',
      text: '需要我做什么？',
      options: [
        { text: '打开同行面板', action: 'open_party_panel' },
        { text: '原地待命', action: 'set_stance:hold' },
        { text: '跟紧我', action: 'set_stance:follow' },
        { text: '主动出击', action: 'set_stance:aggressive' },
        { text: '暂且别过', action: 'dismiss_companion' },
        { text: '继续吧', goto: 'end' }
      ]
    },
    end: { end: true }
  },

  __surrendered__: {
    start: {
      speaker: '剑修沈青萝',
      text: '我……剑意未散，还能再战！',
      next: 'end'
    },
    end: { end: true }
  }
};
