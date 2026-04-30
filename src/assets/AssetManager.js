import Phaser from 'phaser';

/**
 * 资产管理器
 * 使用 Phaser 的 Graphics API 生成像素风格的占位图
 * 在没有真实美术资源时，用颜色块表示游戏元素：
 * - 绿色方块: 玩家
 * - 红色方块: 敌人
 * - 黄色方块: 金币
 * - 蓝色方块: NPC
 * - 粉色方块: 钥匙
 * - 紫色方块: 神器
 * - 棕色方块: 障碍物
 * - 灰色方块: 墙壁
 * - 绿色小方块: 回复药水
 */

// 纹理名称常量
export const TEXTURES = {
  PLAYER: 'player',
  ENEMY: 'enemy',
  COIN: 'coin',
  KEY: 'key',
  ARTIFACT: 'artifact',
  NPC: 'npc',
  WALL: 'wall',
  OBSTACLE: 'obstacle',
  POTION: 'potion',
  HEART: 'heart',
  GROUND: 'ground',
  PARTICLE: 'particle',
  ATTACK_EFFECT: 'attack_effect'
};

export class AssetManager {
  /**
   * 生成所有游戏所需的像素纹理
   * @param {Phaser.Scene} scene - 当前场景实例
   */
  static generateAllTextures(scene) {
    // 玩家纹理 - 绿色像素角色
    AssetManager.createPixelCharacter(scene, TEXTURES.PLAYER, 0x00ff00, 28, 28);

    // 敌人纹理 - 红色像素角色
    AssetManager.createPixelCharacter(scene, TEXTURES.ENEMY, 0xff0000, 28, 28);

    // 金币纹理 - 黄色小方块
    AssetManager.createPixelItem(scene, TEXTURES.COIN, 0xffff00, 20, 20);

    // 钥匙纹理 - 粉色钥匙形状
    AssetManager.createPixelItem(scene, TEXTURES.KEY, 0xff69b4, 20, 20);

    // 神器纹理 - 紫色菱形
    AssetManager.createPixelItem(scene, TEXTURES.ARTIFACT, 0x9932cc, 24, 24);

    // NPC纹理 - 蓝色角色
    AssetManager.createPixelCharacter(scene, TEXTURES.NPC, 0x00bfff, 28, 32);

    // 墙壁纹理 - 深灰色方块
    AssetManager.createPixelBlock(scene, TEXTURES.WALL, 0x4a4a4a, 32, 32);

    // 障碍物纹理 - 棕色方块
    AssetManager.createPixelBlock(scene, TEXTURES.OBSTACLE, 0x8b4513, 32, 32);

    // 地面纹理 - 浅灰色
    AssetManager.createPixelBlock(scene, TEXTURES.GROUND, 0x2d2d3d, 32, 32);

    // 回复药水 - 绿色小瓶
    AssetManager.createPixelItem(scene, TEXTURES.POTION, 0x00ff7f, 16, 20);

    // 心形生命值图标
    AssetManager.createPixelHeart(scene, TEXTURES.HEART, 0xff1493, 20, 18);

    // 粒子效果
    AssetManager.createPixelParticle(scene, TEXTURES.PARTICLE, 0xffffff, 4, 4);

    // 攻击特效
    AssetManager.createAttackEffect(scene, TEXTURES.ATTACK_EFFECT, 0xffffff, 40, 8);

    console.log('[AssetManager] 所有纹理生成完成');
  }

  /**
   * 创建像素角色纹理
   * 包含简单的身体、头部和四肢轮廓
   */
  static createPixelCharacter(scene, key, color, width, height) {
    const graphics = scene.make.graphics({ x: 0, y: 0, add: false });
    const w = width;
    const h = height;
    const halfW = Math.floor(w / 2);
    const quarterH = Math.floor(h / 4);

    // 身体主体
    graphics.fillStyle(color);
    graphics.fillRect(halfW - 8, quarterH, 16, quarterH * 2);

    // 头部
    graphics.fillStyle(color);
    graphics.fillRect(halfW - 6, 2, 12, quarterH - 2);

    // 眼睛 (深色)
    graphics.fillStyle(0x000000);
    graphics.fillRect(halfW - 4, quarterH / 2, 2, 2);
    graphics.fillRect(halfW + 2, quarterH / 2, 2, 2);

    // 左腿
    graphics.fillStyle(color);
    graphics.fillRect(halfW - 8, quarterH * 3, 6, quarterH - 2);

    // 右腿
    graphics.fillRect(halfW + 2, quarterH * 3, 6, quarterH - 2);

    // 左臂
    graphics.fillRect(halfW - 12, quarterH + 2, 4, quarterH);

    // 右臂
    graphics.fillRect(halfW + 8, quarterH + 2, 4, quarterH);

    graphics.generateTexture(key, w, h);
    graphics.destroy();
  }

