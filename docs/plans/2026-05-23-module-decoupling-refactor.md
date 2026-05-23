# 模块解耦重构计划

> 创建日期：2026-05-23

## 目标
将 mixin 全量耦合改为组合持有 + 事件驱动，使各模块可独立修改/插拔。

## Phase 1：统一 SystemRegistry
- 创建 `src/core/SystemRegistry.js`，提供 register/get/has
- MainGameScene.create() 中所有 11 个系统统一注册
- 各系统内部用 `SystemRegistry.get('xxx')` 替代 `this.scene.xxx` 和 `this.scene.registry.get('xxx')`
- `_applyBonuses()` 改名为 `applyBonuses()`（去掉下划线，正式公开 API）

## Phase 2：Panel Mixin → 组合类
- 5 个 Panel 从导出对象改为 class，构造函数接收 panelScene
- PanelScene 持有各 panel 实例（`this.panels.character` 等）
- 各 panel 的 create/refresh/destroy 方法独立

## Phase 3：Manager Mixin → 组合持有
- LevelBuilder → `this.levelBuilder = new LevelBuilder(this)`
- InteractionHandler → `this.interactionHandler = new InteractionHandler(this)`
- MainGameScene 中的调用改为 `this.levelBuilder.xxx()`

## Phase 4：跨面板刷新改为事件
- 面板间 `this.refreshXxxTab()` 调用 → 发事件 `panel:refresh:xxx`
- 各面板自行监听自己的刷新事件
