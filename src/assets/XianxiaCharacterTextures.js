const SCALE = 2;

const COLORS = Object.freeze({
  outline: '#101715',
  deepInk: '#172421',
  ink: '#243832',
  paleRobe: '#d8ddd2',
  robeShade: '#aabbb0',
  robeLight: '#f0eee2',
  jade: '#4fa77c',
  jadeLight: '#83d2a2',
  brass: '#c69b4b',
  cinnabar: '#bd493b',
  skin: '#d8a77b',
  skinShade: '#9f6e54',
  steel: '#d8e2dc',
  steelShade: '#718a83'
});

function rect(ctx, x, y, width, height, color) {
  if (width <= 0 || height <= 0) return;
  ctx.fillStyle = color;
  ctx.fillRect(Math.round(x), Math.round(y), Math.round(width), Math.round(height));
}

function pixelShadow(ctx, x, y, width) {
  const left = Math.round(x - width / 2);
  rect(ctx, left + 3, y, width - 6, 2, 'rgba(4, 8, 7, 0.28)');
  rect(ctx, left, y + 2, width, 2, 'rgba(4, 8, 7, 0.38)');
  rect(ctx, left + 4, y + 4, width - 8, 1, 'rgba(4, 8, 7, 0.22)');
}

function stairLine(ctx, points, thickness, color) {
  for (let i = 0; i < points.length - 1; i += 1) {
    const [x0, y0] = points[i];
    const [x1, y1] = points[i + 1];
    const dx = Math.sign(x1 - x0);
    const dy = Math.sign(y1 - y0);
    const distance = Math.max(Math.abs(x1 - x0), Math.abs(y1 - y0));
    for (let step = 0; step <= distance; step += 1) {
      const x = x0 + Math.round((x1 - x0) * (step / Math.max(1, distance)));
      const y = y0 + Math.round((y1 - y0) * (step / Math.max(1, distance)));
      rect(ctx, x, y, thickness, thickness, color);
      if (dx === 0 && dy === 0) break;
    }
  }
}

function drawSword(ctx, points, raised = false) {
  stairLine(ctx, points, 3, COLORS.outline);
  stairLine(ctx, points, 1, COLORS.steel);
  const [gripX, gripY] = points[0];
  rect(ctx, gripX - 2, gripY - 1, raised ? 5 : 4, 2, COLORS.brass);
  rect(ctx, gripX, gripY + 1, 2, 4, '#684438');
}

