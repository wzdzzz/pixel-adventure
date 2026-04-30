import Phaser from 'phaser';
import { TEXTURES } from '../assets/AssetManager.js';

export class WarFog {
  constructor(scene, config = {}) {
    this.scene = scene;
    this.enabled = true;
    this.radius = config.radius || 180;
    this.color = config.color || 0x0a0a2e;
    this.alpha = config.alpha || 0.7;
    this.breathTimer = 0;

    const cam = scene.cameras.main;
    this.rt = scene.add.renderTexture(0, 0, cam.width, cam.height);
    this.rt.setDepth(90);
    this.rt.setScrollFactor(0);

    // Hidden image used as erase brush with scaling for breath effect
    this.lightImage = scene.add.image(0, 0, TEXTURES.FOG_LIGHT);
    this.lightImage.setVisible(false);
  }

  update(playerX, playerY, delta) {
    if (!this.enabled) return;

    // Breathing effect - subtle radius pulse
    this.breathTimer += delta * 0.002;
    const breathScale = 1 + Math.sin(this.breathTimer) * 0.03;
    // Scale to desired radius (FOG_LIGHT texture was created with radius=200)
    const baseScale = this.radius / 200;
    this.lightImage.setScale(baseScale * breathScale);

    const cam = this.scene.cameras.main;
    const screenX = playerX - cam.scrollX;
    const screenY = playerY - cam.scrollY;

    this.rt.clear();
    this.rt.fill(this.color, this.alpha);
    // lightImage has origin (0.5, 0.5), so (screenX, screenY) centers it on player
    this.rt.erase(this.lightImage, screenX, screenY);
  }

  setEnabled(enabled) {
    this.enabled = enabled;
    this.rt.setVisible(enabled);
  }

  setRadius(radius) {
    this.radius = radius;
  }

  destroy() {
    if (this.rt) this.rt.destroy();
    if (this.lightImage) this.lightImage.destroy();
  }
}
