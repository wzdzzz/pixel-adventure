/**
 * 悬赏执事雷九 — 主线四幕的叙事锚点 + 悬赏堂功能入口
 *
 * stage 机（由 npcs.js 的 transitions 按任务事件自动切换）：
 *   intro → act1 → act1_done → act2 → act2_done → act3 → act3_done → act4 → post
 *
 * 每个 stage 都保留「查看悬赏榜 / 刷新今日悬赏」功能入口。
 */

/** 各 stage 共享的悬赏堂功能选项 */
const BOARD_OPTIONS = [
  { text: '查看悬赏榜', action: 'open_quest_log' },
  { text: '刷新今日悬赏', action: 'refresh_bounties' },
];

export default {
  // ── 序章：登记散修身份 + 交接第一幕 ──
  intro: {
    start: {
      speaker: '悬赏执事雷九',
      text: '新面孔？要在云荒讨生活，先在悬赏堂挂个名。……好了，从今日起你就是在册散修。',
      options: [
        { text: '领第一桩差事', goto: 'first_job' },
        ...BOARD_OPTIONS,
      ]
    },
    first_job: {
      speaker: '悬赏执事雷九',
      text: '近郊水源发浑，浊水精比往年多得不像话。去清掉五只，回来领钱。\n拿上这几包回春散——死在城门口，我可不好交代。',
      options: [
        {
          text: '接下差事',
          action: ['accept_quest:ow_first_hunt', 'give_item:potion:3', 'set_flag:prologue_done'],
          goto: 'end'
        },
      ]
    },
    end: { end: true }
  },

  // ── 第一幕进行中 ──
  act1: {
    start: {
      speaker: '悬赏执事雷九',
      text: '浊水精就在坊市外围的水边，清完五只再来。',
      options: [...BOARD_OPTIONS, { text: '这就去', goto: 'end' }]
    },
    end: { end: true }
  },

  // ── 第一幕完成：揭示 + 交接第二幕 ──
  act1_done: {
    start: {
      speaker: '悬赏执事雷九',
      text: '浊水精清了？水里那股浊气还没散……不是天灾，倒像有什么在上游搅动。\n西边山里的山魈最近也不安分，去看看。',
      options: [
        { text: '接下差事', action: 'accept_quest:ow_goblin_threat', goto: 'end' },
        ...BOARD_OPTIONS,
      ]
    },
    end: { end: true }
  },

  // ── 第二幕进行中 ──
  act2: {
    start: {
      speaker: '悬赏执事雷九',
      text: '山魈在西面山林聚集，小心它们的石锤。',
      options: [...BOARD_OPTIONS, { text: '这就去', goto: 'end' }]
    },
    end: { end: true }
  },

  // ── 第二幕完成：揭示 + 交接第三幕 ──
  act2_done: {
    start: {
      speaker: '悬赏执事雷九',
      text: '你带回的骨饰上有阴煞气——这东西只在古宗封印附近才有。\n北面太虚宗遗址方向不对劲，阴兵都出来了。当心那个带兵的尸傀。',
      options: [
        { text: '接下差事', action: 'accept_quest:ow_bone_legion', goto: 'end' },
        ...BOARD_OPTIONS,
      ]
    },
    end: { end: true }
  },

  // ── 第三幕进行中 ──
  act3: {
    start: {
      speaker: '悬赏执事雷九',
      text: '阴兵怕硬碰硬，尸傀将军可不是。带够丹药再往遗址去。',
      options: [...BOARD_OPTIONS, { text: '这就去', goto: 'end' }]
    },
    end: { end: true }
  },

  // ── 第三幕完成：揭示 + 交接终幕 ──
  act3_done: {
    start: {
      speaker: '悬赏执事雷九',
      text: '尸傀将军也是傀儡，操线的是白骨鬼王。遗址深处的封印撑不了几天了——\n云荒安不安稳，就看这一趟。',
      options: [
        { text: '领最后一桩差事', action: 'accept_quest:ow_slay_king', goto: 'end' },
        ...BOARD_OPTIONS,
      ]
    },
    end: { end: true }
  },

  // ── 终幕进行中 ──
  act4: {
    start: {
      speaker: '悬赏执事雷九',
      text: '鬼王在遗址深处等着。别逞强，备足丹药再去。',
      options: [...BOARD_OPTIONS, { text: '这就去', goto: 'end' }]
    },
    end: { end: true }
  },

  // ── 通关后 ──
  post: {
    start: {
      speaker: '悬赏执事雷九',
      text: '云荒能有今日安稳，坊市都记着你的名字。\n悬赏照旧有——世道从不缺麻烦。',
      options: [...BOARD_OPTIONS, { text: '失陪了', goto: 'end' }]
    },
    end: { end: true }
  },

  // ── 兜底：老档 stage 仍为 greet 时的通用问候（迁移会重写 stage，此处保险） ──
  greet: {
    start: {
      speaker: '悬赏执事雷九',
      text: '悬赏堂的差事不少，看看有哪桩合适。',
      options: [...BOARD_OPTIONS, { text: '失陪了', goto: 'end' }]
    },
    end: { end: true }
  }
};
