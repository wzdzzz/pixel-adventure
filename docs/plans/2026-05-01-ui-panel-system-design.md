# 《像素远征》全功能交互面板 — 设计文档

> 日期：2026-05-01
> 状态：已批准，待实施

---

## 一、总体架构

### 核心改动

1. **全屏化** — Phaser Scale 改为 `RESIZE` 模式，UI 锚点基于百分比布局
2. **面板框架** — 新增 `PanelScene`（独立 Scene，叠在 MainGameScene 之上），打开时暂停游戏逻辑
3. **Tab 导航** — 顶部图标栏：【角色】|【背包】|【技能】|【日志】，按 TAB 或 I 键切换
4. **地图扩大** — 50x40 → 80x60 瓦片（2560x1920 像素）

### 系统层新增

| 文件 | 职责 |
|------|------|
| `Stats.js` 扩展 | 6 属性 (CON/STR/INT/AGI/PER/LCK) + 新衍生属性 |
| `LevelSystem.js` | XP 曲线、升级奖励、属性点分配 |
| `SkillTreeSystem.js` | 节点数据结构、解锁逻辑（技能内容预留） |
| `QuestSystem.js` | 任务数据结构、进度跟踪 |
| `EquipmentSystem.js` | 8 槽位接口预留，空实现 |

### 场景结构

```
BootScene → MainGameScene + UIScene + PanelScene(按需启动)
                                        ├── CharacterTab
                                        ├── InventoryTab
                                        ├── SkillTreeTab
                                        └── QuestLogTab
```

---

## 二、Stats 引擎扩展 + 升级系统

### 6 属性公式

| 属性 | 衍生公式 |
|------|----------|
| CON | `maxHp = CON*10 + Level*5`，`hpRegen = CON*0.5`，韧性贡献 `CON*0.5` |
| STR | `attack = STR*2 + weaponDmg`，韧性贡献 `STR*0.2`，破甲贡献 `STR*0.3` |
| INT | `maxMp = INT*15`，`spellPower = INT*1`，`CDR = min(INT*0.2%, 40%)` |
| AGI | `attackSpeed = 100% + AGI*1%`，`moveSpeed = AGI*20 + 40` |
| PER | `critRate = PER*0.5%`，破甲贡献 `PER*0.5`，探索检测加成 |
| LCK | `dropBonus = sqrt(LCK)*1%`，极低概率"名刀"效果（1HP 存活） |

### 新增衍生属性

- `tenacity = CON*0.5 + STR*0.2` — 硬直阈值
- `armorPen = STR*0.3 + PER*0.5` — 破甲
- `encumbrance` — 负重（预留，暂不影响移动）

### 升级系统

- XP 公式：`xpRequired = 50 * (level^2.2) - (level*10)`
- 击杀经验补偿：敌人等级高于玩家 5 级 → 150%，低于 5 级 → 10%
- 每级奖励：5 点自由属性点 + HP/MP 全回复 + 全屏金光特效
- 每 3 级额外获得 1 点技能点
- 里程碑 LV.10/LV.20 预留解锁钩子

### 敌人等级

按 items.json 中敌人的总属性点推算等级（如 slime 总属性 10 → LV.2，skeleton_king 总属性 34 → LV.7），击杀获得 `baseXP = enemyLevel * 15` 经验。

---

## 三、面板框架

- **触发**：按 `TAB` 或 `I` 键打开/关闭
- **暂停**：打开时 `MainGameScene.physics.pause()` + 冻结敌人 AI
- **动画**：中心向外展开（scaleX/Y 0.8→1 + alpha 0→1，200ms Back.easeOut）
- **关闭**：缩回 + 淡出（150ms），按 `ESC` 或再次 `TAB` 关闭
- **布局**：全屏半透明黑色遮罩（0.6 alpha） + 中央面板区域（屏幕 80% 宽高）
- **Tab 栏**：面板顶部水平图标栏，点击或数字键 1-4 切换，当前 Tab 高亮

---

