// World map regression checks:
// - loaded neighbor chunks do not unlock teleport/exploration
// - map teleport lands on a walkable tile and syncs the physics body
// - loading a save restores world seed and player position before chunks are generated
// - edge streaming never creates out-of-bounds chunks
// - overlay pause reasons cannot resume each other
// - scene restart disposes the previous world graph
import { chromium } from 'playwright';
import { enterFreshGame } from './helpers/game-navigation.mjs';

const URL = process.env.GAME_URL || 'http://localhost:3000';
const pageErrors = [];

const browser = await chromium.launch({
  headless: true,
  args: ['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist'],
});
const ctx = await browser.newContext({ viewport: { width: 1920, height: 1080 } });
const page = await ctx.newPage();
page.on('pageerror', (e) => pageErrors.push(e.stack || e.message));

console.log('URL =', URL);
await page.goto(URL, { waitUntil: 'networkidle' });
await page.waitForSelector('canvas');
await page.evaluate(() => localStorage.clear());
await page.waitForTimeout(1000);

await enterFreshGame(page, { afterStartMs: 3000 });

const result = await page.evaluate(async () => {
  const game = window.__game;
  const scene = game.scene.getScene('MainGameScene');
  const player = scene.player.sprite;

  const out = {
    initial: {
      seed: scene.worldState.seed,
      explored: [...scene.worldState.exploredChunks].sort(),
      activeChunks: [...scene.chunkManager.activeChunks.keys()].sort(),
      player: { x: Math.round(player.x), y: Math.round(player.y) },
    },
  };

  const oldChunkManager = scene.chunkManager;
  const oldNpcRegistry = scene.npcRegistry;

  scene.pauseGame('world-map');
  scene.pauseGame('panel');
  scene.resumeGame('world-map');
  out.pauseReasons = {
    afterFirstResume: scene.gamePaused,
    reasonsAfterFirstResume: [...scene._pauseReasons].sort(),
  };
  scene.resumeGame('panel');
  out.pauseReasons.afterAllResume = scene.gamePaused;

  const pending = scene.chunkManager._getChunksInRadius(8, 8, 1)
    .find(({ chunkX, chunkY }) => chunkX !== 8 || chunkY !== 8);
  scene.events.emit('chunk-unloaded', pending);
  scene.chunkManager.destroyChunk(pending.chunkX, pending.chunkY);
  scene.chunkManager.loadQueue = [{ ...pending, step: 0 }];
  scene.chunkManager._processQueues();
  let pendingLoadedEvents = 0;
  const onPendingLoaded = ({ chunkX, chunkY }) => {
    if (chunkX === pending.chunkX && chunkY === pending.chunkY) pendingLoadedEvents++;
  };
  scene.events.on('chunk-loaded', onPendingLoaded);
  const pendingX = pending.chunkX * 1024 + 512;
  const pendingY = pending.chunkY * 1024 + 512;
  scene.chunkManager.update(pendingX, pendingY);
  scene.chunkManager._processQueues();
  scene.events.off('chunk-loaded', onPendingLoaded);
  out.pendingChunk = {
    loadedEvents: pendingLoadedEvents,
    ready: scene.chunkManager.getChunk(pending.chunkX, pending.chunkY)?.ready,
  };
  scene.chunkManager.teleportReset(player.x, player.y);
  for (let i = 0; i < 20; i++) scene.chunkManager.update(player.x, player.y);

  // Find a chunk whose center tile is blocked but which has a nearby safe tile.
  let target = null;
  for (let y = 0; y < 16 && !target; y++) {
    for (let x = 0; x < 16 && !target; x++) {
      const terrain = scene.worldGenerator.generateChunkTerrain(x, y);
      if (!scene.worldGenerator.isWalkableTile(terrain, 16, 16)) {
        const safe = scene.worldGenerator.findNearestWalkableTile(x, y, 16, 16);
        if (safe) target = { x, y, safe: { localX: safe.localX, localY: safe.localY } };
      }
    }
  }
  if (!target) {
    const safe = scene.worldGenerator.findNearestWalkableTile(8, 8, 16, 16);
    target = { x: 8, y: 8, safe: { localX: safe.localX, localY: safe.localY } };
  }

  scene.worldState.markChunkExplored(`${target.x},${target.y}`);
  scene.scene.launch('WorldMapScene');
  await new Promise((resolve) => setTimeout(resolve, 50));
  const map = game.scene.getScene('WorldMapScene');
  map._teleportTo(target.x, target.y);
  const immediateActiveChunks = scene.chunkManager.activeChunks.size;
  const queuedNeighbors = scene.chunkManager.loadQueue.length;
  await new Promise((resolve) => setTimeout(resolve, 50));

  const localX = Math.floor((scene.player.sprite.x - target.x * 1024) / 32);
  const localY = Math.floor((scene.player.sprite.y - target.y * 1024) / 32);
  const terrainAfter = scene.worldGenerator.generateChunkTerrain(target.x, target.y);
  out.teleport = {
    target,
    player: {
      x: Math.round(scene.player.sprite.x),
      y: Math.round(scene.player.sprite.y),
      localX,
      localY,
    },
    body: {
      x: Math.round(scene.player.sprite.body.x),
      y: Math.round(scene.player.sprite.body.y),
      vx: scene.player.sprite.body.velocity.x,
      vy: scene.player.sprite.body.velocity.y,
    },
    walkable: scene.worldGenerator.isWalkableTile(terrainAfter, localX, localY),
    exploredHasTarget: scene.worldState.exploredChunks.has(`${target.x},${target.y}`),
    immediateActiveChunks,
    queuedNeighbors,
  };

  scene._despawnAllWorldEntities();
  scene.player.sprite.body.reset(16, 16);
  scene.chunkManager.teleportReset(16, 16);
  for (let i = 0; i < 20; i++) scene.chunkManager.update(16, 16);
  out.edge = {
    activeChunks: [...scene.chunkManager.activeChunks.keys()].sort(),
    allInBounds: [...scene.chunkManager.activeChunks.keys()].every((key) => {
      const [x, y] = key.split(',').map(Number);
      return x >= 0 && x < 16 && y >= 0 && y < 16;
    }),
  };

  const saveData = {
    timestamp: Date.now(),
    version: '3.0.0',
    slotId: 3,
    meta: { classType: 'mage', gender: 'female', level: 7, xp: 0, score: 123, currentLevel: 0, levelName: 'Map Test Save' },
    player: {
      position: { x: 5 * 1024 + 16 * 32 + 16, y: 5 * 1024 + 16 * 32 + 16 },
      hp: 77,
      maxHp: 100,
      stamina: 80,
      mana: 60,
      rage: 12,
      classType: 'mage',
      gender: 'female',
      stats: null,
      statusEffects: [],
      skillSlots: null,
      itemSlots: null,
    },
    gameState: { score: 123, keysCollected: 0, hasArtifact: false, collectedItems: [], currentLevel: 0 },
    inventory: [],
    levelSystem: null,
    equipment: null,
    skillTree: null,
    skillEngine: null,
    quests: null,
    worldState: {
      seed: 424242,
      exploredChunks: ['5,5'],
      killedEntities: [],
      openedChests: [],
      pickedItems: [],
      permanentFlags: [],
      bonfireReset: 0,
    },
    npcMemory: null,
    factionData: null,
    shopData: null,
    companion: null,
  };
  localStorage.setItem('pixel_adventure_save_3', JSON.stringify(saveData));
  game.registry.set('pendingLoadSlot', 3);
  game.registry.set('activeSaveSlot', 3);
  game.scene.stop('WorldMapScene');
  game.scene.stop('UIScene');
  scene.scene.restart();
  game.scene.start('UIScene');
  await new Promise((resolve) => setTimeout(resolve, 2500));

  const loaded = game.scene.getScene('MainGameScene');
  out.load = {
    seed: loaded.worldState.seed,
    generatorSeed: loaded.worldGenerator.seed,
    chunkManagerSeed: loaded.chunkManager.worldState.seed,
    player: {
      x: Math.round(loaded.player.sprite.x),
      y: Math.round(loaded.player.sprite.y),
      classType: loaded.player.classType,
      gender: loaded.player.gender,
      hp: loaded.player.hp,
    },
    explored: [...loaded.worldState.exploredChunks].sort(),
    activeChunks: [...loaded.chunkManager.activeChunks.keys()].sort(),
    previousWorldDisposed: {
      activeChunks: oldChunkManager.activeChunks.size,
      npcInstances: oldNpcRegistry.instances.size,
    },
  };
  localStorage.removeItem('pixel_adventure_save_3');

  return out;
});

