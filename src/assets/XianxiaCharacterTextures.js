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

function drawShadeSoldier(ctx, frame, _pose, width, height) {
  const centerX = Math.round(width / 2);
  const groundY = height - 5;
  const hurt = frame === 1;
  const walkStep = frame === 3 ? 1 : frame === 4 ? 2 : frame === 5 ? 3 : 0;
  const thrust = frame === 5;
  const lean = hurt ? -2 : thrust ? 2 : 0;
  const bodyX = centerX + lean;
  const bone = '#c9c3ae';
  const armor = '#4c5a50';
  const armorLight = '#66776a';
  const armorDark = '#323d36';

  pixelShadow(ctx, centerX, groundY + 1, 26);

  const leftLift = walkStep === 1 ? 2 : 0;
  const rightLift = walkStep === 3 ? 2 : 0;
  rect(ctx, bodyX - 8, groundY - 9 - leftLift, 6, 9, COLORS.outline);
  rect(ctx, bodyX + 2, groundY - 9 - rightLift, 6, 9, COLORS.outline);
  rect(ctx, bodyX - 7, groundY - 8 - leftLift, 4, 6, armorDark);
  rect(ctx, bodyX + 3, groundY - 8 - rightLift, 4, 6, armorDark);

  // 兵俑甲身：横向札甲条
  rect(ctx, bodyX - 10, groundY - 27, 20, 19, COLORS.outline);
  rect(ctx, bodyX - 8, groundY - 25, 16, 16, armor);
  rect(ctx, bodyX - 8, groundY - 22, 16, 2, armorDark);
  rect(ctx, bodyX - 8, groundY - 17, 16, 2, armorDark);
  rect(ctx, bodyX - 8, groundY - 12, 16, 2, armorDark);
  rect(ctx, bodyX - 7, groundY - 25, 5, 2, armorLight);
  rect(ctx, bodyX - 2, groundY - 20, 4, 5, COLORS.brass);
  if (hurt) {
    rect(ctx, bodyX - 5, groundY - 21, 3, 8, COLORS.cinnabar);
    rect(ctx, bodyX - 3, groundY - 18, 2, 3, '#e17a61');
  }

  // 持戈臂（右）与护臂（左）
  const armY = groundY - 24 + (walkStep === 2 ? 1 : 0);
  rect(ctx, bodyX - 14, armY, 5, 13, COLORS.outline);
  rect(ctx, bodyX - 13, armY + 1, 3, 10, armorDark);
  if (thrust) {
    rect(ctx, bodyX + 8, groundY - 24, 10, 5, COLORS.outline);
    rect(ctx, bodyX + 9, groundY - 23, 8, 3, armor);
  } else {
    rect(ctx, bodyX + 9, armY, 5, 13, COLORS.outline);
    rect(ctx, bodyX + 10, armY + 1, 3, 10, armor);
  }

  // 长戈：竖杆 + 横刃
  if (thrust) {
    stairLine(ctx, [[bodyX + 14, groundY - 22], [bodyX + 20, groundY - 22]], 3, COLORS.outline);
    stairLine(ctx, [[bodyX + 14, groundY - 22], [bodyX + 19, groundY - 22]], 1, '#6b4a35');
    rect(ctx, bodyX + 17, groundY - 27, 3, 10, COLORS.outline);
    rect(ctx, bodyX + 18, groundY - 26, 1, 8, COLORS.steel);
    stairLine(ctx, [[bodyX + 20, groundY - 24], [bodyX + 26, groundY - 23]], 2, 'rgba(131, 210, 162, 0.7)');
  } else {
    const poleX = bodyX + (frame === 4 ? 13 : 11);
    rect(ctx, poleX, groundY - 38, 3, 34, COLORS.outline);
    rect(ctx, poleX + 1, groundY - 37, 1, 31, '#6b4a35');
    rect(ctx, poleX - 5, groundY - 37, 9, 3, COLORS.outline);
    rect(ctx, poleX - 4, groundY - 36, 6, 1, COLORS.steel);
  }

  // 头：兵俑盔 + 骨面 + 阴火目
  const headY = groundY - 40 + (hurt ? 2 : 0);
  rect(ctx, bodyX - 7, headY, 14, 14, COLORS.outline);
  rect(ctx, bodyX - 5, headY + 3, 10, 9, bone);
  rect(ctx, bodyX - 6, headY + 1, 12, 4, armorDark);
  rect(ctx, bodyX - 8, headY + 3, 3, 6, armorDark);
  rect(ctx, bodyX + 5, headY + 3, 3, 6, armorDark);
  rect(ctx, bodyX - 1, headY - 3, 2, 4, COLORS.outline);
  rect(ctx, bodyX - 1, headY - 2, 2, 2, COLORS.cinnabar);
  const eyeColor = hurt ? COLORS.cinnabar : COLORS.jadeLight;
  rect(ctx, bodyX - 4, headY + 6, 3, 3, COLORS.outline);
  rect(ctx, bodyX + 1, headY + 6, 3, 3, COLORS.outline);
  rect(ctx, bodyX - 3, headY + 6, 2, 2, eyeColor);
  rect(ctx, bodyX + 2, headY + 6, 2, 2, eyeColor);
  rect(ctx, bodyX - 2, headY + 10, 4, 1, '#8f8a77');
}