function drawHeroDown(ctx, frame, pose, width, height) {
  const idleLift = pose.state === 'idle' && pose.step % 3 === 1 ? -1 : 0;
  const walkPhase = pose.state === 'walk' ? pose.step % 3 : 0;
  const isAttack = pose.state === 'attack';
  const isHurt = pose.state === 'hurt';
  const lean = isHurt ? -2 : isAttack ? 1 : 0;
  const baseY = 7 + idleLift;
  const centerX = Math.round(width / 2) + lean;

  pixelShadow(ctx, width / 2, height - 6, 22);

  const leftFootY = height - 10 - (walkPhase === 1 ? 2 : 0);
  const rightFootY = height - 10 - (walkPhase === 2 ? 2 : 0);
  rect(ctx, centerX - 8, leftFootY, 6, 7, COLORS.outline);
  rect(ctx, centerX + 2, rightFootY, 6, 7, COLORS.outline);
  rect(ctx, centerX - 7, leftFootY, 4, 5, '#596b63');
  rect(ctx, centerX + 3, rightFootY, 4, 5, '#596b63');
  rect(ctx, centerX - 9, leftFootY + 5, 7, 2, '#1b2824');
  rect(ctx, centerX + 2, rightFootY + 5, 7, 2, '#1b2824');

  rect(ctx, centerX - 10, baseY + 17, 20, 24, COLORS.outline);
  rect(ctx, centerX - 8, baseY + 17, 16, 21, COLORS.paleRobe);
  rect(ctx, centerX - 7, baseY + 20, 5, 16, COLORS.robeLight);
  rect(ctx, centerX + 3, baseY + 20, 4, 18, COLORS.robeShade);
  rect(ctx, centerX - 1, baseY + 20, 2, 18, '#7d9588');
  rect(ctx, centerX - 9, baseY + 27, 18, 4, COLORS.outline);
  rect(ctx, centerX - 8, baseY + 27, 16, 2, COLORS.jade);
  rect(ctx, centerX - 2, baseY + 26, 4, 4, COLORS.jadeLight);
  rect(ctx, centerX - 1, baseY + 27, 2, 2, COLORS.brass);

  const leftArmY = baseY + 20 + (walkPhase === 2 ? 2 : 0);
  const rightArmY = baseY + 20 + (walkPhase === 1 ? 2 : 0);
  if (!isAttack) {
    rect(ctx, centerX - 14, leftArmY, 6, 16, COLORS.outline);
    rect(ctx, centerX - 13, leftArmY + 1, 4, 13, COLORS.robeShade);
    rect(ctx, centerX + 8, rightArmY, 6, 16, COLORS.outline);
    rect(ctx, centerX + 9, rightArmY + 1, 4, 13, COLORS.paleRobe);
    rect(ctx, centerX - 13, leftArmY + 13, 4, 3, COLORS.skinShade);
    rect(ctx, centerX + 9, rightArmY + 13, 4, 3, COLORS.skin);
  } else if (pose.step === 0) {
    rect(ctx, centerX - 13, baseY + 21, 5, 14, COLORS.outline);
    rect(ctx, centerX - 12, baseY + 22, 3, 11, COLORS.robeShade);
    rect(ctx, centerX + 7, baseY + 17, 9, 6, COLORS.outline);
    rect(ctx, centerX + 8, baseY + 18, 7, 4, COLORS.paleRobe);
    drawSword(ctx, [[centerX + 13, baseY + 17], [centerX + 19, baseY + 9], [centerX + 22, baseY + 2]], true);
  } else {
    rect(ctx, centerX - 13, baseY + 22, 6, 11, COLORS.outline);
    rect(ctx, centerX - 12, baseY + 23, 4, 8, COLORS.robeShade);
    rect(ctx, centerX + 7, baseY + 23, 10, 6, COLORS.outline);
    rect(ctx, centerX + 8, baseY + 24, 8, 4, COLORS.paleRobe);
    drawSword(ctx, [[centerX + 14, baseY + 25], [centerX + 22, baseY + 20], [centerX + 31, baseY + 19]]);
    stairLine(ctx, [[centerX + 17, baseY + 15], [centerX + 27, baseY + 12], [centerX + 34, baseY + 14]], 1, 'rgba(131, 210, 162, 0.8)');
  }

  rect(ctx, centerX - 8, baseY + 4, 16, 15, COLORS.outline);
  rect(ctx, centerX - 6, baseY + 6, 12, 11, COLORS.skin);
  rect(ctx, centerX - 6, baseY + 5, 12, 5, COLORS.deepInk);
  rect(ctx, centerX - 8, baseY + 8, 3, 7, COLORS.deepInk);
  rect(ctx, centerX + 5, baseY + 8, 3, 7, COLORS.deepInk);
  rect(ctx, centerX - 4, baseY + 11, 2, 2, isHurt ? COLORS.cinnabar : COLORS.outline);
  rect(ctx, centerX + 2, baseY + 11, 2, 2, COLORS.outline);
  rect(ctx, centerX - 2, baseY + 15, 4, 1, COLORS.skinShade);

  rect(ctx, centerX - 5, baseY, 10, 6, COLORS.outline);
  rect(ctx, centerX - 3, baseY - 3, 6, 4, COLORS.deepInk);
  rect(ctx, centerX - 1, baseY - 5, 2, 3, COLORS.brass);
  rect(ctx, centerX - 5, baseY + 2, 10, 2, '#314740');

  if (!isAttack) {
    rect(ctx, centerX + 9, baseY + 26, 3, 15, COLORS.outline);
    rect(ctx, centerX + 10, baseY + 27, 1, 12, '#694539');
    rect(ctx, centerX + 8, baseY + 26, 5, 2, COLORS.brass);
  }

  if (isHurt) {
    rect(ctx, centerX - 9, baseY + 19, 3, 8, COLORS.cinnabar);
    rect(ctx, centerX - 6, baseY + 21, 2, 4, '#e17a61');
  }

  if (frame === 13) {
    rect(ctx, centerX - 10, baseY + 18, 2, 2, COLORS.jadeLight);
    rect(ctx, centerX + 8, baseY + 16, 2, 2, COLORS.jadeLight);
  }
}

