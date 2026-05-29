/**
 * 赏金官 老雷 — 冒险公会委托发布人
 *
 * 提供：查看任务板（打开任务日志）+ 刷新今日赏金委托。
 */
export default {
  greet: {
    start: {
      speaker: '赏金官 老雷',
      text: '冒险者？公会的委托板上总缺人手。看看有什么活计吧。',
      options: [
        { text: '查看任务板', action: 'open_quest_log' },
        { text: '刷新今日委托', action: 'refresh_bounties' },
        { text: '失陪了', goto: 'end' }
      ]
    },
    end: { end: true }
  }
};
