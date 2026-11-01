/**
 * DialogueEngine — 节点化对话树解释器
 *
 * 对话节点结构（每个 stage 一棵树，'start' 为入口）：
 *   {
 *     speaker?:  '说话人'
 *     text?:     '文本，支持 {var} 插值'
 *     next?:     '下一节点 id'（无 options 时用）
 *     options?:  [{ text, if?, goto?, action?, set? }]
 *     if?:       '节点级条件'
 *     action?:   'action_string' | [...]
 *     set?:      { stage, flag_xxx, var_xxx, relationDelta }
 *     call?:     '子对话节点 id'（return 后继续 next）
 *     end?:      true
 *   }
 *
 * 事件：
 *   - dialogueStarted:        { npc, stage }
 *   - dialogueNodeEntered:    { npc, node, options }
 *   - dialogueEnded:          { npc }
 */

import { compareRelations } from '../data/factions.js';
import { getClassLabel } from '../config/themeConfig.js';

export class DialogueEngine {
  constructor(scene, { memory, factions, actionRegistry, dialogueLoader }) {
    this.scene = scene;
    this.memory = memory;
    this.factions = factions;
    this.actions = actionRegistry;
    this.loader = dialogueLoader;  // (moduleName) => stagesObject

    this.activeNpc = null;
    this.currentTree = null;
    this.currentStage = null;
    this.currentNode = null;
    this.callStack = [];     // 子对话调用栈：[{ tree, returnTo }]
  }

  // ===== 启动/停止 =====

  start(npc) {
    if (this.activeNpc) return false;
    if (!npc || !npc.dialogueModule) {
      console.warn('[DialogueEngine] NPC has no dialogueModule:', npc?.id);
      return false;
    }
    const stages = this.loader(npc.dialogueModule);
    if (!stages) {
      console.warn('[DialogueEngine] dialogue module not found:', npc.dialogueModule);
      return false;
    }

    this.activeNpc = npc;
    npc.setTalking?.(true);

    const stage = npc.getActiveStage?.() || 'greet';
    let tree = stages[stage];

    console.log(`[DialogueEngine] start: npcId=${npc.id}, stage=${stage}, hasTree=${!!tree}`);

    // 兜底：__surrendered__ stage 用通用文本
    if (!tree && stage === '__surrendered__') {
      tree = {
        start: {
          speaker: npc.name,
          text: npc.surrenderDialogue || '饶命……我什么都不知道……',
          options: [{ text: '离开', goto: 'end' }]
        },
        end: { end: true }
      };
    }

    if (!tree) {
      console.warn(`[DialogueEngine] stage "${stage}" not found in ${npc.dialogueModule}`);
      this.stop();
      return false;
    }

    this.currentTree = tree;
    this.currentStage = stage;
    this.scene?.events?.emit('dialogueStarted', { npc, stage });
    this._runNode('start');
    return true;
  }

  stop() {
    const npc = this.activeNpc;
    if (npc) {
      npc.setTalking?.(false);
      this.scene?.events?.emit('dialogueEnded', { npc });
    }
    this.activeNpc = null;
    this.currentTree = null;
    this.currentStage = null;
    this.currentNode = null;
    this.callStack = [];
  }

  // ===== 节点执行 =====

  _runNode(nodeId) {
    if (!this.currentTree) {
      console.warn('[DialogueEngine] _runNode: currentTree is null');
      return;
    }
    const node = this.currentTree[nodeId];
    if (!node) {
      console.warn(`[DialogueEngine] node "${nodeId}" not found, ending`);
      this.stop();
      return;
    }
    this.currentNode = nodeId;

    // 节点级条件
    if (node.if && !this._evalCondition(node.if)) {
      if (node.next) return this._runNode(node.next);
      return this._popOrEnd();
    }

    // 显示节点（即使没文本，options 也可能存在）
    const ctx = this._buildCtx();
    const speaker = node.speaker || this.activeNpc?.name || '???';
    const text = node.text ? this._interpolate(node.text) : '';
    const options = this._buildOptions(node);
    console.log(`[DialogueEngine] _runNode(${nodeId}): speaker=${speaker}, text=${text}, options=${options.length}`);
    this.scene?.events?.emit('dialogueNodeEntered', {
      npc: this.activeNpc, node, nodeId, speaker, text, options,
      isEnd: !!node.end
    });

    // set （在显示节点后应用）
    if (node.set) this._applySet(node.set);

    // action
    if (node.action) this.actions.dispatch(node.action, ctx);

    // end
    if (node.end) {
      // 等待 UI 显示完毕后由外部调用 advance 关闭
      return;
    }

    // 若没有 options，需要外部 advance 才推进（让 UI 显示完文本）
    if (!options || options.length === 0) {
      // 子对话调用
      if (node.call) {
        this.callStack.push({ tree: this.currentTree, returnTo: node.next || 'end' });
        return this._runNode(node.call);
      }
      // 否则等待 advance（next 在 advance 时跟进）
      // 但若节点既无 text 也无 options，自动走 next
      if (!node.text && node.next) {
        return this._runNode(node.next);
      }
    }
  }

