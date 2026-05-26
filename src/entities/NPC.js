import Phaser from 'phaser';
import { TEXTURES } from '../assets/AssetManager.js';
import { installNpcTransitions } from '../systems/NpcTransitions.js';

export const NPCState = {
  IDLE: 'IDLE',
  READY: 'READY',
  TALKING: 'TALKING',
  HOSTILE: 'HOSTILE',
  SURRENDERED: 'SURRENDERED'
};

/**
 * 基础 NPC 实体（非战斗）。
 *
 * 与三大系统的协作：
 *  - NPCMemoryStore: 读 stage / flag，写 stage transition
 *  - FactionSystem:  读 relation 用于头顶 emoji
 *  - DialogueEngine: 由 InteractionHandler 触发，本类只提供数据
 *
 * 兼容旧版：若 config.dialogues 数组存在，仍可走旧式翻页对话（向后兼容）。
 */
export class NPC {
  constructor(scene, x, y, config = {}) {
    this.scene = scene;
    this.config = config;

    this.id = config.id || `npc_${Math.random().toString(36).slice(2, 8)}`;
    this.name = config.name || 'NPC';
    this.faction = config.faction || 'neutral';
    this.essential = !!config.essential;
    this.persistent = !!config.persistent;
    this.dialogueModule = config.dialogueModule || null;
    this.movement = config.movement || 'stand';
    this.services = config.services || [];
    this.shopId = config.shopId || null;
    this.trainerId = config.trainerId || null;
    this.giftPreferences = config.giftPreferences || { loved: [], liked: [], hated: [] };
    this.surrenderDialogue = config.surrenderDialogue || null;

    // 旧式兼容字段（pre-DialogueEngine 时代）
    this.dialogues = config.dialogues || null;
    this.dialogueIndex = 0;

    this.state = NPCState.IDLE;
    this.isDialoguing = false;

    // 巡逻起点 / 范围
    this._spawnX = x;
    this._spawnY = y;
    this._patrolTimer = 0;
    this._patrolTarget = null;

    // Sprite
    const texKey = config.sprite || TEXTURES.NPC;
    this.sprite = scene.physics.add.sprite(x, y, texKey);
    this.sprite.setOrigin(0.5, 0.5);
    this.sprite.setDisplaySize(28, 32);
    this.sprite.body.setAllowGravity(false);
    this.sprite.body.setImmovable(true);
    this.sprite.npcInstance = this;
    this.sprite.npcId = this.id;
    this.sprite.faction = this.faction;

    // 名字
    this.nameText = scene.add.text(x, y - 30, this.name, {
      fontSize: '12px',
      fill: '#00bfff',
      fontFamily: 'Courier New'
    }).setOrigin(0.5).setDepth(5);

    // 头顶状态/关系指示器
    this.stateIndicator = scene.add.text(x, y - 42, '', {
      fontSize: '12px',
      fill: '#ffff00',
      fontFamily: 'Courier New'
    }).setOrigin(0.5).setDepth(5);

    // 浮空动画
    this._float = scene.tweens.add({
      targets: this.sprite,
      y: y - 5,
      duration: 1500,
      yoyo: true,
      repeat: -1,
      ease: 'Sine.easeInOut'
    });

    // 初始关系图标
    this._refreshIndicator();

    // Stage 自动转换
    this._uninstallTransitions = installNpcTransitions(this, this.config.transitions);
  }

  // ===== Stage 查询 =====

  getActiveStage() {
    if (this.state === NPCState.SURRENDERED) return '__surrendered__';
    const memory = this.scene?.npcMemory;
    if (memory) return memory.getStage(this.id, this.config.initialStage || 'greet');
    return this.config.initialStage || 'greet';
  }

  // ===== 关系/状态可视化 =====

  _refreshIndicator() {
    if (!this.stateIndicator) return;
    if (this.isDialoguing) {
      this.stateIndicator.setText('...');
      this.stateIndicator.setFill('#aaaaaa');
      return;
    }
    if (this.state === NPCState.HOSTILE) {
      this.stateIndicator.setText('💢');
      return;
    }
    if (this.state === NPCState.SURRENDERED) {
      this.stateIndicator.setText('🆘');
      return;
    }
    // 默认按关系等级显示
    const factions = this.scene?.factionSystem;
    if (factions) {
      const rel = factions.getRelation(this.faction, this.id);
      this.stateIndicator.setText(rel.emoji);
    } else {
      this.stateIndicator.setText('');
    }
  }

  setTalking(talking) {
    this.isDialoguing = talking;
    if (talking) this.state = NPCState.TALKING;
    else if (this.state === NPCState.TALKING) this.state = NPCState.IDLE;
    this._refreshIndicator();
  }

  setHostile() {
    this.state = NPCState.HOSTILE;
    this._refreshIndicator();
  }

  setSurrendered() {
    this.state = NPCState.SURRENDERED;
    this._refreshIndicator();
  }

  // ===== 旧版兼容：翻页式对话 =====

  getNextDialogue() {
    if (!this.dialogues || this.dialogues.length === 0) return '...';
    const d = this.dialogues[this.dialogueIndex % this.dialogues.length];
    this.dialogueIndex++;
    return d;
  }

  // ===== 每帧更新 =====

  update(delta) {
    // 跟随 sprite 移动名字 / 指示器
    if (!this.sprite || !this.sprite.active) return;
    this.nameText.setPosition(this.sprite.x, this.sprite.y - 30);
    this.stateIndicator.setPosition(this.sprite.x, this.sprite.y - 42);

    // 巡逻
    if (this.movement && typeof this.movement === 'object' && this.movement.type === 'patrol') {
      this._updatePatrol(delta);
    }
  }

  _updatePatrol(delta) {
    if (this.isDialoguing) {
      this.sprite.setVelocity(0, 0);
      return;
    }
    const radius = this.movement.radius || 64;
    this._patrolTimer -= delta;
    if (this._patrolTimer <= 0 || !this._patrolTarget) {
      const angle = Math.random() * Math.PI * 2;
      const dist = Math.random() * radius;
      this._patrolTarget = {
        x: this._spawnX + Math.cos(angle) * dist,
        y: this._spawnY + Math.sin(angle) * dist
      };
      this._patrolTimer = 2000 + Math.random() * 2000;
    }
    const dx = this._patrolTarget.x - this.sprite.x;
    const dy = this._patrolTarget.y - this.sprite.y;
    const d = Math.sqrt(dx * dx + dy * dy);
    if (d < 4) {
      this.sprite.setVelocity(0, 0);
    } else {
      const speed = 40;
      this.sprite.setVelocity((dx / d) * speed, (dy / d) * speed);
    }
  }

  // ===== 销毁 =====

  destroy() {
    if (this._float) this._float.stop();
    if (this._uninstallTransitions) {
      this._uninstallTransitions();
      this._uninstallTransitions = null;
    }
    if (this.sprite) this.sprite.destroy();
    if (this.nameText) this.nameText.destroy();
    if (this.stateIndicator) this.stateIndicator.destroy();
  }
}
