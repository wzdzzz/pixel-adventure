import Phaser from 'phaser';

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
  ATTACK_EFFECT: 'attack_effect',
  SWORD: 'sword',
  SWORD_SLASH: 'sword_slash',
  TREE: 'tree',
  TREE_PINE: 'tree_pine',
  GRASS: 'grass',
  GRASS_TALL: 'grass_tall',
  WATER: 'water',
  STONE: 'stone',
  FLOWER: 'flower',
  MUSHROOM: 'mushroom',
  SIGN: 'sign',
  BRIDGE: 'bridge',
  FENCE: 'fence',
  CAMPFIRE: 'campfire',
  PORTAL: 'portal',
  CHEST_CLOSED: 'chest_closed',
  CHEST_OPEN: 'chest_open',
  CHEST_LOCKED: 'chest_locked',
  FOG_LIGHT: 'fog_light',
  BARREL: 'barrel',
  GEM: 'gem',
  LANTERN: 'lantern',
  ROCK_CANDLE: 'rock_candle',
  HEAL_ICON: 'heal_icon'
};

export class AssetManager {
  // Only generate texture if not already loaded from an image file
  static gen(scene, key, createFn) {
    if (scene.textures.exists(key)) return;
    createFn();
  }

  static generateAllTextures(scene) {
    AssetManager.gen(scene, TEXTURES.PLAYER, () => AssetManager.createPixelCharacter(scene, TEXTURES.PLAYER, 0x00ff00, 28, 28));
    AssetManager.gen(scene, TEXTURES.ENEMY, () => AssetManager.createPixelCharacter(scene, TEXTURES.ENEMY, 0xff0000, 28, 28));
    AssetManager.gen(scene, TEXTURES.COIN, () => AssetManager.createPixelItem(scene, TEXTURES.COIN, 0xffff00, 20, 20));
    AssetManager.gen(scene, TEXTURES.KEY, () => AssetManager.createPixelItem(scene, TEXTURES.KEY, 0xff69b4, 20, 20));
    AssetManager.gen(scene, TEXTURES.ARTIFACT, () => AssetManager.createPixelItem(scene, TEXTURES.ARTIFACT, 0x9932cc, 24, 24));
    AssetManager.gen(scene, TEXTURES.NPC, () => AssetManager.createPixelCharacter(scene, TEXTURES.NPC, 0x00bfff, 28, 32));
    AssetManager.gen(scene, TEXTURES.WALL, () => AssetManager.createPixelBlock(scene, TEXTURES.WALL, 0x4a4a4a, 32, 32));
    AssetManager.gen(scene, TEXTURES.OBSTACLE, () => AssetManager.createPixelBlock(scene, TEXTURES.OBSTACLE, 0x8b4513, 32, 32));
    AssetManager.gen(scene, TEXTURES.GROUND, () => AssetManager.createPixelBlock(scene, TEXTURES.GROUND, 0x2d2d3d, 32, 32));
    AssetManager.gen(scene, TEXTURES.POTION, () => AssetManager.createPixelItem(scene, TEXTURES.POTION, 0x00ff7f, 16, 20));
    AssetManager.gen(scene, TEXTURES.HEART, () => AssetManager.createPixelHeart(scene, TEXTURES.HEART, 0xff1493, 20, 18));
    AssetManager.gen(scene, TEXTURES.PARTICLE, () => AssetManager.createPixelParticle(scene, TEXTURES.PARTICLE, 0xffffff, 4, 4));
    AssetManager.gen(scene, TEXTURES.ATTACK_EFFECT, () => AssetManager.createAttackEffect(scene, TEXTURES.ATTACK_EFFECT, 0xffffff, 40, 8));

    AssetManager.gen(scene, TEXTURES.SWORD, () => AssetManager.createSword(scene, TEXTURES.SWORD, 0xc0c0c0, 8, 28));
    AssetManager.gen(scene, TEXTURES.SWORD_SLASH, () => AssetManager.createSwordSlash(scene, TEXTURES.SWORD_SLASH, 0xffffff));

    AssetManager.gen(scene, TEXTURES.TREE, () => AssetManager.createTree(scene, TEXTURES.TREE, 0x228b22, 32, 48));
    AssetManager.gen(scene, TEXTURES.TREE_PINE, () => AssetManager.createPineTree(scene, TEXTURES.TREE_PINE, 0x0b5e0b, 32, 48));
    AssetManager.gen(scene, TEXTURES.GRASS, () => AssetManager.createGrass(scene, TEXTURES.GRASS, 0x4caf50, 32, 32));
    AssetManager.gen(scene, TEXTURES.GRASS_TALL, () => AssetManager.createTallGrass(scene, TEXTURES.GRASS_TALL, 0x388e3c, 32, 32));
    AssetManager.gen(scene, TEXTURES.WATER, () => AssetManager.createWater(scene, TEXTURES.WATER, 0x1976d2, 32, 32));
    AssetManager.gen(scene, TEXTURES.STONE, () => AssetManager.createStone(scene, TEXTURES.STONE, 0x757575, 32, 32));
    AssetManager.gen(scene, TEXTURES.FLOWER, () => AssetManager.createFlower(scene, TEXTURES.FLOWER, 0xe91e63, 32, 32));
    AssetManager.gen(scene, TEXTURES.MUSHROOM, () => AssetManager.createMushroom(scene, TEXTURES.MUSHROOM, 0xff5722, 20, 20));
    AssetManager.gen(scene, TEXTURES.SIGN, () => AssetManager.createSign(scene, TEXTURES.SIGN, 0x795548, 32, 32));
    AssetManager.gen(scene, TEXTURES.BRIDGE, () => AssetManager.createBridge(scene, TEXTURES.BRIDGE, 0x8d6e63, 32, 32));
    AssetManager.gen(scene, TEXTURES.FENCE, () => AssetManager.createFence(scene, TEXTURES.FENCE, 0x5d4037, 32, 20));
    AssetManager.gen(scene, TEXTURES.CAMPFIRE, () => AssetManager.createCampfire(scene, TEXTURES.CAMPFIRE, 0xff9800, 24, 24));
    AssetManager.gen(scene, TEXTURES.PORTAL, () => AssetManager.createPortal(scene, TEXTURES.PORTAL, 32, 32));
    AssetManager.gen(scene, TEXTURES.CHEST_CLOSED, () => AssetManager.createChestClosed(scene, TEXTURES.CHEST_CLOSED, 32, 28));
    AssetManager.gen(scene, TEXTURES.CHEST_OPEN, () => AssetManager.createChestOpen(scene, TEXTURES.CHEST_OPEN, 32, 28));
    AssetManager.gen(scene, TEXTURES.FOG_LIGHT, () => AssetManager.createFogLight(scene, TEXTURES.FOG_LIGHT, 200));

    console.log('[AssetManager] 所有纹理生成完成');
  }

