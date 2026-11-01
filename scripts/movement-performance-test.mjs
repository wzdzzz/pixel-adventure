import { chromium } from 'playwright';
import { enterFreshGame } from './helpers/game-navigation.mjs';

const URL = process.env.GAME_URL || 'http://localhost:3000';
const browser = await chromium.launch({
  headless: true,
  args: ['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist'],
});
const context = await browser.newContext({ viewport: { width: 1920, height: 1080 } });
const page = await context.newPage();
const pageErrors = [];

page.on('pageerror', (error) => pageErrors.push(error.message));

await page.goto(URL, { waitUntil: 'networkidle' });
await page.waitForSelector('canvas');
await page.evaluate(() => localStorage.clear());
await page.waitForTimeout(750);

await enterFreshGame(page, { afterStartMs: 3000 });

async function sample(label, durationMs, key = null, stallMs = 0) {
  if (key) await page.keyboard.down(key);
  const result = await page.evaluate(async ({ label, durationMs, stallMs }) => {
    const scene = window.__game.scene.getScene('MainGameScene');
    const player = scene.player.sprite;
    const frames = [];
    let previousTime = performance.now();
    let previousX = player.x;
    let previousY = player.y;
    let previousCameraX = scene.cameras.main.scrollX;
    let previousCameraY = scene.cameras.main.scrollY;
    const startedAt = previousTime;

    await new Promise((resolve) => {
      const tick = () => {
        const now = performance.now();
        const dx = player.x - previousX;
        const dy = player.y - previousY;
        const cameraX = scene.cameras.main.scrollX;
        const cameraY = scene.cameras.main.scrollY;
        frames.push({
          dt: now - previousTime,
          distance: Math.hypot(dx, dy),
          cameraDistance: Math.hypot(cameraX - previousCameraX, cameraY - previousCameraY),
          screenX: player.x - cameraX,
          screenY: player.y - cameraY,
          physicsSteps: scene.physics.world.stepsLastFrame,
          queue: scene.chunkManager.loadQueue.length,
          chunks: scene.chunkManager.activeChunks.size,
          enemies: scene.enemies.length,
          colliders: scene.physics.world.colliders.getActive().length,
          bodies: scene.physics.world.bodies.size,
        });
        previousTime = now;
        previousX = player.x;
        previousY = player.y;
        previousCameraX = cameraX;
        previousCameraY = cameraY;
      };
      window.__game.events.on('poststep', tick);
      if (stallMs > 0) {
        setTimeout(() => {
          const stallUntil = performance.now() + stallMs;
          while (performance.now() < stallUntil) {
            // Intentional main-thread stall to verify movement recovery behavior.
          }
        }, Math.floor(durationMs / 3));
      }
      setTimeout(() => {
        window.__game.events.off('poststep', tick);
        resolve();
      }, durationMs);
    });

    const values = (field) => frames.map((frame) => frame[field]);
    const percentile = (numbers, value) => {
      const sorted = [...numbers].sort((a, b) => a - b);
      return sorted[Math.min(sorted.length - 1, Math.floor(sorted.length * value))] || 0;
    };
    const dts = values('dt');
    const distances = values('distance');
    const cameraDistances = values('cameraDistance');
    const movingFrames = frames.filter((frame) => frame.distance > 0.01);
    const screenXs = movingFrames.map((frame) => frame.screenX);
    const screenYs = movingFrames.map((frame) => frame.screenY);
    const lastFrame = frames.at(-1) || {
      chunks: scene.chunkManager.activeChunks.size,
      enemies: scene.enemies.length,
      colliders: scene.physics.world.colliders.getActive().length,
      bodies: scene.physics.world.bodies.size,
    };
    return {
      label,
      frameCount: frames.length,
      sceneActive: scene.scene.isActive(),
      scenePaused: scene.scene.isPaused(),
      fps: window.__game.loop.actualFps,
      dt: {
        average: dts.reduce((sum, value) => sum + value, 0) / dts.length,
        p95: percentile(dts, 0.95),
        max: Math.max(...dts),
        over25ms: dts.filter((value) => value > 25).length,
        over50ms: dts.filter((value) => value > 50).length,
      },
      movement: {
        total: distances.reduce((sum, value) => sum + value, 0),
        p95FrameDistance: percentile(distances, 0.95),
        maxFrameDistance: Math.max(...distances),
      },
      camera: {
        stationaryWhileMoving: movingFrames.filter((frame) => frame.cameraDistance < 0.01).length,
        p95FrameDistance: percentile(cameraDistances, 0.95),
        maxFrameDistance: Math.max(...cameraDistances),
        screenRangeX: screenXs.length ? Math.max(...screenXs) - Math.min(...screenXs) : 0,
        screenRangeY: screenYs.length ? Math.max(...screenYs) - Math.min(...screenYs) : 0,
      },
      maxPhysicsSteps: Math.max(...values('physicsSteps')),
      maxQueue: Math.max(...values('queue')),
      chunks: lastFrame.chunks,
      enemies: lastFrame.enemies,
      colliders: lastFrame.colliders,
      bodies: lastFrame.bodies,
    };
  }, { label, durationMs, stallMs });
  if (key) await page.keyboard.up(key);
  return result;
}

