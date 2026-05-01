export const questData = [
  {
    id: 'main_level1', title: '逃出迷雾森林', type: 'main',
    description: '远古的迷雾笼罩着这片森林，找到传送门逃离这里。',
    triggerLevel: 0,
    objectives: [
      { id: 'talk_elder', text: '与村长对话', type: 'interact', target: 'elder', required: 1 },
      { id: 'collect_keys_l1', text: '收集 3 把钥匙', type: 'collect', target: 'key', required: 3 },
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
    description: '旅行需要一些药水储备。',
    triggerLevel: 0, triggerNpc: 'scout',
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
      { id: 'find_artifact', text: '找到远古神器', type: 'collect', target: 'artifact', required: 1 },
      { id: 'reach_exit', text: '到达出口', type: 'reach', target: 'end', required: 1 }
    ],
    rewards: { xp: 200, gold: 100 }
  }
];