  static createPixelCharacter(scene, key, color, width, height) {
    const g = scene.make.graphics({ x: 0, y: 0, add: false });
    const w = width, h = height;
    const hw = Math.floor(w / 2), qh = Math.floor(h / 4);

    g.fillStyle(color);
    g.fillRect(hw - 8, qh, 16, qh * 2);
    g.fillRect(hw - 6, 2, 12, qh - 2);
    g.fillStyle(0x000000);
    g.fillRect(hw - 4, qh / 2, 2, 2);
    g.fillRect(hw + 2, qh / 2, 2, 2);
    g.fillStyle(color);
    g.fillRect(hw - 8, qh * 3, 6, qh - 2);
    g.fillRect(hw + 2, qh * 3, 6, qh - 2);
    g.fillRect(hw - 12, qh + 2, 4, qh);
    g.fillRect(hw + 8, qh + 2, 4, qh);

    g.generateTexture(key, w, h);
    g.destroy();
  }

  static createPixelItem(scene, key, color, width, height) {
    const g = scene.make.graphics({ x: 0, y: 0, add: false });
    g.fillStyle(color);
    g.fillRect(2, 2, width - 4, height - 4);
    g.fillStyle(0xffffff, 0.3);
    g.fillRect(4, 4, 4, 4);
    g.fillStyle(0x000000, 0.2);
    g.fillRect(width - 6, height - 6, 4, 4);
    g.generateTexture(key, width, height);
    g.destroy();
  }

