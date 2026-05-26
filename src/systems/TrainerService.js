import { getTrainerConfig } from '../data/trainers.js';
import SystemRegistry from '../core/SystemRegistry.js';

/**
 * 训练师服务
 *
 * 事件：
 *   trainerOpened: { trainerId, npc }
 *   trainerClosed: { trainerId }
 *   skillLearned:  { trainerId, skillId }
 *   talentsReset:  { trainerId }
 */
export class TrainerService {
  constructor(scene) {
    this.scene = scene;
    this.currentTrainerId = null;
    this.currentNpc = null;
  }

  open(trainerId, npc = null) {
    const cfg = getTrainerConfig(trainerId);
    if (!cfg) {
      this.scene.events.emit('showMessage', '该训练师不存在', '#ff8888');
      return false;
    }
    // 职业过滤
    const player = this.scene.player;
    if (cfg.classFilter && player?.classType !== cfg.classFilter) {
      this.scene.events.emit('showMessage', `${cfg.name} 只教 ${cfg.classFilter} 职业`, '#ffaa44');
      return false;
    }
    this.currentTrainerId = trainerId;
    this.currentNpc = npc;
    this.scene.events.emit('trainerOpened', { trainerId, npc });
    return true;
  }

  close() {
    const id = this.currentTrainerId;
    this.currentTrainerId = null;
    this.currentNpc = null;
    this.scene.events.emit('trainerClosed', { trainerId: id });
  }

  getConfig() {
    return this.currentTrainerId ? getTrainerConfig(this.currentTrainerId) : null;
  }

  /** 检查节点是否可学（先决条件+等级+点数+金币） */
  canLearn(skillEntry) {
    const tree = SystemRegistry.get('skillTreeSystem') || this.scene.skillTreeSystem;
    const ls = SystemRegistry.get('levelSystem') || this.scene.levelSystem;
    const inv = this.scene.inventory;
    if (!tree || !ls || !inv) return { ok: false, reason: '系统未就绪' };
    const node = tree.getNode(skillEntry.skillId);
    if (!node) return { ok: false, reason: '节点不存在' };
    if (node.currentRank >= node.maxRank) return { ok: false, reason: '已学满' };
    if (ls.level < skillEntry.levelReq) return { ok: false, reason: `需要等级 ${skillEntry.levelReq}` };
    if (ls.skillPoints < node.cost) return { ok: false, reason: `需要 ${node.cost} 技能点` };
    if ((inv.gold || 0) < skillEntry.goldCost) return { ok: false, reason: '金币不足' };
    const allPrereq = node.prerequisites.every(p => tree.unlockedNodes.has(p));
    if (!allPrereq) return { ok: false, reason: '前置未满足' };
    return { ok: true };
  }

  learn(skillEntry) {
    const check = this.canLearn(skillEntry);
    if (!check.ok) {
      this.scene.events.emit('showMessage', `无法学习：${check.reason}`, '#ff8888');
      return false;
    }
    const tree = SystemRegistry.get('skillTreeSystem') || this.scene.skillTreeSystem;
    const inv = this.scene.inventory;
    inv.gold -= skillEntry.goldCost;
    const ok = tree.unlock(skillEntry.skillId);
    if (!ok) {
      // 回滚
      inv.gold += skillEntry.goldCost;
      this.scene.events.emit('showMessage', '学习失败', '#ff8888');
      return false;
    }
    this.scene.events.emit('goldChanged', inv.gold);
    this.scene.events.emit('skillLearned', { trainerId: this.currentTrainerId, skillId: skillEntry.skillId });
    this.scene.events.emit('showMessage', `已学习：${tree.getNode(skillEntry.skillId)?.name}`, '#44ff88');
    return true;
  }

  resetTalents() {
    const cfg = this.getConfig();
    if (!cfg) return false;
    const inv = this.scene.inventory;
    const cost = cfg.talentResetCost || 5000;
    if ((inv.gold || 0) < cost) {
      this.scene.events.emit('showMessage', `重置需要 ${cost} 金币`, '#ff8888');
      return false;
    }
    const tree = SystemRegistry.get('skillTreeSystem') || this.scene.skillTreeSystem;
    const ls = SystemRegistry.get('levelSystem') || this.scene.levelSystem;
    if (!tree || !ls) return false;
    inv.gold -= cost;
    // 退还点数 + 清空节点 currentRank
    let refund = 0;
    for (const node of tree.nodes) {
      if (node.id === 'root') continue;
      if (node.currentRank > 0) {
        refund += node.cost * node.currentRank;
        node.currentRank = 0;
        tree.unlockedNodes.delete(node.id);
      }
    }
    ls.skillPoints += refund;
    tree.applyAllEffects();
    this.scene.events.emit('goldChanged', inv.gold);
    this.scene.events.emit('skillPointsChanged', ls.skillPoints);
    this.scene.events.emit('talentsReset', { trainerId: this.currentTrainerId });
    this.scene.events.emit('showMessage', `已重置天赋，返还 ${refund} 点`, '#44ff88');
    return true;
  }
}
