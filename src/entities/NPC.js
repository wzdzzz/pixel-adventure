import Phaser from 'phaser';
import { TEXTURES } from '../assets/AssetManager.js';

export const NPCState = {
  IDLE: 'IDLE',
  READY: 'READY',
  TALKING: 'TALKING'
};

export class NPC {
  constructor(scene, x, y, config = {}) {
    this.scene = scene;
    this.id = config.id || 'npc';
    this.name = config.name || 'NPC';
    this.dialogues = config.dialogues || ['...'];
    this.dialogueIndex = 0;
    this.state = NPCState.IDLE;
    this.stateCondition = config.stateCondition || null;
    this.isDialoguing = false;

    this.sprite = scene.physics.add.sprite(x, y, TEXTURES.NPC);
    this.sprite.setOrigin(0.5, 0.5);
    this.sprite.body.setAllowGravity(false);
    this.sprite.body.setImmovable(true);
    this.sprite.npcInstance = this;

    this.nameText = scene.add.text(x, y - 30, this.name, {
      fontSize: '12px',
      fill: '#00bfff',
      fontFamily: 'Courier New'
    }).setOrigin(0.5).setDepth(5);

    this.stateIndicator = scene.add.text(x, y - 42, '', {
      fontSize: '10px',
      fill: '#ffff00',
      fontFamily: 'Courier New'
    }).setOrigin(0.5).setDepth(5);

    scene.tweens.add({
      targets: this.sprite,
      y: y - 5,
      duration: 1500,
      yoyo: true,
      repeat: -1,
      ease: 'Sine.easeInOut'
    });
  }

  updateState(playerInventory) {
    if (this.isDialoguing) return;
    if (this.stateCondition) {
      const newState = this.stateCondition(playerInventory);
      if (newState !== this.state) {
        this.state = newState;
        this.updateStateVisual();
      }
    }
  }

  updateStateVisual() {
    switch (this.state) {
      case NPCState.IDLE:
        this.stateIndicator.setText('');
        break;
      case NPCState.READY:
        this.stateIndicator.setText('!');
        this.stateIndicator.setFill('#ffff00');
        break;
      case NPCState.TALKING:
        this.stateIndicator.setText('...');
        this.stateIndicator.setFill('#aaaaaa');
        break;
    }
  }

  getNextDialogue() {
    const dialogue = this.dialogues[this.dialogueIndex % this.dialogues.length];
    this.dialogueIndex++;
    return dialogue;
  }

  setTalking(talking) {
    this.isDialoguing = talking;
    if (talking) {
      this.state = NPCState.TALKING;
    } else {
      this.state = NPCState.IDLE;
      if (this.stateCondition) {
        this.updateState(this.scene.inventory?.getItems() || []);
      }
    }
    this.updateStateVisual();
  }

  destroy() {
    if (this.sprite) this.sprite.destroy();
    if (this.nameText) this.nameText.destroy();
    if (this.stateIndicator) this.stateIndicator.destroy();
  }
}