  static createPixelBlock(scene, key, color, width, height) {
    const g = scene.make.graphics({ x: 0, y: 0, add: false });
    g.fillStyle(color);
    g.fillRect(0, 0, width, height);
    g.fillStyle(0xffffff, 0.15);
    g.fillRect(0, 0, width, 2);
    g.fillRect(0, 0, 2, height);
    g.fillStyle(0x000000, 0.2);
    g.fillRect(0, height - 2, width, 2);
    g.fillRect(width - 2, 0, 2, height);
    g.fillStyle(0x000000, 0.1);
    g.fillRect(0, Math.floor(height / 2), width, 1);
    g.fillRect(Math.floor(width / 2), 0, 1, height);
    g.generateTexture(key, width, height);
    g.destroy();
  }

  static createPixelHeart(scene, key, color, width, height) {
    const g = scene.make.graphics({ x: 0, y: 0, add: false });
    g.fillStyle(color);
    g.fillRect(2, 4, 6, 6);
    g.fillRect(4, 2, 4, 2);
    g.fillRect(width - 8, 4, 6, 6);
    g.fillRect(width - 8, 2, 4, 2);
    g.fillRect(4, 10, width - 8, 4);
    g.fillRect(6, 14, width - 12, 2);
    g.fillRect(Math.floor(width / 2) - 1, 16, 2, 2);
    g.fillStyle(0xffffff, 0.4);
    g.fillRect(4, 4, 2, 2);
    g.generateTexture(key, width, height);
    g.destroy();
  }

  static createPixelParticle(scene, key, color, width, height) {
    const g = scene.make.graphics({ x: 0, y: 0, add: false });
    g.fillStyle(color);
    g.fillRect(0, 0, width, height);
    g.generateTexture(key, width, height);
    g.destroy();
  }

  static createAttackEffect(scene, key, color, width, height) {
    const g = scene.make.graphics({ x: 0, y: 0, add: false });
    g.fillStyle(color, 0.6);
    g.fillRect(0, 0, width, height);
    g.fillStyle(color, 0.8);
    g.fillRect(width - 8, 0, 8, height);
    g.generateTexture(key, width, height);
    g.destroy();
  }

  static createSword(scene, key, color, width, height) {
    const g = scene.make.graphics({ x: 0, y: 0, add: false });
    g.fillStyle(color);
    g.fillRect(3, 0, 2, height - 6);
    g.fillStyle(0xa0a0a0);
    g.fillRect(3, 0, 2, 3);
    g.fillStyle(0x8b4513);
    g.fillRect(0, height - 6, 8, 3);
    g.fillStyle(0x6d4c41);
    g.fillRect(2, height - 3, 4, 3);
    g.generateTexture(key, width, height);
    g.destroy();
  }

  static createSwordSlash(scene, key, color) {
    const w = 48, h = 48;
    const g = scene.make.graphics({ x: 0, y: 0, add: false });
    g.lineStyle(3, color, 0.8);
    g.beginPath();
    g.arc(w / 2, h / 2, 20, -Math.PI * 0.6, Math.PI * 0.1, false);
    g.strokePath();
    g.lineStyle(2, color, 0.5);
    g.beginPath();
    g.arc(w / 2, h / 2, 16, -Math.PI * 0.5, Math.PI * 0.0, false);
    g.strokePath();
    g.lineStyle(1, color, 0.3);
    g.beginPath();
    g.arc(w / 2, h / 2, 24, -Math.PI * 0.4, Math.PI * 0.2, false);
    g.strokePath();
    g.generateTexture(key, w, h);
    g.destroy();
  }

