/**
 * 关卡数据定义
 * 数据驱动的关卡系统，每关包含地图布局、实体配置等
 */

const TILE = {
  EMPTY: 0, WALL: 1, OBSTACLE: 2, END: 3,
  TREE: 4, TREE_PINE: 5, GRASS: 6, GRASS_TALL: 7,
  WATER: 8, STONE: 9, FLOWER: 10, MUSHROOM: 11,
  SIGN: 12, BRIDGE: 13, FENCE: 14, CAMPFIRE: 15,
  CHEST: 16, CHEST_LOCKED: 17, PORTAL: 18
};

function generateLevel1Map() {
  const W = 80, H = 60;
  const map = Array.from({ length: H }, () => Array(W).fill(TILE.EMPTY));

  // 围墙
  for (let x = 0; x < W; x++) { map[0][x] = TILE.WALL; map[H - 1][x] = TILE.WALL; }
  for (let y = 0; y < H; y++) { map[y][0] = TILE.WALL; map[y][W - 1] = TILE.WALL; }

  // 迷宫墙体 — scaled from 50x40 to 80x60 (x*1.6, y*1.5)
  for (let x = 16; x < 26; x++) map[8][x] = TILE.WALL;
  for (let y = 8; y < 18; y++) map[y][16] = TILE.WALL;
  for (let x = 40; x < 56; x++) map[12][x] = TILE.WALL;
  for (let y = 12; y < 23; y++) map[y][40] = TILE.WALL;
  for (let y = 12; y < 23; y++) map[y][55] = TILE.WALL;
  for (let x = 55; x < 64; x++) map[21][x] = TILE.WALL;
  for (let x = 24; x < 35; x++) map[30][x] = TILE.WALL;
  for (let y = 30; y < 42; y++) map[y][24] = TILE.WALL;
  for (let x = 48; x < 64; x++) map[38][x] = TILE.WALL;
  for (let y = 38; y < 48; y++) map[y][48] = TILE.WALL;
  for (let x = 8; x < 19; x++) map[45][x] = TILE.WALL;
  for (let y = 45; y < 54; y++) map[y][8] = TILE.WALL;

  // Additional walls to fill expanded space
  for (let x = 62; x < 72; x++) map[8][x] = TILE.WALL;
  for (let y = 8; y < 16; y++) map[y][72] = TILE.WALL;
  for (let x = 10; x < 20; x++) map[22][x] = TILE.WALL;
  for (let x = 65; x < 75; x++) map[30][x] = TILE.WALL;
  for (let y = 30; y < 38; y++) map[y][65] = TILE.WALL;
  for (let x = 30; x < 40; x++) map[50][x] = TILE.WALL;
  for (let y = 50; y < 56; y++) map[y][30] = TILE.WALL;

  // 水池区域 — scaled
  // Pool 1: y=24..28, x=32..39 — chest at [26][34], bridge path connects west edge (x=31) to chest
  for (let y = 24; y < 29; y++) for (let x = 32; x < 40; x++) map[y][x] = TILE.WATER;
  map[26][32] = TILE.BRIDGE; // west edge — connects to dry land at x=31
  map[26][33] = TILE.BRIDGE;
  map[26][35] = TILE.BRIDGE; map[26][36] = TILE.BRIDGE;
  map[26][37] = TILE.BRIDGE;
  map[26][38] = TILE.BRIDGE; map[26][39] = TILE.BRIDGE; // east edge — connects to dry land at x=40

  // Pool 2: y=48..53, x=56..66 — locked chest at [51][58], bridge path connects west edge (x=55) to island
  for (let y = 48; y < 54; y++) for (let x = 56; x < 67; x++) map[y][x] = TILE.WATER;
  map[50][56] = TILE.BRIDGE; map[50][57] = TILE.BRIDGE; map[50][58] = TILE.BRIDGE; // west edge to island
  map[50][59] = TILE.BRIDGE; map[50][60] = TILE.BRIDGE;
  map[51][56] = TILE.BRIDGE; map[51][57] = TILE.BRIDGE; // extra width for access
  map[51][59] = TILE.BRIDGE; map[51][60] = TILE.BRIDGE;

  // Additional water feature in top-right
  // Pool 3: y=4..6, x=68..73 — bridge path connects south edge (y=6→dry y=7) to bridges
  for (let y = 4; y < 7; y++) for (let x = 68; x < 74; x++) map[y][x] = TILE.WATER;
  map[5][70] = TILE.BRIDGE; map[5][71] = TILE.BRIDGE;
  map[6][70] = TILE.BRIDGE; map[6][71] = TILE.BRIDGE; // south edge — connects to dry land at y=7

  // 树木 — scaled and expanded
  const trees = [
    [5,5],[6,5],[5,6],[9,13],[11,13],[9,14],
    [5,67],[6,67],[7,67],[5,69],[6,70],
    [5,48],[6,48],[7,50],
    [48,5],[49,5],[48,6],[48,50],[49,50],
    [27,16],[29,18],[15,29],[16,30],
    [57,29],[58,30],[57,32],
    [13,35],[14,36],[15,35],
    [42,56],[43,57],[44,56],
    [35,10],[36,11],[37,10],
    [20,60],[21,61],[22,60],
    [55,68],[56,69],[55,70],
    [40,20],[41,21],[42,20],
    [10,50],[11,51],[12,50],
    [52,40],[53,41],[54,40],
    [32,70],[33,71],[34,70],
    [45,15],[46,16],[47,15]
  ];
  trees.forEach(([y, x]) => {
    if (y > 0 && y < H - 1 && x > 0 && x < W - 1 && map[y][x] === TILE.EMPTY)
      map[y][x] = Math.random() < 0.5 ? TILE.TREE : TILE.TREE_PINE;
  });

  // 草地 — scaled and expanded
  const grass = [
    [3,3],[5,8],[8,5],[12,10],[18,13],[27,8],
    [3,67],[8,64],[12,67],[18,61],
    [33,13],[36,19],[42,10],[48,16],[52,6],
    [33,64],[38,67],[42,61],[48,70],[52,64],
    [15,32],[18,35],[21,29],[24,38],
    [42,32],[45,35],[48,29],[52,38],
    [8,45],[10,48],[14,42],[18,50],
    [30,55],[34,58],[38,52],[42,60],
    [55,20],[56,30],[57,45],[55,55],
    [25,72],[28,74],[20,75],[35,75]
  ];
  grass.forEach(([y, x]) => {
    if (y > 0 && y < H - 1 && x > 0 && x < W - 1 && map[y][x] === TILE.EMPTY)
      map[y][x] = Math.random() < 0.4 ? TILE.GRASS_TALL : TILE.GRASS;
  });

  // 花朵 — scaled and expanded
  const flowers = [
    [6,11],[9,8],[15,5],[21,11],[30,6],
    [6,64],[12,67],[18,64],[24,70],
    [36,13],[42,19],[52,13],[57,16],
    [36,64],[42,61],[52,67],[57,64],
    [10,30],[14,38],[20,45],[26,55],
    [44,30],[48,42],[54,50],[56,38],
    [38,8],[25,20],[15,55],[45,72],
    [8,58],[22,42],[50,25],[33,48]
  ];
  flowers.forEach(([y, x]) => {
    if (y > 0 && y < H - 1 && x > 0 && x < W - 1 && map[y][x] === TILE.EMPTY)
      map[y][x] = TILE.FLOWER;
  });

  // 石头 — scaled and expanded
  const stones = [
    [11,24],[15,40],[24,56],[30,16],[33,45],
    [42,24],[48,40],[54,16],[57,32],
    [18,48],[27,61],[39,67],[52,70],
    [8,36],[14,52],[22,68],[38,74],
    [46,58],[35,35],[28,48],[55,12],
    [4,30],[12,60],[40,45],[50,10]
  ];
  stones.forEach(([y, x]) => {
    if (y > 0 && y < H - 1 && x > 0 && x < W - 1 && map[y][x] === TILE.EMPTY)
      map[y][x] = TILE.STONE;
  });

  // 蘑菇 — scaled and expanded
  const mushrooms = [
    [9,19],[17,29],[21,45],[33,10],[39,16],
    [45,32],[52,48],[57,22],[15,58],[24,67],
    [7,40],[30,60],[44,70],[56,50],
    [3,20],[12,72],[38,25],[48,62]
  ];
  mushrooms.forEach(([y, x]) => {
    if (y > 0 && y < H - 1 && x > 0 && x < W - 1 && map[y][x] === TILE.EMPTY)
      map[y][x] = TILE.MUSHROOM;
  });

  // 栅栏 — scaled and expanded
  for (let x = 5; x < 13; x++) map[3][x] = TILE.FENCE;
  for (let x = 64; x < 74; x++) map[3][x] = TILE.FENCE;
  for (let x = 5; x < 13; x++) map[56][x] = TILE.FENCE;
  for (let x = 64; x < 74; x++) map[56][x] = TILE.FENCE;

  // 篝火 — scaled and expanded
  map[15][32] = TILE.CAMPFIRE;
  map[38][64] = TILE.CAMPFIRE;
  map[10][55] = TILE.CAMPFIRE;
  map[50][20] = TILE.CAMPFIRE;

  // 宝箱 — scaled
  map[26][34] = TILE.CHEST;          // 水池边普通宝箱
  map[51][58] = TILE.CHEST_LOCKED;   // 水池边锁定宝箱
  map[10][70] = TILE.CHEST;          // 右上区域普通宝箱
  map[45][40] = TILE.CHEST_LOCKED;   // 中下区域锁定宝箱

  // 传送点 — bottom-right area (around column 76, row 57)
  map[57][76] = TILE.PORTAL;

  return map;
}

