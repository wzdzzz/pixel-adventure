/**
 * 等级系统 — XP、升级、属性点分配
 *
 * 升级曲线: 50 * level^2.2 - level*10
 * 每次升级获得 5 属性点
 * 每 3 级获得 1 技能点
 * 击杀高等级敌人获得额外经验，低等级敌人经验递减
 */
import { SCALING_CONFIG, TIER } from '../data/monsterScaling.js';

export class LevelSystem {
  constructor(scene) {
    this.scene = scene;
    this.level = 1;
    this.xp = 0;
    this.statPoints = 0;
    this.skillPoints = 0;
  }

  getXpRequired() {
    return Math.max(1, Math.floor(50 * Math.pow(this.level, 2.2) - this.level * 10));
  }

  addXp(amount, enemyLevel = 0) {
    // Level compensation
    if (enemyLevel > 0) {
      const diff = enemyLevel - this.level;
      if (diff >= 5) amount = Math.floor(amount * 1.5);
      else if (diff <= -5) amount = Math.floor(amount * 0.1);
    }
    this.xp += amount;
    this.scene.events.emit('xpChanged', this.xp, this.getXpRequired());

    // Check level up
    while (this.xp >= this.getXpRequired()) {
      this.xp -= this.getXpRequired();
      this.levelUp();
    }
  }

  levelUp() {
    this.level++;
    this.statPoints += 5;
    if (this.level % 3 === 0) this.skillPoints += 1;

    this.scene.events.emit('levelUp', this.level, this.statPoints, this.skillPoints);
    this.scene.events.emit('xpChanged', this.xp, this.getXpRequired());
  }

  allocateStat(statName) {
    if (this.statPoints <= 0) return false;
    this.statPoints--;
    this.scene.events.emit('statPointsChanged', this.statPoints);
    return true;
  }

  getEnemyXp(enemyLevel = 1, tier = TIER.NORMAL) {
    const tm = SCALING_CONFIG.tierMultipliers[tier] || SCALING_CONFIG.tierMultipliers[TIER.NORMAL];
    return Math.round(enemyLevel * 15 * tm.xp);
  }

  toJSON() {
    return { level: this.level, xp: this.xp, statPoints: this.statPoints, skillPoints: this.skillPoints };
  }

  fromJSON(data) {
    if (!data) return;
    this.level = data.level || 1;
    this.xp = data.xp || 0;
    this.statPoints = data.statPoints || 0;
    this.skillPoints = data.skillPoints || 0;
  }
}
