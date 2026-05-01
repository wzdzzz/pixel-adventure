# 《像素远征》全功能交互面板 Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Transform the game into a fullscreen RPG with 6-attribute stats, XP/leveling, 4-tab panel system (Character/Inventory/SkillTree/QuestLog), and combat/HUD improvements.

**Architecture:** Data-driven systems layered on existing Actor/Stats/Scene architecture. New `PanelScene` runs as parallel Scene for UI. All panels are Phaser GameObjects within PanelScene. Systems (LevelSystem, QuestSystem, SkillTreeSystem, EquipmentSystem) are standalone classes instantiated by MainGameScene and shared via scene registry.

**Tech Stack:** Phaser 3.80.1, Vite 5.4.0, vanilla JavaScript ES Modules.

**Design Doc:** `docs/plans/2026-05-01-ui-panel-system-design.md`

---

## Task 1: Fullscreen + Responsive Layout Foundation

**Files:**
- Modify: `src/config/gameConfig.js`
- Modify: `src/scenes/UIScene.js`
- Modify: `src/scenes/MainGameScene.js`
- Modify: `src/scenes/GameOverScene.js`
- Modify: `src/scenes/VictoryScene.js`
- Modify: `src/data/levels.js`

**Step 1: Update gameConfig.js for fullscreen + larger map**

Change Scale mode from `FIT` to `RESIZE`, set initial size to `window.innerWidth/innerHeight`, expand map to 80x60:

```javascript
// gameConfig.js
export const GAME_CONFIG = {
  WIDTH: window.innerWidth,
  HEIGHT: window.innerHeight,

  MAP: {
    TILE_SIZE: 32,
    WIDTH: 80,   // was 50
    HEIGHT: 60   // was 40
  },

  PHYSICS: {
    GRAVITY: 0,
    PLAYER_SPEED: 200,
    PLAYER_DRAG: 800,
    ENEMY_SPEED: 80
  },
  // ... rest unchanged
};

export function createPhaserConfig(scenes) {
  return {
    type: Phaser.AUTO,
    width: GAME_CONFIG.WIDTH,
    height: GAME_CONFIG.HEIGHT,
    parent: 'game-container',
    pixelArt: true,
    roundPixels: true,
    physics: {
      default: 'arcade',
      arcade: {
        gravity: { y: GAME_CONFIG.PHYSICS.GRAVITY },
        debug: false
      }
    },
    scene: scenes,
    scale: {
      mode: Phaser.Scale.RESIZE,          // was FIT
      autoCenter: Phaser.Scale.CENTER_BOTH
    }
  };
}
```

**Step 2: Make UIScene responsive**

Replace all hardcoded positions (800, 600) with `this.cameras.main.width/height`. Add a `resize` event handler to reposition elements on window resize:

```javascript
// UIScene.js - add resize handler in create()
this.scale.on('resize', (gameSize) => {
  this.repositionHUD(gameSize.width, gameSize.height);
});
```

Key anchoring rules:
- HP/MP bars: top-left, fixed offset (20, 18)
- Score: top-center, `width/2`
- Keys: top-right, `width - 200`
- Level name: top-right, `width - 80`
- Controls hint: bottom-center, `(width/2, height - 15)`
- Top bar: `(0, 0, width, 50)`
- Bottom bar: `(0, height - 30, width, 30)`

**Step 3: Update GameOverScene and VictoryScene**

Replace hardcoded `width/2`, `height/2` references with `this.cameras.main.width/height` (these already use `this.cameras.main.width` so should mostly work, but verify).

**Step 4: Expand level 1 map to 80x60**

In `levels.js`, update `generateLevel1Map()`:
- Change `const W = 50, H = 40` → `const W = 80, H = 60`
- Scale wall/decoration positions proportionally to fill larger map
- Add more decoration variety to fill expanded space
- Update portal position to new bottom-right area
- Keep Level 2 at 50x40 initially (different areas can have different sizes)

**Step 5: Verify**

Run `npm run dev`, confirm:
- Game fills browser window
- HUD elements anchored correctly at all window sizes
- Resize window → HUD repositions
- Level 1 map is larger, camera follows player properly

**Step 6: Commit**

```bash
git add src/config/gameConfig.js src/scenes/UIScene.js src/scenes/MainGameScene.js src/scenes/GameOverScene.js src/scenes/VictoryScene.js src/data/levels.js
git commit -m "feat: fullscreen RESIZE mode + responsive HUD + expanded map 80x60"
```

---

## Task 2: Stats Engine Expansion (6 Attributes)

**Files:**
- Modify: `src/systems/Stats.js`
- Modify: `src/entities/Player.js` (constructor stats)
- Modify: `src/data/items.json` (enemy stats)

**Step 1: Expand Stats.js to 6 attributes**

Add PER and LCK to DEFAULT_BASE_STATS, update getDerived() with all new formulas per design doc:

```javascript
// Stats.js
export const DEFAULT_BASE_STATS = {
  con: 10, str: 8, int: 5, agi: 8, per: 5, lck: 3
};

// In getDerived():
this._cache = {
  maxHp:       con * 10 + this.flatBonuses.maxHp,       // +Level*5 added by LevelSystem
  maxMp:       int * 15         + this.flatBonuses.maxMp,  // was int*10
  attack:      str * 2          + this.flatBonuses.attack,
  spellPower:  int * 1          + this.flatBonuses.spellPower,
  moveSpeed:   agi * 20 + 40    + this.flatBonuses.moveSpeed,
  attackSpeed: 1.0 + agi * 0.01 + this.flatBonuses.attackSpeed,
  hpRegen:     con * 0.5        + this.flatBonuses.hpRegen,
  critDmg:     1.5 + str * 0.1  + this.flatBonuses.critDmg,
  critRate:    per * 0.5         + this.flatBonuses.critRate,      // NEW
  tenacity:    con * 0.5 + str * 0.2 + this.flatBonuses.tenacity, // NEW formula
  armorPen:    str * 0.3 + per * 0.5 + this.flatBonuses.armorPen, // NEW
  defense:     this.flatBonuses.defense,
  dropBonus:   Math.sqrt(lck) * 1.0 + this.flatBonuses.dropBonus, // NEW (%)
  cdr:         Math.min(40, int * 0.2) + this.flatBonuses.cdr,    // NEW (%)
  encumbrance: this.flatBonuses.encumbrance                       // NEW (reserved)
};
```

Add `per` and `lck` to bonuses object, flatBonuses object, getEffective(), levelUp(), toJSON(), fromJSON().

**Step 2: Update Player constructor**

