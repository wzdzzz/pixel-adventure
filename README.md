# 像素远征 - Pixel Adventure

使用 Phaser 3 和 Vite 构建的像素风格动作冒险 RPG。

## 技术栈

- **引擎**: Phaser 3.90.0 (Arcade Physics)
- **构建**: Vite 5.4.0
- **语言**: ES6+ Modules (vanilla JS)
- **美术**: 代码生成像素占位图

## 快速开始

```bash
pnpm install
pnpm dev        # http://localhost:3000
pnpm build      # 生产构建
```

## 操作

| 按键 | 功能 |
|------|------|
| WASD / 方向键 | 8 方向移动 |
| 空格 | 普通攻击 |
| E | 与 NPC / 宝箱交互 |
| 1-4 | 技能 |
| Tab | 打开面板（背包/装备/角色/天赋） |
| F5 / F9 | 快速存档 / 读档 |

## 已实现功能

### 核心系统
- Arcade Physics 物理引擎 + 瓦片地图
- 平滑相机跟随 + 战争迷雾
- localStorage 存档（自动 30s + 手动 F5）

### 实体与战斗
- **玩家**：8 方向移动、普攻（hitbox 判定）、I-Frames
- **敌人**：巡逻/追击/攻击 AI 状态机、接触伤害
- **属性引擎**：6 基础属性 → 14 派生属性，缓存失效机制
- **双资源**：体力（技能消耗，自动回复）+ 怒气（战斗积累，脱战衰减）

### 技能系统
- **冲锋**：8 方向冲刺穿过敌人，造成伤害 + 眩晕 + 击退
- **旋风斩**：AOE 持续伤害，施法期间无敌 + 加速
- 技能等级（最高 5 级），消耗/CD/伤害 逐级缩放
- HUD 技能栏 + 冷却显示

### RPG 系统
- **背包**：32 格、堆叠、排序
- **装备**：8 槽位、属性加成、品质系统（白/绿/蓝/紫/橙）
- **掉落**：加权随机掉落、品质缩放
- **等级**：经验升级、属性点 + 技能点分配
- **任务**：目标追踪、奖励
- **NPC 对话**：打字机效果、多页

### UI
- HUD：血条/体力/怒气/经验条/技能栏/任务追踪
- 面板：背包、装备、角色属性、天赋树（Tab 切换）

## 项目结构

```
src/
├── main.js                    # 入口
├── config/gameConfig.js       # 全局配置
├── assets/AssetManager.js     # 纹理生成
├── entities/                  # Actor → Player / Enemy / Item / NPC
├── systems/                   # Stats / SkillEngine / Inventory / Equipment / ...
├── scenes/                    # Boot / MainGame / UI / Panel / GameOver / Victory
└── data/                      # items.json / levels.js / lootTables.js / ...
```

详细架构文档见 [docs/architecture.md](docs/architecture.md)

## 许可证

MIT