function drawHeroUp(ctx, pose, width, height) {
  const step = pose.step % 4;
  const bob = step === 1 || step === 3 ? -1 : 0;
  const centerX = Math.round(width / 2);
  const baseY = 7 + bob;

  pixelShadow(ctx, width / 2, height - 6, 22);
  const leftLift = step === 1 ? 2 : 0;
  const rightLift = step === 3 ? 2 : 0;
  rect(ctx, centerX - 8, height - 10 - leftLift, 6, 7, COLORS.outline);
  rect(ctx, centerX + 2, height - 10 - rightLift, 6, 7, COLORS.outline);
  rect(ctx, centerX - 7, height - 9 - leftLift, 4, 4, '#53665d');
  rect(ctx, centerX + 3, height - 9 - rightLift, 4, 4, '#53665d');

  rect(ctx, centerX - 10, baseY + 17, 20, 24, COLORS.outline);
  rect(ctx, centerX - 8, baseY + 18, 16, 20, COLORS.robeShade);
  rect(ctx, centerX - 6, baseY + 19, 6, 18, COLORS.paleRobe);
  rect(ctx, centerX + 2, baseY + 19, 4, 18, '#92a89b');
  rect(ctx, centerX - 9, baseY + 27, 18, 4, COLORS.outline);
  rect(ctx, centerX - 8, baseY + 28, 16, 2, COLORS.jade);

  rect(ctx, centerX - 14, baseY + 20 + (step === 2 ? 2 : 0), 6, 15, COLORS.outline);
  rect(ctx, centerX - 13, baseY + 21 + (step === 2 ? 2 : 0), 4, 12, COLORS.robeShade);
  rect(ctx, centerX + 8, baseY + 20 + (step === 0 ? 2 : 0), 6, 15, COLORS.outline);
  rect(ctx, centerX + 9, baseY + 21 + (step === 0 ? 2 : 0), 4, 12, COLORS.paleRobe);

  rect(ctx, centerX - 8, baseY + 4, 16, 15, COLORS.outline);
  rect(ctx, centerX - 6, baseY + 6, 12, 11, COLORS.deepInk);
  rect(ctx, centerX - 7, baseY + 12, 3, 10, COLORS.deepInk);
  rect(ctx, centerX + 4, baseY + 12, 3, 10, COLORS.deepInk);
  rect(ctx, centerX - 4, baseY + 8, 8, 4, '#314740');
  rect(ctx, centerX - 5, baseY, 10, 6, COLORS.outline);
  rect(ctx, centerX - 3, baseY - 3, 6, 4, COLORS.deepInk);
  rect(ctx, centerX - 1, baseY - 5, 2, 3, COLORS.brass);

  rect(ctx, centerX + 9, baseY + 23, 3, 17, COLORS.outline);
  rect(ctx, centerX + 10, baseY + 24, 1, 13, '#694539');
  rect(ctx, centerX + 8, baseY + 23, 5, 2, COLORS.brass);
}

function drawFallenHero(ctx, pose, width, height) {
  const finalFrame = pose.step > 0;
  const groundY = height - 9;
  pixelShadow(ctx, width / 2, height - 6, 29);

  if (!finalFrame) {
    rect(ctx, 7, groundY - 21, 10, 13, COLORS.outline);
    rect(ctx, 9, groundY - 20, 7, 10, COLORS.skin);
    rect(ctx, 14, groundY - 17, 17, 13, COLORS.outline);
    rect(ctx, 15, groundY - 15, 14, 10, COLORS.paleRobe);
    rect(ctx, 15, groundY - 9, 15, 3, COLORS.jade);
    rect(ctx, 28, groundY - 9, 5, 9, COLORS.outline);
    rect(ctx, 29, groundY - 8, 3, 7, '#53665d');
    rect(ctx, 8, groundY - 24, 8, 5, COLORS.deepInk);
    rect(ctx, 7, groundY - 25, 4, 3, COLORS.deepInk);
  } else {
    rect(ctx, 4, groundY - 12, 29, 12, COLORS.outline);
    rect(ctx, 6, groundY - 10, 12, 8, COLORS.paleRobe);
    rect(ctx, 17, groundY - 9, 13, 7, COLORS.robeShade);
    rect(ctx, 16, groundY - 11, 3, 10, COLORS.jade);
    rect(ctx, 2, groundY - 10, 8, 8, COLORS.outline);
    rect(ctx, 3, groundY - 9, 6, 5, COLORS.skinShade);
    rect(ctx, 2, groundY - 12, 7, 4, COLORS.deepInk);
    rect(ctx, 29, groundY - 7, 6, 5, '#53665d');
  }
  drawSword(ctx, [[7, groundY - 1], [18, groundY - 3], [31, groundY - 2]]);
}