function drawDemonBrute(ctx, frame, _pose, width, height) {
  const centerX = Math.round(width / 2);
  const groundY = height - 5;
  const crouch = frame === 1;
  const walkStep = frame === 2 ? 1 : frame === 3 ? 2 : frame === 4 ? 3 : 0;
  const windup = frame === 3;
  const smash = frame === 4;
  const bodyX = centerX + (smash ? 2 : 0);
  const bodyLift = crouch ? 2 : 0;
  const hide = '#7c4636';
  const hideLight = '#96604a';
  const furDark = '#3c342c';
  const fur = '#57493c';

  pixelShadow(ctx, centerX, groundY + 1, 34);

  const leftLift = walkStep === 1 ? 2 : 0;
  const rightLift = walkStep === 3 ? 2 : 0;
  rect(ctx, bodyX - 11, groundY - 10 - leftLift, 8, 10, COLORS.outline);
  rect(ctx, bodyX + 3, groundY - 10 - rightLift, 8, 10, COLORS.outline);
  rect(ctx, bodyX - 10, groundY - 9 - leftLift, 6, 7, hide);
  rect(ctx, bodyX + 4, groundY - 9 - rightLift, 6, 7, hide);

  // 兽皮围裙 + 宽厚躯干
  rect(ctx, bodyX - 13, groundY - 32 + bodyLift, 26, 24, COLORS.outline);
  rect(ctx, bodyX - 11, groundY - 30 + bodyLift, 22, 20, hide);
  rect(ctx, bodyX - 11, groundY - 24 + bodyLift, 22, 3, hideLight);
  rect(ctx, bodyX - 11, groundY - 15 + bodyLift, 22, 6, fur);
  rect(ctx, bodyX - 9, groundY - 13 + bodyLift, 4, 4, furDark);
  rect(ctx, bodyX + 2, groundY - 14 + bodyLift, 5, 5, furDark);
  rect(ctx, bodyX - 3, groundY - 22 + bodyLift, 6, 6, COLORS.brass);
  rect(ctx, bodyX - 2, groundY - 21 + bodyLift, 4, 4, '#8a6a35');

  // 铁肩甲
  rect(ctx, bodyX - 17, groundY - 34 + bodyLift, 10, 9, COLORS.outline);
  rect(ctx, bodyX - 16, groundY - 33 + bodyLift, 8, 6, COLORS.steelShade);
  rect(ctx, bodyX + 7, groundY - 34 + bodyLift, 10, 9, COLORS.outline);
  rect(ctx, bodyX + 8, groundY - 33 + bodyLift, 8, 6, COLORS.steelShade);

  // 臂与石锤
  if (smash) {
    stairLine(ctx, [[bodyX + 10, groundY - 28], [bodyX + 17, groundY - 20], [bodyX + 20, groundY - 14]], 4, COLORS.outline);
    stairLine(ctx, [[bodyX + 10, groundY - 28], [bodyX + 17, groundY - 20], [bodyX + 19, groundY - 15]], 2, hideLight);
    rect(ctx, bodyX + 16, groundY - 14, 12, 10, COLORS.outline);
    rect(ctx, bodyX + 18, groundY - 12, 8, 6, '#6d7a72');
    rect(ctx, bodyX + 18, groundY - 12, 8, 2, '#8c958a');
    stairLine(ctx, [[bodyX + 12, groundY - 6], [bodyX + 20, groundY - 3], [bodyX + 28, groundY - 5]], 1, 'rgba(198, 154, 85, 0.75)');
  } else if (windup) {
    stairLine(ctx, [[bodyX + 10, groundY - 30], [bodyX + 15, groundY - 38], [bodyX + 17, groundY - 43]], 4, COLORS.outline);
    stairLine(ctx, [[bodyX + 10, groundY - 30], [bodyX + 15, groundY - 38], [bodyX + 16, groundY - 42]], 2, hideLight);
    rect(ctx, bodyX + 13, groundY - 51, 12, 10, COLORS.outline);
    rect(ctx, bodyX + 15, groundY - 49, 8, 6, '#6d7a72');
  } else {
    stairLine(ctx, [[bodyX + 10, groundY - 29 + bodyLift], [bodyX + 14, groundY - 20], [bodyX + 14, groundY - 13]], 4, COLORS.outline);
    stairLine(ctx, [[bodyX + 10, groundY - 29 + bodyLift], [bodyX + 14, groundY - 21], [bodyX + 14, groundY - 14]], 2, hideLight);
    rect(ctx, bodyX + 11, groundY - 40, 3, 28, COLORS.outline);
    rect(ctx, bodyX + 12, groundY - 39, 1, 26, '#6b4a35');
    rect(ctx, bodyX + 8, groundY - 48, 12, 10, COLORS.outline);
    rect(ctx, bodyX + 10, groundY - 46, 8, 6, '#6d7a72');
    rect(ctx, bodyX + 10, groundY - 46, 8, 2, '#8c958a');
  }
  stairLine(ctx, [[bodyX - 10, groundY - 29 + bodyLift], [bodyX - 15, groundY - 21], [bodyX - 14, groundY - 13]], 4, COLORS.outline);
  stairLine(ctx, [[bodyX - 10, groundY - 29 + bodyLift], [bodyX - 15, groundY - 22], [bodyX - 14, groundY - 14]], 2, hide);

  // 牛角兽面
  const headY = groundY - 46 + bodyLift + (crouch ? 2 : 0);
  rect(ctx, bodyX - 9, headY, 18, 14, COLORS.outline);
  rect(ctx, bodyX - 7, headY + 2, 14, 11, hide);
  rect(ctx, bodyX - 6, headY + 5, 12, 7, '#8d4c3f');
  stairLine(ctx, [[bodyX - 10, headY + 3], [bodyX - 14, headY - 2], [bodyX - 15, headY - 6]], 3, COLORS.outline);
  stairLine(ctx, [[bodyX - 10, headY + 3], [bodyX - 14, headY - 2], [bodyX - 15, headY - 5]], 1, '#d8c7a2');
  stairLine(ctx, [[bodyX + 9, headY + 3], [bodyX + 13, headY - 2], [bodyX + 14, headY - 6]], 3, COLORS.outline);
  stairLine(ctx, [[bodyX + 9, headY + 3], [bodyX + 13, headY - 2], [bodyX + 14, headY - 5]], 1, '#d8c7a2');
  const eyeColor = crouch ? COLORS.cinnabar : '#f0b35e';
  rect(ctx, bodyX - 5, headY + 6, 3, 2, eyeColor);
  rect(ctx, bodyX + 2, headY + 6, 3, 2, eyeColor);
  rect(ctx, bodyX - 3, headY + 10, 6, 2, '#d8c7a2');
  rect(ctx, bodyX - 4, headY + 9, 2, 3, '#e8e0cb');
  rect(ctx, bodyX + 2, headY + 9, 2, 3, '#e8e0cb');
}

