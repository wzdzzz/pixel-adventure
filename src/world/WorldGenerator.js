/**
 * 种子化世界地形生成器（纯函数）
 *
 * 使用 simplex-noise 生成确定性的 biome 分布和地形数据。
 * 相同 seed + 相同坐标 → 永远返回相同结果。
 * 无 Phaser 依赖。
 */
import { createNoise2D } from 'simplex-noise';
import { BIOMES, WORLD_CENTER, WORLD_RADIUS } from './biomes/biomeConfig.js';

// ─── Tile ID 常量 ──────────────────────────────────────────
export const TILE_IDS = {
  // 地面层 (0-15)
  GRASS: 0, DIRT: 1, SAND: 2, SNOW: 3, WATER: 4,
  STONE_FLOOR: 5, LAVA_FLOOR: 6, SWAMP_FLOOR: 7,
  // 墙壁/碰撞层 (16-31)
  WALL: 16, TREE: 17, TREE_PINE: 18, ROCK: 19, FENCE: 20,
  // 装饰层 (32-47)
  FLOWER: 32, MUSHROOM: 33, GRASS_TALL: 34, CAMPFIRE: 36,
  // 特殊
  EMPTY: -1
};

/** chunk 边长（tile 数） */
const CHUNK_SIZE = 32;

// biome id 列表（排除 forest，forest 用于起始区域特殊判定）
const OUTER_BIOMES = ['ruins', 'snow', 'desert', 'swamp', 'volcano'];

// ─── Biome → 地面 tile 映射 ────────────────────────────────
const BIOME_GROUND = {
  forest:  { base: TILE_IDS.GRASS,       water: TILE_IDS.WATER,      waterThreshold: -0.3 },
  ruins:   { base: TILE_IDS.STONE_FLOOR, water: TILE_IDS.WATER,      waterThreshold: -0.3 },
  snow:    { base: TILE_IDS.SNOW,        water: TILE_IDS.WATER,      waterThreshold: -0.3 },
  desert:  { base: TILE_IDS.SAND,        water: TILE_IDS.WATER,      waterThreshold: -0.4 },
  swamp:   { base: TILE_IDS.SWAMP_FLOOR, water: TILE_IDS.WATER,      waterThreshold: 0.0  },
  volcano: { base: TILE_IDS.STONE_FLOOR, water: TILE_IDS.LAVA_FLOOR, waterThreshold: -0.3 }
};

// ─── Biome → 墙壁噪声阈值（越低→墙越多） ──────────────────
const BIOME_WALL_THRESHOLD = {
  forest: 0.45, ruins: 0.3, snow: 0.45, desert: 0.55, swamp: 0.5, volcano: 0.4
};