```javascript
// Player.js constructor
const statsConfig = { con: 10, str: 8, int: 5, agi: 8, per: 5, lck: 3 };
```

**Step 3: Update enemy stats in items.json**

Add `per` and `lck` fields to each enemy's stats object. Most enemies get low values:

```json
"slime":    { "stats": { "con": 3, "str": 5, "int": 1, "agi": 1, "per": 1, "lck": 1 } },
"skeleton": { "stats": { "con": 5, "str": 7, "int": 2, "agi": 1, "per": 2, "lck": 1 } },
// ... etc for all 9 enemies
```

Also add `"level"` field to each enemy (derived from total stats):
```json
"slime": { ..., "level": 2 },
"skeleton_king": { ..., "level": 7 }
```

**Step 4: Update Enemy.js stats derivation fallback**

In Enemy constructor, add per/lck to the fallback stats calculation:

```javascript
const statsConfig = mergedConfig.stats || {
  con: Math.ceil(mergedConfig.hp / 10),
  str: Math.ceil(mergedConfig.damage / 2),
  int: 1,
  agi: Math.ceil(mergedConfig.speed / 10),
  per: 1,  // NEW
  lck: 1   // NEW
};
```

**Step 5: Verify**

Run game. Player should have same HP (CON 10 → 100 HP) but MP now 75 (INT 5 × 15). Combat should still work.

**Step 6: Commit**

```bash
git add src/systems/Stats.js src/entities/Player.js src/entities/Enemy.js src/data/items.json
git commit -m "feat: expand Stats engine to 6 attributes (PER, LCK) + new derived stats"
```

---

## Task 3: Level System (XP, Leveling, Stat Points)

**Files:**
- Create: `src/systems/LevelSystem.js`
- Modify: `src/scenes/MainGameScene.js` (integrate leveling)
- Modify: `src/entities/Player.js` (add level/xp fields)
- Modify: `src/config/gameConfig.js` (add level to DEFAULT_STATE)

**Step 1: Create LevelSystem.js**

```javascript
// src/systems/LevelSystem.js
export class LevelSystem {
  constructor(scene) {
    this.scene = scene;
    this.level = 1;
    this.xp = 0;
    this.statPoints = 0;
    this.skillPoints = 0;
  }

  getXpRequired() {
    return Math.floor(50 * Math.pow(this.level, 2.2) - this.level * 10);
  }

  addXp(amount, enemyLevel = 0) {
    // Level compensation
    if (enemyLevel > 0) {
      const diff = enemyLevel - this.level;
      if (diff >= 5) amount = Math.floor(amount * 1.5);
      else if (diff <= -5) amount = Math.floor(amount * 0.1);
    }
    this.xp += amount;
    this.scene.events.emit('xpChanged', this.xp, this.getXpRequired());

    // Check level up
    while (this.xp >= this.getXpRequired()) {
      this.xp -= this.getXpRequired();
      this.levelUp();
    }
  }

  levelUp() {
    this.level++;
    this.statPoints += 5;
    if (this.level % 3 === 0) this.skillPoints += 1;

    this.scene.events.emit('levelUp', this.level, this.statPoints, this.skillPoints);
    this.scene.events.emit('xpChanged', this.xp, this.getXpRequired());
  }

  allocateStat(statName) {
    if (this.statPoints <= 0) return false;
    this.statPoints--;
    this.scene.events.emit('statPointsChanged', this.statPoints);
    return true;
  }

  getEnemyXp(enemyConfig) {
    const enemyLevel = enemyConfig.level || 1;
    return enemyLevel * 15;
  }

  toJSON() {
    return { level: this.level, xp: this.xp, statPoints: this.statPoints, skillPoints: this.skillPoints };
  }

  fromJSON(data) {
    if (!data) return;
    this.level = data.level || 1;
    this.xp = data.xp || 0;
    this.statPoints = data.statPoints || 0;
    this.skillPoints = data.skillPoints || 0;
  }
}
```

**Step 2: Add level to Player**

In Player constructor, add `this.level` field. In `onHpChanged()`, also emit level info. Add method `getLevel()`.

**Step 3: Integrate into MainGameScene**

- Import and instantiate `LevelSystem` in `create()`
- Store in `this.levelSystem` and in registry: `this.registry.set('levelSystem', this.levelSystem)`
- In `enemyDeath` event handler: call `this.levelSystem.addXp(this.levelSystem.getEnemyXp(enemy.config), enemy.config.level)`
- Listen for `levelUp` event → trigger level-up effects (flash, heal, screen text)
- Apply `Level*5` bonus to maxHp via `player.stats.setFlatBonus('maxHp', (level-1)*5)`

**Step 4: Level-up visual effects**

In MainGameScene, on `levelUp` event:

```javascript
this.events.on('levelUp', (level, statPoints, skillPoints) => {
  // Full HP/MP restore
  this.player.hp = this.player.maxHp;
  this.player.mp = this.player.maxMp;
  this.player.onHpChanged();

  // White flash
  const flash = this.add.rectangle(
    this.cameras.main.scrollX + this.cameras.main.width/2,
    this.cameras.main.scrollY + this.cameras.main.height/2,
    this.cameras.main.width, this.cameras.main.height,
    0xffffff, 0
  ).setDepth(200).setScrollFactor(0);

  this.tweens.add({
    targets: flash, alpha: 0.6, duration: 150, yoyo: true,
    onComplete: () => flash.destroy()
  });

  // Gold tint on player
  this.player.sprite.setTint(0xffd700);
  this.time.delayedCall(1000, () => this.player.sprite.clearTint());

  // "LEVEL UP!" floating text
  const lvlText = this.add.text(
    this.cameras.main.width/2, this.cameras.main.height/2 - 50,
    `LEVEL UP! LV.${level}`, {
      fontSize: '28px', fill: '#ffd700', fontFamily: 'Courier New', fontStyle: 'bold'
    }
  ).setOrigin(0.5).setDepth(201).setScrollFactor(0);

  this.tweens.add({
    targets: lvlText, y: lvlText.y - 60, alpha: 0,
    scaleX: 1.5, scaleY: 1.5, duration: 2000,
    onComplete: () => lvlText.destroy()
  });
});
```

**Step 5: Update SaveSystem**

Add levelSystem data to save/load flow.

**Step 6: Verify**

Kill enemies → see XP notifications → level up → golden flash + "LEVEL UP!" text + HP/MP restored.

**Step 7: Commit**

```bash
git add src/systems/LevelSystem.js src/scenes/MainGameScene.js src/entities/Player.js src/config/gameConfig.js src/systems/SaveSystem.js
git commit -m "feat: XP/leveling system with level-up effects and stat points"
```

