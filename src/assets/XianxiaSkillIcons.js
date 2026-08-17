const ICON_SIZE = 64;
const PIXEL_SCALE = 2;

const SPECIFIC_ICONS = Object.freeze({
  heavyStrike: 'skill_icon_heavyStrike',
  whirlwind: 'skill_icon_whirlwind',
  charge: 'skill_icon_charge',
  warCry: 'skill_icon_warCry',
  piercingShot: 'skill_icon_piercingShot',
  rapidFire: 'skill_icon_rapidFire',
  evasiveRoll: 'skill_icon_evasiveRoll',
  eagleEye: 'skill_icon_eagleEye',
  fireball: 'skill_icon_fireball',
  frostNova: 'skill_icon_frostNova',
  blink: 'skill_icon_blink',
  magicShield: 'skill_icon_magicShield',
});

const CLASS_ICONS = Object.freeze({
  warrior: 'skill_icon_warrior',
  archer: 'skill_icon_archer',
  mage: 'skill_icon_mage',
});

const COLORS = Object.freeze({
  ink: '#0b1411',
  inkRaised: '#182921',
  paper: '#d9ddd4',
  jade: '#62bc91',
  jadeBright: '#98dfbb',
  cinnabar: '#b94f43',
  cinnabarBright: '#e07b69',
  brass: '#c6a45f',
  frost: '#91c7c2',
});

export function getSkillIconTexture(classType, skillId) {
  return SPECIFIC_ICONS[skillId] || CLASS_ICONS[classType] || CLASS_ICONS.warrior;
}

function line(ctx, color, width, points) {
  ctx.strokeStyle = color;
  ctx.lineWidth = width;
  ctx.lineCap = 'square';
  ctx.lineJoin = 'miter';
  ctx.beginPath();
  ctx.moveTo(points[0][0], points[0][1]);
  for (let i = 1; i < points.length; i++) ctx.lineTo(points[i][0], points[i][1]);
  ctx.stroke();
}

function sword(ctx, x, y, rotation = 0, color = COLORS.paper) {
  ctx.save();
  ctx.translate(x, y);
  ctx.rotate(rotation);
  ctx.fillStyle = color;
  ctx.fillRect(-1, -10, 3, 17);
  ctx.fillRect(-2, -11, 5, 3);
  ctx.fillStyle = COLORS.brass;
  ctx.fillRect(-4, 6, 9, 2);
  ctx.fillStyle = COLORS.cinnabar;
  ctx.fillRect(-1, 8, 3, 4);
  ctx.restore();
}

function talisman(ctx, x, y, mark = COLORS.cinnabar) {
  ctx.fillStyle = COLORS.paper;
  ctx.fillRect(x - 5, y - 11, 10, 22);
  ctx.fillStyle = COLORS.brass;
  ctx.fillRect(x - 5, y - 11, 10, 2);
  ctx.fillStyle = mark;
  ctx.fillRect(x - 2, y - 7, 4, 3);
  ctx.fillRect(x, y - 4, 2, 5);
  ctx.fillRect(x - 3, y, 5, 2);
  ctx.fillRect(x - 3, y + 2, 2, 5);
  ctx.fillRect(x + 1, y + 5, 4, 2);
}

function drawBase(ctx, accent) {
  ctx.fillStyle = COLORS.ink;
  ctx.fillRect(1, 1, 30, 30);
  ctx.fillStyle = COLORS.inkRaised;
  ctx.fillRect(3, 3, 26, 26);
  ctx.strokeStyle = accent;
  ctx.lineWidth = 1;
  ctx.strokeRect(2.5, 2.5, 27, 27);
  ctx.fillStyle = accent;
  ctx.fillRect(4, 4, 3, 1);
  ctx.fillRect(25, 27, 3, 1);
}

