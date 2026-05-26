/**
 * NPC Stage Transition installer — 监听 scene 事件自动 setStage。
 *
 * 支持的 transition.on 格式：
 *   quest:<questId>:completed
 *   quest:<questId>:accepted
 *   flag:<npcId>:<key>
 *   <scene_event_name>
 *
 * 用法：const off = installNpcTransitions(npc, npc.config.transitions);
 *       销毁时调用 off()
 */
export function installNpcTransitions(npc, transitions) {
  const listeners = [];
  if (!Array.isArray(transitions) || !transitions.length) return () => {};
  const memory = npc.scene?.npcMemory;
  if (!memory || !npc.scene?.events) return () => {};

  const byEvent = new Map();
  for (const t of transitions) {
    if (!t?.on) continue;
    if (!byEvent.has(t.on)) byEvent.set(t.on, []);
    byEvent.get(t.on).push(t);
  }

  for (const [eventStr, rules] of byEvent.entries()) {
    const parts = eventStr.split(':');
    let eventName, matcher;
    if (parts[0] === 'quest' && parts[2] === 'completed') {
      eventName = 'questCompleted';
      const id = parts[1];
      matcher = (q) => q?.id === id;
    } else if (parts[0] === 'quest' && parts[2] === 'accepted') {
      eventName = 'questActivated';
      const id = parts[1];
      matcher = (q) => q?.id === id;
    } else if (parts[0] === 'flag') {
      eventName = 'npcFlagChanged';
      const [, npcId, key] = parts;
      matcher = (p) => p?.npcId === npcId && p?.key === key && !!p?.value;
    } else {
      eventName = eventStr;
      matcher = () => true;
    }

    const handler = (payload) => {
      if (!matcher(payload)) return;
      const cur = memory.getStage(npc.id, npc.config?.initialStage || 'greet');
      for (const r of rules) {
        if (r.from && r.from !== cur) continue;
        if (!r.to) continue;
        memory.setStage(npc.id, r.to);
        break;
      }
    };
    npc.scene.events.on(eventName, handler);
    listeners.push({ event: eventName, handler });
  }

  return () => {
    for (const { event, handler } of listeners) {
      npc.scene?.events?.off(event, handler);
    }
  };
}
