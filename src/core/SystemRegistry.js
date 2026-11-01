/**
 * SystemRegistry — 统一的系统注册/获取中心
 *
 * 替代散落的 this.scene.xxx 和 scene.registry.get('xxx')，
 * 使所有系统通过统一入口访问，依赖关系可追踪。
 *
 * 用法：
 *   SystemRegistry.register('inventory', inventoryInstance);
 *   const inv = SystemRegistry.get('inventory');
 */

const _systems = new Map();

const SystemRegistry = {
  /** 注册一个系统实例 */
  register(name, instance) {
    _systems.set(name, instance);
  },

  /** 获取系统实例（不存在返回 null） */
  get(name) {
    return _systems.get(name) || null;
  },

  /** 检查系统是否已注册 */
  has(name) {
    return _systems.has(name);
  },

  /** 清除所有注册（场景切换时调用） */
  clear() {
    _systems.clear();
  },

  /** 调试用：列出所有已注册系统名 */
  list() {
    return [..._systems.keys()];
  }
};

export default SystemRegistry;