function drawKarmicFlameCultist(ctx, frame, _pose, width, height) {
  const centerX = Math.round(width / 2);
  const groundY = height - 5;
  const raise = frame === 3;
  const release = frame === 5;
  const walkStep = frame === 1 ? 1 : frame === 2 ? 2 : release ? 3 : 0;
  const lean = release ? 3 : 0;
  const bodyX = centerX + lean;
  const robe = '#2c2320';
  const robeLight = '#463732';
  const robeTrim = '#8a3a30';
  const flame = '#e6842f';
  const flameCore = '#f4c05e';

  pixelShadow(ctx, centerX, groundY + 1, 26);

  // 破损道袍下摆：锯齿边
  rect(ctx, bodyX - 11, groundY - 26, 22, 22, COLORS.outline);
  rect(ctx, bodyX - 9, groundY - 24, 18, 19, robe);
  rect(ctx, bodyX - 9, groundY - 24, 5, 16, robeLight);
  for (let i = 0; i < 5; i += 1) {
    const fx = bodyX - 9 + i * 4;
    const drop = (i + walkStep) % 2 === 0 ? 0 : 3;
    rect(ctx, fx, groundY - 6 + drop, 3, 3, robe);
    rect(ctx, fx, groundY - 3 + drop, 3, 2, COLORS.outline);
  }
  rect(ctx, bodyX - 9, groundY - 16, 18, 2, robeTrim);
  rect(ctx, bodyX - 2, groundY - 22, 4, 8, robeTrim);
  rect(ctx, bodyX - 1, groundY - 20, 2, 4, COLORS.brass);

  // 符箓腰牌
  rect(ctx, bodyX + 4, groundY - 15, 5, 9, '#c9bfa4');
  rect(ctx, bodyX + 5, groundY - 13, 3, 2, COLORS.cinnabar);
  rect(ctx, bodyX + 6, groundY - 10, 1, 3, COLORS.cinnabar);

  // 施法臂
  if (raise) {
    stairLine(ctx, [[bodyX + 8, groundY - 22], [bodyX + 12, groundY - 30], [bodyX + 13, groundY - 35]], 3, COLORS.outline);
    stairLine(ctx, [[bodyX + 8, groundY - 22], [bodyX + 12, groundY - 30], [bodyX + 13, groundY - 34]], 1, robeLight);
    rect(ctx, bodyX + 10, groundY - 44, 7, 9, COLORS.outline);
    rect(ctx, bodyX + 11, groundY - 43, 5, 7, flame);
    rect(ctx, bodyX + 12, groundY - 41, 3, 4, flameCore);
    rect(ctx, bodyX + 13, groundY - 47, 2, 3, flame);
  } else if (release) {
    rect(ctx, bodyX + 7, groundY - 24, 11, 5, COLORS.outline);
    rect(ctx, bodyX + 8, groundY - 23, 9, 3, robeLight);
    rect(ctx, bodyX + 17, groundY - 27, 9, 10, COLORS.outline);
    rect(ctx, bodyX + 18, groundY - 26, 7, 8, flame);
    rect(ctx, bodyX + 20, groundY - 24, 4, 4, flameCore);
    stairLine(ctx, [[bodyX + 25, groundY - 29], [bodyX + 30, groundY - 31]], 2, flame);
    stairLine(ctx, [[bodyX + 25, groundY - 16], [bodyX + 30, groundY - 14]], 2, flame);
  } else {
    rect(ctx, bodyX + 7, groundY - 23, 5, 12, COLORS.outline);
    rect(ctx, bodyX + 8, groundY - 22, 3, 9, robeLight);
    rect(ctx, bodyX + 7, groundY - 12, 5, 4, flame);
    rect(ctx, bodyX + 8, groundY - 11, 3, 2, flameCore);
  }
  rect(ctx, bodyX - 12, groundY - 23 + (walkStep === 2 ? 2 : 0), 5, 12, COLORS.outline);
  rect(ctx, bodyX - 11, groundY - 22 + (walkStep === 2 ? 2 : 0), 3, 9, robe);

  // 兜帽头：阴影中一双业火眼
  const headY = groundY - 38;
  rect(ctx, bodyX - 8, headY, 16, 14, COLORS.outline);
  rect(ctx, bodyX - 6, headY + 2, 12, 11, robe);
  rect(ctx, bodyX - 5, headY + 3, 10, 3, robeLight);
  rect(ctx, bodyX - 4, headY + 6, 8, 6, '#100c0a');
  const eyeColor = release || raise ? flameCore : flame;
  rect(ctx, bodyX - 3, headY + 8, 2, 2, eyeColor);
  rect(ctx, bodyX + 1, headY + 8, 2, 2, eyeColor);
  rect(ctx, bodyX - 1, headY - 3, 2, 3, robeTrim);

  // 飘散余烬
  const emberShift = (frame * 3) % 5;
  rect(ctx, bodyX - 14, groundY - 30 - emberShift, 2, 2, flame);
  rect(ctx, bodyX + 13, groundY - 34 + emberShift, 2, 2, 'rgba(244, 192, 94, 0.8)');
}

