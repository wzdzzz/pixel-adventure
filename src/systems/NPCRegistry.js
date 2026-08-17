import { NPC } from '../entities/NPC.js';
import { CombatNPC } from '../entities/CombatNPC.js';
import { NPCS, getNpcConfig } from '../data/npcs.js';

/**
 * NPC 注册表：管理实例生命周期 + chunk 关联。
 *
 * 用法：
 *   - chunk 加载时调用 spawnChunk(cx, cy)
 *   - chunk 卸载时调用 despawnChunk(`${cx},${cy}`)
 *   - 永久 NPC（同伴等）不受 chunk 卸载影响（config.persistent）
 *   - 已永久死亡的 NPC（NPCMemory.isDead）不会重新 spawn
 */
export class NPCRegistry {
  constructor(scene) {
    this.scene = scene;
    this.instances = new Map();          // npcId -> NPC instance
    this.byChunk = new Map();            // chunkKey -> Set<npcId>
    // 战斗 NPC 工厂（Phase 3 注入，未注入时纯走 NPC）
    this._combatNpcFactory = null;
    this._onNpcDeath = ({ npcId, npc }) => {
      this._destroyColliders(npc);
      this.instances.delete(npcId);
      for (const set of this.byChunk.values()) set.delete(npcId);
    };
    this.scene.events.on('npcDeath', this._onNpcDeath);
  }

  setCombatNpcFactory(fn) {
    this._combatNpcFactory = fn;
  }

  spawn(npcId, chunkKey = null) {
    if (this.instances.has(npcId)) return this.instances.get(npcId);
    const config = getNpcConfig(npcId);
    if (!config) {
      console.warn(`[NPCRegistry] unknown npc id: ${npcId}`);
      return null;
    }
    if (this.scene.npcMemory?.isDead(npcId)) return null;

    const wx = (config.spawn.chunkX * 32 + config.spawn.localX) * 32 + 16;
    const wy = (config.spawn.chunkY * 32 + config.spawn.localY) * 32 + 16;

    let instance;
    if (config.combatStats) {
      // 战斗 NPC 默认走 CombatNPC（不再依赖外部 factory 注入）
      instance = this._combatNpcFactory
        ? this._combatNpcFactory(this.scene, wx, wy, config)
        : new CombatNPC(this.scene, wx, wy, config);
    } else {
      instance = new NPC(this.scene, wx, wy, config);
    }

    this.instances.set(npcId, instance);
    if (chunkKey) {
      if (!this.byChunk.has(chunkKey)) this.byChunk.set(chunkKey, new Set());
      this.byChunk.get(chunkKey).add(npcId);
    }

    // 把交互重叠注册到玩家
    this._registerInteractOverlap(instance);

    // 战斗 NPC：注册玩家攻击命中（与 Enemy 走同一条路径）
    if (config.combatStats) {
      this._registerCombatOverlap(instance);
    }

    // 名册中的伙伴：spawnChunk 重新生成其源 NPC 时，应保持其待命/出战状态，
    // 不在世界里以"可招募候选"重复出现（restoreInstances/deploy 统一管理实例）
    if (this.scene.companionManager?.isRecruited?.(npcId)) {
      const mgr = this.scene.companionManager;
      if (mgr.getActiveId() === npcId) {
        // 已出战者重新关联实例（理论上不会走到，active 实例 persistent 常驻）
      } else {
        // 待命者：隐藏禁用
        instance.persistent = true;
        if (instance.config) instance.config.persistent = true;
        instance.sprite?.setVisible(false);
        if (instance.sprite?.body) instance.sprite.body.enable = false;
        if (instance.ai) instance.ai.enabled = false;
      }
    }

    return instance;
  }

  _registerInteractOverlap(npc) {
    if (!this.scene?.player?.sprite || !npc?.sprite) return;
    npc._registryColliders ??= [];
    npc._registryColliders.push(this.scene.physics.add.overlap(
      this.scene.player.sprite,
      npc.sprite,
      () => {
        if (this.scene.interactionHandler) {
          this.scene.interactionHandler.handleNPCProximity(npc);
        } else if (this.scene.handleNPCProximity) {
          this.scene.handleNPCProximity(npc);
        }
      }
    ));
  }

  _registerCombatOverlap(npc) {
    const scene = this.scene;
    const player = scene?.player;
    if (!player?.attackHitbox || !player?.skillHitbox || !npc?.sprite) return;
    npc._registryColliders ??= [];
    npc._registryColliders.push(
      scene.physics.add.overlap(player.attackHitbox, npc.sprite,
        () => scene.handleAttackHit && scene.handleAttackHit(npc), null, scene),
      scene.physics.add.overlap(player.skillHitbox, npc.sprite,
        () => scene.handleSkillHit && scene.handleSkillHit(npc), null, scene)
    );
  }

  _destroyColliders(npc) {
    if (!npc?._registryColliders) return;
    for (const collider of npc._registryColliders) {
      if (collider?.world) collider.destroy();
    }
    npc._registryColliders.length = 0;
  }

  despawn(npcId) {
    const npc = this.instances.get(npcId);
    if (!npc) return;
    if (npc.persistent || npc.config?.persistent) return;
    this._destroyColliders(npc);
    npc.destroy();
    this.instances.delete(npcId);
    for (const set of this.byChunk.values()) set.delete(npcId);
  }

  despawnChunk(chunkKey) {
    const set = this.byChunk.get(chunkKey);
    if (!set) return;
    for (const npcId of [...set]) {
      const npc = this.instances.get(npcId);
      if (npc && !(npc.persistent || npc.config?.persistent)) {
        this._destroyColliders(npc);
        npc.destroy();
        this.instances.delete(npcId);
      }
    }
    this.byChunk.delete(chunkKey);
  }

  spawnChunk(chunkX, chunkY) {
    const chunkKey = `${chunkX},${chunkY}`;
    for (const config of Object.values(NPCS)) {
      if (!config.spawn) continue;
      if (config.spawn.chunkX === chunkX && config.spawn.chunkY === chunkY) {
        this.spawn(config.id, chunkKey);
      }
    }
  }

  get(npcId) { return this.instances.get(npcId); }
  getAll() { return [...this.instances.values()]; }

  /** 取某 faction 的所有当前实例 */
  getByFaction(factionId) {
    return [...this.instances.values()].filter(n => n.faction === factionId);
  }

  update(delta) {
    for (const npc of this.instances.values()) {
      if (typeof npc.update === 'function') npc.update(delta);
    }
  }

  destroyAll() {
    this.scene.events.off('npcDeath', this._onNpcDeath);
    for (const npc of this.instances.values()) {
      this._destroyColliders(npc);
      npc.destroy();
    }
    this.instances.clear();
    this.byChunk.clear();
  }
}