  /** 外部「下一句」（无选项时点继续 / 末尾点关闭） */
  advance() {
    if (!this.currentNode || !this.currentTree) return;
    const node = this.currentTree[this.currentNode];
    if (!node) return this.stop();
    if (node.end) return this.stop();
    if (node.options && node.options.length > 0) return;  // 等待选项
    if (node.next) return this._runNode(node.next);
    if (node.call) {
      this.callStack.push({ tree: this.currentTree, returnTo: 'end' });
      return this._runNode(node.call);
    }
    return this._popOrEnd();
  }

  /** 选项被点击 */
  choose(optionIndex) {
    if (!this.currentNode || !this.currentTree) return;
    const node = this.currentTree[this.currentNode];
    const visibleOptions = this._buildOptions(node);
    const opt = visibleOptions[optionIndex];
    if (!opt) return;

    const ctx = this._buildCtx();

    if (opt.set) this._applySet(opt.set);
    if (opt.action) this.actions.dispatch(opt.action, ctx);

    if (opt.goto === 'end') return this.stop();
    if (opt.goto) return this._runNode(opt.goto);
    return this._popOrEnd();
  }

  _popOrEnd() {
    if (this.callStack.length > 0) {
      const frame = this.callStack.pop();
      this.currentTree = frame.tree;
      return this._runNode(frame.returnTo);
    }
    return this.stop();
  }

  // ===== 选项构建（按 if 过滤） =====

  _buildOptions(node) {
    if (!node || !Array.isArray(node.options)) return [];
    return node.options.filter(o => !o.if || this._evalCondition(o.if));
  }

  // ===== set 应用 =====

  _applySet(setObj) {
    const npcId = this.activeNpc?.id;
    if (!npcId) return;
    for (const [k, v] of Object.entries(setObj)) {
      if (k === 'stage') {
        this.memory.setStage(npcId, v);
        // 切到新树
        const stages = this.loader(this.activeNpc.dialogueModule);
        if (stages && stages[v]) {
          this.currentTree = stages[v];
          this.currentStage = v;
        }
      } else if (k === 'relationDelta') {
        const faction = this.activeNpc.faction;
        if (faction && typeof v === 'number') {
          this.factions?.addReputation(faction, v, 'dialogue_choice');
        }
      } else if (k.startsWith('flag_')) {
        this.memory.setFlag(npcId, k.slice(5), v);
      } else if (k.startsWith('var_')) {
        this.memory.setVar(npcId, k.slice(4), v);
      } else if (k.startsWith('global_')) {
        this.scene?.worldState?.setFlag(k.slice(7), v);
      } else {
        // 默认视为 flag
        this.memory.setFlag(npcId, k, v);
      }
    }
  }

  // ===== 文本插值 ===== {var}/{playerName}/{relation}

  _interpolate(text) {
    if (typeof text !== 'string') return '';
    return text.replace(/\{(\w+)\}/g, (_m, key) => {
      const ctx = this._buildCtx();
      if (key === 'playerName') return ctx.player ? getClassLabel(ctx.player.classType) : '道友';
      if (key === 'relation') {
        const rel = this.factions?.getRelation(this.activeNpc?.faction, this.activeNpc?.id);
        return rel?.label || '中立';
      }
      // var_xxx
      const v = this.memory?.getVar(this.activeNpc?.id, key, null);
      if (v != null) return String(v);
      return `{${key}}`;
    });
  }

  // ===== 条件 DSL 评估 =====

  _evalCondition(expr) {
    if (typeof expr === 'function') {
      try { return !!expr(this._buildCtx()); } catch (_) { return false; }
    }
    if (typeof expr !== 'string') return true;
    return this._evalExpr(expr.trim());
  }

  _evalExpr(s) {
    // 简易递归：支持 &&、||、!、括号、原子谓词
    s = s.trim();
    if (!s) return true;

    // 括号
    if (s.startsWith('(')) {
      const end = this._findMatchingParen(s, 0);
      if (end === s.length - 1) return this._evalExpr(s.slice(1, -1));
    }

    // 顶层 || 优先级最低
    const orIdx = this._findTopLevelOp(s, '||');
    if (orIdx >= 0) {
      return this._evalExpr(s.slice(0, orIdx)) || this._evalExpr(s.slice(orIdx + 2));
    }
    const andIdx = this._findTopLevelOp(s, '&&');
    if (andIdx >= 0) {
      return this._evalExpr(s.slice(0, andIdx)) && this._evalExpr(s.slice(andIdx + 2));
    }
    if (s.startsWith('!')) return !this._evalExpr(s.slice(1));

    return this._evalAtom(s);
  }

