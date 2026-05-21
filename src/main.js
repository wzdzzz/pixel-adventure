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
import { RunSetupScene } from './scenes/RunSetupScene.js';
import { MapScene } from './scenes/MapScene.js';
import { RewardScene } from './scenes/RewardScene.js';

/**
 * 游戏入口文件
 *
 * 场景顺序：
 * 1. BootScene - 启动场景，加载资源
 * 2. MainMenuScene - 主菜单 + 角色选择
 * 3. RunSetupScene - 肉鸽模式职业选择
 * 4. MapScene - 肉鸽模式节点地图
 * 5. MainGameScene - 主游戏逻辑
 * 6. RewardScene - 战斗奖励选择
 * 7. UIScene - HUD 界面层
 * 8. GameOverScene - 游戏失败画面
 * 9. VictoryScene - 胜利画面
 */

const scenes = [
  BootScene,
  MainMenuScene,
  SaveSelectScene,
  RunSetupScene,
  MapScene,
  MainGameScene,
  RewardScene,
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

// 全局错误处理
window.addEventListener('error', (event) => {
  console.error('[Game Error]', event.error);
});

// 开发模式下的调试信息
if (import.meta.env.DEV) {
  console.log('[Pixel Adventure] 游戏启动 (开发模式)');
  console.log('[Pixel Adventure] 按 F12 打开开发者工具查看日志');
}

export default game;
