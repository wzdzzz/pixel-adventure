import Phaser from 'phaser';

export class FocusLight {
  constructor(scene, config = {}) {
    this.scene = scene;
    this.enabled = true;

    this.lightRadius = config.radius || 150;
    this.darknessAlpha = config.darknessAlpha || 0.6;

    this.rt = scene.add.renderTexture(0, 0, scene.cameras.main.width, scene.cameras.main.height);
    this.rt.setDepth(90);
    this.rt.setScrollFactor(0);
    this.rt.setBlendMode(Phaser.BlendModes.MULTIPLY);

    this.darknessRect = scene.add.rectangle(
      scene.cameras.main.width / 2,
      scene.cameras.main.height / 2,
      scene.cameras.main.width,
      scene.cameras.main.height,
      0x000000
    ).setOrigin(0.5).setAlpha(0);

    this.lightGradient = this.createLightGradient();

    this.flickerTimer = 0;
    this.flickerIntensity = 0;
  }

  createLightGradient() {
    const size = this.lightRadius * 2;
    const canvas = document.createElement('canvas');
    canvas.width = size;
    canvas.height = size;
    const ctx = canvas.getContext('2d');

    const cx = size / 2;
    const cy = size / 2;

    const gradient = ctx.createRadialGradient(cx, cy, 0, cx, cy, this.lightRadius);
    gradient.addColorStop(0, 'rgba(255, 255, 255, 1)');
    gradient.addColorStop(0.4, 'rgba(255, 255, 255, 0.8)');
    gradient.addColorStop(0.7, 'rgba(255, 255, 255, 0.3)');
    gradient.addColorStop(1, 'rgba(255, 255, 255, 0)');

    ctx.fillStyle = gradient;
    ctx.fillRect(0, 0, size, size);

    return canvas;
  }

  update(playerX, playerY, delta) {
    if (!this.enabled) return;

    this.flickerTimer += delta;
    if (this.flickerTimer > 100) {
      this.flickerTimer = 0;
      this.flickerIntensity = Math.random() * 0.05;
    }

    const cam = this.scene.cameras.main;
    const screenX = playerX - cam.scrollX;
    const screenY = playerY - cam.scrollY;

    this.rt.clear();
    this.rt.fill(0x000000, this.darknessAlpha - this.flickerIntensity);
    this.rt.draw(this.lightGradient, screenX - this.lightRadius, screenY - this.lightRadius);
  }

  setEnabled(enabled) {
    this.enabled = enabled;
    this.rt.setVisible(enabled);
  }

  setRadius(radius) {
    this.lightRadius = radius;
    this.lightGradient = this.createLightGradient();
  }

  destroy() {
    if (this.rt) this.rt.destroy();
    if (this.darknessRect) this.darknessRect.destroy();
  }
}