const DRAWERS = {
  skill_icon_heavyStrike(ctx) {
    drawBase(ctx, COLORS.cinnabar);
    line(ctx, COLORS.brass, 2, [[6, 24], [13, 14], [17, 19], [21, 10], [27, 24]]);
    line(ctx, COLORS.cinnabarBright, 2, [[9, 25], [16, 19], [23, 25]]);
    ctx.fillStyle = COLORS.paper;
    ctx.fillRect(14, 7, 4, 8);
    ctx.fillRect(11, 9, 10, 4);
  },
  skill_icon_whirlwind(ctx) {
    drawBase(ctx, COLORS.cinnabar);
    ctx.strokeStyle = COLORS.brass;
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.arc(16, 16, 10, -0.4, 4.8);
    ctx.stroke();
    ctx.strokeStyle = COLORS.cinnabarBright;
    ctx.beginPath();
    ctx.arc(16, 16, 5, 2.4, 7.1);
    ctx.stroke();
    ctx.fillStyle = COLORS.brass;
    ctx.fillRect(23, 6, 4, 4);
    ctx.fillStyle = COLORS.cinnabarBright;
    ctx.fillRect(6, 21, 4, 4);
  },
  skill_icon_charge(ctx) {
    drawBase(ctx, COLORS.cinnabar);
    line(ctx, COLORS.brass, 3, [[7, 24], [17, 13], [24, 13]]);
    line(ctx, COLORS.paper, 2, [[10, 19], [5, 14]]);
    line(ctx, COLORS.cinnabarBright, 2, [[14, 14], [9, 9]]);
    ctx.fillStyle = COLORS.cinnabarBright;
    ctx.fillRect(22, 10, 5, 8);
  },
  skill_icon_warCry(ctx) {
    drawBase(ctx, COLORS.cinnabar);
    ctx.fillStyle = COLORS.paper;
    ctx.fillRect(7, 12, 7, 8);
    ctx.fillStyle = COLORS.cinnabar;
    ctx.fillRect(14, 10, 3, 12);
    line(ctx, COLORS.brass, 2, [[20, 11], [24, 8]]);
    line(ctx, COLORS.brass, 2, [[20, 16], [27, 16]]);
    line(ctx, COLORS.brass, 2, [[20, 21], [24, 24]]);
  },
  skill_icon_piercingShot(ctx) {
    drawBase(ctx, COLORS.jade);
    sword(ctx, 16, 16, Math.PI / 4, COLORS.jadeBright);
    line(ctx, COLORS.paper, 1, [[5, 24], [12, 17]]);
    line(ctx, COLORS.jade, 2, [[21, 11], [27, 5]]);
  },
  skill_icon_rapidFire(ctx) {
    drawBase(ctx, COLORS.jade);
    sword(ctx, 10, 18, Math.PI / 4, COLORS.paper);
    sword(ctx, 16, 16, Math.PI / 4, COLORS.jadeBright);
    sword(ctx, 22, 14, Math.PI / 4, COLORS.brass);
  },
  skill_icon_evasiveRoll(ctx) {
    drawBase(ctx, COLORS.jade);
    line(ctx, COLORS.jadeBright, 2, [[5, 20], [11, 14], [17, 18], [25, 10]]);
    line(ctx, COLORS.paper, 2, [[6, 25], [12, 22], [18, 24], [27, 20]]);
    ctx.fillStyle = COLORS.brass;
    ctx.fillRect(23, 7, 4, 4);
  },
  skill_icon_eagleEye(ctx) {
    drawBase(ctx, COLORS.jade);
    line(ctx, COLORS.jadeBright, 2, [[5, 16], [11, 10], [21, 10], [27, 16], [21, 22], [11, 22], [5, 16]]);
    ctx.fillStyle = COLORS.brass;
    ctx.fillRect(13, 13, 6, 6);
    ctx.fillStyle = COLORS.ink;
    ctx.fillRect(15, 15, 2, 2);
  },
  skill_icon_fireball(ctx) {
    drawBase(ctx, COLORS.cinnabar);
    talisman(ctx, 14, 16);
    ctx.fillStyle = COLORS.cinnabarBright;
    ctx.fillRect(21, 8, 4, 5);
    ctx.fillRect(19, 12, 7, 8);
    ctx.fillStyle = COLORS.brass;
    ctx.fillRect(21, 14, 3, 4);
  },
  skill_icon_frostNova(ctx) {
    drawBase(ctx, COLORS.frost);
    line(ctx, COLORS.frost, 2, [[16, 5], [16, 27]]);
    line(ctx, COLORS.frost, 2, [[5, 16], [27, 16]]);
    line(ctx, COLORS.paper, 2, [[8, 8], [24, 24]]);
    line(ctx, COLORS.paper, 2, [[24, 8], [8, 24]]);
    ctx.fillStyle = COLORS.jadeBright;
    ctx.fillRect(13, 13, 7, 7);
  },
  skill_icon_blink(ctx) {
    drawBase(ctx, COLORS.brass);
    talisman(ctx, 9, 17, COLORS.jade);
    talisman(ctx, 23, 15, COLORS.cinnabar);
    line(ctx, COLORS.jadeBright, 2, [[12, 9], [18, 9], [18, 22]]);
  },
  skill_icon_magicShield(ctx) {
    drawBase(ctx, COLORS.brass);
    ctx.fillStyle = COLORS.jade;
    ctx.fillRect(8, 8, 16, 3);
    ctx.fillRect(7, 11, 3, 9);
    ctx.fillRect(22, 11, 3, 9);
    ctx.fillRect(10, 20, 3, 4);
    ctx.fillRect(19, 20, 3, 4);
    ctx.fillRect(13, 24, 6, 3);
    ctx.fillStyle = COLORS.paper;
    ctx.fillRect(14, 13, 4, 8);
    ctx.fillRect(12, 15, 8, 4);
  },
};

DRAWERS.skill_icon_warrior = DRAWERS.skill_icon_heavyStrike;
DRAWERS.skill_icon_archer = DRAWERS.skill_icon_piercingShot;
DRAWERS.skill_icon_mage = DRAWERS.skill_icon_fireball;

export function installXianxiaSkillIcons(scene) {
  for (const [key, draw] of Object.entries(DRAWERS)) {
    if (scene.textures.exists(key)) scene.textures.remove(key);
    const canvas = document.createElement('canvas');
    canvas.width = ICON_SIZE;
    canvas.height = ICON_SIZE;
    const ctx = canvas.getContext('2d');
    ctx.imageSmoothingEnabled = false;
    ctx.scale(PIXEL_SCALE, PIXEL_SCALE);
    draw(ctx);
    scene.textures.addCanvas(key, canvas);
  }
}