function drawHero(ctx, frame, pose, width, height) {
  if (pose.state === 'die') {
    drawFallenHero(ctx, pose, width, height);
  } else if (pose.state === 'walk_up') {
    drawHeroUp(ctx, pose, width, height);
  } else {
    drawHeroDown(ctx, frame, pose, width, height);
  }
}

function drawMurkwaterSpirit(ctx, frame, _pose, width, height) {
  const centerX = Math.round(width / 2);
  const groundY = height - 6;
  const phase = frame === 1 ? 1 : frame === 2 ? 2 : frame === 3 ? 3 : 0;
  const hurt = frame === 4;
  const bodyWidth = hurt ? 27 : phase === 1 ? 31 : phase === 3 ? 36 : 34;
  const bodyHeight = hurt ? 15 : phase === 2 ? 25 : phase === 1 ? 20 : 22;
  const bodyX = centerX - Math.round(bodyWidth / 2) + (phase === 3 ? 3 : 0);
  const bodyY = groundY - bodyHeight;

  pixelShadow(ctx, centerX, groundY + 1, 34);
  rect(ctx, bodyX + 4, bodyY - 3, bodyWidth - 8, 5, COLORS.outline);
  rect(ctx, bodyX, bodyY + 2, bodyWidth, bodyHeight - 4, COLORS.outline);
  rect(ctx, bodyX + 3, bodyY, bodyWidth - 6, bodyHeight - 1, hurt ? '#536965' : '#315f59');
  rect(ctx, bodyX + 6, bodyY + 2, bodyWidth - 13, 6, hurt ? '#70837d' : '#43857a');
  rect(ctx, bodyX + 5, groundY - 5, 6, 4, '#1e4642');
  rect(ctx, bodyX + bodyWidth - 12, groundY - 4, 8, 3, '#1e4642');

  const eyeY = bodyY + Math.max(6, Math.floor(bodyHeight * 0.42));
  rect(ctx, centerX - 8, eyeY, 5, 4, COLORS.outline);
  rect(ctx, centerX + 3, eyeY, 5, 4, COLORS.outline);
  rect(ctx, centerX - 7, eyeY, 2, 2, hurt ? COLORS.cinnabar : COLORS.jadeLight);
  rect(ctx, centerX + 4, eyeY, 2, 2, hurt ? COLORS.cinnabar : COLORS.jadeLight);
  rect(ctx, centerX - 2, bodyY + 4, 4, 4, COLORS.jadeLight);
  rect(ctx, centerX - 1, bodyY + 3, 2, 8, 'rgba(131, 210, 162, 0.58)');

  if (phase === 2) {
    rect(ctx, bodyX + 2, bodyY + 5, 3, 7, '#6ca096');
    rect(ctx, bodyX + bodyWidth - 5, bodyY + 7, 3, 5, '#6ca096');
  }
  if (hurt) {
    rect(ctx, centerX - 3, eyeY + 7, 7, 2, COLORS.cinnabar);
  }
}

