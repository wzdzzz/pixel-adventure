/**
 * 战士导师对话
 */
export default {
  greet: {
    start: {
      speaker: '体修教习石崇山',
      text: '想锤炼体魄？我可以教你几式体修功夫。',
      options: [
        { text: '请教传承', action: 'open_trainer:warrior_trainer' },
        { text: '调息疗伤', action: 'heal_player' },
        { text: '告辞', goto: 'end' }
      ]
    },
    end: { end: true }
  }
};
