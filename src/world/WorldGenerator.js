/**
 * 种子化世界地形生成器（纯函数）
 *
 * 使用 simplex-noise 生成确定性的 biome 分布。
 * 相同 seed + 相同坐标 → 永远返回相同 biome。
 * 无 Phaser 依赖。
 */
import { createNoise2D } from 'simplex-noise';
import { BIOMES, WORLD_CENTER, WORLD_RADIUS } from './biomes/biomeConfig.js';

// biome id 列表（排除 forest，forest 用于起始区域特殊判定）
const OUTER_BIOMES = ['ruins', 'snow', 'desert', 'swamp', 'volcano'];

export class WorldGenerator {
  /**
   * @param {number} seed - 世界种子（整数）
   */
  constructor(seed) {
    this.seed = seed;

    // 用种子创建确定性 RNG，再用它初始化 3 层噪声
    const rng1 = this._seedRng(seed);
    const rng2 = this._seedRng(seed + 1000);
    const rng3 = this._seedRng(seed + 2000);

    /** 低频噪声 — biome 大区划分 */
    this.biomeNoise = createNoise2D(rng1);
    /** 中频噪声 — 地形起伏（后续 Task 使用） */
    this.terrainNoise = createNoise2D(rng2);
    /** 高频噪声 — 细节变化（后续 Task 使用） */
    this.detailNoise = createNoise2D(rng3);
  }

  // ─── 种子化伪随机数生成器 ──────────────────────────────
  /**
   * 创建一个基于种子的 RNG 函数，返回 [0, 1) 范围的浮点数。
   * 算法：Park-Miller LCG (最小标准随机数生成器)
   * @param {number} seed
   * @returns {() => number}
   */
  _seedRng(seed) {
    let s = seed | 0;
    // 确保种子不为 0（LCG 的 0 是不动点）
    if (s <= 0) s = 1;
    return () => {
      s = (s * 16807 + 0) % 2147483647;
      return (s - 1) / 2147483646;
    };
  }

  // ─── Biome 判定 ────────────────────────────────────────
  /**
   * 根据 chunk 坐标返回 biome id
   * @param {number} chunkX - chunk 列 (0..15)
   * @param {number} chunkY - chunk 行 (0..15)
   * @returns {string} biome id（如 'forest', 'ruins' 等）
   */
  getBiome(chunkX, chunkY) {
    const dx = chunkX - WORLD_CENTER.x;
    const dy = chunkY - WORLD_CENTER.y;
    const dist = Math.sqrt(dx * dx + dy * dy);

    // 起始区域：距中心 < 2 的 chunk 固定为 forest
    if (dist < 2) {
      return 'forest';
    }

    // 低频噪声采样（scale ~0.1 让相邻 chunk 有平滑过渡）
    const BIOME_SCALE = 0.1;
    const noiseVal = this.biomeNoise(chunkX * BIOME_SCALE, chunkY * BIOME_SCALE);
    // noiseVal 范围 [-1, 1]

    // 计算从中心出发的角度 [0, 2π)
    const angle = Math.atan2(dy, dx) + Math.PI; // [0, 2π)

    // 将角度归一化到 [0, 1)
    const angleNorm = angle / (2 * Math.PI);

    // 混合噪声和角度：噪声提供随机性，角度提供径向分布
    // 噪声权重 0.3，角度权重 0.7 → biome 呈扇区分布但边界不规则
    const combined = (angleNorm * 0.7 + (noiseVal + 1) / 2 * 0.3) % 1;

    // 映射到 5 个外围 biome（forest 只出现在起始区域）
    const idx = Math.floor(combined * OUTER_BIOMES.length);
    // 安全钳位，防止浮点精度导致越界
    return OUTER_BIOMES[Math.min(idx, OUTER_BIOMES.length - 1)];
  }

  // ─── 边界检测 ──────────────────────────────────────────
  /**
   * chunk 是否在世界范围内（16×16 网格）
   * @param {number} chunkX
   * @param {number} chunkY
   * @returns {boolean}
   */
  isInBounds(chunkX, chunkY) {
    return chunkX >= 0 && chunkX <= 15 && chunkY >= 0 && chunkY <= 15;
  }
}