---

## Task 4: Inventory System Expansion

**Files:**
- Modify: `src/systems/InventorySystem.js`
- Modify: `src/data/items.json`

**Step 1: Expand items.json with rarity, stacking, categories**

Add `rarity`, `stackable`, `maxStack`, `level`, `sellPrice`, `category` fields to each item:

```json
{
  "items": {
    "coin": {
      "id": "coin", "name": "金币", "type": "currency",
      "rarity": "common", "stackable": true, "maxStack": 9999,
      "level": 1, "sellPrice": 0, "value": 10,
      "description": "闪闪发光的金币"
    },
    "potion": {
      "id": "potion", "name": "回复药水", "type": "consumable",
      "rarity": "common", "stackable": true, "maxStack": 99,
      "level": 1, "sellPrice": 5, "value": 25,
      "description": "恢复25点生命值"
    }
    // ... update all items similarly
  }
}
```

**Step 2: Rewrite InventorySystem for stacking + 32 slots**

```javascript
// InventorySystem.js - key changes
export class InventorySystem {
  constructor(scene) {
    this.scene = scene;
    this.slots = new Array(32).fill(null); // 8x4 grid
    this.gold = 0;
  }

  addItem(itemData, quantity = 1) {
    // If currency (gold), just add to gold counter
    if (itemData.type === 'currency') {
      this.gold += itemData.value * quantity;
      this.scene.events.emit('goldChanged', this.gold);
      return true;
    }

    // Try stacking first
    if (itemData.stackable) {
      const existing = this.slots.findIndex(
        s => s && s.id === itemData.id && s.quantity < (itemData.maxStack || 99)
      );
      if (existing !== -1) {
        this.slots[existing].quantity = Math.min(
          (this.slots[existing].quantity || 1) + quantity,
          itemData.maxStack || 99
        );
        this.scene.events.emit('inventoryUpdated', this.slots);
        return true;
      }
    }

    // Find empty slot
    const emptyIndex = this.slots.findIndex(s => s === null);
    if (emptyIndex === -1) return false; // Full

    this.slots[emptyIndex] = {
      ...itemData,
      quantity: quantity,
      slotIndex: emptyIndex
    };
    this.scene.events.emit('inventoryUpdated', this.slots);
    return true;
  }

  removeItem(slotIndex, quantity = 1) { /* ... */ }
  useItem(slotIndex) { /* ... */ }
  swapSlots(fromIndex, toIndex) { /* ... */ }
  sortBy(criteria) { /* 'level' | 'type' | 'rarity' */ }
  filterBy(type) { /* 'all' | 'consumable' | 'equipment' | 'material' | 'quest' */ }
  getSlot(index) { return this.slots[index]; }
  exportData() { return { slots: this.slots.map(s => s ? {...s} : null), gold: this.gold }; }
  importData(data) { /* restore slots and gold */ }
}
```

**Step 3: Update MainGameScene item collection**

Gold (coins) now go to `inventory.gold` instead of `gameState.score`. Score becomes a separate tracking metric (kill score vs gold currency). Update `createItems()` coin callback:

```javascript
onCollect: (item) => {
  this.inventory.addItem(itemData.items.coin);
  // Also add score
  const g = this.registry.get('gameState');
  g.score += item.value;
  this.registry.set('gameState', g);
  this.events.emit('scoreChanged', g.score);
}
```

**Step 4: Update SaveSystem for new inventory format**

**Step 5: Verify**

Collect coins → gold counter increases. Collect potions → stack in inventory. Fill 32 slots → "背包已满".

**Step 6: Commit**

```bash
git add src/systems/InventorySystem.js src/data/items.json src/scenes/MainGameScene.js src/systems/SaveSystem.js
git commit -m "feat: expanded inventory with 32 slots, stacking, rarity, gold system"
```

---

## Task 5: Panel Framework (PanelScene + Tab Navigation)

**Files:**
- Create: `src/scenes/PanelScene.js`
- Modify: `src/main.js` (register PanelScene)
- Modify: `src/scenes/MainGameScene.js` (TAB key handler, pause integration)

**Step 1: Create PanelScene.js**

```javascript
// src/scenes/PanelScene.js
import Phaser from 'phaser';

const TABS = ['character', 'inventory', 'skillTree', 'questLog'];
const TAB_LABELS = ['角色', '背包', '技能', '日志'];

export class PanelScene extends Phaser.Scene {
  constructor() {
    super({ key: 'PanelScene' });
    this.activeTab = 'character';
    this.isOpen = false;
    this.tabContainers = {};
  }

  create() {
    this.gameScene = this.scene.get('MainGameScene');
    const w = this.cameras.main.width;
    const h = this.cameras.main.height;

    // Overlay background (darkened)
    this.overlay = this.add.rectangle(w/2, h/2, w, h, 0x000000, 0.6)
      .setScrollFactor(0).setDepth(0);

    // Panel container - 80% of screen
    this.panelW = Math.min(w * 0.8, 900);
    this.panelH = Math.min(h * 0.8, 600);
    this.panelX = w / 2;
    this.panelY = h / 2;

    this.panelBg = this.add.rectangle(this.panelX, this.panelY, this.panelW, this.panelH, 0x1a1a2e, 0.95)
      .setStrokeStyle(2, 0x4a4a6a).setScrollFactor(0).setDepth(1);

    // Tab bar
    this.createTabBar();

    // Create tab content containers (initially hidden)
    this.createCharacterTab();
    this.createInventoryTab();
    this.createSkillTreeTab();
    this.createQuestLogTab();

    // Show default tab
    this.switchTab('character');

    // Open animation
    this.panelRoot = this.add.container(0, 0);
    // ... add all elements to panelRoot

    // Input: ESC or TAB to close
    this.input.keyboard.on('keydown-ESC', () => this.closePanel());
    this.input.keyboard.on('keydown-TAB', (e) => { e.preventDefault(); this.closePanel(); });

    // Number keys to switch tabs
    this.input.keyboard.on('keydown-ONE', () => this.switchTab('character'));
    this.input.keyboard.on('keydown-TWO', () => this.switchTab('inventory'));
    this.input.keyboard.on('keydown-THREE', () => this.switchTab('skillTree'));
    this.input.keyboard.on('keydown-FOUR', () => this.switchTab('questLog'));

    // Resize handler
    this.scale.on('resize', (gameSize) => this.handleResize(gameSize.width, gameSize.height));

    // Open animation
    this.playOpenAnimation();
  }

  createTabBar() { /* 4 tab buttons at top of panel */ }
  switchTab(tabName) { /* hide all containers, show selected, update tab highlights */ }
  createCharacterTab() { /* placeholder - filled in Task 6 */ }
  createInventoryTab() { /* placeholder - filled in Task 7 */ }
  createSkillTreeTab() { /* placeholder - filled in Task 9 */ }
  createQuestLogTab() { /* placeholder - filled in Task 10 */ }

  playOpenAnimation() {
    // Scale 0.8 → 1 + alpha 0 → 1
  }

  closePanel() {
    // Scale 1 → 0.8 + alpha 1 → 0, then stop scene, resume game
    this.tweens.add({
      targets: [this.panelBg, this.overlay], alpha: 0,
      duration: 150, ease: 'Back.easeIn',
      onComplete: () => {
        this.scene.stop('PanelScene');
        this.gameScene.resumeGame();
      }
    });
  }

  handleResize(w, h) { /* reposition all elements */ }
}
```

