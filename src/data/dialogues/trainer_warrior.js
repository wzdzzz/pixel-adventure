/**
 * 战士导师对话
 */
export default {
  greet: {
    start: {
      speaker: '战士导师·铁拳',
      text: '想变强吗？我可以教你战士的招式。',
      options: [
        { text: '开始训练', action: 'open_trainer:warrior_trainer' },
        { text: '回血', action: 'heal_player' },
        { text: '告辞', goto: 'end' }
      ]
    },
    end: { end: true }
  }
};
