/**
 * 佣兵巴克对话 — 招募候选（重甲近战）
 */
export default {
  recruitable: {
    start: {
      speaker: '体修岳沉山',
      text: '缺个能扛能打的同伴？800 灵石，我替你守住身前。',
      options: [
        { text: '邀请同行（800 灵石）', action: 'recruit_companion' },
        { text: '改天再说', goto: 'end' }
      ]
    },
    end: { end: true }
  },

  recruited: {
    start: {
      speaker: '体修岳沉山',
      text: '听你的，道友。',
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
    start: { speaker: '体修岳沉山', text: '容我调息片刻……', next: 'end' },
    end: { end: true }
  }
};