**Step 2: Add TAB key handler to MainGameScene**

```javascript
// MainGameScene.js - in create() or setupEvents()
this.tabKey = this.input.keyboard.addKey(Phaser.Input.Keyboard.KeyCodes.TAB);
this.iKey = this.input.keyboard.addKey(Phaser.Input.Keyboard.KeyCodes.I);

const openPanel = () => {
  if (this.scene.isActive('PanelScene')) return;
  this.pauseGame();
  this.scene.launch('PanelScene');
  this.scene.bringToTop('PanelScene');
};

this.tabKey.on('down', (e) => { e.originalEvent?.preventDefault(); openPanel(); });
this.iKey.on('down', openPanel);

// Pause/resume methods
pauseGame() {
  this.physics.pause();
  this.gamePaused = true;
}
resumeGame() {
  this.physics.resume();
  this.gamePaused = false;
}
```

In `update()`, early return if `this.gamePaused`.

**Step 3: Register PanelScene in main.js**

```javascript
import { PanelScene } from './scenes/PanelScene.js';
const scenes = [BootScene, MainGameScene, UIScene, PanelScene, GameOverScene, VictoryScene];
```

**Step 4: Verify**

Press TAB → panel opens with dark overlay, game pauses. Press ESC → panel closes, game resumes. Number keys 1-4 switch tabs (placeholder content).

**Step 5: Commit**

```bash
git add src/scenes/PanelScene.js src/main.js src/scenes/MainGameScene.js
git commit -m "feat: panel framework with TAB toggle, pause integration, tab navigation"
```

---

## Task 6: Character Tab (Paper Doll + Stats + Stat Points)

**Files:**
- Modify: `src/scenes/PanelScene.js` (fill in createCharacterTab)

**Step 1: Implement Character Tab layout**

Left side: paper doll area with 8 equipment slot placeholders + character preview sprite + level/XP bar.

Right side: 6 base stats with `[+]` buttons + foldable derived stats list.

Key implementation details:

```javascript
createCharacterTab() {
  const container = this.add.container(0, 0).setVisible(false);
  this.tabContainers.character = container;

  const leftX = this.panelX - this.panelW/2 + this.panelW * 0.25;
  const rightX = this.panelX + this.panelW * 0.05;
  const topY = this.panelY - this.panelH/2 + 70;

  // --- LEFT: Paper Doll ---
  // Character preview (idle animation)
  const preview = this.add.sprite(leftX, topY + 120, 'hero_00');
  preview.setDisplaySize(72, 104);
  preview.play('hero_idle');
  container.add(preview);

  // 8 equipment slots (gray boxes with dashed borders)
  const slotPositions = [
    { x: 0, y: -80, label: '头盔' },    // helmet
    { x: 0, y: 0, label: '护甲' },      // armor (behind preview)
    { x: -60, y: -40, label: '项链' },   // necklace
    { x: 60, y: -40, label: '戒指' },    // ring1
    { x: -60, y: 40, label: '副手' },    // offhand
    { x: 60, y: 40, label: '戒指' },     // ring2
    { x: -60, y: -100, label: '武器' },  // weapon
    { x: 0, y: 80, label: '靴子' }       // boots
  ];
  slotPositions.forEach(pos => {
    const slot = this.add.rectangle(leftX + pos.x, topY + 120 + pos.y, 36, 36, 0x2a2a3a, 0.8)
      .setStrokeStyle(1, 0x555555);
    const label = this.add.text(leftX + pos.x, topY + 120 + pos.y + 22, pos.label, {
      fontSize: '8px', fill: '#666666', fontFamily: 'Courier New'
    }).setOrigin(0.5);
    container.add([slot, label]);
  });

  // "装备系统开发中" text
  const devText = this.add.text(leftX, topY + 240, '装备系统开发中...', {
    fontSize: '10px', fill: '#555555', fontFamily: 'Courier New'
  }).setOrigin(0.5);
  container.add(devText);

  // Level + XP bar
  // ...

  // --- RIGHT: Stats ---
  const stats = ['con', 'str', 'int', 'agi', 'per', 'lck'];
  const statNames = ['体质(CON)', '力量(STR)', '智力(INT)', '敏捷(AGI)', '感知(PER)', '幸运(LCK)'];

  stats.forEach((stat, i) => {
    const y = topY + i * 36;
    // Stat name
    const nameText = this.add.text(rightX, y, statNames[i], {
      fontSize: '14px', fill: '#cccccc', fontFamily: 'Courier New'
    });
    // Stat value
    const valueText = this.add.text(rightX + 160, y, '0', {
      fontSize: '14px', fill: '#ffffff', fontFamily: 'Courier New'
    });
    // [+] button
    const plusBtn = this.add.text(rightX + 200, y, '[+]', {
      fontSize: '14px', fill: '#444444', fontFamily: 'Courier New'
    }).setInteractive({ useHandCursor: true });

    plusBtn.on('pointerdown', () => this.handleStatAllocation(stat, valueText, plusBtn));
    plusBtn.on('pointerover', () => plusBtn.setFill('#00ff00'));
    plusBtn.on('pointerout', () => this.updatePlusButtonColor(plusBtn));

    // Tooltip on hover over name
    nameText.setInteractive();
    nameText.on('pointerover', () => this.showStatTooltip(stat, nameText));
    nameText.on('pointerout', () => this.hideTooltip());

    container.add([nameText, valueText, plusBtn]);
    // Store references for refresh
    this['stat_' + stat + '_value'] = valueText;
    this['stat_' + stat + '_plus'] = plusBtn;
  });

  // Available stat points display
  this.statPointsText = this.add.text(rightX, topY + 6 * 36 + 10, '可用属性点: 0', {
    fontSize: '13px', fill: '#ffd700', fontFamily: 'Courier New'
  });
  container.add(this.statPointsText);

  // Derived stats (foldable)
  // ...
}
```

