const SCALE = 2;

const COLORS = Object.freeze({
  outline: '#101715',
  wood: '#4a3527',
  woodLight: '#63482f',
  woodDark: '#33251b',
  brass: '#c6a45f',
  brassDark: '#816c43',
  cinnabar: '#b94f43',
  cinnabarDark: '#7c352c',
  jade: '#62bc91',
  jadeLight: '#95d8b4',
  jadeDark: '#3c7a5c',
  paper: '#d9ddd4',
  paperShade: '#a7afa8',
  stone: '#687875',
  stoneLight: '#899490',
  stoneDark: '#485956',
  clay: '#8a5f43',
  clayLight: '#a87c58',
  flame: '#e6bd67',
  flameDeep: '#d9663a',
  ink: '#182a28'
});

function rect(ctx, x, y, width, height, color) {
  if (width <= 0 || height <= 0) return;
  ctx.fillStyle = color;
  ctx.fillRect(Math.round(x), Math.round(y), Math.round(width), Math.round(height));
}

/** 木胎漆匣基座：宝箱三态共用的箱体 */
function chestBody(ctx, w, open) {
  const bodyY = open ? 12 : 8;
  rect(ctx, 1, bodyY - 1, w - 2, 28 - bodyY, COLORS.outline);
  rect(ctx, 3, bodyY + 1, w - 6, 24 - bodyY, COLORS.wood);
  rect(ctx, 3, bodyY + 1, w - 6, 2, COLORS.woodLight);
  rect(ctx, 3, 24, w - 6, 2, COLORS.woodDark);
  // 铜箍回纹
  rect(ctx, 5, bodyY + 1, 2, 25 - bodyY, COLORS.brassDark);
  rect(ctx, w - 7, bodyY + 1, 2, 25 - bodyY, COLORS.brassDark);
}

