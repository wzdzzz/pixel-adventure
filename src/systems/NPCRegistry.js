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
    return instance;
  }

  _registerInteractOverlap(npc) {
    if (!this.scene?.player?.sprite || !npc?.sprite) return;
    this.scene.physics.add.overlap(
      this.scene.player.sprite,
      npc.sprite,
      () => {
        if (this.scene.interactionHandler) {
          this.scene.interactionHandler.handleNPCProximity(npc);
        } else if (this.scene.handleNPCProximity) {
          this.scene.handleNPCProximity(npc);
        }
      }
    );
  }

  _registerCombatOverlap(npc) {
    const scene = this.scene;
    const player = scene?.player;
    if (!player?.attackHitbox || !player?.skillHitbox || !npc?.sprite) return;
    scene.physics.add.overlap(player.attackHitbox, npc.sprite,
      () => scene.handleAttackHit && scene.handleAttackHit(npc), null, scene);
    scene.physics.add.overlap(player.skillHitbox, npc.sprite,
      () => scene.handleSkillHit && scene.handleSkillHit(npc), null, scene);
  }

  despawn(npcId) {
    const npc = this.instances.get(npcId);
    if (!npc) return;
    if (npc.persistent || npc.config?.persistent) return;
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
    for (const npc of this.instances.values()) npc.destroy();
    this.instances.clear();
    this.byChunk.clear();
  }
}