function drawCorpsePuppetGeneral(ctx, frame, _pose, width, height) {
  const centerX = Math.round(width / 2);
  const groundY = height - 5;
  const hurt = frame === 5;
  const windup = frame === 2;
  const slam = frame === 3;
  const sway = frame === 1 ? 1 : 0;
  const bodyX = centerX + (slam ? 3 : hurt ? -2 : 0);
  const armor = '#4a4f42';
  const armorLight = '#666c58';
  const armorDark = '#2f342b';
  const corpse = '#77896f';

  pixelShadow(ctx, centerX, groundY + 1, 44);

  rect(ctx, bodyX - 13, groundY - 13 - sway, 9, 13, COLORS.outline);
  rect(ctx, bodyX + 4, groundY - 13 + sway, 9, 13, COLORS.outline);
  rect(ctx, bodyX - 11, groundY - 11 - sway, 5, 9, armorDark);
  rect(ctx, bodyX + 6, groundY - 11 + sway, 5, 9, armorDark);

  // 甲裙垂片
  rect(ctx, bodyX - 15, groundY - 24, 30, 12, COLORS.outline);
  rect(ctx, bodyX - 13, groundY - 22, 26, 9, armor);
  rect(ctx, bodyX - 8, groundY - 22, 2, 9, armorDark);
  rect(ctx, bodyX - 1, groundY - 22, 2, 9, armorDark);
  rect(ctx, bodyX + 6, groundY - 22, 2, 9, armorDark);

  // 胸甲：古将军扎甲 + 裂痕
  rect(ctx, bodyX - 14, groundY - 44, 28, 22, COLORS.outline);
  rect(ctx, bodyX - 12, groundY - 42, 24, 19, armor);
  rect(ctx, bodyX - 12, groundY - 37, 24, 2, armorDark);
  rect(ctx, bodyX - 12, groundY - 31, 24, 2, armorDark);
  rect(ctx, bodyX - 11, groundY - 42, 6, 3, armorLight);
  rect(ctx, bodyX - 3, groundY - 36, 6, 7, COLORS.brass);
  rect(ctx, bodyX - 2, groundY - 35, 4, 5, '#8a6a35');
  stairLine(ctx, [[bodyX + 4, groundY - 42], [bodyX + 8, groundY - 36], [bodyX + 6, groundY - 30]], 1, hurt ? COLORS.cinnabar : armorDark);
  if (hurt) {
    rect(ctx, bodyX - 8, groundY - 39, 4, 9, COLORS.cinnabar);
    rect(ctx, bodyX - 6, groundY - 36, 2, 4, '#e17a61');
  }

  // 肩吞与红缨绦带
  rect(ctx, bodyX - 20, groundY - 46, 11, 11, COLORS.outline);
  rect(ctx, bodyX - 19, groundY - 45, 9, 8, armorLight);
  rect(ctx, bodyX + 9, groundY - 46, 11, 11, COLORS.outline);
  rect(ctx, bodyX + 10, groundY - 45, 9, 8, armorLight);
  stairLine(ctx, [[bodyX - 18, groundY - 36], [bodyX - 21, groundY - 28], [bodyX - 19, groundY - 21]], 2, COLORS.cinnabar);

  // 巨型残刀
  if (windup) {
    stairLine(ctx, [[bodyX + 13, groundY - 40], [bodyX + 19, groundY - 48], [bodyX + 21, groundY - 54]], 5, COLORS.outline);
    stairLine(ctx, [[bodyX + 13, groundY - 40], [bodyX + 19, groundY - 48], [bodyX + 20, groundY - 53]], 2, corpse);
    rect(ctx, bodyX + 17, groundY - 66, 5, 14, COLORS.outline);
    rect(ctx, bodyX + 18, groundY - 64, 2, 11, COLORS.steel);
    rect(ctx, bodyX + 21, groundY - 62, 3, 7, COLORS.steelShade);
  } else if (slam) {
    stairLine(ctx, [[bodyX + 13, groundY - 38], [bodyX + 21, groundY - 28], [bodyX + 25, groundY - 18]], 5, COLORS.outline);
    stairLine(ctx, [[bodyX + 13, groundY - 38], [bodyX + 21, groundY - 28], [bodyX + 24, groundY - 19]], 2, corpse);
    rect(ctx, bodyX + 22, groundY - 18, 14, 5, COLORS.outline);
    rect(ctx, bodyX + 23, groundY - 17, 12, 3, COLORS.steel);
    rect(ctx, bodyX + 30, groundY - 19, 5, 2, COLORS.steelShade);
    stairLine(ctx, [[bodyX + 16, groundY - 8], [bodyX + 26, groundY - 4], [bodyX + 36, groundY - 7]], 1, 'rgba(131, 210, 162, 0.7)');
  } else {
    stairLine(ctx, [[bodyX + 13, groundY - 40 + sway], [bodyX + 17, groundY - 30], [bodyX + 17, groundY - 20]], 5, COLORS.outline);
    stairLine(ctx, [[bodyX + 13, groundY - 40 + sway], [bodyX + 17, groundY - 30], [bodyX + 17, groundY - 21]], 2, corpse);
    rect(ctx, bodyX + 15, groundY - 24, 4, 20, COLORS.outline);
    rect(ctx, bodyX + 16, groundY - 22, 2, 17, COLORS.steel);
  }
  stairLine(ctx, [[bodyX - 13, groundY - 40 - sway], [bodyX - 18, groundY - 31], [bodyX - 17, groundY - 22]], 5, COLORS.outline);
  stairLine(ctx, [[bodyX - 13, groundY - 40 - sway], [bodyX - 18, groundY - 31], [bodyX - 17, groundY - 23]], 2, corpse);

  // 将盔：高冠 + 红缨 + 尸面
  const headY = groundY - 60 + (hurt ? 3 : 0);
  rect(ctx, bodyX - 9, headY, 18, 17, COLORS.outline);
  rect(ctx, bodyX - 7, headY + 4, 14, 12, corpse);
  rect(ctx, bodyX - 8, headY + 1, 16, 5, armorDark);
  rect(ctx, bodyX - 10, headY + 4, 3, 8, armorDark);
  rect(ctx, bodyX + 7, headY + 4, 3, 8, armorDark);
  rect(ctx, bodyX - 3, headY - 6, 6, 7, COLORS.outline);
  rect(ctx, bodyX - 2, headY - 5, 4, 5, armorDark);
  rect(ctx, bodyX - 1, headY - 9, 2, 4, COLORS.cinnabar);
  const eyeColor = hurt ? COLORS.cinnabar : COLORS.jadeLight;
  rect(ctx, bodyX - 5, headY + 8, 3, 3, COLORS.outline);
  rect(ctx, bodyX + 2, headY + 8, 3, 3, COLORS.outline);
  rect(ctx, bodyX - 4, headY + 8, 2, 2, eyeColor);
  rect(ctx, bodyX + 3, headY + 8, 2, 2, eyeColor);
  rect(ctx, bodyX - 2, headY + 13, 4, 1, '#55654e');
}