console.log(JSON.stringify(result, null, 2));

await browser.close();

if (pageErrors.length) {
  console.log('\n=== page errors ===');
  pageErrors.slice(0, 6).forEach((e) => console.log('  -', e.slice(0, 160)));
}

const pass =
  result.initial.explored.length === 1 &&
  result.initial.explored[0] === '8,8' &&
  result.initial.activeChunks.length === 9 &&
  result.pauseReasons.afterFirstResume === true &&
  result.pauseReasons.reasonsAfterFirstResume.length === 1 &&
  result.pauseReasons.reasonsAfterFirstResume[0] === 'panel' &&
  result.pauseReasons.afterAllResume === false &&
  result.pendingChunk.loadedEvents === 1 &&
  result.pendingChunk.ready === true &&
  result.teleport.walkable === true &&
  result.teleport.exploredHasTarget === true &&
  result.teleport.body.vx === 0 &&
  result.teleport.body.vy === 0 &&
  result.teleport.immediateActiveChunks === 1 &&
  result.teleport.queuedNeighbors > 0 &&
  result.edge.allInBounds === true &&
  result.edge.activeChunks.length === 4 &&
  result.load.seed === 424242 &&
  result.load.generatorSeed === 424242 &&
  result.load.chunkManagerSeed === 424242 &&
  result.load.player.x === 5648 &&
  result.load.player.y === 5648 &&
  result.load.player.classType === 'mage' &&
  result.load.player.gender === 'female' &&
  result.load.player.hp === 50 &&
  result.load.explored.includes('5,5') &&
  result.load.previousWorldDisposed.activeChunks === 0 &&
  result.load.previousWorldDisposed.npcInstances === 0 &&
  pageErrors.length === 0;

console.log('\nResult:', pass ? 'PASS' : 'FAIL');
process.exit(pass ? 0 : 1);