function generateLevel2Map() {
  const W = 50, H = 40;
  const map = Array.from({ length: H }, () => Array(W).fill(TILE.EMPTY));

  // 围墙
  for (let x = 0; x < W; x++) { map[0][x] = TILE.WALL; map[H - 1][x] = TILE.WALL; }
  for (let y = 0; y < H; y++) { map[y][0] = TILE.WALL; map[y][W - 1] = TILE.WALL; }

  // 第二关：更复杂的迷宫布局 - 废墟主题
  // 中央大厅
  for (let x = 18; x < 32; x++) { map[12][x] = TILE.WALL; map[27][x] = TILE.WALL; }
  for (let y = 12; y < 28; y++) { map[y][18] = TILE.WALL; map[y][31] = TILE.WALL; }
  // 入口
  map[27][24] = TILE.EMPTY; map[27][25] = TILE.EMPTY;
  // 出口
  map[12][24] = TILE.EMPTY; map[12][25] = TILE.EMPTY;

  // 左侧走廊
  for (let x = 5; x < 18; x++) map[15][x] = TILE.WALL;
  for (let x = 5; x < 18; x++) map[24][x] = TILE.WALL;
  for (let y = 15; y < 25; y++) map[y][5] = TILE.WALL;
  map[20][5] = TILE.EMPTY; // 侧门

  // 右侧走廊
  for (let x = 32; x < 45; x++) map[15][x] = TILE.WALL;
  for (let x = 32; x < 45; x++) map[24][x] = TILE.WALL;
  for (let y = 15; y < 25; y++) map[y][44] = TILE.WALL;
  map[20][44] = TILE.EMPTY; // 侧门

  // 上方区域墙体
  for (let x = 8; x < 18; x++) map[5][x] = TILE.WALL;
  for (let y = 3; y < 12; y++) map[y][8] = TILE.WALL;
  for (let x = 32; x < 42; x++) map[5][x] = TILE.WALL;
  for (let y = 3; y < 12; y++) map[y][41] = TILE.WALL;

  // 下方区域墙体
  for (let x = 8; x < 15; x++) map[33][x] = TILE.WALL;
  for (let y = 33; y < 38; y++) map[y][14] = TILE.WALL;
  for (let x = 35; x < 45; x++) map[33][x] = TILE.WALL;
  for (let y = 33; y < 38; y++) map[y][35] = TILE.WALL;

  // 水池 - 中央大厅内
  for (let y = 18; y < 22; y++) for (let x = 22; x < 28; x++) map[y][x] = TILE.WATER;
  map[20][24] = TILE.BRIDGE; map[20][25] = TILE.BRIDGE;

  // 装饰物
  const trees = [
    [2,2],[2,3],[3,2],[2,46],[2,47],[3,47],
    [37,2],[37,3],[38,2],[37,46],[37,47],[38,47],
    [8,14],[8,15],[9,14],[8,35],[8,36],[9,36],
    [30,8],[30,9],[31,9],[30,42],[30,43],[31,42]
  ];
  trees.forEach(([y, x]) => {
    if (y > 0 && y < H - 1 && x > 0 && x < W - 1 && map[y][x] === TILE.EMPTY)
      map[y][x] = Math.random() < 0.3 ? TILE.TREE : TILE.TREE_PINE;
  });

  const stones = [
    [6,20],[6,29],[10,12],[10,38],
    [29,10],[29,40],[35,20],[35,30],
    [16,22],[16,27],[26,22],[26,27]
  ];
  stones.forEach(([y, x]) => {
    if (y > 0 && y < H - 1 && x > 0 && x < W - 1 && map[y][x] === TILE.EMPTY)
      map[y][x] = TILE.STONE;
  });

  const mushrooms = [
    [4,12],[7,38],[14,3],[25,46],
    [32,12],[36,38],[18,10],[22,40]
  ];
  mushrooms.forEach(([y, x]) => {
    if (y > 0 && y < H - 1 && x > 0 && x < W - 1 && map[y][x] === TILE.EMPTY)
      map[y][x] = TILE.MUSHROOM;
  });

  const grass = [
    [3,10],[4,15],[6,3],[7,45],[10,6],[11,44],
    [28,6],[29,44],[32,3],[33,46],[36,10],[36,40],
    [14,22],[14,28],[26,22],[26,28]
  ];
  grass.forEach(([y, x]) => {
    if (y > 0 && y < H - 1 && x > 0 && x < W - 1 && map[y][x] === TILE.EMPTY)
      map[y][x] = Math.random() < 0.4 ? TILE.GRASS_TALL : TILE.GRASS;
  });

  // 篝火
  map[19][24] = TILE.CAMPFIRE;
  map[7][25] = TILE.CAMPFIRE;

  // 宝箱
  map[20][23] = TILE.CHEST;          // 中央大厅水池旁
  map[7][10] = TILE.CHEST;           // 左上角
  map[7][40] = TILE.CHEST_LOCKED;    // 右上角锁定
  map[35][25] = TILE.CHEST_LOCKED;   // 下方锁定

  // 终点（第二关胜利点）
  map[3][25] = TILE.END;

  return map;
}