**Step 2: Implement stat allocation with visual feedback**

When `[+]` clicked: decrement stat points, increment base stat, show "+1" floating text in green, update derived stats display.

**Step 3: Implement tooltip system**

Hovering over stat name shows floating panel explaining the formula and current breakdown.

**Step 4: Refresh function**

`refreshCharacterTab()` reads current player stats, level system data, and updates all text elements.

**Step 5: Verify**

Open panel → Character tab shows paper doll with empty slots, stats list, can allocate stat points (if any). Derived stats update correctly.

**Step 6: Commit**

```bash
git add src/scenes/PanelScene.js
git commit -m "feat: character tab with paper doll, 6-stat display, stat point allocation"
```

---

## Task 7: Inventory Tab (Grid + Rarity + Sorting)

**Files:**
- Modify: `src/scenes/PanelScene.js` (fill in createInventoryTab)

**Step 1: Implement 8x4 grid**

```javascript
createInventoryTab() {
  const container = this.add.container(0, 0).setVisible(false);
  this.tabContainers.inventory = container;

  const gridStartX = this.panelX - this.panelW/2 + 40;
  const gridStartY = this.panelY - this.panelH/2 + 110;
  const cellSize = 48;
  const gap = 4;

  // Filter bar
  // Sort bar
  // Gold display

  // Grid cells
  this.invSlots = [];
  for (let row = 0; row < 4; row++) {
    for (let col = 0; col < 8; col++) {
      const x = gridStartX + col * (cellSize + gap);
      const y = gridStartY + row * (cellSize + gap);
      const slotIndex = row * 8 + col;

      const cell = this.add.rectangle(x, y, cellSize, cellSize, 0x3a3a3a, 0.8)
        .setStrokeStyle(1, 0x666666).setOrigin(0, 0).setInteractive({ useHandCursor: true });

      cell.on('pointerover', () => {
        cell.setScale(1.05);
        cell.setStrokeStyle(2, 0xffffff);
        this.showItemTooltip(slotIndex);
      });
      cell.on('pointerout', () => {
        cell.setScale(1);
        this.restoreSlotBorder(cell, slotIndex);
        this.hideTooltip();
      });
      cell.on('pointerdown', (pointer) => {
        if (pointer.rightButtonDown()) this.showContextMenu(slotIndex, pointer);
        else this.selectItem(slotIndex);
      });

      this.invSlots.push({ cell, icon: null, countText: null, index: slotIndex });
      container.add(cell);
    }
  }

  // Detail panel at bottom
  this.itemDetailBg = this.add.rectangle(/* ... */);
  this.itemDetailName = this.add.text(/* ... */);
  this.itemDetailDesc = this.add.text(/* ... */);
  this.itemDetailButtons = []; // Use, Drop buttons
  container.add([this.itemDetailBg, this.itemDetailName, this.itemDetailDesc]);
}
```

**Step 2: Implement rarity colors**

```javascript
const RARITY_COLORS = {
  common:    { bg: 0x3a3a3a, border: 0x666666 },
  uncommon:  { bg: 0x1a3a1a, border: 0x44bb44 },
  rare:      { bg: 0x1a1a3a, border: 0x4488ff },
  epic:      { bg: 0x2a1a3a, border: 0xbb44ff },
  legendary: { bg: 0x3a2a1a, border: 0xffaa00 }
};
```

**Step 3: Implement filter/sort buttons**

Filter by type, sort by level/type/rarity. Each button toggleable.

**Step 4: Implement context menu (right-click)**

Small popup near cursor with "使用" / "丢弃" options. "使用" calls `inventory.useItem()`, "丢弃" calls `inventory.removeItem()`.

**Step 5: Implement `refreshInventoryTab()`**

Reads inventory slots, updates grid icons, count badges, rarity borders, gold display.

**Step 6: Verify**

Open panel → Inventory tab shows 8x4 grid. Items display with correct icons/counts. Right-click shows context menu. Filter/sort works.

**Step 7: Commit**

```bash
git add src/scenes/PanelScene.js
git commit -m "feat: inventory tab with 8x4 grid, rarity colors, sort/filter, context menu"
```

---

## Task 8: Equipment System Stub

**Files:**
- Create: `src/systems/EquipmentSystem.js`
- Modify: `src/scenes/MainGameScene.js` (instantiate)

**Step 1: Create EquipmentSystem.js with stub interface**

```javascript
// src/systems/EquipmentSystem.js
export const EQUIP_SLOTS = ['helmet', 'armor', 'weapon', 'offhand', 'necklace', 'ring1', 'ring2', 'boots'];

export class EquipmentSystem {
  constructor(scene) {
    this.scene = scene;
    this.slots = {};
    EQUIP_SLOTS.forEach(s => this.slots[s] = null);
  }

  equip(slotName, item) {
    if (!EQUIP_SLOTS.includes(slotName)) return null;
    const prev = this.slots[slotName];
    this.slots[slotName] = item;
    this.scene.events.emit('equipmentChanged', slotName, item, prev);
    return prev; // return unequipped item
  }

  unequip(slotName) {
    const item = this.slots[slotName];
    this.slots[slotName] = null;
    this.scene.events.emit('equipmentChanged', slotName, null, item);
    return item;
  }

  getSlot(slotName) { return this.slots[slotName]; }

  getStatBonuses() {
    // Aggregate stat bonuses from all equipped items
    const bonuses = { con:0, str:0, int:0, agi:0, per:0, lck:0 };
    const flatBonuses = { maxHp:0, maxMp:0, attack:0, defense:0 };
    // When equipment items exist, iterate slots and sum their stat contributions
    return { bonuses, flatBonuses };
  }

  toJSON() { return { slots: { ...this.slots } }; }
  fromJSON(data) { if (data?.slots) this.slots = { ...data.slots }; }
}
```

**Step 2: Instantiate in MainGameScene and register**

**Step 3: Commit**

```bash
git add src/systems/EquipmentSystem.js src/scenes/MainGameScene.js
git commit -m "feat: equipment system stub with 8 slots interface"
```

---

## Task 9: Skill Tree System + Tab

**Files:**
- Create: `src/systems/SkillTreeSystem.js`
- Modify: `src/scenes/PanelScene.js` (fill in createSkillTreeTab)
- Modify: `src/scenes/MainGameScene.js` (instantiate)

**Step 1: Create SkillTreeSystem.js**