  static createTree(scene, key, color, width, height) {
    const g = scene.make.graphics({ x: 0, y: 0, add: false });
    g.fillStyle(0x5d4037);
    g.fillRect(13, height - 16, 6, 16);
    g.fillStyle(color);
    g.fillRect(4, 4, 24, 20);
    g.fillRect(8, 0, 16, 8);
    g.fillStyle(0x1b5e20);
    g.fillRect(6, 10, 6, 4);
    g.fillRect(18, 6, 6, 4);
    g.generateTexture(key, width, height);
    g.destroy();
  }

  static createPineTree(scene, key, color, width, height) {
    const g = scene.make.graphics({ x: 0, y: 0, add: false });
    g.fillStyle(0x4e342e);
    g.fillRect(14, height - 12, 4, 12);
    g.fillStyle(color);
    g.fillRect(10, 20, 12, 10);
    g.fillRect(8, 12, 16, 10);
    g.fillRect(6, 4, 20, 10);
    g.fillRect(12, 0, 8, 6);
    g.fillStyle(0x0a3d0a);
    g.fillRect(10, 16, 4, 4);
    g.fillRect(18, 10, 4, 4);
    g.generateTexture(key, width, height);
    g.destroy();
  }

  static createGrass(scene, key, color, width, height) {
    const g = scene.make.graphics({ x: 0, y: 0, add: false });
    g.fillStyle(0x2e7d32);
    g.fillRect(0, 0, width, height);
    g.fillStyle(color);
    for (let i = 0; i < 8; i++) {
      const gx = (i * 5 + 2) % (width - 3);
      const gy = Math.floor(i / 3) * 10 + 4;
      g.fillRect(gx, gy, 2, 6);
    }
    g.fillStyle(0x66bb6a, 0.4);
    g.fillRect(4, 4, 3, 3);
    g.fillRect(20, 12, 3, 3);
    g.generateTexture(key, width, height);
    g.destroy();
  }

  static createTallGrass(scene, key, color, width, height) {
    const g = scene.make.graphics({ x: 0, y: 0, add: false });
    g.fillStyle(0x1b5e20);
    g.fillRect(0, 0, width, height);
    g.fillStyle(color);
    for (let i = 0; i < 12; i++) {
      const gx = (i * 4 + 1) % (width - 2);
      g.fillRect(gx, 2, 2, 10 + (i % 3) * 4);
    }
    g.fillStyle(0x81c784, 0.5);
    g.fillRect(8, 6, 2, 8);
    g.fillRect(22, 4, 2, 10);
    g.generateTexture(key, width, height);
    g.destroy();
  }

  static createWater(scene, key, color, width, height) {
    const g = scene.make.graphics({ x: 0, y: 0, add: false });
    g.fillStyle(color);
    g.fillRect(0, 0, width, height);
    g.fillStyle(0x64b5f6, 0.4);
    for (let i = 0; i < 4; i++) {
      g.fillRect(2 + i * 8, 8 + (i % 2) * 8, 6, 2);
    }
    g.fillStyle(0xbbdefb, 0.3);
    g.fillRect(6, 4, 4, 2);
    g.fillRect(20, 18, 6, 2);
    g.fillStyle(0x0d47a1, 0.2);
    g.fillRect(0, height - 2, width, 2);
    g.fillRect(width - 2, 0, 2, height);
    g.generateTexture(key, width, height);
    g.destroy();
  }

  static createStone(scene, key, color, width, height) {
    const g = scene.make.graphics({ x: 0, y: 0, add: false });
    g.fillStyle(color);
    g.fillRect(4, 8, 24, 18);
    g.fillRect(8, 4, 16, 6);
    g.fillStyle(0x9e9e9e);
    g.fillRect(6, 8, 8, 4);
    g.fillStyle(0x424242);
    g.fillRect(18, 20, 8, 4);
    g.generateTexture(key, width, height);
    g.destroy();
  }

  static createFlower(scene, key, color, width, height) {
    const g = scene.make.graphics({ x: 0, y: 0, add: false });
    g.fillStyle(0x2e7d32);
    g.fillRect(14, 16, 4, 12);
    g.fillRect(10, 22, 4, 4);
    g.fillRect(18, 20, 4, 4);
    g.fillStyle(color);
    g.fillRect(12, 8, 8, 8);
    g.fillStyle(0xffeb3b);
    g.fillRect(14, 10, 4, 4);
    g.generateTexture(key, width, height);
    g.destroy();
  }