const DRAWERS = {
  chest_closed: {
    w: 32, h: 28,
    draw(ctx, w) {
      chestBody(ctx, w, false);
      rect(ctx, 1, 3, w - 2, 8, COLORS.outline);
      rect(ctx, 3, 5, w - 6, 5, COLORS.woodLight);
      rect(ctx, 3, 5, w - 6, 2, COLORS.clayLight);
      rect(ctx, 5, 4, 2, 7, COLORS.brass);
      rect(ctx, w - 7, 4, 2, 7, COLORS.brass);
      // 玉扣锁
      rect(ctx, w / 2 - 4, 9, 8, 8, COLORS.outline);
      rect(ctx, w / 2 - 3, 10, 6, 6, COLORS.brass);
      rect(ctx, w / 2 - 2, 12, 4, 3, COLORS.jade);
    }
  },
  chest_open: {
    w: 32, h: 28,
    draw(ctx, w) {
      chestBody(ctx, w, true);
      // 掀开的盖
      rect(ctx, 1, 1, w - 2, 9, COLORS.outline);
      rect(ctx, 3, 3, w - 6, 5, COLORS.woodLight);
      rect(ctx, 5, 3, 2, 5, COLORS.brass);
      rect(ctx, w - 7, 3, 2, 5, COLORS.brass);
      // 箱内灵光与灵石
      rect(ctx, 4, 13, w - 8, 7, '#0d1411');
      rect(ctx, 8, 15, 6, 4, COLORS.jade);
      rect(ctx, 17, 16, 5, 3, COLORS.brass);
      rect(ctx, 9, 14, 2, 2, COLORS.jadeLight);
      rect(ctx, 18, 15, 2, 2, COLORS.flame);
    }
  },
  chest_locked: {
    w: 32, h: 28,
    draw(ctx, w) {
      chestBody(ctx, w, false);
      rect(ctx, 1, 3, w - 2, 8, COLORS.outline);
      rect(ctx, 3, 5, w - 6, 5, COLORS.woodLight);
      rect(ctx, 5, 4, 2, 7, COLORS.brass);
      rect(ctx, w - 7, 4, 2, 7, COLORS.brass);
      // 封印符纸：斜贴朱砂符
      rect(ctx, w / 2 - 3, 4, 6, 20, COLORS.paper);
      rect(ctx, w / 2 - 3, 4, 6, 2, COLORS.brassDark);
      rect(ctx, w / 2 - 2, 8, 4, 3, COLORS.cinnabar);
      rect(ctx, w / 2 - 1, 12, 2, 4, COLORS.cinnabar);
      rect(ctx, w / 2 - 2, 17, 4, 2, COLORS.cinnabar);
    }
  },
  coin: {
    w: 20, h: 20,
    draw(ctx) {
      // 灵石：多面玉晶
      rect(ctx, 7, 2, 6, 3, COLORS.outline);
      rect(ctx, 4, 5, 12, 10, COLORS.outline);
      rect(ctx, 7, 15, 6, 3, COLORS.outline);
      rect(ctx, 8, 3, 4, 2, COLORS.jade);
      rect(ctx, 5, 6, 10, 8, COLORS.jade);
      rect(ctx, 8, 16, 4, 1, COLORS.jadeDark);
      rect(ctx, 6, 6, 4, 4, COLORS.jadeLight);
      rect(ctx, 7, 7, 2, 2, '#d7f2e2');
      rect(ctx, 11, 10, 3, 3, COLORS.jadeDark);
    }
  },
  key: {
    w: 20, h: 20,
    draw(ctx) {
      // 禁制令牌：铜牌朱绦
      rect(ctx, 5, 2, 10, 14, COLORS.outline);
      rect(ctx, 6, 3, 8, 12, COLORS.brass);
      rect(ctx, 6, 3, 8, 2, COLORS.brassDark);
      rect(ctx, 8, 6, 4, 5, COLORS.cinnabarDark);
      rect(ctx, 9, 7, 2, 3, COLORS.flame);
      rect(ctx, 9, 0, 2, 3, COLORS.brassDark);
      rect(ctx, 9, 16, 2, 4, COLORS.cinnabar);
    }
  },
  artifact: {
    w: 24, h: 24,
    draw(ctx) {
      // 镇界古印：方印钮首（浅色底，便于地标 tint 上色）
      rect(ctx, 9, 1, 6, 6, COLORS.outline);
      rect(ctx, 10, 2, 4, 4, COLORS.paperShade);
      rect(ctx, 6, 7, 12, 4, COLORS.outline);
      rect(ctx, 7, 8, 10, 2, COLORS.paper);
      rect(ctx, 3, 11, 18, 11, COLORS.outline);
      rect(ctx, 5, 13, 14, 8, COLORS.paper);
      rect(ctx, 5, 13, 14, 2, '#eceee6');
      // 印面阵纹
      rect(ctx, 8, 16, 3, 3, COLORS.paperShade);
      rect(ctx, 13, 16, 3, 3, COLORS.paperShade);
      rect(ctx, 11, 15, 2, 5, COLORS.paperShade);
    }
  },
  potion: {
    w: 16, h: 20,
    draw(ctx) {
      // 回春散：青玉小葫芦
      rect(ctx, 6, 0, 4, 3, COLORS.woodDark);
      rect(ctx, 5, 3, 6, 5, COLORS.outline);
      rect(ctx, 6, 4, 4, 3, COLORS.jade);
      rect(ctx, 3, 8, 10, 11, COLORS.outline);
      rect(ctx, 4, 9, 8, 9, COLORS.jade);
      rect(ctx, 5, 10, 3, 3, COLORS.jadeLight);
      rect(ctx, 6, 13, 4, 4, COLORS.cinnabar);
      rect(ctx, 7, 14, 2, 2, '#e8a08f');
    }
  },
  mana_potion: {
    w: 16, h: 20,
    draw(ctx) {
      // 聚灵散：蓝玉小葫芦
      rect(ctx, 6, 0, 4, 3, COLORS.woodDark);
      rect(ctx, 5, 3, 6, 5, COLORS.outline);
      rect(ctx, 6, 4, 4, 3, '#5a8fb4');
      rect(ctx, 3, 8, 10, 11, COLORS.outline);
      rect(ctx, 4, 9, 8, 9, '#5a8fb4');
      rect(ctx, 5, 10, 3, 3, '#8fc0dd');
      rect(ctx, 6, 13, 4, 4, COLORS.brass);
      rect(ctx, 7, 14, 2, 2, COLORS.flame);
    }
  },
  campfire: {
    w: 24, h: 24,
    draw(ctx) {
      // 石圈篝火
      rect(ctx, 2, 18, 5, 4, COLORS.stoneDark);
      rect(ctx, 9, 20, 6, 4, COLORS.stoneDark);
      rect(ctx, 17, 18, 5, 4, COLORS.stoneDark);
      rect(ctx, 3, 18, 3, 2, COLORS.stone);
      rect(ctx, 18, 18, 3, 2, COLORS.stone);
      rect(ctx, 6, 16, 12, 4, COLORS.woodDark);
      rect(ctx, 8, 15, 8, 2, COLORS.wood);
      rect(ctx, 8, 6, 8, 11, COLORS.flameDeep);
      rect(ctx, 10, 8, 5, 8, '#efa04e');
      rect(ctx, 11, 10, 3, 5, COLORS.flame);
      rect(ctx, 12, 3, 2, 4, COLORS.flameDeep);
    }
  },
  sign: {
    w: 32, h: 32,
    draw(ctx) {
      // 坊市木指牌
      rect(ctx, 14, 18, 4, 14, COLORS.outline);
      rect(ctx, 15, 19, 2, 12, COLORS.woodDark);
      rect(ctx, 2, 4, 28, 16, COLORS.outline);
      rect(ctx, 4, 6, 24, 12, COLORS.wood);
      rect(ctx, 4, 6, 24, 2, COLORS.woodLight);
      rect(ctx, 5, 9, 2, 8, COLORS.brassDark);
      rect(ctx, 25, 9, 2, 8, COLORS.brassDark);
      rect(ctx, 9, 10, 14, 2, COLORS.paperShade);
      rect(ctx, 9, 14, 10, 2, COLORS.paperShade);
    }
  },
  stone: {
    w: 32, h: 32,
    draw(ctx) {
      // 青石
      rect(ctx, 4, 10, 24, 18, COLORS.outline);
      rect(ctx, 9, 5, 15, 7, COLORS.outline);
      rect(ctx, 6, 12, 20, 14, COLORS.stone);
      rect(ctx, 10, 7, 12, 6, COLORS.stone);
      rect(ctx, 11, 8, 7, 3, COLORS.stoneLight);
      rect(ctx, 8, 14, 6, 4, COLORS.stoneLight);
      rect(ctx, 18, 20, 7, 5, COLORS.stoneDark);
      rect(ctx, 7, 23, 6, 3, '#59756a');
    }
  },
  barrel: {
    w: 28, h: 32,
    draw(ctx) {
      // 陶瓮酒坛
      rect(ctx, 9, 1, 10, 4, COLORS.outline);
      rect(ctx, 10, 2, 8, 2, COLORS.woodDark);
      rect(ctx, 7, 5, 14, 4, COLORS.outline);
      rect(ctx, 8, 6, 12, 2, COLORS.clayLight);
      rect(ctx, 4, 9, 20, 21, COLORS.outline);
      rect(ctx, 6, 11, 16, 17, COLORS.clay);
      rect(ctx, 7, 12, 5, 8, COLORS.clayLight);
      rect(ctx, 6, 24, 16, 2, '#6e4a33');
      // 朱砂封纸
      rect(ctx, 12, 13, 5, 9, COLORS.paper);
      rect(ctx, 13, 15, 3, 2, COLORS.cinnabar);
      rect(ctx, 14, 18, 1, 3, COLORS.cinnabar);
    }
  },
  gem: {
    w: 20, h: 20,
    draw(ctx) {
      // 灵晶簇
      rect(ctx, 3, 15, 14, 4, COLORS.outline);
      rect(ctx, 4, 16, 12, 2, COLORS.stoneDark);
      rect(ctx, 5, 6, 4, 10, COLORS.outline);
      rect(ctx, 6, 7, 2, 8, COLORS.jade);
      rect(ctx, 9, 2, 5, 14, COLORS.outline);
      rect(ctx, 10, 3, 3, 12, COLORS.jadeLight);
      rect(ctx, 10, 4, 2, 4, '#d7f2e2');
      rect(ctx, 14, 8, 4, 8, COLORS.outline);
      rect(ctx, 15, 9, 2, 6, COLORS.jadeDark);
    }
  },
  lantern: {
    w: 20, h: 28,
    draw(ctx) {
      // 符灯：朱纱灯笼
      rect(ctx, 8, 0, 4, 3, COLORS.brassDark);
      rect(ctx, 5, 3, 10, 3, COLORS.outline);
      rect(ctx, 6, 4, 8, 1, COLORS.brass);
      rect(ctx, 3, 6, 14, 15, COLORS.outline);
      rect(ctx, 4, 7, 12, 13, COLORS.cinnabar);
      rect(ctx, 5, 8, 4, 5, '#da7465');
      rect(ctx, 8, 10, 4, 6, COLORS.flame);
      rect(ctx, 9, 7, 2, 13, COLORS.cinnabarDark);
      rect(ctx, 5, 21, 10, 3, COLORS.outline);
      rect(ctx, 6, 22, 8, 1, COLORS.brass);
      rect(ctx, 9, 24, 2, 4, COLORS.cinnabarDark);
    }
  },
  rock_candle: {
    w: 24, h: 28,
    draw(ctx) {
      // 石烛：石座灵火
      rect(ctx, 6, 20, 12, 7, COLORS.outline);
      rect(ctx, 7, 21, 10, 5, COLORS.stoneDark);
      rect(ctx, 8, 21, 4, 2, COLORS.stone);
      rect(ctx, 9, 13, 6, 8, COLORS.outline);
      rect(ctx, 10, 14, 4, 6, COLORS.stone);
      rect(ctx, 11, 6, 2, 7, COLORS.paperShade);
      rect(ctx, 10, 3, 4, 5, COLORS.jadeLight);
      rect(ctx, 11, 4, 2, 3, '#d7f2e2');
    }
  },
  portal: {
    w: 32, h: 32,
    draw(ctx) {
      // 传送阵：玉青阵环
      rect(ctx, 4, 4, 24, 24, COLORS.ink);
      rect(ctx, 6, 6, 20, 20, '#213c33');
      rect(ctx, 8, 4, 16, 2, COLORS.jadeDark);
      rect(ctx, 8, 26, 16, 2, COLORS.jadeDark);
      rect(ctx, 4, 8, 2, 16, COLORS.jadeDark);
      rect(ctx, 26, 8, 2, 16, COLORS.jadeDark);
      // 内圈阵纹
      rect(ctx, 10, 10, 12, 12, COLORS.jadeDark);
      rect(ctx, 12, 12, 8, 8, COLORS.jade);
      rect(ctx, 14, 14, 4, 4, COLORS.jadeLight);
      rect(ctx, 15, 10, 2, 2, COLORS.jadeLight);
      rect(ctx, 15, 20, 2, 2, COLORS.jadeLight);
      rect(ctx, 10, 15, 2, 2, COLORS.jadeLight);
      rect(ctx, 20, 15, 2, 2, COLORS.jadeLight);
      // 四角符记
      rect(ctx, 6, 6, 3, 3, COLORS.brass);
      rect(ctx, 23, 6, 3, 3, COLORS.brass);
      rect(ctx, 6, 23, 3, 3, COLORS.brass);
      rect(ctx, 23, 23, 3, 3, COLORS.brass);
    }
  }
};

/**
 * 用仙侠主题的程序化像素画替换道具/地标贴图。
 * 覆盖 BootScene 加载的旧 PNG 与 AssetManager 生成的旧纹理，texture key 不变。
 */
export function installXianxiaPropTextures(scene) {
  if (!scene?.textures) return;
  for (const [key, def] of Object.entries(DRAWERS)) {
    const canvas = document.createElement('canvas');
    canvas.width = def.w * SCALE;
    canvas.height = def.h * SCALE;
    const ctx = canvas.getContext('2d');
    if (!ctx) continue;
    ctx.imageSmoothingEnabled = false;
    ctx.scale(SCALE, SCALE);
    def.draw(ctx, def.w, def.h);
    if (scene.textures.exists(key)) scene.textures.remove(key);
    scene.textures.addCanvas(key, canvas);
  }
}