```javascript
// src/systems/SkillTreeSystem.js
export class SkillTreeSystem {
  constructor(scene) {
    this.scene = scene;
    this.nodes = [];       // Array of skill node definitions
    this.unlockedNodes = new Set(); // Set of unlocked node IDs
    this.initDefaultTree();
  }

  initDefaultTree() {
    // Placeholder tree structure - 1 root + 4 tier-1 + 2 tier-2 + 1 tier-3
    this.nodes = [
      { id: 'root', name: '起始', type: 'passive', tier: 0, x: 0, y: 0,
        prerequisites: [], requiredLevel: 1, cost: 0, maxRank: 1, currentRank: 1,
        effects: [], description: '冒险的起点' },
      { id: 'node_1a', name: '???', type: 'passive', tier: 1, x: -1.5, y: 1,
        prerequisites: ['root'], requiredLevel: 3, cost: 1, maxRank: 3, currentRank: 0,
        effects: [], description: '待填充' },
      { id: 'node_1b', name: '???', type: 'passive', tier: 1, x: -0.5, y: 1,
        prerequisites: ['root'], requiredLevel: 3, cost: 1, maxRank: 3, currentRank: 0,
        effects: [], description: '待填充' },
      { id: 'node_1c', name: '???', type: 'active', tier: 1, x: 0.5, y: 1,
        prerequisites: ['root'], requiredLevel: 3, cost: 1, maxRank: 3, currentRank: 0,
        effects: [], description: '待填充' },
      { id: 'node_1d', name: '???', type: 'active', tier: 1, x: 1.5, y: 1,
        prerequisites: ['root'], requiredLevel: 3, cost: 1, maxRank: 3, currentRank: 0,
        effects: [], description: '待填充' },
      { id: 'node_2a', name: '???', type: 'passive', tier: 2, x: -1, y: 2,
        prerequisites: ['node_1a', 'node_1b'], requiredLevel: 6, cost: 1, maxRank: 3, currentRank: 0,
        effects: [], description: '待填充' },
      { id: 'node_2b', name: '???', type: 'active', tier: 2, x: 1, y: 2,
        prerequisites: ['node_1c', 'node_1d'], requiredLevel: 6, cost: 1, maxRank: 3, currentRank: 0,
        effects: [], description: '待填充' },
      { id: 'node_3', name: '???', type: 'active', tier: 3, x: 0, y: 3,
        prerequisites: ['node_2a', 'node_2b'], requiredLevel: 10, cost: 2, maxRank: 1, currentRank: 0,
        effects: [], description: '待填充' }
    ];
    this.unlockedNodes.add('root');
  }

  canUnlock(nodeId) {
    const node = this.getNode(nodeId);
    if (!node || node.currentRank >= node.maxRank) return false;
    const levelSystem = this.scene.registry.get('levelSystem');
    if (!levelSystem || levelSystem.level < node.requiredLevel) return false;
    if (levelSystem.skillPoints < node.cost) return false;
    return node.prerequisites.every(p => this.unlockedNodes.has(p));
  }

  unlock(nodeId) {
    if (!this.canUnlock(nodeId)) return false;
    const node = this.getNode(nodeId);
    const levelSystem = this.scene.registry.get('levelSystem');
    levelSystem.skillPoints -= node.cost;
    node.currentRank++;
    if (node.currentRank >= 1) this.unlockedNodes.add(nodeId);
    this.scene.events.emit('skillUnlocked', nodeId, node);
    return true;
  }

  getNode(id) { return this.nodes.find(n => n.id === id); }

  getNodeState(nodeId) {
    const node = this.getNode(nodeId);
    if (!node) return 'unknown';
    if (this.unlockedNodes.has(nodeId) && node.currentRank >= node.maxRank) return 'maxed';
    if (this.unlockedNodes.has(nodeId)) return 'unlocked';
    if (this.canUnlock(nodeId)) return 'available';
    return 'locked';
  }

  toJSON() { return { unlockedNodes: [...this.unlockedNodes], nodes: this.nodes.map(n => ({ id: n.id, currentRank: n.currentRank })) }; }
  fromJSON(data) { /* restore */ }
}
```

**Step 2: Implement SkillTree Tab in PanelScene**

Draw nodes as circles (passive) / squares (active) connected by lines. Color by state. Click to unlock with confirmation. Bottom detail panel.

```javascript
createSkillTreeTab() {
  const container = this.add.container(0, 0).setVisible(false);
  this.tabContainers.skillTree = container;

  // Skill points display
  // Draw connection lines between nodes
  // Draw each node as circle or square
  // Node interaction (hover, click)
  // Bottom detail panel
}
```

Node positioning: use `node.x * spacing + centerX` and `node.y * spacing + startY` to layout the tree visually.

**Step 3: Instantiate in MainGameScene and register**

**Step 4: Verify**

Open panel → Skill Tree tab shows node graph. Root node is golden. Tier 1 nodes are white if unlockable, gray otherwise. Click unlockable node → confirmation → unlock animation.

**Step 5: Commit**

```bash
git add src/systems/SkillTreeSystem.js src/scenes/PanelScene.js src/scenes/MainGameScene.js
git commit -m "feat: skill tree system + visual tab with placeholder nodes"
```

---

## Task 10: Quest System + Quest Log Tab

**Files:**
- Create: `src/systems/QuestSystem.js`
- Create: `src/data/quests.js`
- Modify: `src/scenes/PanelScene.js` (fill in createQuestLogTab)
- Modify: `src/scenes/MainGameScene.js` (integrate quest events)

**Step 1: Create quest data**

```javascript
// src/data/quests.js
export const questData = [
  {
    id: 'main_level1', title: '逃出迷雾森林', type: 'main',
    description: '远古的迷雾笼罩着这片森林，找到传送门逃离这里。',
    triggerLevel: 0,  // auto-activate on level 0
    objectives: [
      { id: 'talk_elder', text: '与村长对话', type: 'interact', target: 'elder', required: 1 },
      { id: 'collect_keys_l1', text: '收集 2 把钥匙', type: 'collect', target: 'key', required: 2 },
      { id: 'find_portal', text: '到达传送门', type: 'reach', target: 'portal', required: 1 }
    ],
    rewards: { xp: 100, gold: 50 }
  },
  {
    id: 'side_kill_slimes', title: '清除史莱姆', type: 'side',
    description: '这片森林的史莱姆越来越多，帮忙清理一些。',
    triggerLevel: 0, triggerNpc: 'elder',
    objectives: [
      { id: 'kill_slimes', text: '击败 5 只史莱姆', type: 'kill', target: 'slime', required: 5 }
    ],
    rewards: { xp: 60, gold: 30 }
  },
  {
    id: 'side_collect_potions', title: '收集药水', type: 'side',
    description: '旅行商人需要一些药水样本。',
    triggerLevel: 0, triggerNpc: 'merchant',
    objectives: [
      { id: 'collect_potions', text: '收集 3 瓶药水', type: 'collect', target: 'potion', required: 3 }
    ],
    rewards: { xp: 40, gold: 20 }
  },
  {
    id: 'main_level2', title: '寻找远古神器', type: 'main',
    description: '探索古老废墟深处，找到传说中的远古神器。',
    triggerLevel: 1,
    objectives: [
      { id: 'talk_guardian', text: '与守卫者对话', type: 'interact', target: 'guardian', required: 1 },
      { id: 'find_artifact', text: '找到远古神器', type: 'collect', target: 'artifact', required: 1 },
      { id: 'reach_exit', text: '到达出口', type: 'reach', target: 'end', required: 1 }
    ],
    rewards: { xp: 200, gold: 100 }
  }
];
```