function drawSoulBat(ctx, frame, _pose, width, height) {
  const centerX = Math.round(width / 2);
  const centerY = Math.round(height / 2) + (frame === 3 ? -2 : frame === 4 ? 3 : 0);
  const wingUp = frame === 3;
  const folded = frame === 4;

  pixelShadow(ctx, centerX, height - 5, folded ? 20 : 30);
  if (folded) {
    rect(ctx, centerX - 14, centerY - 5, 8, 16, COLORS.outline);
    rect(ctx, centerX + 6, centerY - 5, 8, 16, COLORS.outline);
    rect(ctx, centerX - 12, centerY - 3, 6, 11, '#37433f');
    rect(ctx, centerX + 6, centerY - 3, 6, 11, '#37433f');
  } else if (wingUp) {
    rect(ctx, centerX - 21, centerY - 13, 9, 6, COLORS.outline);
    rect(ctx, centerX - 18, centerY - 9, 12, 10, COLORS.outline);
    rect(ctx, centerX + 12, centerY - 13, 9, 6, COLORS.outline);
    rect(ctx, centerX + 6, centerY - 9, 12, 10, COLORS.outline);
    rect(ctx, centerX - 19, centerY - 11, 6, 3, '#4f5b56');
    rect(ctx, centerX - 16, centerY - 7, 9, 6, '#3b4944');
    rect(ctx, centerX + 13, centerY - 11, 6, 3, '#4f5b56');
    rect(ctx, centerX + 7, centerY - 7, 9, 6, '#3b4944');
  } else {
    rect(ctx, centerX - 22, centerY - 2, 16, 9, COLORS.outline);
    rect(ctx, centerX + 6, centerY - 2, 16, 9, COLORS.outline);
    rect(ctx, centerX - 19, centerY, 13, 5, '#46544e');
    rect(ctx, centerX + 6, centerY, 13, 5, '#46544e');
    rect(ctx, centerX - 22, centerY + 6, 7, 4, COLORS.outline);
    rect(ctx, centerX + 15, centerY + 6, 7, 4, COLORS.outline);
  }

  rect(ctx, centerX - 7, centerY - 7, 14, 18, COLORS.outline);
  rect(ctx, centerX - 5, centerY - 5, 10, 14, '#293631');
  rect(ctx, centerX - 8, centerY - 11, 5, 7, COLORS.outline);
  rect(ctx, centerX + 3, centerY - 11, 5, 7, COLORS.outline);
  rect(ctx, centerX - 6, centerY - 8, 3, 4, '#68433f');
  rect(ctx, centerX + 3, centerY - 8, 3, 4, '#68433f');
  rect(ctx, centerX - 4, centerY - 2, 3, 3, COLORS.cinnabar);
  rect(ctx, centerX + 1, centerY - 2, 3, 3, COLORS.cinnabar);
  rect(ctx, centerX - 1, centerY + 1, 2, 7, '#6f3530');
  rect(ctx, centerX - 4, centerY + 10, 3, 4, COLORS.outline);
  rect(ctx, centerX + 1, centerY + 10, 3, 4, COLORS.outline);
}

function drawSoulSpider(ctx, frame, _pose, width, height) {
  const centerX = Math.round(width / 2);
  const groundY = height - 5;
  const compressed = frame === 4;
  const splayed = frame === 5;
  const bodyY = compressed ? groundY - 14 : groundY - 18;
  const legShift = frame === 1 || splayed ? 3 : 0;

  pixelShadow(ctx, centerX, groundY + 1, 36);
  const legColor = COLORS.outline;
  const innerLeg = '#394740';
  const leftStarts = [centerX - 8, centerX - 7, centerX - 6, centerX - 5];
  for (let i = 0; i < 4; i += 1) {
    const y = bodyY + 3 + i * 3;
    const extent = 13 + ((i + legShift) % 3) * 2;
    stairLine(ctx, [[leftStarts[i], y], [centerX - extent, y + (i < 2 ? -5 : 5)], [centerX - extent - 4, groundY - (i % 2)]], 3, legColor);
    stairLine(ctx, [[leftStarts[i], y], [centerX - extent, y + (i < 2 ? -5 : 5)], [centerX - extent - 4, groundY - (i % 2)]], 1, innerLeg);
    stairLine(ctx, [[centerX + 5 + i, y], [centerX + extent, y + (i < 2 ? -5 : 5)], [centerX + extent + 4, groundY - ((i + 1) % 2)]], 3, legColor);
    stairLine(ctx, [[centerX + 5 + i, y], [centerX + extent, y + (i < 2 ? -5 : 5)], [centerX + extent + 4, groundY - ((i + 1) % 2)]], 1, innerLeg);
  }

  rect(ctx, centerX - 11, bodyY - 5, 22, 17, COLORS.outline);
  rect(ctx, centerX - 9, bodyY - 3, 18, 13, '#2b3632');
  rect(ctx, centerX - 7, bodyY - 1, 14, 5, '#454b48');
  rect(ctx, centerX - 7, bodyY + 5, 14, 3, '#251e24');
  rect(ctx, centerX - 3, bodyY + 2, 6, 7, COLORS.cinnabar);
  rect(ctx, centerX - 1, bodyY, 2, 11, '#e1745e');

  rect(ctx, centerX - 8, bodyY - 10, 16, 8, COLORS.outline);
  rect(ctx, centerX - 6, bodyY - 8, 12, 5, '#333e39');
  rect(ctx, centerX - 5, bodyY - 7, 3, 2, COLORS.cinnabar);
  rect(ctx, centerX + 2, bodyY - 7, 3, 2, COLORS.cinnabar);
  rect(ctx, centerX - 7, bodyY - 3, 3, 4, COLORS.steelShade);
  rect(ctx, centerX + 4, bodyY - 3, 3, 4, COLORS.steelShade);
}