function drawBoneGhostKing(ctx, frame, _pose, width, height) {
  const centerX = Math.round(width / 2);
  const groundY = height - 4;
  const bob = frame === 1 || frame === 3 ? 2 : 0;
  const raise = frame === 2;
  const strike = frame === 3;
  const bodyX = centerX + (strike ? 3 : 0);
  const baseY = groundY - bob;
  const bone = '#e2ddce';
  const boneShade = '#b3ac97';
  const robe = '#1d1a22';
  const robeLight = '#332d3c';
  const ghost = 'rgba(131, 210, 162, 0.75)';

  pixelShadow(ctx, centerX, groundY + 1, 40);

  // 袍底鬼火：漂浮无足
  rect(ctx, bodyX - 14, baseY - 8, 5, 5, ghost);
  rect(ctx, bodyX + 10, baseY - 7, 4, 4, ghost);
  rect(ctx, bodyX - 2, baseY - 5, 4, 4, 'rgba(131, 210, 162, 0.5)');

  // 残破王袍：锯齿下摆
  rect(ctx, bodyX - 16, baseY - 40, 32, 30, COLORS.outline);
  rect(ctx, bodyX - 14, baseY - 38, 28, 28, robe);
  rect(ctx, bodyX - 14, baseY - 38, 8, 24, robeLight);
  for (let i = 0; i < 7; i += 1) {
    const fx = bodyX - 14 + i * 4;
    const drop = i % 2 === 0 ? 0 : 4;
    rect(ctx, fx, baseY - 12 + drop, 3, 4, robe);
    rect(ctx, fx, baseY - 8 + drop, 3, 2, COLORS.outline);
  }
  rect(ctx, bodyX - 10, baseY - 34, 3, 16, COLORS.cinnabar);
  rect(ctx, bodyX + 7, baseY - 33, 3, 14, COLORS.cinnabar);

  // 白骨胸廓压在袍上
  rect(ctx, bodyX - 9, baseY - 38, 18, 14, COLORS.outline);
  rect(ctx, bodyX - 7, baseY - 36, 14, 11, bone);
  rect(ctx, bodyX - 7, baseY - 33, 14, 2, boneShade);
  rect(ctx, bodyX - 7, baseY - 29, 14, 2, boneShade);
  rect(ctx, bodyX - 1, baseY - 36, 2, 11, boneShade);

  // 骨爪臂
  if (raise) {
    stairLine(ctx, [[bodyX + 8, baseY - 36], [bodyX + 15, baseY - 46], [bodyX + 17, baseY - 54]], 4, COLORS.outline);
    stairLine(ctx, [[bodyX + 8, baseY - 36], [bodyX + 15, baseY - 46], [bodyX + 16, baseY - 53]], 2, bone);
    rect(ctx, bodyX + 13, baseY - 60, 3, 7, bone);
    rect(ctx, bodyX + 17, baseY - 61, 3, 8, bone);
    rect(ctx, bodyX + 21, baseY - 59, 3, 7, bone);
    rect(ctx, bodyX + 14, baseY - 63, 9, 3, ghost);
  } else if (strike) {
    stairLine(ctx, [[bodyX + 8, baseY - 35], [bodyX + 18, baseY - 32], [bodyX + 26, baseY - 30]], 4, COLORS.outline);
    stairLine(ctx, [[bodyX + 8, baseY - 35], [bodyX + 18, baseY - 32], [bodyX + 25, baseY - 30]], 2, bone);
    rect(ctx, bodyX + 25, baseY - 34, 7, 3, bone);
    rect(ctx, bodyX + 27, baseY - 30, 6, 3, bone);
    rect(ctx, bodyX + 25, baseY - 26, 6, 3, bone);
    stairLine(ctx, [[bodyX + 20, baseY - 44], [bodyX + 30, baseY - 40], [bodyX + 36, baseY - 33]], 2, ghost);
    stairLine(ctx, [[bodyX + 22, baseY - 20], [bodyX + 31, baseY - 18]], 2, ghost);
  } else {
    stairLine(ctx, [[bodyX + 8, baseY - 36], [bodyX + 13, baseY - 28], [bodyX + 12, baseY - 20]], 4, COLORS.outline);
    stairLine(ctx, [[bodyX + 8, baseY - 36], [bodyX + 13, baseY - 28], [bodyX + 12, baseY - 21]], 2, bone);
  }
  stairLine(ctx, [[bodyX - 8, baseY - 36], [bodyX - 14, baseY - 28], [bodyX - 13, baseY - 20]], 4, COLORS.outline);
  stairLine(ctx, [[bodyX - 8, baseY - 36], [bodyX - 14, baseY - 28], [bodyX - 13, baseY - 21]], 2, boneShade);

  // 幽火杖：左手骨杖悬浮鬼火
  rect(ctx, bodyX - 16, baseY - 44, 3, 26, COLORS.outline);
  rect(ctx, bodyX - 15, baseY - 43, 1, 23, bone);
  rect(ctx, bodyX - 18, baseY - 50, 7, 7, COLORS.outline);
  rect(ctx, bodyX - 17, baseY - 49, 5, 5, raise || strike ? COLORS.jadeLight : '#5ba185');

  // 白骨法冠 + 骷髅首
  const headY = baseY - 56 + (strike ? 1 : 0);
  rect(ctx, bodyX - 8, headY, 16, 16, COLORS.outline);
  rect(ctx, bodyX - 6, headY + 2, 12, 12, bone);
  rect(ctx, bodyX - 5, headY + 11, 10, 3, boneShade);
  rect(ctx, bodyX - 4, headY + 12, 2, 2, COLORS.outline);
  rect(ctx, bodyX, headY + 12, 2, 2, COLORS.outline);
  rect(ctx, bodyX + 3, headY + 12, 2, 2, COLORS.outline);
  const eyeGlow = raise || strike ? '#b7f0d2' : COLORS.jadeLight;
  rect(ctx, bodyX - 5, headY + 5, 4, 4, COLORS.outline);
  rect(ctx, bodyX + 1, headY + 5, 4, 4, COLORS.outline);
  rect(ctx, bodyX - 4, headY + 6, 2, 2, eyeGlow);
  rect(ctx, bodyX + 2, headY + 6, 2, 2, eyeGlow);

  // 法冠：中高侧低三叉 + 朱砂绦
  rect(ctx, bodyX - 7, headY - 4, 14, 5, COLORS.outline);
  rect(ctx, bodyX - 6, headY - 3, 12, 3, COLORS.brass);
  rect(ctx, bodyX - 2, headY - 9, 4, 6, COLORS.outline);
  rect(ctx, bodyX - 1, headY - 8, 2, 5, bone);
  rect(ctx, bodyX - 7, headY - 7, 3, 4, COLORS.outline);
  rect(ctx, bodyX + 4, headY - 7, 3, 4, COLORS.outline);
  rect(ctx, bodyX - 6, headY - 6, 1, 3, bone);
  rect(ctx, bodyX + 5, headY - 6, 1, 3, bone);
  stairLine(ctx, [[bodyX + 8, headY - 2], [bodyX + 12, headY + 4], [bodyX + 11, headY + 10]], 1, COLORS.cinnabar);
}

