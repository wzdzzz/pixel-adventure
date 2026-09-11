/**
 * 秘境构建器 — 整图一次构建三层 tilemap(无流式)
 *
 * 与 ChunkManager.createChunk 同一套 world_tileset 三层结构,
 * 但整个 site 一张图、原点 (0,0)。碰撞器统一挂在 handle.colliders,销毁时先清。
 */
import { WORLD_CONFIG } from './worldConfig.js';

export const SiteBuilder = {
  /**
   * @param {Phaser.Scene} scene
   * @param {object} site - SITES[siteId](见 sites.js)
   * @returns {{site, maps, layers, wallLayer, widthPx, heightPx, colliders}}
   */
  build(scene, site) {
    const ts = WORLD_CONFIG.tileSize;
    const { ground, walls, decorations } = site.generateMap();

    const mk = (data, depth, collide) => {
      const map = scene.make.tilemap({ data, tileWidth: ts, tileHeight: ts });
      const tileset = map.addTilesetImage('world_tileset', 'world_tileset', ts, ts);
      const layer = map.createLayer(0, tileset, 0, 0);
      layer.setDepth(depth);
      if (collide) layer.setCollisionByExclusion([-1]);
      return { map, layer };
    };

    const g = mk(ground, -2, false);
    const w = mk(walls, 0, true);
    const d = mk(decorations, -1, false);

    return {
      site,
      maps: [g.map, w.map, d.map],
      layers: [g.layer, w.layer, d.layer],
      wallLayer: w.layer,
      widthPx: site.widthTiles * ts,
      heightPx: site.heightTiles * ts,
      colliders: [],
    };
  },

  /** 销毁秘境(先碰撞器后图层,顺序同 ChunkManager.destroyChunk) */
  destroy(handle) {
    if (!handle) return;
    for (const c of handle.colliders) { if (c?.world) c.destroy(); }
    handle.colliders = [];
    for (const layer of handle.layers) layer.destroy();
    for (const map of handle.maps) map.destroy();
  },
};
