/**
 * 对话模块索引：按 NPC 拆文件，统一从这里加载。
 *
 * 调用 getDialogueModule('blacksmith_tom') 返回该模块的 stages 对象。
 */
import blacksmith_tom from './blacksmith_tom.js';
import town_guard from './town_guard.js';
import trainer_warrior from './trainer_warrior.js';

const MODULES = {
  blacksmith_tom,
  town_guard,
  trainer_warrior
};

export function getDialogueModule(name) {
  return MODULES[name] || null;
}

export function registerDialogueModule(name, stages) {
  MODULES[name] = stages;
}
