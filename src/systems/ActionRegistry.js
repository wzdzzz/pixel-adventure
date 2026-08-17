import itemData from '../data/items.json';
import { THEME_CONFIG } from '../config/themeConfig.js';

/**
 * ActionRegistry — 对话/事件统一 action 派发器
 *
 * action 字符串格式：'name' 或 'name:arg1:arg2:...'
 * 也支持数组（顺序执行多个）：['take_item:iron_ore:5', 'show_message:谢谢']
 *
 * 每个 handler 签名：(args: string[], ctx: { npc, player, scene, dialogueEngine, save? }) => void
 *
 * 默认注册 21 个内置 action（Phase 2 阶段为桩，后续 phase 替换实现）。
 */
export class ActionRegistry {
  constructor(scene) {
    this.scene = scene;
    this.handlers = new Map();
    this._registerBuiltins();
  }

  register(name, handler) {
    this.handlers.set(name, handler);
  }

  has(name) {
    return this.handlers.has(name);
  }

  parse(str) {
    const parts = str.split(':');
    return { name: parts[0], args: parts.slice(1) };
  }

  dispatch(action, ctx) {
    if (!action) return;
    if (Array.isArray(action)) {
      for (const a of action) this.dispatch(a, ctx);
      return;
    }
    const { name, args } = this.parse(action);
    const handler = this.handlers.get(name);
    if (!handler) {
      console.warn(`[ActionRegistry] unknown action: ${name}`);
      return;
    }
    try {
      handler(args, ctx);
    } catch (err) {
      console.error(`[ActionRegistry] action "${name}" failed:`, err);
    }
  }

