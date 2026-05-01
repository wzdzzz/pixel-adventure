# 实体系统

> 文件：`src/entities/Actor.js`, `Player.js`, `Enemy.js`, `Item.js`, `NPC.js`

## 继承关系

```
Actor (基类 270行)
├── Player (603行) — 玩家控制、状态机、技能
└── Enemy (290行) — AI 行为、掉落
```

Item 和 NPC 是独立类，不继承 Actor。

## Actor 基类

**职责**：HP/体力/怒气管理、I-Frames、属性系统、击退、基础更新循环

### 构造函数参数
```js
constructor(scene, x, y, textureKey, statsConfig, characterId)
// statsConfig = { con: 10, str: 8, int: 5, agi: 8, per: 5, lck: 3 }
```

### 双资源系统
| 资源 | 公式 | 回复机制 |
|------|------|----------|
| 体力 (Stamina) | CON × 8 + 60 | 停止使用 1 秒后，以 CON × 0.8/秒 回复 |
| 怒气 (Rage) | 固定 0-100 | 攻击 +8，被击 +12；脱战 3 秒后 5/秒 衰减 |

### I-Frames（无敌帧）
- 受击后启动，Player 默认 800ms，Enemy 默认 200ms
- `updateIFrames(delta)` 每帧递减计时器
- 旋风斩等技能无敌时，i-frames 到期不会清除 `isInvulnerable`

### 关键方法
| 方法 | 作用 |
|------|------|
| `takeDamage(damage, ax, ay)` | 减伤计算 → 扣血 → 开 I-Frames → 击退 → 闪烁 |
| `heal(amount)` | 回血，不超过 maxHp |
| `useStamina(amount)` | 扣体力，重置回复计时器 |
| `addRage(amount)` | 加怒气，重置衰减计时器 |
| `refreshStats()` | 从 Stats 引擎刷新 maxHp/maxStamina |
| `updateActor(delta)` | 调用 updateIFrames + updateRegen |

## Player

**职责**：输入处理、状态机、普攻、技能系统、NPC 交互

### 状态机
```
IDLE ←→ WALK
  ↓          ↓
ATTACK_STARTUP → ATTACK_ACTIVE → ATTACK_RECOVERY → IDLE
  ↓
SKILL_CASTING (技能施法) → IDLE
  ↓
HURT → IDLE
  ↓
DEAD
```

### 输入绑定
| 按键 | 功能 |
|------|------|
| WASD / 方向键 | 8 方向移动 |
| 空格 | 普通攻击 |
| E | 与 NPC / 宝箱交互 |
| 1-4 | 技能槽位 |
| Tab | 打开/关闭面板 |
| F5 | 快速存档 |
| F9 | 快速读档 |

### 技能相关属性
| 属性 | 作用 |
|------|------|
| `skillEngine` | SkillEngine 实例 |
| `skillHitbox` | 技能判定矩形（physics body） |
| `_chargeDashDir` | 冲锋方向向量 |
| `_chargeDashVelocity` | 冲锋速度 |
| `_whirlwindSuperArmor` | 旋风斩无敌标记 |
| `_whirlwindMoveSpeedMod` | 旋风斩移速加成 |

### 碰撞体
- `sprite.body`：脚部小碰撞体（地形碰撞）
- `attackHitbox`：普攻判定矩形
- `skillHitbox`：技能判定矩形（无重力，按需启用）
- `sprite.body.pushable = false`：玩家不可被推动

## Enemy

**职责**：AI 状态机、巡逻/追击/攻击行为

### AI 状态
```
PATROL ←→ CHASE → ATTACK → CHASE
                     ↓
                   HURT → PATROL/CHASE
                     ↓
                   DEAD
```

### 配置参数（来自 levels.js）
| 参数 | 含义 |
|------|------|
| `patrolRange` | 巡逻范围（像素） |
| `chaseRange` | 追击触发距离 |
| `attackRange` | 攻击触发距离 |
| `attackCooldown` | 攻击冷却（ms） |

## Item

**职责**：可拾取道具的视觉表现和拾取动画

- 支持浮动动画（上下晃动）
- 拾取时播放飞入效果
- 通过 `itemId` 关联 items.json 数据

## NPC

**职责**：对话交互、任务状态指示

- 显示名字标签
- 头顶 `!`（有任务）/ `?`（可交互）标记
- 通过 dialogueId 关联对话数据
