export const WORLD_CONFIG = Object.freeze({
  widthChunks: 16,
  heightChunks: 16,
  chunkTiles: 32,
  tileSize: 32,
  centerChunkX: 8,
  centerChunkY: 8,
});

export const WORLD_CHUNK_PX = WORLD_CONFIG.chunkTiles * WORLD_CONFIG.tileSize;
export const WORLD_WIDTH_PX = WORLD_CONFIG.widthChunks * WORLD_CHUNK_PX;
export const WORLD_HEIGHT_PX = WORLD_CONFIG.heightChunks * WORLD_CHUNK_PX;

export function chunkKey(chunkX, chunkY) {
  return `${chunkX},${chunkY}`;
}

export function isChunkInBounds(chunkX, chunkY) {
  return chunkX >= 0 && chunkX < WORLD_CONFIG.widthChunks &&
    chunkY >= 0 && chunkY < WORLD_CONFIG.heightChunks;
}

export function worldToChunk(worldX, worldY) {
  return {
    chunkX: Math.floor(worldX / WORLD_CHUNK_PX),
    chunkY: Math.floor(worldY / WORLD_CHUNK_PX),
  };
}

export function chunkTileToWorld(chunkX, chunkY, localX, localY) {
  return {
    x: chunkX * WORLD_CHUNK_PX + localX * WORLD_CONFIG.tileSize + WORLD_CONFIG.tileSize / 2,
    y: chunkY * WORLD_CHUNK_PX + localY * WORLD_CONFIG.tileSize + WORLD_CONFIG.tileSize / 2,
  };
}

export function getDefaultWorldSpawn() {
  return {
    x: WORLD_CONFIG.centerChunkX * WORLD_CHUNK_PX + WORLD_CHUNK_PX / 2,
    y: WORLD_CONFIG.centerChunkY * WORLD_CHUNK_PX + WORLD_CHUNK_PX / 2,
  };
}