function drawMountainDemon(ctx, frame, _pose, width, height) {
  const centerX = Math.round(width / 2);
  const groundY = height - 5;
  const attack = frame === 4 || frame === 5;
  const fallen = frame === 0;
  const walkStep = frame === 3 ? 1 : 0;

  pixelShadow(ctx, centerX, groundY + 1, fallen ? 34 : 28);
  if (fallen) {
    rect(ctx, centerX - 18, groundY - 12, 33, 12, COLORS.outline);
    rect(ctx, centerX - 15, groundY - 10, 19, 8, '#60685c');
    rect(ctx, centerX + 2, groundY - 9, 11, 7, '#814a3c');
    rect(ctx, centerX - 19, groundY - 10, 9, 8, '#3d463f');
    rect(ctx, centerX - 18, groundY - 8, 4, 3, COLORS.cinnabar);
    stairLine(ctx, [[centerX - 12, groundY - 1], [centerX + 2, groundY - 4], [centerX + 19, groundY - 3]], 3, COLORS.outline);
    stairLine(ctx, [[centerX - 12, groundY - 1], [centerX + 2, groundY - 4], [centerX + 19, groundY - 3]], 1, '#75543a');
    return;
  }

  const lean = attack ? 3 : 0;
  const bodyX = centerX + lean;
  rect(ctx, bodyX - 10, groundY - 14 - (walkStep ? 2 : 0), 7, 12, COLORS.outline);
  rect(ctx, bodyX + 3, groundY - 14, 7, 12, COLORS.outline);
  rect(ctx, bodyX - 8, groundY - 12 - (walkStep ? 2 : 0), 4, 9, '#4b554d');
  rect(ctx, bodyX + 4, groundY - 12, 4, 9, '#4b554d');
  rect(ctx, bodyX - 11, groundY - 26, 22, 16, COLORS.outline);
  rect(ctx, bodyX - 9, groundY - 24, 18, 13, '#626b5f');
  rect(ctx, bodyX - 8, groundY - 16, 16, 5, '#6e3e35');
  rect(ctx, bodyX - 2, groundY - 17, 4, 5, COLORS.brass);

  if (attack) {
    rect(ctx, bodyX - 14, groundY - 24, 6, 13, COLORS.outline);
    rect(ctx, bodyX - 12, groundY - 22, 3, 9, '#59645a');
    const reach = frame === 5 ? 27 : 20;
    stairLine(ctx, [[bodyX + 8, groundY - 21], [bodyX + reach - 7, groundY - 25], [bodyX + reach, groundY - 23]], 4, COLORS.outline);
    stairLine(ctx, [[bodyX + 8, groundY - 21], [bodyX + reach - 7, groundY - 25], [bodyX + reach, groundY - 23]], 2, '#725139');
    rect(ctx, bodyX + reach - 2, groundY - 27, 5, 8, '#8c958a');
  } else {
    rect(ctx, bodyX - 15, groundY - 24 + (walkStep ? 2 : 0), 7, 14, COLORS.outline);
    rect(ctx, bodyX - 13, groundY - 22 + (walkStep ? 2 : 0), 4, 10, '#59645a');
    rect(ctx, bodyX + 8, groundY - 24 - (walkStep ? 1 : 0), 7, 14, COLORS.outline);
    rect(ctx, bodyX + 9, groundY - 22 - (walkStep ? 1 : 0), 4, 10, '#59645a');
    stairLine(ctx, [[bodyX + 12, groundY - 12], [bodyX + 16, groundY - 25], [bodyX + 17, groundY - 34]], 3, COLORS.outline);
    stairLine(ctx, [[bodyX + 12, groundY - 12], [bodyX + 16, groundY - 25], [bodyX + 17, groundY - 34]], 1, '#725139');
  }

  rect(ctx, bodyX - 10, groundY - 38, 20, 14, COLORS.outline);
  rect(ctx, bodyX - 8, groundY - 36, 16, 11, '#535c54');
  rect(ctx, bodyX - 12, groundY - 35, 5, 8, COLORS.outline);
  rect(ctx, bodyX + 7, groundY - 35, 5, 8, COLORS.outline);
  rect(ctx, bodyX - 11, groundY - 33, 3, 5, '#747e70');
  rect(ctx, bodyX + 8, groundY - 33, 3, 5, '#747e70');
  rect(ctx, bodyX - 7, groundY - 35, 14, 8, '#8d4c3f');
  rect(ctx, bodyX - 5, groundY - 33, 3, 2, '#f0b35e');
  rect(ctx, bodyX + 2, groundY - 33, 3, 2, '#f0b35e');
  rect(ctx, bodyX - 2, groundY - 29, 4, 2, '#d8c7a2');
  rect(ctx, bodyX - 7, groundY - 41, 5, 5, COLORS.outline);
  rect(ctx, bodyX + 2, groundY - 41, 5, 5, COLORS.outline);
  rect(ctx, bodyX - 5, groundY - 40, 3, 4, '#8f8170');
  rect(ctx, bodyX + 2, groundY - 40, 3, 4, '#8f8170');
}

