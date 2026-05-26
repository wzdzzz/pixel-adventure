import itemData from '../data/items.json';

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

    // play_sound（暂时桩）
    this.register('play_sound', stub('play_sound'));

    // === Phase 4 实现 ===
    this.register('open_shop', (args, ctx) => {
      // open_shop:shop_id 或 open_shop（用 npc.shopId）
      const shopId = args[0] || ctx?.npc?.shopId;
      if (!shopId) {
        scene?.events?.emit('showMessage', '没有商店 ID', '#ff8888');
        return;
      }
      const svc = scene?.shopService;
      if (!svc) {
        scene?.events?.emit('showMessage', '商店服务未初始化', '#ff8888');
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
        scene.scene.launch('PanelScene', { tab });
      }
    };
    this.register('open_enhance', (_args, ctx) => {
      ctx?.dialogueEngine?.stop();
      scene?.events?.emit('showMessage', '从背包右键装备 → 强化（铁匠界面 Phase 5）', '#ffaa44');
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
        scene?.events?.emit('showMessage', '没有训练师 ID', '#ff8888');
        return;
      }
      const svc = scene?.trainerService;
      if (!svc) {
        scene?.events?.emit('showMessage', '训练师服务未初始化', '#ff8888');
        return;
      }
      ctx?.dialogueEngine?.stop();
      svc.open(trainerId, ctx?.npc);
    });

    // accept_quest:questId — 把 quest 状态改成 active
    this.register('accept_quest', (args, _ctx) => {
      const questId = args[0];
      const qs = scene?.questSystem;
      if (!questId || !qs) return;
      const q = qs.quests.find(x => x.id === questId);
      if (!q) return;
      if (q.status === 'locked') {
        q.status = 'active';
        scene.events.emit('questActivated', q);
        scene.events.emit('showMessage', `接受任务：${q.name || q.id}`, '#44ff88');
      }
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
      scene.events.emit('showMessage', `获得 ${amt} 金币`, '#ffdd44');
    });

    // take_gold:amount
    this.register('take_gold', (args, _ctx) => {
      const amt = parseInt(args[0]) || 0;
      const inv = scene?.inventory;
      if (!inv || amt <= 0) return;
      if ((inv.gold || 0) < amt) {
        scene.events.emit('showMessage', '金币不足', '#ff8888');
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
      scene.events.emit('showMessage', `恢复 ${amount} 生命`, '#44ff88');
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

    // === Phase 6+ 实现 ===
    this.register('recruit_companion', stub('recruit_companion'));
    this.register('dismiss_companion', stub('dismiss_companion'));

    // === Phase 7+ 实现 ===
    this.register('gift_item', stub('gift_item'));
  }
}