  /**
   * 创建像素道具纹理
   * 简单的几何形状
   */
  static createPixelItem(scene, key, color, width, height) {
    const graphics = scene.make.graphics({ x: 0, y: 0, add: false });
    const w = width;
    const h = height;

    // 主体
    graphics.fillStyle(color);
    graphics.fillRect(2, 2, w - 4, h - 4);

    // 高光
    graphics.fillStyle(0xffffff, 0.3);
    graphics.fillRect(4, 4, 4, 4);

    // 阴影
    graphics.fillStyle(0x000000, 0.2);
    graphics.fillRect(w - 6, h - 6, 4, 4);

    graphics.generateTexture(key, w, h);
    graphics.destroy();
  }

  /**
   * 创建像素方块纹理 (墙壁、障碍物)
   * 带有简单的阴影和高光
   */
  static createPixelBlock(scene, key, color, width, height) {
    const graphics = scene.make.graphics({ x: 0, y: 0, add: false });
    const w = width;
    const h = height;

    // 主体
    graphics.fillStyle(color);
    graphics.fillRect(0, 0, w, h);

    // 顶部高光
    graphics.fillStyle(0xffffff, 0.15);
    graphics.fillRect(0, 0, w, 2);
    graphics.fillRect(0, 0, 2, h);

    // 底部阴影
    graphics.fillStyle(0x000000, 0.2);
    graphics.fillRect(0, h - 2, w, 2);
    graphics.fillRect(w - 2, 0, 2, h);

    // 内部纹理线
    graphics.fillStyle(0x000000, 0.1);
    graphics.fillRect(0, Math.floor(h / 2), w, 1);
    graphics.fillRect(Math.floor(w / 2), 0, 1, h);

    graphics.generateTexture(key, w, h);
    graphics.destroy();
  }

  /**
   * 创建心形生命值图标
   */
  static createPixelHeart(scene, key, color, width, height) {
    const graphics = scene.make.graphics({ x: 0, y: 0, add: false });
    const w = width;
    const h = height;

    // 简单的心形像素图
    graphics.fillStyle(color);

    // 左半心
    graphics.fillRect(2, 4, 6, 6);
    graphics.fillRect(4, 2, 4, 2);

    // 右半心
    graphics.fillRect(w - 8, 4, 6, 6);
    graphics.fillRect(w - 8, 2, 4, 2);

    // 底部尖角
    graphics.fillRect(4, 10, w - 8, 4);
    graphics.fillRect(6, 14, w - 12, 2);
    graphics.fillRect(Math.floor(w / 2) - 1, 16, 2, 2);

    // 高光
    graphics.fillStyle(0xffffff, 0.4);
    graphics.fillRect(4, 4, 2, 2);

    graphics.generateTexture(key, w, h);
    graphics.destroy();
  }

  /**
   * 创建像素粒子
   */
  static createPixelParticle(scene, key, color, width, height) {
    const graphics = scene.make.graphics({ x: 0, y: 0, add: false });

    graphics.fillStyle(color);
    graphics.fillRect(0, 0, width, height);

    graphics.generateTexture(key, width, height);
    graphics.destroy();
  }

  /**
   * 创建攻击特效纹理
   */
  static createAttackEffect(scene, key, color, width, height) {
    const graphics = scene.make.graphics({ x: 0, y: 0, add: false });

    // 半透明的攻击弧线效果
    graphics.fillStyle(color, 0.6);
    graphics.fillRect(0, 0, width, height);

    // 尖端
    graphics.fillStyle(color, 0.8);
    graphics.fillRect(width - 8, 0, 8, height);

    graphics.generateTexture(key, width, height);
    graphics.destroy();
  }

  /**
   * 根据类型获取纹理键名
   * @param {string} type - 物品类型
   * @returns {string} 纹理键名
   */
  static getTextureKey(type) {
    const typeMap = {
      'player': TEXTURES.PLAYER,
      'enemy': TEXTURES.ENEMY,
      'coin': TEXTURES.COIN,
      'key': TEXTURES.KEY,
      'artifact': TEXTURES.ARTIFACT,
      'npc': TEXTURES.NPC,
      'wall': TEXTURES.WALL,
      'obstacle': TEXTURES.OBSTACLE,
      'potion': TEXTURES.POTION,
      'heart': TEXTURES.HEART
    };
    return typeMap[type] || TEXTURES.COIN;
  }
}
