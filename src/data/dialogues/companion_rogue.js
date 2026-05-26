/**
 * 游侠艾琳对话 — 招募候选
 */
export default {
  recruitable: {
    start: {
      speaker: '游侠艾琳',
      text: '我厌倦了独自旅行，给我 500 金币，我帮你打怪。',
      options: [
        { text: '招募（500 G）', action: 'recruit_companion' },
        { text: '改天再说', goto: 'end' }
      ]
    },
    end: { end: true }
  },

  // 招募后切到此 stage（事件驱动 transitions）
  recruited: {
    start: {
      speaker: '游侠艾琳',
      text: '需要我做什么？',
      options: [
        { text: '解散队伍', action: 'dismiss_companion' },
        { text: '继续吧', goto: 'end' }
      ]
    },
    end: { end: true }
  },

  __surrendered__: {
    start: {
      speaker: '游侠艾琳',
      text: '我……还能再战！',
      next: 'end'
    },
    end: { end: true }
  }
};