// ─── Biome → 墙壁 tile 类型 ────────────────────────────────
const BIOME_WALL_TILE = {
  forest:  [TILE_IDS.TREE, TILE_IDS.TREE_PINE],
  ruins:   [TILE_IDS.WALL],
  snow:    [TILE_IDS.TREE_PINE],
  desert:  [TILE_IDS.ROCK],
  swamp:   [TILE_IDS.TREE],
  volcano: [TILE_IDS.ROCK, TILE_IDS.WALL]
};

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

  // ─── 确定性随机（非噪声） ──────────────────────────────────
  /**
   * 基于种子 + chunk 坐标 + 索引生成确定性随机数 [0, 1)。
   * 用于需要确定性但不需要空间连续性的场景（如刷怪点）。
   * @param {number} chunkX
   * @param {number} chunkY
   * @param {number} index - 同一 chunk 内的序号
   * @returns {number} [0, 1)
   */
  _seededRandom(chunkX, chunkY, index) {
    // 将 seed + 坐标 + index 混合成一个唯一整数种子
    let h = (this.seed * 374761393 + chunkX * 668265263 + chunkY * 2147483647 + index * 1013904223) | 0;
    // Wang hash — 快速、分布均匀
    h = ((h >> 16) ^ h) * 0x45d9f3b | 0;
    h = ((h >> 16) ^ h) * 0x45d9f3b | 0;
    h = (h >> 16) ^ h;
    return (h & 0x7fffffff) / 0x7fffffff;
  }

  // ─── 地形数据生成 ────────────────────────────────────────
  /**
   * 生成一个 chunk 的 32×32 地形数据（地面、墙壁、装饰三层）。
   * 所有噪声采样使用世界坐标，保证跨 chunk 无缝衔接。
   *
   * @param {number} chunkX - chunk 列 (0..15)
   * @param {number} chunkY - chunk 行 (0..15)
   * @returns {{ ground: number[][], walls: number[][], decorations: number[][], biome: string }}
   */
  generateChunkTerrain(chunkX, chunkY) {
    // --- 创建空 32×32 二维数组的辅助函数 ---
    const makeGrid = (fill) =>
      Array.from({ length: CHUNK_SIZE }, () => new Array(CHUNK_SIZE).fill(fill));

    // ─── 1. 边界检查 ───────────────────────────────────────
    if (!this.isInBounds(chunkX, chunkY)) {
      // 越界 chunk：全部填充 WALL（不可通行边界）
      return {
        ground: makeGrid(TILE_IDS.WALL),
        walls: makeGrid(TILE_IDS.WALL),
        decorations: makeGrid(TILE_IDS.EMPTY),
        biome: 'void'
      };
    }

    // ─── 2. 获取 biome ─────────────────────────────────────
    const biome = this.getBiome(chunkX, chunkY);
    const groundCfg = BIOME_GROUND[biome];
    const wallThreshold = BIOME_WALL_THRESHOLD[biome];
    const wallTiles = BIOME_WALL_TILE[biome];

    const ground = makeGrid(TILE_IDS.GRASS);
    let walls = makeGrid(TILE_IDS.EMPTY);
    const decorations = makeGrid(TILE_IDS.EMPTY);

    // ─── 3. 地面层 — 中频噪声 ─────────────────────────────
    const TERRAIN_SCALE = 0.05;
    for (let ly = 0; ly < CHUNK_SIZE; ly++) {
      for (let lx = 0; lx < CHUNK_SIZE; lx++) {
        const wx = chunkX * CHUNK_SIZE + lx;
        const wy = chunkY * CHUNK_SIZE + ly;
        const n = this.terrainNoise(wx * TERRAIN_SCALE, wy * TERRAIN_SCALE);

        ground[ly][lx] = n < groundCfg.waterThreshold
          ? groundCfg.water
          : groundCfg.base;
      }
    }

    // ─── 4. 墙壁层 — 噪声初始化 + cellular automata ───────
    // Step A: 用高频噪声初始化墙壁候选
    const WALL_NOISE_SCALE = 0.15;
    for (let ly = 0; ly < CHUNK_SIZE; ly++) {
      for (let lx = 0; lx < CHUNK_SIZE; lx++) {
        // 水面/岩浆上不放墙壁
        const g = ground[ly][lx];
        if (g === TILE_IDS.WATER || g === TILE_IDS.LAVA_FLOOR) continue;

        const wx = chunkX * CHUNK_SIZE + lx;
        const wy = chunkY * CHUNK_SIZE + ly;
        const d = this.detailNoise(wx * WALL_NOISE_SCALE, wy * WALL_NOISE_SCALE);

        if (d > wallThreshold) {
          walls[ly][lx] = TILE_IDS.WALL; // 临时标记
        }
      }
    }

    // Step B: 3 轮 cellular automata 平滑
    for (let iter = 0; iter < 3; iter++) {
      const next = makeGrid(TILE_IDS.EMPTY);
      for (let ly = 0; ly < CHUNK_SIZE; ly++) {
        for (let lx = 0; lx < CHUNK_SIZE; lx++) {
          // 水面/岩浆保持无墙
          const g = ground[ly][lx];
          if (g === TILE_IDS.WATER || g === TILE_IDS.LAVA_FLOOR) continue;

          // 统计 3×3 邻域内的墙壁数量
          let wallCount = 0;
          for (let dy = -1; dy <= 1; dy++) {
            for (let dx = -1; dx <= 1; dx++) {
              const ny = ly + dy;
              const nx = lx + dx;
              if (ny < 0 || ny >= CHUNK_SIZE || nx < 0 || nx >= CHUNK_SIZE) {
                // 边界外视为空（不强制墙壁，保持 chunk 边缘通畅）
                continue;
              }
              if (walls[ny][nx] !== TILE_IDS.EMPTY) wallCount++;
            }
          }
          // 5/9 规则：邻居中 ≥5 个墙壁 → 变为墙壁
          if (wallCount >= 5) {
            next[ly][lx] = TILE_IDS.WALL;
          }
        }
      }
      walls = next;
    }

    // Step C: 将临时 WALL 替换为 biome 对应的障碍物 tile
    for (let ly = 0; ly < CHUNK_SIZE; ly++) {
      for (let lx = 0; lx < CHUNK_SIZE; lx++) {
        if (walls[ly][lx] === TILE_IDS.WALL && wallTiles[0] !== TILE_IDS.WALL) {
          // 多种墙壁 tile 时用确定性随机选择
          if (wallTiles.length === 1) {
            walls[ly][lx] = wallTiles[0];
          } else {
            const r = this._seededRandom(chunkX * CHUNK_SIZE + lx, chunkY * CHUNK_SIZE + ly, 0);
            walls[ly][lx] = wallTiles[Math.floor(r * wallTiles.length)];
          }
        }
      }
    }

    // ─── 5. 装饰层 — 稀疏放置 ─────────────────────────────
    const DECO_NOISE_SCALE = 0.2;
    const DECO_OFFSET = 500; // 噪声偏移，避免与墙壁噪声重叠
    const treeDensity = BIOMES[biome].treeDensity;

    for (let ly = 0; ly < CHUNK_SIZE; ly++) {
      for (let lx = 0; lx < CHUNK_SIZE; lx++) {
        // 只在无墙壁且非水面的位置放装饰
        if (walls[ly][lx] !== TILE_IDS.EMPTY) continue;
        const g = ground[ly][lx];
        if (g === TILE_IDS.WATER || g === TILE_IDS.LAVA_FLOOR) continue;

        const wx = chunkX * CHUNK_SIZE + lx;
        const wy = chunkY * CHUNK_SIZE + ly;
        const d = this.detailNoise(
          (wx + DECO_OFFSET) * DECO_NOISE_SCALE,
          (wy + DECO_OFFSET) * DECO_NOISE_SCALE
        );

        // 根据 biome 类型放置不同装饰
        if (biome === 'forest') {
          if (d > 0.7)      decorations[ly][lx] = TILE_IDS.MUSHROOM;
          else if (d > 0.6) decorations[ly][lx] = TILE_IDS.FLOWER;
          else if (d > 0.5) decorations[ly][lx] = TILE_IDS.GRASS_TALL;
        } else if (biome === 'swamp') {
          if (d > 0.65)     decorations[ly][lx] = TILE_IDS.MUSHROOM;
          else if (d > 0.5) decorations[ly][lx] = TILE_IDS.GRASS_TALL;
        } else {
          // 其他 biome：装饰更稀疏，密度与 treeDensity 相关
          const adjustedThreshold = 0.7 + (1 - treeDensity) * 0.2; // treeDensity 低 → 阈值高 → 更稀疏
          if (d > adjustedThreshold) {
            decorations[ly][lx] = TILE_IDS.GRASS_TALL;
          } else if (d > adjustedThreshold + 0.05) {
            decorations[ly][lx] = TILE_IDS.FLOWER;
          }
        }
      }
    }

    return { ground, walls, decorations, biome };
  }
}