## 四、角色面板（CharacterTab）

### 布局

```
┌──────────────┬───────────────────────────────┐
│              │  ── 基础属性 ──                │
│   ┌──┐       │  体质(CON)  10  [+]           │
│   │头│       │  力量(STR)   8  [+]           │
│ ┌─┤  ├─┐    │  智力(INT)   5  [+]           │
│ │项│角│戒│   │  敏捷(AGI)   8  [+]           │
│ │链│色│指│   │  感知(PER)   5  [+]           │
│ ├─┤预│──┤   │  幸运(LCK)   3  [+]           │
│ │副│览│戒│   │                               │
│ │手│  │指│   │  可用属性点: 5                 │
│ └─┤  ├─┘    │                               │
│   │靴│       │  ── 衍生属性 ▼ ──             │
│   └──┘       │  HP: 105/105  MP: 75/75       │
│              │  攻击: 16  法强: 5             │
│  LV.1       │  暴击: 2.5%  韧性: 6.6        │
│  XP ████░░  │  破甲: 4.9  移速: 200         │
│  12/40      │  掉率加成: 1.7%               │
└──────────────┴───────────────────────────────┘
```

### 左侧纸娃娃

- 中央：角色像素动画预览（播放 idle 动画）
- 8 个装备槽环绕（灰色空格子 + 虚线边框 + 槽位名称）
- 装备槽暂时不可交互，显示 "装备系统开发中"
- 底部：等级 + XP 进度条

### 右侧属性

- 基础属性 6 行：属性名 + 当前值 + `[+]` 加点按钮
- 有可用属性点时 `[+]` 高亮绿色
- 衍生属性：可折叠区域
- Tooltips：悬停属性名弹出公式和加成来源

### 交互细节

- 加点时数值变绿 + 向上漂浮 "+1" 特效
- 衍生属性同步更新，变化值显示绿色（增加）或红色（减少）

---

## 五、背包面板（InventoryTab）

### 布局

```
┌──────────────────────────────────────────────┐
│  过滤: [全部] [装备] [消耗] [材料] [任务]     │
│  排序: [等级▼] [种类] [稀有度]    金币: 120   │
├──────────────────────────────────────────────┤
│  8x4 网格 (32 格)                             │
│  每格 48x48，物品图标 + 数量角标              │
├──────────────────────────────────────────────┤
│  物品详情栏：名称/描述/稀有度/操作按钮         │
└──────────────────────────────────────────────┘
```

### 稀有度底色

| 稀有度 | 底色 | 边框色 |
|--------|------|--------|
| 普通 common | #3a3a3a | #666666 |
| 优秀 uncommon | #1a3a1a | #44bb44 |
| 精良 rare | #1a1a3a | #4488ff |
| 史诗 epic | #2a1a3a | #bb44ff |
| 传说 legendary | #3a2a1a | #ffaa00 |

### 交互

- 左键：选中，显示详情
- 右键：弹出快捷菜单（使用/丢弃/拆解）
- Shift+左键：快速使用/装备
- 悬停：边框高亮 + 放大 1.05x + Tooltip

### 物品数据扩展

```javascript
{
  "id": "potion",
  "name": "回复药水",
  "type": "consumable",    // consumable / equipment / material / quest
  "rarity": "common",      // common / uncommon / rare / epic / legendary
  "stackable": true,
  "maxStack": 99,
  "level": 1,
  "value": 25,
  "sellPrice": 5,
  "description": "恢复25点生命值"
}
```

---

## 六、技能树面板（SkillTreeTab）

### 节点视觉

| 元素 | 视觉 | 说明 |
|------|------|------|
| 圆形节点 | ○ 28px | 被动技能 |
| 方形节点 | □ 32px | 主动技能 |
| 已解锁 | 金色发光边框 | 可使用 |
| 可解锁 | 白色边框 | 满足条件 |
| 未解锁 | 半透明灰色 | 前置未满足 |

### 节点数据结构（预留框架）