**Step 2: Create QuestSystem.js**

```javascript
// src/systems/QuestSystem.js
import { questData } from '../data/quests.js';

export class QuestSystem {
  constructor(scene) {
    this.scene = scene;
    this.quests = questData.map(q => ({
      ...q,
      status: 'locked',    // locked / active / completed
      objectives: q.objectives.map(o => ({ ...o, current: 0 }))
    }));
    this.setupEventListeners();
  }

  setupEventListeners() {
    // Kill tracking
    this.scene.events.on('enemyDeath', (enemy) => {
      this.updateObjectives('kill', enemy.config?.id, 1);
    });

    // Collect tracking
    this.scene.events.on('keysChanged', (count) => {
      this.setObjectiveProgress('collect', 'key', count);
    });

    // Interact tracking
    this.scene.events.on('playerInteract', (target) => {
      const npcId = target?.npcInstance?.id || target?.id;
      if (npcId) {
        this.updateObjectives('interact', npcId, 1);
        this.checkNpcQuestTrigger(npcId);
      }
    });
  }

  activateQuestsForLevel(levelIndex) {
    this.quests.forEach(q => {
      if (q.triggerLevel === levelIndex && q.status === 'locked' && !q.triggerNpc) {
        q.status = 'active';
        this.scene.events.emit('questActivated', q);
      }
    });
  }

  checkNpcQuestTrigger(npcId) {
    this.quests.forEach(q => {
      if (q.triggerNpc === npcId && q.status === 'locked') {
        q.status = 'active';
        this.scene.events.emit('questActivated', q);
      }
    });
  }

  updateObjectives(type, target, amount) {
    this.quests.filter(q => q.status === 'active').forEach(q => {
      q.objectives.filter(o => o.type === type && o.target === target).forEach(o => {
        o.current = Math.min(o.required, o.current + amount);
      });
      this.checkQuestCompletion(q);
    });
    this.scene.events.emit('questProgressUpdated');
  }

  setObjectiveProgress(type, target, value) {
    this.quests.filter(q => q.status === 'active').forEach(q => {
      q.objectives.filter(o => o.type === type && o.target === target).forEach(o => {
        o.current = Math.min(o.required, value);
      });
      this.checkQuestCompletion(q);
    });
    this.scene.events.emit('questProgressUpdated');
  }

  checkQuestCompletion(quest) {
    if (quest.objectives.every(o => o.current >= o.required)) {
      quest.status = 'completed';
      this.scene.events.emit('questCompleted', quest);
      // Award rewards
      if (quest.rewards.xp) {
        const ls = this.scene.registry.get('levelSystem');
        if (ls) ls.addXp(quest.rewards.xp);
      }
      if (quest.rewards.gold) {
        this.scene.inventory.gold += quest.rewards.gold;
        this.scene.events.emit('goldChanged', this.scene.inventory.gold);
      }
    }
  }

  getActiveQuests() { return this.quests.filter(q => q.status === 'active'); }
  getCompletedQuests() { return this.quests.filter(q => q.status === 'completed'); }
  getTrackedQuest() { return this.getActiveQuests()[0] || null; }

  toJSON() { return this.quests.map(q => ({ id: q.id, status: q.status, objectives: q.objectives.map(o => ({ id: o.id, current: o.current })) })); }
  fromJSON(data) { /* restore progress */ }
}
```

**Step 3: Implement Quest Log Tab in PanelScene**

Dual-column layout: left = quest list grouped by main/side/completed, right = selected quest detail with objectives and rewards.

**Step 4: Integrate into MainGameScene**

```javascript
// In create():
this.questSystem = new QuestSystem(this);
this.registry.set('questSystem', this.questSystem);

// In loadLevel():
this.questSystem.activateQuestsForLevel(levelIndex);
```

**Step 5: Verify**

Start game → main quest auto-activates. Talk to elder → quest progress updates. Open panel → Quest Log shows quest list and details.

**Step 6: Commit**

```bash
git add src/systems/QuestSystem.js src/data/quests.js src/scenes/PanelScene.js src/scenes/MainGameScene.js
git commit -m "feat: quest system with event-driven tracking + quest log panel"
```

---

## Task 11: HUD Improvements (XP Bar, HP Ghosting, Quest Tracker)

**Files:**
- Modify: `src/scenes/UIScene.js`

**Step 1: Add XP bar below MP bar**

Purple bar at y=48, same width as HP bar. Listen for `xpChanged` event.

**Step 2: Add level display**

"LV.1" text next to HP area. Listen for `levelUp` event.

**Step 3: Implement HP bar ghosting**

Add white "ghost" rectangle behind HP bar. On HP decrease, ghost bar delays 500ms then tweens to match current HP width.

```javascript
// In updateHealthBar():
const newWidth = Math.max(0, 148 * percentage);
// Ghost bar - only on decrease
if (newWidth < this.hpBar.width) {
  this.hpGhost.width = this.hpBar.width; // set ghost to old width
  this.tweens.add({
    targets: this.hpGhost,
    width: newWidth,
    duration: 500, delay: 200,
    ease: 'Quad.easeOut'
  });
}
this.hpBar.width = newWidth;
```

**Step 4: Add quest tracker in bottom-right**

Small semi-transparent panel showing current tracked quest's 1-2 objectives. Listen for `questProgressUpdated` and `questActivated` events.

**Step 5: Update controls hint**

Add "TAB:面板" to the bottom bar text.

**Step 6: Add gold display to HUD**

Gold coin icon + amount near key display. Listen for `goldChanged` event.

**Step 7: Verify**

Play game → XP bar fills on kills. HP ghost effect on damage. Quest objectives show in bottom-right. Level number updates on level-up.

