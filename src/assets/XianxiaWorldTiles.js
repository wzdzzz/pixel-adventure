const COLORS = Object.freeze({
  ink: '#182a28',
  inkSoft: '#243b37',
  jadeDark: '#315846',
  jade: '#4f7b62',
  jadeLight: '#79a889',
  stoneDark: '#485956',
  stone: '#687875',
  stoneLight: '#899490',
  earthDark: '#51463c',
  earth: '#6b5a49',
  earthLight: '#87725b',
  paper: '#c5c8bd',
  paperShade: '#a7afa8',
  cinnabar: '#a9483e',
  cinnabarDark: '#71362f',
  brass: '#c29a55',
  flame: '#e6bd67'
});

const SUPPORTED_TILE_IDS = new Set([0, 1, 4, 5, 16, 17, 18, 20, 32, 34, 36]);

/**
 * Draws a deterministic xianxia-themed replacement for a world tileset cell.
 * Coordinates are authored on a 32x32 pixel grid and scaled for other tile sizes.
 *
 * @returns {boolean} true when the tile ID was handled
 */
export function drawXianxiaWorldTile(ctx, tileId, cols, size) {
  if (!SUPPORTED_TILE_IDS.has(tileId)) return false;

  const originX = (tileId % cols) * size;
  const originY = Math.floor(tileId / cols) * size;
  const scale = size / 32;
  const rect = (x, y, width, height) => {
    ctx.fillRect(
      Math.round(originX + x * scale),
      Math.round(originY + y * scale),
      Math.max(1, Math.round(width * scale)),
      Math.max(1, Math.round(height * scale))
    );
  };
  const clear = () => ctx.clearRect(originX, originY, size, size);

  switch (tileId) {
    case 0: { // Bamboo meadow
      ctx.fillStyle = COLORS.jadeDark;
      rect(0, 0, 32, 32);
      ctx.fillStyle = COLORS.inkSoft;
      rect(3, 6, 3, 2);
      rect(22, 17, 4, 2);
      rect(11, 25, 5, 2);
      rect(2, 29, 7, 2);
      rect(23, 28, 6, 2);
      ctx.fillStyle = COLORS.jade;
      rect(5, 12, 2, 7);
      rect(3, 13, 3, 2);
      rect(7, 16, 4, 2);
      rect(25, 4, 2, 7);
      rect(22, 5, 4, 2);
      rect(27, 8, 3, 2);
      ctx.fillStyle = COLORS.stone;
      rect(14, 7, 5, 3);
      rect(17, 19, 4, 3);
      ctx.fillStyle = COLORS.jadeLight;
      rect(15, 7, 3, 1);
      rect(5, 12, 1, 4);
      break;
    }

    case 1: { // Packed earth path
      ctx.fillStyle = COLORS.earth;
      rect(0, 0, 32, 32);
      ctx.fillStyle = COLORS.earthDark;
      rect(0, 9, 8, 2);
      rect(11, 10, 13, 2);
      rect(27, 8, 5, 2);
      rect(3, 24, 12, 2);
      rect(19, 23, 10, 2);
      ctx.fillStyle = COLORS.earthLight;
      rect(5, 5, 4, 2);
      rect(20, 5, 3, 2);
      rect(13, 17, 5, 2);
      rect(26, 28, 3, 2);
      ctx.fillStyle = COLORS.stoneDark;
      rect(2, 16, 3, 2);
      rect(23, 15, 4, 2);
      break;
    }

    case 4: { // Mountain stream
      ctx.fillStyle = '#315d67';
      rect(0, 0, 32, 32);
      ctx.fillStyle = '#244c55';
      rect(0, 12, 8, 2);
      rect(13, 13, 13, 2);
      rect(6, 26, 12, 2);
      rect(24, 25, 8, 2);
      ctx.fillStyle = '#6f9e97';
      rect(4, 5, 8, 2);
      rect(17, 6, 11, 2);
      rect(2, 19, 5, 2);
      rect(11, 20, 13, 2);
      ctx.fillStyle = '#a0bdb2';
      rect(19, 7, 5, 1);
      rect(13, 21, 6, 1);
      break;
    }

    case 5: { // Qiyun market flagstones
      ctx.fillStyle = COLORS.stone;
      rect(0, 0, 32, 32);
      ctx.fillStyle = COLORS.stoneDark;
      rect(0, 10, 32, 2);
      rect(0, 21, 32, 2);
      rect(15, 0, 2, 10);
      rect(7, 12, 2, 9);
      rect(23, 12, 2, 9);
      rect(15, 23, 2, 9);
      ctx.fillStyle = COLORS.stoneLight;
      rect(2, 2, 9, 2);
      rect(18, 13, 4, 2);
      rect(18, 25, 9, 2);
      ctx.fillStyle = COLORS.jadeDark;
      rect(0, 20, 5, 1);
      rect(25, 9, 7, 1);
      break;
    }

    case 16: { // Grey-tile roof and white wall
      clear();
      ctx.fillStyle = COLORS.paperShade;
      rect(2, 13, 28, 17);
      ctx.fillStyle = COLORS.paper;
      rect(4, 15, 24, 12);
      ctx.fillStyle = COLORS.stoneDark;
      rect(0, 7, 32, 8);
      rect(3, 4, 26, 4);
      rect(7, 1, 18, 4);
      ctx.fillStyle = COLORS.inkSoft;
      rect(0, 13, 32, 3);
      rect(5, 7, 2, 6);
      rect(12, 4, 2, 9);
      rect(19, 4, 2, 9);
      rect(26, 7, 2, 6);
      ctx.fillStyle = COLORS.stoneLight;
      rect(4, 5, 24, 1);
      rect(8, 2, 16, 1);
      ctx.fillStyle = COLORS.cinnabarDark;
      rect(14, 20, 4, 10);
      break;
    }

    case 17: { // Bamboo grove
      clear();
      ctx.fillStyle = COLORS.jadeDark;
      rect(7, 5, 4, 27);
      rect(15, 1, 4, 31);
      rect(23, 8, 3, 24);
      ctx.fillStyle = COLORS.jadeLight;
      rect(7, 11, 4, 2);
      rect(15, 8, 4, 2);
      rect(15, 19, 4, 2);
      rect(23, 16, 3, 2);
      ctx.fillStyle = COLORS.jade;
      rect(1, 5, 8, 3);
      rect(4, 8, 6, 3);
      rect(19, 3, 9, 3);
      rect(20, 6, 6, 3);
      rect(9, 14, 7, 3);
      rect(19, 21, 10, 3);
      rect(22, 24, 6, 3);
      ctx.fillStyle = COLORS.inkSoft;
      rect(5, 29, 23, 3);
      break;
    }

    case 18: { // Pine and bamboo cluster
      clear();
      ctx.fillStyle = COLORS.earthDark;
      rect(14, 19, 5, 13);
      ctx.fillStyle = COLORS.ink;
      rect(5, 19, 23, 9);
      rect(8, 12, 18, 9);
      rect(11, 6, 13, 8);
      rect(14, 2, 7, 6);
      ctx.fillStyle = COLORS.jadeDark;
      rect(7, 17, 15, 4);
      rect(11, 10, 12, 3);
      rect(19, 23, 9, 3);
      ctx.fillStyle = COLORS.jadeLight;
      rect(25, 6, 3, 23);
      rect(23, 11, 7, 2);
      rect(22, 17, 6, 2);
      break;
    }

    case 20: { // Cinnabar timber railing
      clear();
      ctx.fillStyle = COLORS.cinnabarDark;
      rect(0, 10, 32, 4);
      rect(0, 21, 32, 4);
      rect(3, 5, 5, 24);
      rect(24, 5, 5, 24);
      ctx.fillStyle = COLORS.cinnabar;
      rect(1, 9, 31, 2);
      rect(5, 4, 3, 3);
      rect(26, 4, 3, 3);
      ctx.fillStyle = COLORS.brass;
      rect(5, 12, 2, 2);
      rect(26, 23, 2, 2);
      break;
    }

    case 32: { // Mountain wildflowers
      clear();
      ctx.fillStyle = COLORS.jadeDark;
      rect(14, 14, 3, 16);
      rect(8, 20, 7, 3);
      rect(17, 23, 7, 3);
      ctx.fillStyle = COLORS.cinnabar;
      rect(10, 9, 5, 5);
      rect(16, 7, 6, 6);
      rect(21, 12, 4, 4);
      ctx.fillStyle = COLORS.paper;
      rect(11, 10, 2, 2);
      rect(18, 9, 2, 2);
      ctx.fillStyle = COLORS.brass;
      rect(22, 13, 2, 2);
      break;
    }

    case 34: { // Tall bamboo-leaf grass
      clear();
      ctx.fillStyle = 'rgba(36, 59, 55, 0.72)';
      rect(0, 24, 32, 8);
      ctx.fillStyle = COLORS.jadeDark;
      rect(4, 8, 3, 22);
      rect(14, 3, 3, 28);
      rect(25, 10, 3, 21);
      ctx.fillStyle = COLORS.jade;
      rect(0, 11, 8, 3);
      rect(6, 17, 9, 3);
      rect(9, 7, 7, 3);
      rect(17, 11, 8, 3);
      rect(19, 20, 9, 3);
      rect(25, 14, 7, 3);
      ctx.fillStyle = COLORS.jadeLight;
      rect(15, 5, 2, 8);
      rect(26, 11, 2, 7);
      break;
    }

    case 36: { // Stone brazier and spirit light
      clear();
      ctx.fillStyle = COLORS.stoneDark;
      rect(7, 21, 18, 7);
      rect(10, 28, 4, 4);
      rect(20, 28, 4, 4);
      ctx.fillStyle = COLORS.stoneLight;
      rect(9, 19, 14, 4);
      ctx.fillStyle = COLORS.cinnabarDark;
      rect(9, 13, 14, 8);
      ctx.fillStyle = COLORS.cinnabar;
      rect(11, 9, 10, 11);
      ctx.fillStyle = COLORS.brass;
      rect(13, 5, 6, 13);
      ctx.fillStyle = COLORS.flame;
      rect(15, 2, 3, 11);
      rect(13, 8, 2, 5);
      break;
    }
  }

  return true;
}
