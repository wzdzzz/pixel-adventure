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
  const W = 50, H = 40;
  const map = Array.from({ length: H }, () => Array(W).fill(TILE.EMPTY));

  // 围墙
  for (let x = 0; x < W; x++) { map[0][x] = TILE.WALL; map[H - 1][x] = TILE.WALL; }
  for (let y = 0; y < H; y++) { map[y][0] = TILE.WALL; map[y][W - 1] = TILE.WALL; }

  // 迷宫墙体
  for (let x = 10; x < 16; x++) map[5][x] = TILE.WALL;
  for (let y = 5; y < 12; y++) map[y][10] = TILE.WALL;
  for (let x = 25; x < 35; x++) map[8][x] = TILE.WALL;
  for (let y = 8; y < 15; y++) map[y][25] = TILE.WALL;
  for (let y = 8; y < 15; y++) map[y][34] = TILE.WALL;
  for (let x = 34; x < 40; x++) map[14][x] = TILE.WALL;
  for (let x = 15; x < 22; x++) map[20][x] = TILE.WALL;
  for (let y = 20; y < 28; y++) map[y][15] = TILE.WALL;
  for (let x = 30; x < 40; x++) map[25][x] = TILE.WALL;
  for (let y = 25; y < 32; y++) map[y][30] = TILE.WALL;
  for (let x = 5; x < 12; x++) map[30][x] = TILE.WALL;
  for (let y = 30; y < 36; y++) map[y][5] = TILE.WALL;

  // 水池区域
  for (let y = 16; y < 19; y++) for (let x = 20; x < 25; x++) map[y][x] = TILE.WATER;
  map[17][22] = TILE.BRIDGE; map[17][23] = TILE.BRIDGE;

  for (let y = 32; y < 36; y++) for (let x = 35; x < 42; x++) map[y][x] = TILE.WATER;
  map[33][37] = TILE.BRIDGE; map[33][38] = TILE.BRIDGE;
  map[34][37] = TILE.BRIDGE; map[34][38] = TILE.BRIDGE;

  // 树木
  const trees = [
    [3,3],[4,3],[3,4],[6,8],[7,8],[6,9],
    [42,3],[43,3],[44,4],[42,8],[43,9],
    [3,32],[4,33],[3,34],[42,32],[43,33],[44,34],
    [18,10],[19,11],[38,18],[39,19],[40,18],
    [8,22],[9,23],[44,25],[45,26],[43,27],
    [20,35],[21,36],[22,35],[35,6],[36,7],[37,6]
  ];
  trees.forEach(([y, x]) => {
    if (y > 0 && y < H - 1 && x > 0 && x < W - 1 && map[y][x] === TILE.EMPTY)
      map[y][x] = Math.random() < 0.5 ? TILE.TREE : TILE.TREE_PINE;
  });

  // 草地
  const grass = [
    [2,2],[3,5],[5,3],[8,6],[12,4],[15,8],[18,5],
    [2,42],[5,40],[8,44],[12,42],[15,38],
    [22,8],[24,12],[28,6],[32,10],[35,4],
    [22,40],[25,42],[28,38],[32,44],[35,40],
    [10,20],[12,22],[14,18],[16,24],
    [28,20],[30,22],[32,18],[34,24]
  ];
  grass.forEach(([y, x]) => {
    if (y > 0 && y < H - 1 && x > 0 && x < W - 1 && map[y][x] === TILE.EMPTY)
      map[y][x] = Math.random() < 0.4 ? TILE.GRASS_TALL : TILE.GRASS;
  });

  // 花朵
  const flowers = [
    [4,7],[6,5],[10,3],[14,7],[20,4],
    [4,40],[8,42],[12,40],[16,44],
    [24,8],[28,12],[34,8],[38,10],
    [24,40],[28,38],[34,42],[38,40]
  ];
  flowers.forEach(([y, x]) => {
    if (y > 0 && y < H - 1 && x > 0 && x < W - 1 && map[y][x] === TILE.EMPTY)
      map[y][x] = TILE.FLOWER;
  });

  // 石头
  const stones = [
    [7,15],[10,25],[16,35],[20,10],[22,28],
    [28,15],[32,25],[36,10],[38,20],
    [12,30],[18,38],[26,42],[34,44]
  ];
  stones.forEach(([y, x]) => {
    if (y > 0 && y < H - 1 && x > 0 && x < W - 1 && map[y][x] === TILE.EMPTY)
      map[y][x] = TILE.STONE;
  });

  // 蘑菇
  const mushrooms = [
    [6,12],[11,18],[14,28],[22,6],[26,10],
    [30,20],[34,30],[38,14],[10,36],[16,42]
  ];
  mushrooms.forEach(([y, x]) => {
    if (y > 0 && y < H - 1 && x > 0 && x < W - 1 && map[y][x] === TILE.EMPTY)
      map[y][x] = TILE.MUSHROOM;
  });

  // 栅栏
  for (let x = 3; x < 8; x++) map[2][x] = TILE.FENCE;
  for (let x = 40; x < 46; x++) map[2][x] = TILE.FENCE;
  for (let x = 3; x < 8; x++) map[37][x] = TILE.FENCE;

  // 篝火
  map[10][20] = TILE.CAMPFIRE;
  map[25][40] = TILE.CAMPFIRE;

  // 宝箱
  map[17][21] = TILE.CHEST;         // 水池边普通宝箱
  map[34][36] = TILE.CHEST_LOCKED;  // 水池边锁定宝箱

  // 传送点（替代原来的END）
  map[38][47] = TILE.PORTAL;

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
      { type: 'slime', count: 2 },
      { type: 'goblin', count: 2 },
      { type: 'spider', count: 2 },
      { type: 'bat', count: 2 },
      { type: 'skeleton', count: 2 },
      { type: 'orc_warrior', count: 1 },
      { type: 'fire_mage', count: 1 },
      { type: 'giant_skeleton', count: 1 },
      { type: 'skeleton_king', count: 1 }
    ],
    items: { coins: 12, keys: 2, potions: 4, hasArtifact: false },
    npcs: [
      {
        id: 'elder', name: '村长', x: 200, y: 400,
        dialogues: [
          '欢迎来到这个危险的地方，冒险者！',
          '小心那些红色的怪物，它们会攻击你。',
          '收集钥匙可以打开宝箱，找到传送门就能离开这里！'
        ],
        hasStateCondition: true
      },
      {
        id: 'merchant', name: '旅行商人', x: 600, y: 200,
        dialogues: [
          '欢迎！这里到处都是危险的史莱姆。',
          '鼠标左键挥剑攻击，击败它们可以获得金币。',
          '收集钥匙可以开启宝箱，找到传送门就能前往下一关！'
        ]
      }
    ],
    signs: [
      { x: 120, y: 120, text: '--- 像素冒险 ---\n\n操作:\nWASD/方向键 移动\n鼠标左键 攻击\nE 交互/对话\n\n目标:收集钥匙到达传送门!' },
      { x: 120, y: 300, text: '--- 道具说明 ---\n\n金币(黄):+10分\n钥匙(粉):开启宝箱/传送门\n药水(绿):恢复25HP\n生命之心(红):恢复50HP' },
      { x: 120, y: 500, text: '--- 战斗提示 ---\n\n鼠标左键挥剑攻击\n角色自动转向鼠标方向\n攻击有前摇和后摇\n命中敌人造成定格冻结\n可破坏木桶获取道具' },
      { x: 800, y: 120, text: '--- 探索提示 ---\n\n与NPC按E对话\n黄色感叹号=有新对话\n探索每个角落寻找道具\n水池和树木是障碍物\n击败史莱姆获得金币' }
    ],
    portalRequiredKeys: 2
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