  _findTopLevelOp(s, op) {
    let depth = 0;
    for (let i = 0; i < s.length - op.length + 1; i++) {
      const c = s[i];
      if (c === '(') depth++;
      else if (c === ')') depth--;
      else if (depth === 0 && s.substr(i, op.length) === op) return i;
    }
    return -1;
  }

  _findMatchingParen(s, start) {
    let depth = 0;
    for (let i = start; i < s.length; i++) {
      if (s[i] === '(') depth++;
      else if (s[i] === ')') { depth--; if (depth === 0) return i; }
    }
    return -1;
  }

  _evalAtom(expr) {
    const ctx = this._buildCtx();
    expr = expr.trim();

    // hasItem(id,count)  / noItem(id)
    let m = expr.match(/^hasItem\(([^,]+),\s*(\d+)\)$/);
    if (m) return this._countItem(m[1].trim()) >= parseInt(m[2], 10);
    m = expr.match(/^hasItem\(([^)]+)\)$/);
    if (m) return this._countItem(m[1].trim()) >= 1;
    m = expr.match(/^noItem\(([^)]+)\)$/);
    if (m) return this._countItem(m[1].trim()) === 0;

    // level>=N / level<=N / level==N
    m = expr.match(/^level(>=|<=|==|>|<)(\d+)$/);
    if (m) return this._cmpNum(ctx.level, m[1], parseInt(m[2], 10));

    // gold>=N
    m = expr.match(/^gold(>=|<=|==|>|<)(\d+)$/);
    if (m) return this._cmpNum(ctx.gold, m[1], parseInt(m[2], 10));

    // flag(key)  / notFlag(key)
    m = expr.match(/^flag\(([^)]+)\)$/);
    if (m) return !!this.memory.getFlag(this.activeNpc.id, m[1].trim());
    m = expr.match(/^notFlag\(([^)]+)\)$/);
    if (m) return !this.memory.getFlag(this.activeNpc.id, m[1].trim());

    // globalFlag(key)
    m = expr.match(/^globalFlag\(([^)]+)\)$/);
    if (m) return !!this.scene?.worldState?.getFlag(m[1].trim());

    // stage==xxx
    m = expr.match(/^stage==([\w_]+)$/);
    if (m) return this.activeNpc && this.memory.getStage(this.activeNpc.id) === m[1];

    // relation>=name / relation<=name [对当前 NPC 阵营]
    m = expr.match(/^relation(>=|<=|==)(\w+)$/);
    if (m) {
      const cur = this.factions?.getRelation(this.activeNpc.faction, this.activeNpc.id);
      if (!cur) return false;
      const cmp = compareRelations(cur.name, m[2]);
      if (m[1] === '>=') return cmp >= 0;
      if (m[1] === '<=') return cmp <= 0;
      if (m[1] === '==') return cmp === 0;
    }

    // relation(faction)>=name
    m = expr.match(/^relation\((\w+)\)(>=|<=|==)(\w+)$/);
    if (m) {
      const cur = this.factions?.getRelation(m[1]);
      if (!cur) return false;
      const cmp = compareRelations(cur.name, m[3]);
      if (m[2] === '>=') return cmp >= 0;
      if (m[2] === '<=') return cmp <= 0;
      if (m[2] === '==') return cmp === 0;
    }

    // quest:id:status (status ∈ active/completed/notStarted)
    m = expr.match(/^quest:(\w+):(active|completed|notStarted)$/);
    if (m) {
      const q = this.scene?.questSystem;
      if (!q) return false;
      const status = q.getQuestStatus ? q.getQuestStatus(m[1]) : null;
      return status === m[2];
    }

    // true / false 字面量
    if (expr === 'true') return true;
    if (expr === 'false') return false;

    console.warn(`[DialogueEngine] unknown condition: "${expr}"`);
    return false;
  }

  _cmpNum(a, op, b) {
    if (op === '>=') return a >= b;
    if (op === '<=') return a <= b;
    if (op === '==') return a === b;
    if (op === '>') return a > b;
    if (op === '<') return a < b;
    return false;
  }

  _countItem(itemId) {
    const inv = this.scene?.inventory;
    if (!inv) return 0;
    if (typeof inv.countItem === 'function') return inv.countItem(itemId);
    // fallback: 遍历背包
    const items = (typeof inv.getItems === 'function') ? inv.getItems() : [];
    let n = 0;
    for (const it of items) {
      if (it && (it.id === itemId || it.itemId === itemId)) n += (it.count || 1);
    }
    return n;
  }

  // ===== ctx 构造 =====

  _buildCtx() {
    return {
      npc: this.activeNpc,
      player: this.scene?.player,
      scene: this.scene,
      dialogueEngine: this,
      memory: this.memory,
      factions: this.factions,
      level: this.scene?.levelSystem?.level || 1,
      gold: (this.scene?.registry?.get('gameState')?.gold) ?? 0
    };
  }
}
