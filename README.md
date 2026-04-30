# 像素冒险 - Pixel Adventure

使用 Phaser 3 和 Vite 构建的像素风格冒险游戏。

## 技术栈

- **引擎**: Phaser 3.80.1
- **构建工具**: Vite 5.4.0
- **风格**: 16-bit 像素风

## 快速开始

### 安装依赖

```bash
npm install
```

### 启动开发服务器

```bash
npm run dev
```

游戏将在 http://localhost:3000 启动。

### 构建生产版本

```bash
npm run build
```

## 游戏操作

- **WASD / 方向键**: 移动
- **空格**: 攻击
- **E**: 与 NPC 交互

## 游戏特性

### 核心系统

- 🎮 Arcade Physics 物理引擎
- 🗺️ 瓦片地图系统
- 📷 平滑相机跟随
- 💾 localStorage 存档系统

### 实体系统

- 👤 玩家: 移动、攻击、交互
- 👾 敌人: 巡逻、仇恨追踪、受击反馈
- 🎁 道具: 金币、钥匙、药水、神器
- 💬 NPC: 对话系统

### 游戏闭环

- 🏆 胜利条件: 收集神器并到达终点
- 💀 失败条件: HP 归零
- 🔄 自动存档: 每30秒自动保存

## 项目结构

```
pixel-adventure/
├── index.html
├── package.json
├── vite.config.js
├── src/
│   ├── main.js              # 游戏入口
│   ├── config/
│   │   └── gameConfig.js    # 游戏配置
│   ├── assets/
│   │   └── AssetManager.js  # 资产管理器
│   ├── scenes/
│   │   ├── BootScene.js     # 启动场景
│   │   ├── MainGameScene.js # 主游戏场景
│   │   ├── UIScene.js       # HUD 界面
│   │   ├── GameOverScene.js # 失败画面
│   │   └── VictoryScene.js  # 胜利画面
│   ├── entities/
│   │   ├── Player.js        # 玩家类
│   │   ├── Enemy.js         # 敌人类
│   │   └── Item.js          # 道具类
│   ├── systems/
│   │   ├── InventorySystem.js # 背包系统
│   │   └── SaveSystem.js    # 存档系统
│   └── data/
│       └── items.json       # 道具配置
```

## 资产说明

由于使用代码生成的像素占位图：

- 🟢 绿色方块: 玩家
- 🔴 红色方块: 敌人
- 🟡 黄色方块: 金币
- 🩷 粉色方块: 钥匙
- 🟣 紫色方块: 神器
- 🔵 蓝色方块: NPC
- ⬜ 灰色方块: 墙壁
- 🟤 棕色方块: 障碍物

## 扩展指南

### 添加新道具

编辑 `src/data/items.json`:

```json
{
  "items": {
    "new_item": {
      "id": "new_item",
      "name": "新道具",
      "type": "consumable",
      "texture": "coin",
      "value": 50,
      "description": "描述文字",
      "effect": {
        "type": "heal",
        "amount": 50
      }
    }
  }
}
```

### 添加新敌人

编辑 `src/data/items.json` 的 `enemies` 部分。

## 许可证

MIT