  _registerBuiltins() {
    const scene = this.scene;
    const stub = (label) => (args, ctx) => {
      console.log(`[Action stub] ${label}`, args, ctx?.npc?.id);
      scene?.events?.emit('showMessage', `[${label}] 暂未实现`, '#ffaa44');
    };

    // 关闭对话（在 Phase 2 即可生效）
    this.register('close_dialogue', (_args, ctx) => {
      ctx?.dialogueEngine?.stop();
    });

    // 屏幕提示（在 Phase 2 即可生效）
    this.register('show_message', (args, _ctx) => {
      const text = args.join(':');
      scene?.events?.emit('showMessage', text, '#ffffff');
    });

    // set_flag（写到 WorldStateManager.permanentFlags）
    this.register('set_flag', (args, _ctx) => {
      const [key, value = 'true'] = args;
      if (!key) return;
      const v = value === 'true' ? true : value === 'false' ? false : value;
      scene?.worldState?.setFlag(key, v);
    });

    // play_sound:音效名 —— 通过事件解耦交给 SoundManager 播放程序化 SFX
    this.register('play_sound', (args, _ctx) => {
      const name = args[0];
      if (name) scene?.events?.emit('playSound', name);
    });

    // === Phase 4 实现 ===
    this.register('open_shop', (args, ctx) => {
      // open_shop:shop_id 或 open_shop（用 npc.shopId）
      const shopId = args[0] || ctx?.npc?.shopId;
      if (!shopId) {
        scene?.events?.emit('showMessage', '没有商铺 ID', '#ff8888');
        return;
      }
      const svc = scene?.shopService;
      if (!svc) {
        scene?.events?.emit('showMessage', '商铺服务未初始化', '#ff8888');
        return;
      }
      // 先关掉对话再开商店
      ctx?.dialogueEngine?.stop();
      svc.open(shopId, ctx?.npc);
    });

    // 强化/洗练/镶嵌：调既有 PanelScene（如果存在），否则提示
    const openPanelTab = (tab) => () => {
      if (scene.scene.isActive('PanelScene')) {
        scene.events.emit('switchPanelTab', tab);
      } else {
        // 通过 registry 指定默认标签（PanelScene.create 读取），并暂停游戏
        scene.registry?.set('panelDefaultTab', tab);
        if (scene.pauseGame) scene.pauseGame('panel');
        scene.scene.launch('PanelScene');
        scene.scene.bringToTop('PanelScene');
      }
    };
    this.register('open_enhance', (_args, ctx) => {
      ctx?.dialogueEngine?.stop();
      scene?.events?.emit('showMessage', '从行囊右键装备即可淬炼', '#ffaa44');
      openPanelTab('inventory')();
    });
    this.register('open_reforge', (_args, ctx) => {
      ctx?.dialogueEngine?.stop();
      scene?.events?.emit('showMessage', '洗练（Phase 5）', '#ffaa44');
      openPanelTab('inventory')();
    });
    this.register('open_gem_inlay', (_args, ctx) => {
      ctx?.dialogueEngine?.stop();
      scene?.events?.emit('showMessage', '镶嵌（Phase 5）', '#ffaa44');
      openPanelTab('inventory')();
    });

    // === Phase 5 实现 ===
    this.register('open_trainer', (args, ctx) => {
      const trainerId = args[0] || ctx?.npc?.trainerId;
      if (!trainerId) {
        scene?.events?.emit('showMessage', '没有教习 ID', '#ff8888');
        return;
      }
      const svc = scene?.trainerService;
      if (!svc) {
        scene?.events?.emit('showMessage', '传功服务未初始化', '#ff8888');
        return;
      }
      ctx?.dialogueEngine?.stop();
      svc.open(trainerId, ctx?.npc);
    });

    // accept_quest:questId — 接受任务（available/locked → active）
    this.register('accept_quest', (args, _ctx) => {
      const questId = args[0];
      const qs = scene?.questSystem;
      if (!questId || !qs) return;
      qs.acceptQuest(questId);
    });

    // refresh_bounties — 刷新任务板上的可重复赏金（赏金官对话用）
    this.register('refresh_bounties', (_args, ctx) => {
      ctx?.dialogueEngine?.stop();
      scene?.questSystem?.refreshBounties(3);
    });

    // open_quest_log — 打开任务日志面板
    this.register('open_quest_log', (_args, ctx) => {
      ctx?.dialogueEngine?.stop();
      openPanelTab('questLog')();
    });

    // turn_in_quest:questId — 强制完成（用于无目标式任务）
    this.register('turn_in_quest', (args, _ctx) => {
      const questId = args[0];
      const qs = scene?.questSystem;
      if (!questId || !qs) return;
      const q = qs.quests.find(x => x.id === questId);
      if (!q || q.status === 'completed') return;
      // 完成所有 objective
      for (const o of q.objectives) o.current = o.required;
      qs.checkQuestCompletion(q);
    });

    // give_item:itemId:count — 给玩家物品
    this.register('give_item', (args, _ctx) => {
      const [itemId, countStr] = args;
      const count = parseInt(countStr) || 1;
      const inv = scene?.inventory;
      const def = itemData.items?.[itemId];
      if (!inv || !def) {
        scene?.events?.emit('showMessage', `物品不存在：${itemId}`, '#ff8888');
        return;
      }
      inv.addItem({ ...def, id: itemId }, count);
      scene.events.emit('showMessage', `获得 ${def.name || itemId} ×${count}`, '#44ff88');
    });

    // take_item:itemId:count — 从玩家背包扣物品（按 id 找第一个匹配槽）
    this.register('take_item', (args, _ctx) => {
      const [itemId, countStr] = args;
      let need = parseInt(countStr) || 1;
      const inv = scene?.inventory;
      if (!inv) return;
      const slots = inv.getItems();
      for (let i = 0; i < slots.length && need > 0; i++) {
        const s = slots[i];
        if (!s || s.id !== itemId) continue;
        const take = Math.min(need, s.quantity || 1);
        inv.removeItem(i, take);
        need -= take;
      }
      if (need > 0) {
        scene.events.emit('showMessage', `物品不足：${itemId}`, '#ff8888');
      }
    });

    // give_gold:amount
    this.register('give_gold', (args, _ctx) => {
      const amt = parseInt(args[0]) || 0;
      const inv = scene?.inventory;
      if (!inv || amt <= 0) return;
      inv.gold = (inv.gold || 0) + amt;
      scene.events.emit('goldChanged', inv.gold);
      scene.events.emit('showMessage', `获得 ${amt} ${THEME_CONFIG.currency}`, '#ffdd44');
    });

    // take_gold:amount
    this.register('take_gold', (args, _ctx) => {
      const amt = parseInt(args[0]) || 0;
      const inv = scene?.inventory;
      if (!inv || amt <= 0) return;
      if ((inv.gold || 0) < amt) {
        scene.events.emit('showMessage', `${THEME_CONFIG.currency}不足`, '#ff8888');
        return false;
      }
      inv.gold -= amt;
      scene.events.emit('goldChanged', inv.gold);
    });

    // heal_player:amount  (amount 缺省 = 满血)
    this.register('heal_player', (args, _ctx) => {
      const player = scene?.player;
      if (!player) return;
      const amount = args[0] ? parseInt(args[0]) : player.maxHp;
      player.heal(amount);
      scene.events.emit('showMessage', `恢复 ${amount} 气血`, '#44ff88');
    });

    // learn_skill:nodeId — 免费解锁某技能节点
    this.register('learn_skill', (args, _ctx) => {
      const nodeId = args[0];
      const tree = scene?.skillTreeSystem;
      if (!nodeId || !tree) return;
      const node = tree.getNode(nodeId);
      if (!node) return;
      if (node.currentRank >= node.maxRank) {
        scene.events.emit('showMessage', `${node.name} 已学满`, '#ffaa44');
        return;
      }
      // 直接解锁（绕过 cost 检查）
      node.currentRank++;
      tree.unlockedNodes.add(nodeId);
      tree.applyAllEffects();
      scene.events.emit('skillUnlocked', nodeId, node);
      scene.events.emit('showMessage', `学会：${node.name}`, '#44ff88');
    });

    // teleport_player:x:y — 把玩家瞬移到世界坐标
    this.register('teleport_player', (args, ctx) => {
      const player = scene?.player;
      if (!player) return;
      const x = parseFloat(args[0]);
      const y = parseFloat(args[1]);
      if (!Number.isFinite(x) || !Number.isFinite(y)) return;
      ctx?.dialogueEngine?.stop();
      player.sprite.setPosition(x, y);
      scene.events.emit('showMessage', '瞬移完成', '#88ccff');
    });

    // === Phase 3+ 实现 ===
    this.register('trigger_combat', stub('trigger_combat'));

    // === Phase 6 实现 ===
    // recruit_companion[:companionId] — 默认招募当前对话 NPC
    this.register('recruit_companion', (args, ctx) => {
      const npc = ctx?.npc;
      if (!npc) {
        scene?.events?.emit('showMessage', '未找到目标 NPC', '#ff8888');
        return;
      }
      const mgr = scene?.companionManager;
      if (!mgr) return;
      // 招募代价
      const cost = npc.config?.recruitCost?.gold || 0;
      const inv = scene.inventory;
      if (cost > 0) {
        if ((inv?.gold || 0) < cost) {
          scene.events.emit('showMessage', `同行需要 ${cost} ${THEME_CONFIG.currency}`, '#ff8888');
          return;
        }
        inv.gold -= cost;
        scene.events.emit('goldChanged', inv.gold);
      }
      ctx?.dialogueEngine?.stop();
      const ok = mgr.recruit(npc);
      if (ok && npc.id) {
        // 写 recruited flag → 触发 recruitable→recruited stage 转换（再对话显示已招募内容）
        scene.npcMemory?.setFlag(npc.id, 'recruited', true);
      } else if (!ok && cost > 0) {
        // 回滚
        inv.gold += cost;
        scene.events.emit('goldChanged', inv.gold);
      }
    });

    this.register('dismiss_companion', (_args, ctx) => {
      ctx?.dialogueEngine?.stop();
      // 解散正在对话的这个伙伴（缺省则解散当前出战者）
      scene?.companionManager?.dismiss(ctx?.npc?.id);
    });

    // set_stance:stance — 设置正在对话伙伴的战术姿态
    this.register('set_stance', (args, ctx) => {
      const stance = args[0];
      const npcId = ctx?.npc?.id || scene?.companionManager?.getActiveId();
      if (!npcId || !stance) return;
      ctx?.dialogueEngine?.stop();
      const stanceNames = { follow: '跟紧', hold: '原地待命', aggressive: '主动出击', defensive: '防守' };
      if (scene?.companionManager?.setStance(npcId, stance)) {
        scene.events.emit('showMessage', `姿态已设为「${stanceNames[stance] || stance}」`, '#88ccff');
      }
    });

    // open_party_panel — 打开队伍面板
    this.register('open_party_panel', (_args, ctx) => {
      ctx?.dialogueEngine?.stop();
      openPanelTab('party')();
    });

    // === Phase 7 实现 ===
    // gift_item:itemId[:count] — 从背包扣物品送给当前 NPC
    this.register('gift_item', (args, ctx) => {
      const npc = ctx?.npc;
      if (!npc) {
        scene?.events?.emit('showMessage', '没有目标 NPC', '#ff8888');
        return;
      }
      const [itemId, countStr] = args;
      const count = parseInt(countStr) || 1;
      if (!itemId) return;
      const inv = scene?.inventory;
      const slots = inv?.getItems?.() || [];
      // 找 slot
      let slotIdx = -1;
      for (let i = 0; i < slots.length; i++) {
        if (slots[i] && slots[i].id === itemId && (slots[i].quantity || 1) >= count) {
          slotIdx = i; break;
        }
      }
      if (slotIdx < 0) {
        scene.events.emit('showMessage', `没有 ${itemId} ×${count}`, '#ff8888');
        return;
      }
      const prefs = npc.giftPreferences || { loved: [], liked: [], hated: [] };
      let action;
      if (prefs.loved?.includes(itemId)) action = 'gift_loved';
      else if (prefs.liked?.includes(itemId)) action = 'gift_liked';
      else if (prefs.hated?.includes(itemId)) action = 'gift_hated';
      else action = 'gift_neutral';
      inv.removeItem(slotIdx, count);
      scene.factionSystem?.applyDelta(npc.faction, action, `gift:${itemId}->${npc.id}`);
      // 反馈文本
      const fbMap = {
        gift_loved: { msg: `${npc.name} 非常喜欢这件礼物！`, color: '#ff66cc' },
        gift_liked: { msg: `${npc.name} 收下了礼物`, color: '#66ff88' },
        gift_neutral: { msg: `${npc.name} 收下了礼物，但似乎不感兴趣`, color: '#cccccc' },
        gift_hated: { msg: `${npc.name} 厌恶这件东西！`, color: '#ff4444' }
      };
      const fb = fbMap[action];
      scene.events.emit('showMessage', fb.msg, fb.color);
    });
  }
}