  static createMushroom(scene, key, color, width, height) {
    const g = scene.make.graphics({ x: 0, y: 0, add: false });
    g.fillStyle(0xd7ccc8);
    g.fillRect(8, 12, 4, 8);
    g.fillStyle(color);
    g.fillRect(2, 4, 16, 10);
    g.fillRect(4, 2, 12, 4);
    g.fillStyle(0xffffff, 0.6);
    g.fillRect(6, 6, 3, 3);
    g.fillRect(12, 8, 2, 2);
    g.generateTexture(key, width, height);
    g.destroy();
  }

  static createSign(scene, key, color, width, height) {
    const g = scene.make.graphics({ x: 0, y: 0, add: false });
    g.fillStyle(0x5d4037);
    g.fillRect(14, 20, 4, 12);
    g.fillStyle(color);
    g.fillRect(2, 4, 28, 18);
    g.fillStyle(0x8d6e63);
    g.fillRect(4, 6, 24, 14);
    g.fillStyle(0x4e342e);
    g.fillRect(4, 6, 24, 2);
    g.generateTexture(key, width, height);
    g.destroy();
  }

  static createBridge(scene, key, color, width, height) {
    const g = scene.make.graphics({ x: 0, y: 0, add: false });
    g.fillStyle(color);
    g.fillRect(0, 4, width, height - 8);
    g.fillStyle(0x6d4c41);
    g.fillRect(0, 4, width, 3);
    g.fillRect(0, height - 7, width, 3);
    for (let i = 0; i < 4; i++) {
      g.fillStyle(0x5d4037);
      g.fillRect(2 + i * 8, 8, 6, height - 16);
    }
    g.generateTexture(key, width, height);
    g.destroy();
  }

  static createFence(scene, key, color, width, height) {
    const g = scene.make.graphics({ x: 0, y: 0, add: false });
    g.fillStyle(color);
    g.fillRect(0, 6, width, 4);
    g.fillRect(0, 14, width, 4);
    g.fillRect(2, 2, 4, 18);
    g.fillRect(width - 6, 2, 4, 18);
    g.fillStyle(0x4e342e);
    g.fillRect(4, 2, 2, 2);
    g.fillRect(width - 4, 2, 2, 2);
    g.generateTexture(key, width, height);
    g.destroy();
  }

  static createCampfire(scene, key, color, width, height) {
    const g = scene.make.graphics({ x: 0, y: 0, add: false });
    g.fillStyle(0x5d4037);
    g.fillRect(4, 16, 4, 8);
    g.fillRect(16, 16, 4, 8);
    g.fillStyle(0x795548);
    g.fillRect(8, 14, 8, 4);
    g.fillStyle(color);
    g.fillRect(8, 6, 8, 10);
    g.fillStyle(0xffc107);
    g.fillRect(10, 8, 4, 6);
    g.fillStyle(0xffeb3b, 0.8);
    g.fillRect(11, 10, 2, 3);
    g.generateTexture(key, width, height);
    g.destroy();
  }

  static createPortal(scene, key, width, height) {
    const g = scene.make.graphics({ x: 0, y: 0, add: false });
    // Outer ring - dark purple
    g.fillStyle(0x4a148c);
    g.fillRect(4, 4, 24, 24);
    // Inner vortex - bright purple/blue
    g.fillStyle(0x7c4dff);
    g.fillRect(8, 8, 16, 16);
    // Center glow
    g.fillStyle(0xb388ff);
    g.fillRect(12, 12, 8, 8);
    // Highlight sparkle
    g.fillStyle(0xe1bee7, 0.8);
    g.fillRect(14, 10, 4, 2);
    g.fillRect(10, 14, 2, 4);
    // Corner accents
    g.fillStyle(0x6200ea, 0.6);
    g.fillRect(4, 4, 4, 4);
    g.fillRect(24, 4, 4, 4);
    g.fillRect(4, 24, 4, 4);
    g.fillRect(24, 24, 4, 4);
    g.generateTexture(key, width, height);
    g.destroy();
  }

