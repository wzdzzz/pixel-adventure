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

    // === Phase 4+ 实现 ===
    this.register('open_shop', stub('open_shop'));
    this.register('open_enhance', stub('open_enhance'));
    this.register('open_reforge', stub('open_reforge'));
    this.register('open_gem_inlay', stub('open_gem_inlay'));

    // === Phase 5+ 实现 ===
    this.register('open_trainer', stub('open_trainer'));
    this.register('accept_quest', stub('accept_quest'));
    this.register('turn_in_quest', stub('turn_in_quest'));
    this.register('give_item', stub('give_item'));
    this.register('take_item', stub('take_item'));
    this.register('give_gold', stub('give_gold'));
    this.register('take_gold', stub('take_gold'));
    this.register('heal_player', stub('heal_player'));
    this.register('learn_skill', stub('learn_skill'));
    this.register('teleport_player', stub('teleport_player'));

    // === Phase 3+ 实现 ===
    this.register('trigger_combat', stub('trigger_combat'));

    // === Phase 6+ 实现 ===
    this.register('recruit_companion', stub('recruit_companion'));
    this.register('dismiss_companion', stub('dismiss_companion'));

    // === Phase 7+ 实现 ===
    this.register('gift_item', stub('gift_item'));
  }
}
