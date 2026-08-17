/**
 * 铁匠汤姆对话树
 * 3 个 stage：greet（陌生） → awaiting_ore（接了委托） → trusted（信任）
 */

export default {
  // ────────── Stage 1: 陌生人 ──────────
  greet: {
    start: {
      speaker: '炼器师顾炉',
      text: '生面孔啊。栖云坊市不常来散修，你找我有什么事？',
      next: 'menu'
    },
    menu: {
      speaker: '炼器师顾炉',
      text: '说吧，想办什么？',
      options: [
        { text: '想接悬赏', goto: 'offer_quest' },
        { text: '看看你的法器', goto: 'show_shop' },
        { text: '告辞', goto: 'end' }
      ]
    },
    offer_quest: {
      speaker: '炼器师顾炉',
      text: '正好，北边矿洞被妖祟占了，我的炉子快断料了。帮我取 5 块玄铁屑来，报酬少不了你的。',
      action: 'accept_quest:tom_intro',
      set: { stage: 'awaiting_ore', relationDelta: 5 },
      next: 'end'
    },
    show_shop: {
      speaker: '炼器师顾炉',
      text: '都在这里，自己挑。',
      action: 'open_shop:tom_shop',
      next: 'end'
    },
    end: { end: true }
  },

  // ────────── Stage 2: 等矿 ──────────
  awaiting_ore: {
    start: {
      speaker: '炼器师顾炉',
      text: '玄铁屑带回来了吗？',
      options: [
        { text: '交付 5×玄铁屑',
          if: 'hasItem(iron_ore,5)',
          goto: 'turn_in' },
        { text: '还在找',
          if: '!hasItem(iron_ore,5)',
          goto: 'remind' },
        { text: '看看你的法器', goto: 'show_shop' },
        { text: '告辞', goto: 'end' }
      ]
    },
    turn_in: {
      action: ['take_item:iron_ore:5', 'turn_in_quest:tom_intro', 'give_gold:200'],
      set: { stage: 'trusted', relationDelta: 20 },
      speaker: '炼器师顾炉',
      text: '成色不错。往后想淬炼法器就来找我，给你算便宜些。',
      next: 'end'
    },
    remind: {
      speaker: '炼器师顾炉',
      text: '矿洞就在北边，妖祟还守在那里。',
      next: 'end'
    },
    show_shop: {
      action: 'open_shop:tom_shop',
      next: 'end'
    },
    end: { end: true }
  },

  // ────────── Stage 3: 信任 ──────────
  trusted: {
    start: {
      speaker: '炼器师顾炉',
      text: '道友，今天想炼些什么？',
      options: [
        { text: '淬炼装备', action: 'open_enhance', goto: 'end' },
        { text: '重炼词条', action: 'open_reforge', goto: 'end' },
        { text: '镶嵌灵玉', action: 'open_gem_inlay', goto: 'end' },
        { text: '看看你的法器', action: 'open_shop:tom_shop', goto: 'end' },
        { text: '送点东西给你', goto: 'gift_menu' },
        { text: '告辞', goto: 'end' }
      ]
    },
    gift_menu: {
      speaker: '炼器师顾炉',
      text: '送什么？玄铁屑和星辰碎片最合我心意。',
      options: [
        { text: '送 1 块玄铁屑',
          if: 'hasItem(iron_ore,1)',
          action: 'gift_item:iron_ore:1',
          goto: 'end' },
        { text: '算了，不送了', goto: 'end' }
      ]
    },
    end: { end: true }
  }
};
