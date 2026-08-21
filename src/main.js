import Phaser from 'phaser';
import { createPhaserConfig } from './config/gameConfig.js';
import { BootScene } from './scenes/BootScene.js';
import { MainGameScene } from './scenes/MainGameScene.js';
import { UIScene } from './scenes/UIScene.js';
import { GameOverScene } from './scenes/GameOverScene.js';
import { VictoryScene } from './scenes/VictoryScene.js';
import { PanelScene } from './scenes/PanelScene.js';
import { MainMenuScene } from './scenes/MainMenuScene.js';
import { SaveSelectScene } from './scenes/SaveSelectScene.js';
import { WorldMapScene } from './scenes/WorldMapScene.js';
import audioEngine from './systems/AudioEngine.js';

/**
 * 游戏入口文件
 *
 * 场景顺序：
 * 1. BootScene - 启动场景，加载资源
 * 2. MainMenuScene - 主菜单 + 角色选择
 * 3. MainGameScene - 主游戏逻辑
 * 4. UIScene - HUD 界面层
 * 5. GameOverScene - 游戏失败画面
 * 6. VictoryScene - 胜利画面
 */

const scenes = [
  BootScene,
  MainMenuScene,
  SaveSelectScene,
  MainGameScene,
  UIScene,
  PanelScene,
  WorldMapScene,
  GameOverScene,
  VictoryScene
];

// 创建游戏配置
const config = createPhaserConfig(scenes);

// 创建游戏实例
const game = new Phaser.Game(config);

// 画布最终缩放使用平滑插值（覆盖 pixelArt 默认的 pixelated CSS）。
// 高 DPI（如 150% 缩放 → 1.5x 非整数比）下最近邻拉伸会让滚屏时
// 像素蠕动/闪烁，观感眩晕；内部渲染仍保持 pixelArt 最近邻采样。
game.events.once(Phaser.Core.Events.READY, () => {
  if (game.canvas) game.canvas.style.imageRendering = 'auto';
});

// ── 程序化音频系统：初始化 + 首次用户手势解锁 AudioContext ──
// 浏览器自动播放策略要求音频在用户交互后才能出声，因此监听首次
// pointerdown / keydown / touchstart，解锁后移除监听。
audioEngine.init();
function _unlockAudioOnce() {
  audioEngine.unlock();
  window.removeEventListener('pointerdown', _unlockAudioOnce);
  window.removeEventListener('keydown', _unlockAudioOnce);
  window.removeEventListener('touchstart', _unlockAudioOnce);
}
window.addEventListener('pointerdown', _unlockAudioOnce);
window.addEventListener('keydown', _unlockAudioOnce);
window.addEventListener('touchstart', _unlockAudioOnce);

// 全局错误处理
window.addEventListener('error', (event) => {
  console.error('[Game Error]', event.error);
});

// 开发模式下的调试信息
if (import.meta.env.DEV) {
  console.log('[云荒问道] 游戏启动 (开发模式)');
  console.log('[云荒问道] 按 F12 打开开发者工具查看日志');
  window.__game = game; // 调试钩子（仅 DEV）
}

export default game;