```javascript
{
  id: 'skill_001',
  name: '???',
  type: 'passive',        // passive / active
  tier: 1,                // 层级（0=起始）
  icon: null,
  prerequisites: ['skill_000'],
  requiredLevel: 3,
  cost: 1,
  maxRank: 3,
  currentRank: 0,
  effects: [],
  description: '???'
}
```

### 交互

- 悬停节点 → 底部详情栏
- 点击可解锁节点 → 确认弹窗 → 解锁动画
- 精通度进度条预留
- 大型技能树支持拖拽/缩放浏览

---

## 七、任务日志面板（QuestLogTab）

### 双栏布局

- 左栏 30%：任务列表（主线/支线/已完成分组）
- 右栏 70%：选中任务详情（描述、目标进度、奖励预览）

### 任务数据结构

```javascript
{
  id: 'quest_001',
  title: '逃出迷雾森林',
  type: 'main',              // main / side
  description: '远古的迷雾笼罩着这片森林...',
  status: 'active',          // locked / active / completed
  objectives: [
    { id: 'obj_1', text: '与村长对话', type: 'interact', target: 'elder', current: 1, required: 1 },
    { id: 'obj_2', text: '收集 2 把钥匙', type: 'collect', target: 'key', current: 1, required: 2 },
    { id: 'obj_3', text: '找到传送门', type: 'reach', target: 'portal', current: 0, required: 1 }
  ],
  rewards: { xp: 100, gold: 50, items: [] },
  levelRequired: 1,
  prerequisites: []
}
```

### 任务触发/追踪

- 事件驱动：监听 `enemyDeath`、`playerInteract`、`keysChanged` 等现有事件自动更新进度
- 每关自动注册对应的主线任务
- NPC 对话可触发支线任务（`questTrigger` 字段）
- HUD 右下角显示当前追踪任务目标

---

## 八、HUD 改进

### 新增元素

| 元素 | 位置 | 说明 |
|------|------|------|
| XP 进度条 | HP/MP 下方 | 紫色进度条 |
| 等级显示 | HP 条右侧 | "LV.3" |
| 任务追踪 | 右下角小窗 | 当前追踪任务 1-2 条目标 |
| 面板提示 | 底部 | 增加 "TAB:面板" |

### HP 条缓动残影

- 掉血时：绿条立即缩短，留下白色残影条
- 残影在 500ms 内平滑追上当前血量
- 实现：双层矩形，白色层延迟 tween 跟随

### 数值变动特效

- 属性变化时数值变色（绿=增/红=减）+ 向上漂浮文字

---

## 九、战斗交互增强

| 功能 | 实现 |
|------|------|
| 预输入缓冲 | 攻击动画期间缓存下一次攻击输入，后摇结束立即执行 |
| I-Frames 衰减 | 连续受击时无敌帧递减（预留翻滚系统） |
| 交互优先级队列 | NPC > 宝箱 > 传送门 > 地面物品 > 环境，面朝方向 ±45° |
| 碰撞弹性 | 玩家撞墙 `bounce: 0.05` |
| Y 排序防闪烁 | 相同 Y 坐标按 entity ID 稳定排序 |

### 升级特效

- 全屏白色闪光（alpha 0→0.6→0，300ms）
- 角色金色 tint 闪烁 1 秒
- HP/MP 全额恢复
- 屏幕中央浮动 "LEVEL UP!" + 缩放动画
- 自动弹出角色面板供加点

---

## 十、装备系统（预留）

### 8 个装备槽位

头盔、护甲、武器、副手、项链、戒指 x2、靴子

### 预留接口

```javascript
// EquipmentSystem.js
class EquipmentSystem {
  slots: { helmet, armor, weapon, offhand, necklace, ring1, ring2, boots }
  equip(slot, item) → boolean
  unequip(slot) → item
  getSlot(slot) → item | null
  getStatBonuses() → { con, str, int, agi, per, lck, ...flatBonuses }
}
```

具体装备数据、掉落表、装备效果后续由用户单独提供。