const DRAWERS = Object.freeze({
  hero: drawHero,
  slime: drawMurkwaterSpirit,
  bat: drawSoulBat,
  spider: drawSoulSpider,
  goblin: drawMountainDemon
});

const POSE_PRIORITY = Object.freeze(['die', 'hurt', 'attack', 'walk_up', 'walk', 'idle']);

function resolvePose(config, frame) {
  for (const state of POSE_PRIORITY) {
    const frames = config.anims?.[state]?.frames;
    const step = frames?.indexOf(frame) ?? -1;
    if (step >= 0) return { state, step, total: frames.length };
  }
  return { state: 'idle', step: 0, total: 1 };
}

function makePixelCanvas(display, drawFrame) {
  const width = Math.max(1, Math.round(display.w));
  const height = Math.max(1, Math.round(display.h));
  const canvas = document.createElement('canvas');
  canvas.width = width * SCALE;
  canvas.height = height * SCALE;

  const ctx = canvas.getContext('2d');
  if (!ctx) throw new Error('Unable to create a 2D canvas for xianxia character textures');
  ctx.imageSmoothingEnabled = false;
  ctx.scale(SCALE, SCALE);
  drawFrame(ctx, width, height);
  ctx.setTransform(1, 0, 0, 1, 0, 0);
  ctx.imageSmoothingEnabled = false;
  return canvas;
}

function replaceCanvasTexture(scene, key, canvas) {
  if (scene.textures.exists(key)) scene.textures.remove(key);
  scene.textures.addCanvas(key, canvas);
}

/**
 * Replaces the configured hero and nearby-enemy frames with transparent,
 * high-contrast xianxia pixel art while preserving every existing frame key.
 */
export function installXianxiaCharacterTextures(scene, characters) {
  if (!scene?.textures || !characters) return;

  for (const [characterName, drawCharacter] of Object.entries(DRAWERS)) {
    const config = characters[characterName];
    if (!config?.prefix || !Array.isArray(config.frames) || !config.display) continue;

    for (const frame of config.frames) {
      const pose = resolvePose(config, frame);
      const frameKey = `${config.prefix}_${String(frame).padStart(2, '0')}`;
      const canvas = makePixelCanvas(config.display, (ctx, width, height) => {
        drawCharacter(ctx, frame, pose, width, height);
      });
      replaceCanvasTexture(scene, frameKey, canvas);
    }
  }
}
