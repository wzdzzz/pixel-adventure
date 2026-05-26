import Phaser from 'phaser';
import { TEXTURES } from '../assets/AssetManager.js';
import { Actor } from './Actor.js';
import { EnemySkillSystem } from '../systems/EnemySkillSystem.js';
import { CombatAI, CombatState } from '../systems/CombatAI.js';
import { NPCState } from './NPC.js';
import { installNpcTransitions } from '../systems/NpcTransitions.js';
import { scaleBaseStats, applyDerivedScaling } from '../data/monsterScaling.js';
import { EnemyState } from './Enemy.js';

/**
 * CombatNPC — 战斗型 NPC（守卫、招募同伴、敌对派系成员）
 *
 * 继承 Actor（HP/技能资源/I-Frames），内含 EnemySkillSystem + CombatAI。
 * 与 NPC 的关系：
 *   - 同样可对话（dialogueModule / faction / persistent / essential）
 *   - 但 NPC 是和平实体（无 HP），CombatNPC 有完整战斗参数
 *
 * 状态机沿用 EnemyState 枚举，方便复用 handleAttackHit/handleSkillHit 路径。
 */
export class CombatNPC extends Actor {
  constructor(scene, x, y, config = {}) {
    const cs = config.combatStats || {};
    const baseStats = cs.stats || {
      con: Math.ceil((cs.hp || 80) / 10),
      str: Math.ceil((cs.damage || 8) / 2),
      int: 1,
      agi: Math.ceil((cs.speed || 70) / 10),
      per: 2,
      lck: 1
    };
    const finalLevel = cs.level || 1;
    const tier = cs.tier || 'normal';
    const scaled = scaleBaseStats(baseStats, finalLevel);

    const tex = config.sprite || TEXTURES.NPC;
    super(scene, x, y, tex, scaled, null);

    // ─── 配置 ─────────────────────────────
    this.config = config;
    this.id = config.id || `combat_npc_${Math.random().toString(36).slice(2, 8)}`;
    this.name = config.name || '战斗 NPC';
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

    // 旧式兼容字段
    this.dialogues = config.dialogues || null;
    this.dialogueIndex = 0;
    this.isDialoguing = false;

    this.finalLevel = finalLevel;
    this.tier = tier;
    this.isBoss = false;
    this.iFramesDuration = 600;

    this._applyLevelScaling(finalLevel, tier);

    // 销毁/死亡标记
    this._isDestroyed = false;
    this._isSurrendered = false;

    // sprite 装饰
    this.sprite.setDisplaySize(28, 32);
    this.sprite.setBounce(0.1);
    this.sprite.combatNpcInstance = this;
    this.sprite.npcInstance = this;
    this.sprite.npcId = this.id;
    this.sprite.faction = this.faction;
    // 为 InteractionHandler.handleAttackHit / handleSkillHit 兼容，
    // 让 sprite 也带 enemyInstance 别名（取伤害走相同路径）
    this.sprite.enemyInstance = this;

    // 状态（沿用 EnemyState 枚举）
    this.state = EnemyState.PATROL;
    this.inCombat = false;

    // 头顶名字 + 关系指示器（与 NPC 一致）
    this.nameText = scene.add.text(x, y - 30, this.name, {
      fontSize: '12px',
      fill: '#ff8888',  // 战斗 NPC 用红色名字
      fontFamily: 'Courier New'
    }).setOrigin(0.5).setDepth(5);

    this.stateIndicator = scene.add.text(x, y - 42, '', {
      fontSize: '12px',
      fill: '#ffff00',
      fontFamily: 'Courier New'
    }).setOrigin(0.5).setDepth(5);

    // 头顶血条
    this._buildHealthBar();

    // 技能系统（无技能 ID 列表也可，pickSkill 直接返回 null）
    this.skillSystem = new EnemySkillSystem(scene, this, cs.skills || []);
    this._activeSkill = null;

    // 战斗 AI（targeting + 状态机）
    this.ai = new CombatAI(scene, this, {
      patrolRange: (config.movement && config.movement.radius) ? config.movement.radius * 2 : 96,
      detectionRange: cs.detectionRange ?? 200,
      aggroDelay: cs.aggroDelay ?? 300,
      disengageTime: cs.disengageTime ?? 3000,
      getTarget: () => this._pickTarget(),
      canEngage: (t) => this._canEngage(t)
    });

    // AI 写自己的 state，本类的 .state 通过 getter delegate（解决兼容 handleSkillHit/EnemyState 用法）
    // 实现方式：每帧从 ai.state 映射到 this.state
    this._refreshIndicator();

    // Stage 自动转换（同 NPC 机制）
    this._uninstallTransitions = installNpcTransitions(this, this.config.transitions);
  }

