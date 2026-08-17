/**
 * 赏金官 老雷 — 冒险公会委托发布人
 *
 * 提供：查看任务板（打开任务日志）+ 刷新今日赏金委托。
 */
export default {
  greet: {
    start: {
      speaker: '悬赏执事雷九',
      text: '新来的散修？悬赏堂正缺人手，看看有哪桩差事合适。',
      options: [
        { text: '查看悬赏榜', action: 'open_quest_log' },
        { text: '刷新今日悬赏', action: 'refresh_bounties' },
        { text: '失陪了', goto: 'end' }
      ]
    },
    end: { end: true }
  }
};
