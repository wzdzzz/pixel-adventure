import Phaser from 'phaser';
import { THEME_CONFIG } from '../config/themeConfig.js';
import { UI_THEME } from '../config/uiTheme.js';
import { AssetManager, TEXTURES, CHARACTERS } from '../assets/AssetManager.js';

export class BootScene extends Phaser.Scene {
  constructor() {
    super({ key: 'BootScene' });
  }

  preload() {
    // Load real sprite images — these override generated textures
    const sprites = {
      [TEXTURES.CHEST_CLOSED]: 'sprites/chest_closed.png',
      [TEXTURES.CHEST_OPEN]: 'sprites/chest_open.png',
      [TEXTURES.CHEST_LOCKED]: 'sprites/chest_locked.png',
      [TEXTURES.COIN]: 'sprites/coin.png',
      [TEXTURES.POTION]: 'sprites/potion.png',
      [TEXTURES.CAMPFIRE]: 'sprites/campfire.png',
      [TEXTURES.SIGN]: 'sprites/sign.png',
      [TEXTURES.STONE]: 'sprites/stone.png',
      [TEXTURES.ARTIFACT]: 'sprites/artifact.png',
      [TEXTURES.NPC]: 'sprites/npc.png',
      [TEXTURES.BARREL]: 'sprites/barrel.png',
      [TEXTURES.GEM]: 'sprites/gem.png',
      [TEXTURES.LANTERN]: 'sprites/lantern.png',
      [TEXTURES.ROCK_CANDLE]: 'sprites/rock_candle.png',
      [TEXTURES.HEAL_ICON]: 'sprites/heal_icon.png',
    };
    for (const [key, path] of Object.entries(sprites)) {
      this.load.image(key, path);
    }

    // Load character animation frames
    for (const [name, config] of Object.entries(CHARACTERS)) {
      const folder = name; // directory name matches character key
      for (const i of config.frames) {
        const frameKey = `${config.prefix}_${String(i).padStart(2, '0')}`;
        this.load.image(frameKey, `sprites/characters/${folder}/${frameKey}.png`);
      }
    }
  }

  create() {
    const width = this.cameras.main.width;
    const height = this.cameras.main.height;
    const { colors, text, font } = UI_THEME;

    this.add.rectangle(width / 2, height / 2, width, height, colors.ink);

    const landscape = this.add.graphics();
    landscape.fillStyle(colors.backdrop, 1);
    landscape.fillPoints([
      new Phaser.Geom.Point(0, height * 0.74),
      new Phaser.Geom.Point(width * 0.2, height * 0.5),
      new Phaser.Geom.Point(width * 0.36, height * 0.72),
      new Phaser.Geom.Point(width * 0.55, height * 0.42),
      new Phaser.Geom.Point(width * 0.73, height * 0.69),
      new Phaser.Geom.Point(width, height * 0.52),
      new Phaser.Geom.Point(width, height),
      new Phaser.Geom.Point(0, height),
    ], true);
    landscape.lineStyle(1, colors.brassMuted, 0.7);
    landscape.lineBetween(width / 2 - 180, height / 2 + 12, width / 2 - 32, height / 2 + 12);
    landscape.lineBetween(width / 2 + 32, height / 2 + 12, width / 2 + 180, height / 2 + 12);
    landscape.fillStyle(colors.cinnabar, 1);
    landscape.fillRect(width / 2 - 9, height / 2 + 3, 18, 18);

    this.add.text(width / 2, height / 2 - 90, THEME_CONFIG.title, {
      fontSize: '64px',
      fill: text.paper,
      fontFamily: font.display,
      fontStyle: 'bold'
    }).setOrigin(0.5);

    const loadText = this.add.text(width / 2, height / 2 + 62, '引灵入境', {
      fontSize: '16px',
      fill: text.jadeBright,
      fontFamily: font.body
    }).setOrigin(0.5);

    this.tweens.add({
      targets: loadText,
      alpha: 0.3,
      duration: 500,
      yoyo: true,
      repeat: -1
    });

    AssetManager.generateAllTextures(this);

    // Create character animations from loaded frames
    for (const [name, config] of Object.entries(CHARACTERS)) {
      for (const [animName, animConfig] of Object.entries(config.anims)) {
        const key = `${name}_${animName}`;
        if (this.anims.exists(key)) continue;
        this.anims.create({
          key,
          frames: animConfig.frames.map(i => ({
            key: `${config.prefix}_${String(i).padStart(2, '0')}`
          })),
          frameRate: animConfig.rate,
          repeat: animConfig.repeat
        });
      }
    }

    this.registry.set('gameState', {
      hp: 100,
      maxHp: 100,
      score: 0,
      inventory: [],
      keysCollected: 0,
      hasArtifact: false,
      currentLevel: 0,
      playerPosition: { x: 150, y: 150 },
      collectedItems: []
    });

    this.time.delayedCall(600, () => {
      this.scene.start('MainMenuScene');
    });
  }
}