export const LEVEL_TILE = TILE;

export const levelData = [
  {
    name: '第一关 - 迷雾森林',
    generateMap: generateLevel1Map,
    playerStart: { x: 150, y: 150 },
    enemies: [
      { type: 'slime', count: 5 },
      { type: 'goblin', count: 4 },
      { type: 'spider', count: 3 },
      { type: 'bat', count: 4 },
      { type: 'skeleton', count: 3 },
      { type: 'orc_warrior', count: 2 },
      { type: 'fire_mage', count: 1 },
      { type: 'giant_skeleton', count: 1 },
      { type: 'skeleton_king', count: 1 }
    ],
    items: { coins: 20, keys: 3, potions: 8, hasArtifact: false },
    npcs: [
      {
        id: 'elder', name: '村长', x: 300, y: 600,
        dialogues: [
          '欢迎来到这个危险的地方，冒险者！',
          '小心那些红色的怪物，它们会攻击你。',
          '收集钥匙可以打开宝箱，找到传送门就能离开这里！'
        ],
        hasStateCondition: true
      },
      {
        id: 'merchant', name: '旅行商人', x: 960, y: 300,
        dialogues: [
          '欢迎！这里到处都是危险的史莱姆。',
          '鼠标左键挥剑攻击，击败它们可以获得金币。',
          '收集钥匙可以开启宝箱，找到传送门就能前往下一关！'
        ]
      },
      {
        id: 'scout', name: '侦察兵', x: 1600, y: 1200,
        dialogues: [
          '你已经深入森林了，冒险者。',
          '东南方有一个古老的传送门，但需要钥匙才能激活。',
          '注意搜索每个角落，钥匙可能藏在意想不到的地方！'
        ]
      }
    ],
    signs: [
      { x: 120, y: 120, text: '--- 像素冒险 ---\n\n操作:\nWASD/方向键 移动\n鼠标左键 攻击\nE 交互/对话\n\n目标:收集钥匙到达传送门!' },
      { x: 120, y: 450, text: '--- 道具说明 ---\n\n金币(黄):+10分\n钥匙(粉):开启宝箱/传送门\n药水(绿):恢复25HP\n生命之心(红):恢复50HP' },
      { x: 120, y: 800, text: '--- 战斗提示 ---\n\n鼠标左键挥剑攻击\n角色自动转向鼠标方向\n攻击有前摇和后摇\n命中敌人造成定格冻结\n可破坏木桶获取道具' },
      { x: 1280, y: 120, text: '--- 探索提示 ---\n\n与NPC按E对话\n黄色感叹号=有新对话\n探索每个角落寻找道具\n水池和树木是障碍物\n击败史莱姆获得金币' },
      { x: 2000, y: 900, text: '--- 深林警告 ---\n\n前方敌人更加危险\n确保药水充足再继续\n传送门就在东南方向！' }
    ],
    portalRequiredKeys: 3
  },
  {
    name: '第二关 - 古老废墟',
    generateMap: generateLevel2Map,
    playerStart: { x: 800, y: 1100 },
    enemies: [
      { type: 'skeleton', count: 4 },
      { type: 'bat', count: 3 },
      { type: 'orc_warrior', count: 2 },
      { type: 'slime', count: 3 }
    ],
    items: { coins: 15, keys: 2, potions: 6, hasArtifact: true },
    npcs: [
      {
        id: 'guardian', name: '守卫者', x: 800, y: 700,
        dialogues: [
          '你竟然来到了古老废墟...',
          '远古神器就藏在这片废墟的深处。',
          '小心这里的怪物比外面的更加凶猛！',
          '找到神器，到达北方的出口就能逃出生天！'
        ]
      }
    ],
    signs: [
      { x: 800, y: 1050, text: '--- 古老废墟 ---\n\n第二关\n\n这里的敌人更加危险\n探索废墟深处寻找神器\n到达北方出口即可胜利!' },
      { x: 500, y: 700, text: '--- 警告 ---\n\n前方区域危险\n确保你有足够的药水\n锁定宝箱需要钥匙才能打开' }
    ],
    portalRequiredKeys: 0
  }
];