  _applyLevelScaling(level, tier) {
    const derived = this.stats.getDerived();
    const scaled = applyDerivedScaling(
      { maxHp: derived.maxHp, attack: derived.attack },
      level, tier
    );
    const hpDiff = scaled.maxHp - derived.maxHp;
    const atkDiff = scaled.attack - derived.attack;
    if (hpDiff !== 0) this.stats.flatBonuses.maxHp = (this.stats.flatBonuses.maxHp || 0) + hpDiff;
    if (atkDiff !== 0) this.stats.flatBonuses.attack = (this.stats.flatBonuses.attack || 0) + atkDiff;
    this.stats.invalidate();
    this.maxHp = this.stats.getDerived().maxHp;
    this.hp = this.maxHp;
    // 配置覆盖（如固定 200 HP）
    if (this.config.combatStats?.hp) {
      this.maxHp = this.config.combatStats.hp;
      this.hp = this.maxHp;
    }
  }

  // ───── 头顶血条 ────────────────────────────────────

  _buildHealthBar() {
    const w = 28, h = 3;
    this.hbWidth = w;
    this.hbHeight = h;
    this.hbBg = this.scene.add.rectangle(this.sprite.x, this.sprite.y, w, h, 0x222222, 0.85)
      .setOrigin(0.5).setStrokeStyle(1, 0x000000, 0.6).setDepth(900);
    this.hbFill = this.scene.add.rectangle(this.sprite.x, this.sprite.y, w, h, 0x00ff00, 1)
      .setOrigin(0, 0.5).setDepth(901);
    this.hbLevelText = this.scene.add.text(
      this.sprite.x, this.sprite.y,
      `Lv.${this.finalLevel}`,
      { fontSize: '10px', fill: '#ffffff', fontFamily: 'Courier New' }
    ).setOrigin(1, 0.5).setDepth(902);
    this._updateHealthBar();
  }

  _updateHealthBar() {
    if (!this.hbBg || !this.hbFill || !this.sprite?.active) return;
    const topY = this.sprite.y - this.sprite.displayHeight / 2 - 6;
    this.hbBg.setPosition(this.sprite.x, topY);
    const leftX = this.sprite.x - this.hbWidth / 2;
    this.hbFill.setPosition(leftX, topY);
    if (this.hbLevelText) this.hbLevelText.setPosition(this.sprite.x - this.hbWidth / 2 - 4, topY);
    const pct = Math.max(0, Math.min(1, this.hp / this.maxHp));
    this.hbFill.width = this.hbWidth * pct;
    if (pct > 0.6) this.hbFill.setFillStyle(0x00dd44);
    else if (pct > 0.3) this.hbFill.setFillStyle(0xffdd00);
    else this.hbFill.setFillStyle(0xff3333);
  }

  _destroyHealthBar() {
    if (this.hbBg) { this.hbBg.destroy(); this.hbBg = null; }
    if (this.hbFill) { this.hbFill.destroy(); this.hbFill = null; }
    if (this.hbLevelText) { this.hbLevelText.destroy(); this.hbLevelText = null; }
  }

  // ───── 状态/关系指示 ─────────────────────────────────

  _refreshIndicator() {
    if (!this.stateIndicator) return;
    if (this.isDialoguing) {
      this.stateIndicator.setText('...').setFill('#aaaaaa');
      return;
    }
    if (this._isSurrendered) {
      this.stateIndicator.setText('🆘');
      return;
    }
    if (this.state === EnemyState.DEAD) {
      this.stateIndicator.setText('');
      return;
    }
    const fs = this.scene?.factionSystem;
    if (fs) {
      const rel = fs.getRelation(this.faction, this.id);
      // 战斗中显示战斗图标
      if (this.inCombat) this.stateIndicator.setText('⚔');
      else this.stateIndicator.setText(rel.emoji);
    } else {
      this.stateIndicator.setText('');
    }
  }

  setTalking(talking) {
    this.isDialoguing = talking;
    if (this.ai) {
      if (talking) this.ai.pause();
      else if (!this._isSurrendered && this.state !== EnemyState.DEAD) this.ai.resume();
    }
    this._refreshIndicator();
  }

  // 旧版兼容
  getNextDialogue() {
    if (!this.dialogues || this.dialogues.length === 0) return '...';
    const d = this.dialogues[this.dialogueIndex % this.dialogues.length];
    this.dialogueIndex++;
    return d;
  }

  getActiveStage() {
    if (this._isSurrendered) return '__surrendered__';
    const memory = this.scene?.npcMemory;
    if (memory) return memory.getStage(this.id, this.config.initialStage || 'greet');
    return this.config.initialStage || 'greet';
  }

  // ───── 目标选择 / 阵营检查 ────────────────────────