const DRAWERS = Object.freeze({
  hero: drawHero,
  slime: drawMurkwaterSpirit,
  bat: drawSoulBat,
  spider: drawSoulSpider,
  goblin: drawMountainDemon,
  skeleton: drawShadeSoldier,
  orc_warrior: drawDemonBrute,
  fire_mage: drawKarmicFlameCultist,
  giant_skeleton: drawCorpsePuppetGeneral,
  skeleton_king: drawBoneGhostKing
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

/** 通用坊民贴图（28×32）：束发布衣，替换旧的纯色小人。 */
function drawTownsfolk(ctx, width, height) {
  const centerX = Math.round(width / 2);
  const groundY = height - 3;
  pixelShadow(ctx, centerX, groundY, 18);

  rect(ctx, centerX - 6, groundY - 6, 5, 5, COLORS.outline);
  rect(ctx, centerX + 1, groundY - 6, 5, 5, COLORS.outline);
  rect(ctx, centerX - 5, groundY - 5, 3, 3, '#4b5a52');
  rect(ctx, centerX + 2, groundY - 5, 3, 3, '#4b5a52');

  rect(ctx, centerX - 8, groundY - 18, 16, 13, COLORS.outline);
  rect(ctx, centerX - 6, groundY - 16, 12, 10, '#7d8f83');
  rect(ctx, centerX - 6, groundY - 16, 4, 8, '#93a396');
  rect(ctx, centerX - 6, groundY - 11, 12, 2, COLORS.brass);
  rect(ctx, centerX - 1, groundY - 16, 2, 7, '#5c6f63');

  rect(ctx, centerX - 10, groundY - 16, 3, 9, COLORS.outline);
  rect(ctx, centerX + 7, groundY - 16, 3, 9, COLORS.outline);

  rect(ctx, centerX - 6, groundY - 29, 12, 12, COLORS.outline);
  rect(ctx, centerX - 4, groundY - 27, 8, 9, COLORS.skin);
  rect(ctx, centerX - 4, groundY - 28, 8, 3, COLORS.deepInk);
  rect(ctx, centerX - 3, groundY - 24, 2, 2, COLORS.outline);
  rect(ctx, centerX + 1, groundY - 24, 2, 2, COLORS.outline);
  rect(ctx, centerX - 2, groundY - 32, 4, 4, COLORS.deepInk);
  rect(ctx, centerX - 1, groundY - 33, 2, 2, COLORS.brass);
}

export function installXianxiaNpcTexture(scene) {
  if (!scene?.textures) return;
  const canvas = makePixelCanvas({ w: 28, h: 32 }, (ctx, width, height) => {
    drawTownsfolk(ctx, width, height);
  });
  replaceCanvasTexture(scene, 'npc', canvas);
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