  static createChestClosed(scene, key, width, height) {
    const g = scene.make.graphics({ x: 0, y: 0, add: false });
    // Body
    g.fillStyle(0x8d6e63);
    g.fillRect(2, 8, 28, 18);
    // Lid
    g.fillStyle(0xa1887f);
    g.fillRect(2, 4, 28, 8);
    // Lid edge
    g.fillStyle(0x6d4c41);
    g.fillRect(2, 11, 28, 2);
    // Lock
    g.fillStyle(0xffd54f);
    g.fillRect(13, 10, 6, 6);
    g.fillStyle(0xffb300);
    g.fillRect(14, 12, 4, 2);
    // Metal bands
    g.fillStyle(0x5d4037);
    g.fillRect(2, 4, 2, 22);
    g.fillRect(28, 4, 2, 22);
    // Highlight
    g.fillStyle(0xbcaaa4, 0.4);
    g.fillRect(4, 5, 8, 2);
    g.generateTexture(key, width, height);
    g.destroy();
  }

  static createChestOpen(scene, key, width, height) {
    const g = scene.make.graphics({ x: 0, y: 0, add: false });
    // Body
    g.fillStyle(0x8d6e63);
    g.fillRect(2, 12, 28, 14);
    // Open lid (tilted back)
    g.fillStyle(0xa1887f);
    g.fillRect(2, 2, 28, 10);
    // Inside - dark
    g.fillStyle(0x3e2723);
    g.fillRect(4, 12, 24, 8);
    // Gold inside
    g.fillStyle(0xffd54f);
    g.fillRect(8, 14, 6, 4);
    g.fillRect(16, 15, 4, 3);
    // Sparkle
    g.fillStyle(0xffff8d, 0.7);
    g.fillRect(10, 13, 2, 2);
    g.fillRect(18, 14, 2, 2);
    // Metal bands
    g.fillStyle(0x5d4037);
    g.fillRect(2, 2, 2, 24);
    g.fillRect(28, 2, 2, 24);
    g.generateTexture(key, width, height);
    g.destroy();
  }

  static createFogLight(scene, key, radius) {
    const size = radius * 2;
    const canvas = document.createElement('canvas');
    canvas.width = size;
    canvas.height = size;
    const ctx = canvas.getContext('2d');
    const gradient = ctx.createRadialGradient(radius, radius, 0, radius, radius, radius);
    gradient.addColorStop(0, 'rgba(255, 255, 255, 1)');
    gradient.addColorStop(0.3, 'rgba(255, 255, 255, 0.9)');
    gradient.addColorStop(0.6, 'rgba(255, 255, 255, 0.5)');
    gradient.addColorStop(0.85, 'rgba(255, 255, 255, 0.15)');
    gradient.addColorStop(1, 'rgba(255, 255, 255, 0)');
    ctx.fillStyle = gradient;
    ctx.fillRect(0, 0, size, size);
    scene.textures.addCanvas(key, canvas);
  }

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
      'heart': TEXTURES.HEART,
      'tree': TEXTURES.TREE,
      'tree_pine': TEXTURES.TREE_PINE,
      'grass': TEXTURES.GRASS,
      'grass_tall': TEXTURES.GRASS_TALL,
      'water': TEXTURES.WATER,
      'stone': TEXTURES.STONE,
      'flower': TEXTURES.FLOWER,
      'mushroom': TEXTURES.MUSHROOM,
      'sign': TEXTURES.SIGN,
      'bridge': TEXTURES.BRIDGE,
      'fence': TEXTURES.FENCE,
      'campfire': TEXTURES.CAMPFIRE,
      'portal': TEXTURES.PORTAL,
      'chest_closed': TEXTURES.CHEST_CLOSED,
      'chest_open': TEXTURES.CHEST_OPEN
    };
    return typeMap[type] || TEXTURES.COIN;
  }
}