  _pickTarget() {
    // 只针对玩家（companion/cross-faction 战斗留待 Phase 6）
    return this.scene?.player || null;
  }

  _canEngage(target) {
    if (!target) return false;
    if (this._isSurrendered) return false;
    const fs = this.scene?.factionSystem;
    if (!fs) return false;
    const targetFaction = target === this.scene?.player ? 'player' : target.faction;
    if (!targetFaction) return false;
    return fs.isHostile(this.faction, targetFaction);
  }

  // ───── 主循环 ────────────────────────────────────

  update(delta) {
    if (this._isDestroyed) return;
    if (this.state === EnemyState.DEAD) return;

    this.updateActor(delta);
    this._updateHealthBar();

    // 跟随 sprite 移动名字 / 指示器
    if (this.sprite?.active) {
      this.nameText.setPosition(this.sprite.x, this.sprite.y - 30);
      this.stateIndicator.setPosition(this.sprite.x, this.sprite.y - 42);
    }

    // 跑 AI
    this.ai?.update(delta);

    // 同步 AI 状态到 this.state（让 EnemyState 兼容代码可用）
    if (this.ai) {
      // CombatState → EnemyState（同名映射）
      const map = {
        PATROL: EnemyState.PATROL,
        CHASE: EnemyState.CHASE,
        SKILL_TELEGRAPH: EnemyState.SKILL_TELEGRAPH,
        SKILL_ACTIVE: EnemyState.SKILL_ACTIVE,
        SKILL_RECOVERY: EnemyState.SKILL_RECOVERY,
        HURT: EnemyState.HURT,
        DEAD: EnemyState.DEAD
      };
      this.state = map[this.ai.state] || EnemyState.PATROL;
      this.inCombat = this.ai.inCombat;
    }

    this._refreshIndicator();
  }

  // ───── 受伤 & 死亡 ───────────────────────────────

  setState(newState) {
    // 兼容 InteractionHandler 直接调 setState(EnemyState.HURT)
    if (newState === EnemyState.HURT) {
      this.ai?.enterHurt(this.attackCooldown || 200);
    } else if (newState === EnemyState.CHASE) {
      this.ai?.setState(CombatState.CHASE);
    }
    this.state = newState;
  }

  takeDamage(damage, attackerX, attackerY, staggerMs = 0) {
    if (this.isInvulnerable || this.state === EnemyState.DEAD || this._isSurrendered) return;

    // 受击后强制进入战斗
    if (!this.inCombat) {
      this.ai?.forceCombat(this.scene?.player);
    }

    if (staggerMs > 0) this.ai?.enterHurt(staggerMs);

    super.takeDamage(damage, attackerX, attackerY);
    this.scene.events.emit('screenShake', 2, 60);
  }

  /** 死亡 — essential 转投降，普通永久死亡 */
  die() {
    if (this._isDestroyed || this._isSurrendered || this.state === EnemyState.DEAD) return;

    // Essential：HP 锁 1，投降态，停 AI
    if (this.essential) {
      this.hp = 1;
      this.maxHp = Math.max(1, this.maxHp);
      this._isSurrendered = true;
      this.ai?.cancelSkill();
      this.ai?.pause();
      this.scene?.npcMemory?.setStage(this.id, '__surrendered__');
      this.onHpChanged();
      this._refreshIndicator();
      this.scene.events.emit('npcSurrendered', { npcId: this.id, npc: this });
      return;
    }

    // 普通：永久死亡
    this.state = EnemyState.DEAD;
    this.scene?.npcMemory?.markDead(this.id);
    this.sprite.body.enable = false;
    this._destroyHealthBar();
    this.ai?.cancelSkill();
    this.skillSystem?.cancel();

    this.scene.tweens.add({
      targets: this.sprite,
      alpha: 0,
      scaleX: 1.5,
      scaleY: 1.5,
      duration: 400,
      onComplete: () => {
        if (this._isDestroyed) return;
        this.scene.events.emit('npcDeath', { npcId: this.id, npc: this });
        this.destroy();
      }
    });
  }

  // ───── 销毁 ───────────────────────────────────────

  destroy() {
    if (this._isDestroyed) return;
    this._isDestroyed = true;
    if (this._uninstallTransitions) { this._uninstallTransitions(); this._uninstallTransitions = null; }
    if (this.skillSystem) this.skillSystem.cancel();
    this._destroyHealthBar();
    if (this.nameText) { this.nameText.destroy(); this.nameText = null; }
    if (this.stateIndicator) { this.stateIndicator.destroy(); this.stateIndicator = null; }
    this.destroyActor();
  }

  // ───── 兼容 hook ─────────────────────────────────

  onHpChanged() {
    this._updateHealthBar();
  }
}
