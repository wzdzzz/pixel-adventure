import Phaser from 'phaser';
import { AssetManager } from '../assets/AssetManager.js';

export const ItemType = {
  HEAL: 'HEAL',
  KEY: 'KEY',
  COIN: 'COIN',
  ARTIFACT: 'ARTIFACT'
};

export class Item {
  constructor(scene, x, y, type, config = {}) {
    this.scene = scene;
    this.id = config.id || `${type}_${Date.now()}`;
    this.type = type;
    this.value = config.value || 0;
    this.name = config.name || type;
    this.description = config.description || '';
    this.isCollected = false;

    this.onCollect = config.onCollect || null;

    const textureKey = AssetManager.getTextureKey(type);

    this.sprite = scene.physics.add.sprite(x, y, textureKey);
    this.sprite.setOrigin(0.5, 0.5);
    this.sprite.body.setAllowGravity(false);
    this.sprite.body.setImmovable(true);
    this.sprite.body.setSize(16, 16);
    this.sprite.itemInstance = this;

    this.startFloatAnimation();
    this.startGlowAnimation();
  }

  startFloatAnimation() {
    this.scene.tweens.add({
      targets: this.sprite,
      y: this.sprite.y - 8,
      duration: 1000,
      yoyo: true,
      repeat: -1,
      ease: 'Sine.easeInOut'
    });
  }

  startGlowAnimation() {
    if (this.type === ItemType.ARTIFACT || this.type === ItemType.KEY) {
      this.scene.tweens.add({
        targets: this.sprite,
        alpha: 0.7,
        duration: 800,
        yoyo: true,
        repeat: -1,
        ease: 'Sine.easeInOut'
      });
    }
  }

  collect() {
    if (this.isCollected) return null;
    this.isCollected = true;

    this.scene.tweens.add({
      targets: this.sprite,
      y: this.sprite.y - 30,
      alpha: 0,
      scaleX: 0,
      scaleY: 0,
      duration: 300,
      ease: 'Back.easeIn',
      onComplete: () => this.destroy()
    });

    if (this.onCollect) {
      this.onCollect(this);
    }

    return {
      id: this.id,
      type: this.type,
      value: this.value,
      name: this.name,
      description: this.description
    };
  }

  getInfo() {
    return {
      id: this.id,
      type: this.type,
      value: this.value,
      name: this.name,
      description: this.description,
      position: { x: this.sprite.x, y: this.sprite.y }
    };
  }

  destroy() {
    if (this.sprite) this.sprite.destroy();
  }
}