const sceneState = await page.evaluate(() => {
  const scene = window.__game.scene.getScene('MainGameScene');
  return {
    classType: scene.player.classType,
    moveSpeed: scene.player.getMoveSpeed(),
    maxVelocity: {
      x: scene.player.sprite.body.maxVelocity.x,
      y: scene.player.sprite.body.maxVelocity.y,
    },
    camera: {
      lerpX: scene.cameras.main.lerp.x,
      lerpY: scene.cameras.main.lerp.y,
      deadzone: scene.cameras.main.deadzone
        ? { width: scene.cameras.main.deadzone.width, height: scene.cameras.main.deadzone.height }
        : null,
      roundPixels: scene.cameras.main.roundPixels,
    },
    walkAnimationFps: scene.anims.get('hero_walk')?.frameRate,
    walkUpAnimationFps: scene.anims.get('hero_walk_up')?.frameRate,
  };
});

const results = [await sample('idle', 2000)];

await page.evaluate(() => {
  const scene = window.__game.scene.getScene('MainGameScene');
  const player = scene.player.sprite;
  player.body.checkCollision.none = true;
  player.body.reset(8 * 1024 + 640, 8 * 1024 + 512);
  scene.chunkManager.teleportReset(player.x, player.y);
});
await page.waitForTimeout(2500);
results.push(await sample('steady-move', 2000, 'd'));

await page.evaluate(() => {
  const scene = window.__game.scene.getScene('MainGameScene');
  const player = scene.player.sprite;
  player.body.reset(9 * 1024 - 160, 8 * 1024 + 512);
});
results.push(await sample('chunk-crossing', 2500, 'd'));
results.push(await sample('stall-recovery', 2000, 'd', 120));

const collision = await page.evaluate(async () => {
  const scene = window.__game.scene.getScene('MainGameScene');
  const player = scene.player;
  const enemy = scene.enemies.find((entry) => entry.sprite?.active && !entry._isDestroyed);
  if (!enemy) return { available: false };

  const originalEnemyUpdate = enemy.update;
  const originalContact = scene.handleEnemyContact;
  enemy.update = () => {};
  enemy.state = 'PATROL';
  enemy.isInvulnerable = false;
  enemy.iFramesTimer = 0;
  enemy.hp = enemy.maxHp;
  scene.physics.world.enable(enemy.sprite);
  player.sprite.body.checkCollision.none = false;
  player.sprite.setVelocity(0, 0);
  enemy.sprite.setVelocity(0, 0);

  const x = player.sprite.x;
  const y = player.sprite.y;
  player.sprite.body.reset(x, y);
  enemy.sprite.body.reset(x + 4, y);

  let contactCount = 0;
  scene.handleEnemyContact = (...args) => {
    contactCount++;
    return originalContact.apply(scene, args);
  };
  await new Promise((resolve) => setTimeout(resolve, 100));

  enemy.sprite.body.reset(x + 40, y);
  player.attackHitRegistered = false;
  player.attackHitbox.setPosition(enemy.sprite.x, enemy.sprite.y);
  player.attackHitbox.body.enable = true;
  const hpBefore = enemy.hp;
  await new Promise((resolve) => setTimeout(resolve, 100));

  const enemyChunkX = Math.floor(enemy.spawnX / 1024);
  const enemyChunkY = Math.floor(enemy.spawnY / 1024);
  const chunkGroup = scene._enemyGroupsByChunk.get(`${enemyChunkX},${enemyChunkY}`);
  const result = {
    available: true,
    inSharedGroup: scene._enemySprites.contains(enemy.sprite),
    inChunkGroup: chunkGroup?.contains(enemy.sprite) || false,
    contactCount,
    attackDamage: hpBefore - enemy.hp,
  };

  scene.handleEnemyContact = originalContact;
  enemy.update = originalEnemyUpdate;
  return result;
});

console.log(JSON.stringify({ sceneState, results, collision, pageErrors }, null, 2));
await browser.close();

const steady = results.find(({ label }) => label === 'steady-move');
const stalled = results.find(({ label }) => label === 'stall-recovery');
const crossing = results.find(({ label }) => label === 'chunk-crossing');
const passed =
  pageErrors.length === 0 &&
  results.every(({ sceneActive, scenePaused, frameCount }) => sceneActive && !scenePaused && frameCount > 30) &&
  steady.movement.total > 250 &&
  steady.camera.stationaryWhileMoving < 3 &&
  steady.camera.screenRangeX < 2 &&
  stalled.dt.max > 100 &&
  stalled.movement.maxFrameDistance < 10 &&
  crossing.colliders < 200 &&
  sceneState.camera.lerpX === 1 &&
  sceneState.camera.lerpY === 1 &&
  sceneState.camera.deadzone === null &&
  sceneState.walkAnimationFps === 12 &&
  sceneState.walkUpAnimationFps === 12 &&
  collision.available &&
  collision.inSharedGroup &&
  collision.inChunkGroup &&
  collision.contactCount > 0 &&
  collision.attackDamage > 0;

console.log(`\nResult: ${passed ? 'PASS' : 'FAIL'}`);
process.exit(passed ? 0 : 1);