**Step 8: Commit**

```bash
git add src/scenes/UIScene.js
git commit -m "feat: HUD improvements - XP bar, HP ghosting, quest tracker, gold display"
```

---

## Task 12: Combat Interaction Improvements

**Files:**
- Modify: `src/entities/Player.js`
- Modify: `src/scenes/MainGameScene.js`

**Step 1: Input buffering**

In Player, add `pendingAttack` flag. During attack states, if mouse clicked, set `pendingAttack = true`. In `handleAttackRecovery()`, check and execute buffered attack:

```javascript
// Player.js
handleAttackRecovery() {
  this.sprite.setVelocity(0, 0);
  if (this.stateTimer >= 150) {
    if (this.pendingAttack) {
      this.pendingAttack = false;
      this.tryAttack();
    } else {
      this.setState(PlayerState.IDLE);
    }
  }
}

// In tryAttack():
if (this.isAttacking()) {
  this.pendingAttack = true; // buffer it
  return;
}
```

**Step 2: Interaction priority queue**

In MainGameScene, replace direct `setInteractTarget` with a priority-based system:

```javascript
// MainGameScene.js
getInteractionPriority(entity) {
  if (entity.npcInstance && entity.npcInstance.dialogues) return 10; // NPC
  if (entity.chestInstance) return 8; // Chest
  if (entity.portalInstance) return 6; // Portal
  if (entity.itemInstance) return 4; // Ground item
  return 2; // Environment
}
```

When multiple overlaps active, pick highest priority within ±45° of facing direction.

**Step 3: Wall collision elasticity**

In Player constructor, change `setBounce(0.1)` to `setBounce(0.05)` for subtle bounce.

**Step 4: Y-sort stability**

In MainGameScene update loop, when setting depth, use `sprite.y + sprite.x * 0.001` to break ties stably.

**Step 5: Verify**

Attack → click during recovery → attack chains immediately. Multiple interactables nearby → correct priority. Collide with wall → subtle bounce.

**Step 6: Commit**

```bash
git add src/entities/Player.js src/scenes/MainGameScene.js
git commit -m "feat: input buffering, interaction priority queue, collision elasticity"
```

---

## Task 13: Save System Update + Integration Polish

**Files:**
- Modify: `src/systems/SaveSystem.js`
- Modify: `src/scenes/MainGameScene.js`
- Modify: `src/scenes/BootScene.js`
- Modify: `src/scenes/GameOverScene.js`
- Modify: `src/scenes/VictoryScene.js`

**Step 1: Expand SaveSystem to persist all new systems**

```javascript
// SaveSystem.save() additions:
const saveData = {
  // ... existing fields
  version: '2.0.0',
  levelSystem: scene.levelSystem?.toJSON(),
  equipment: scene.equipmentSystem?.toJSON(),
  skillTree: scene.skillTreeSystem?.toJSON(),
  quests: scene.questSystem?.toJSON(),
  inventory: scene.inventory?.exportData() // now includes gold + 32 slots
};
```

**Step 2: Update load() to restore new systems**

**Step 3: Update BootScene DEFAULT_STATE**

Add `level: 1, xp: 0, statPoints: 0, skillPoints: 0` to initial registry state.

**Step 4: Update GameOverScene and VictoryScene reset**

Include new fields in reset state object.

**Step 5: Wire up all event connections**

Ensure all systems are properly connected:
- LevelSystem ↔ Stats (maxHp level bonus)
- QuestSystem ↔ events (kill/collect/interact tracking)
- EquipmentSystem ↔ Stats (bonuses when equipment exists)
- SkillTreeSystem ↔ LevelSystem (skill point spending)

**Step 6: Verify**

Full play-through: kill enemies (XP), level up (stat points), allocate stats, complete quests, transition levels, save/load preserves all progress.

**Step 7: Commit**

```bash
git add src/systems/SaveSystem.js src/scenes/MainGameScene.js src/scenes/BootScene.js src/scenes/GameOverScene.js src/scenes/VictoryScene.js
git commit -m "feat: save system v2 with full persistence for all new systems"
```

---

## Task 14: Map Expansion + Level 1 Content

**Files:**
- Modify: `src/data/levels.js`

**Step 1: Rewrite generateLevel1Map for 80x60**

Larger map with more varied areas:
- More wall structures creating distinct zones
- Multiple water features with bridges
- Dense forest areas
- Open plains with scattered enemies
- More chest placements
- Additional sign positions

**Step 2: Update Level 1 enemy counts**

More enemies to fill the larger map:
```javascript
enemies: [
  { type: 'slime', count: 5 },
  { type: 'goblin', count: 4 },
  { type: 'spider', count: 3 },
  { type: 'bat', count: 4 },
  { type: 'skeleton', count: 3 },
  { type: 'orc_warrior', count: 2 },
  { type: 'fire_mage', count: 1 },
  { type: 'giant_skeleton', count: 1 },
  { type: 'skeleton_king', count: 1 }
],
items: { coins: 20, keys: 3, potions: 8, hasArtifact: false }
```

**Step 3: Update NPC positions for larger map**

**Step 4: Verify**

Play Level 1 → map feels spacious, enemies distributed well, can find all items and reach portal.

**Step 5: Commit**

```bash
git add src/data/levels.js
git commit -m "feat: expanded Level 1 map (80x60) with more content"
```

---

## Task Summary & Dependencies

```
Task 1: Fullscreen + Responsive ─────────────┐
Task 2: Stats Engine (6 attrs) ──────┐       │
Task 3: Level System ────────────────┤       │
Task 4: Inventory Expansion ─────────┤       │
                                     ▼       ▼
Task 5: Panel Framework ◄───────────────────────
                │
    ┌───────────┼───────────┐
    ▼           ▼           ▼
Task 6:     Task 7:      Task 8:
Character   Inventory    Equipment
Tab         Tab          Stub
    │           │           │
    └───────────┤───────────┘
                ▼
    ┌───────────┼───────────┐
    ▼                       ▼
Task 9:                 Task 10:
SkillTree               Quest System
System+Tab              + Tab
    │                       │
    └───────────┬───────────┘
                ▼
           Task 11:
           HUD Improvements
                │
                ▼
           Task 12:
           Combat Improvements
                │
                ▼
           Task 13:
           Save + Integration
                │
                ▼
           Task 14:
           Map Expansion
```

Tasks 1-4 can be parallelized (independent foundation work).
Tasks 6, 7, 8 can be parallelized (independent tab implementations).
Tasks 9, 10 can be parallelized (independent system + tab implementations).
Tasks 11-14 are sequential (integration and polish).
