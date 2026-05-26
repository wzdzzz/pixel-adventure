/**
 * 铁匠汤姆对话树
 * 3 个 stage：greet（陌生） → awaiting_ore（接了委托） → trusted（信任）
 */

export default {
  // ────────── Stage 1: 陌生人 ──────────
  greet: {
    start: {
      speaker: '铁匠汤姆',
      text: '一个生面孔啊。这村子可不常来人，你来这干嘛？',
      next: 'menu'
    },
    menu: {
      speaker: '铁匠汤姆',
      text: '你想干嘛？',
      options: [
        { text: '想接点委托', goto: 'offer_quest' },
        { text: '看看你的货', goto: 'show_shop' },
        { text: '告辞', goto: 'end' }
      ]
    },
    offer_quest: {
      speaker: '铁匠汤姆',
      text: '正好，山里铁矿被人霸占着，我打不开锅。帮我搞 5 块铁矿来，我请你喝两杯，再教你点东西。',
      action: 'accept_quest:tom_intro',
      set: { stage: 'awaiting_ore', relationDelta: 5 },
      next: 'end'
    },
    show_shop: {
      speaker: '铁匠汤姆',
      text: '看吧。',
      action: 'open_shop:tom_shop',
      next: 'end'
    },
    end: { end: true }
  },

  // ────────── Stage 2: 等矿 ──────────
  awaiting_ore: {
    start: {
      speaker: '铁匠汤姆',
      text: '矿石带回来了吗？',
      options: [
        { text: '交付 5×铁矿',
          if: 'hasItem(iron_ore,5)',
          goto: 'turn_in' },
        { text: '还在找',
          if: '!hasItem(iron_ore,5)',
          goto: 'remind' },
        { text: '看看你的货', goto: 'show_shop' },
        { text: '告辞', goto: 'end' }
      ]
    },
    turn_in: {
      action: ['take_item:iron_ore:5', 'turn_in_quest:tom_intro', 'give_gold:200'],
      set: { stage: 'trusted', relationDelta: 20 },
      speaker: '铁匠汤姆',
      text: '哈哈，好兄弟！以后想强化装备随时来，给你算便宜点。',
      next: 'end'
    },
    remind: {
      speaker: '铁匠汤姆',
      text: '快去吧，矿就在北边山洞。',
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
      speaker: '铁匠汤姆',
      text: '兄弟！想做点啥？',
      options: [
        { text: '强化装备', action: 'open_enhance', goto: 'end' },
        { text: '洗练词条', action: 'open_reforge', goto: 'end' },
        { text: '镶嵌宝石', action: 'open_gem_inlay', goto: 'end' },
        { text: '看看你的货', action: 'open_shop:tom_shop', goto: 'end' },
        { text: '送点东西给你', goto: 'gift_menu' },
        { text: '告辞', goto: 'end' }
      ]
    },
    gift_menu: {
      speaker: '铁匠汤姆',
      text: '送什么？我最喜欢铁矿和星辰碎片。',
      options: [
        { text: '送 1 块铁矿',
          if: 'hasItem(iron_ore,1)',
          action: 'gift_item:iron_ore:1',
          goto: 'end' },
        { text: '算了，不送了', goto: 'end' }
      ]
    },
    end: { end: true }
  }
};
