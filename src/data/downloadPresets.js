export const windowsPresetDownloads = [
  {
    id: 'health-check',
    name: '一键体检器',
    fileName: 'health-check.cmd',
    description: '双击运行后，在桌面生成环境检测结果。',
    kind: 'detection'
  },
  {
    id: 'frontend-starter',
    name: '前端新机包',
    fileName: 'frontend-starter.bat',
    description: 'Node.js / Git / VS Code / pnpm',
    packageIds: ['nodejs', 'git', 'vscode', 'pnpm']
  },
  {
    id: 'backend-starter',
    name: '后端基础包',
    fileName: 'backend-starter.bat',
    description: 'Python / OpenJDK',
    packageIds: ['python', 'openjdk']
  },
  {
    id: 'data-science-starter',
    name: '数据科学包',
    fileName: 'data-science-starter.bat',
    description: 'Python / Miniconda',
    packageIds: ['python', 'miniconda']
  },
  {
    id: 'deep-learning-starter',
    name: '深度学习包',
    fileName: 'deep-learning-starter.bat',
    description: 'Python / PyTorch',
    packageIds: ['python', 'pytorch']
  },
  {
    id: 'fullstack-starter',
    name: '全栈常用包',
    fileName: 'fullstack-starter.bat',
    description: 'Node.js / Git / VS Code / Python / pnpm',
    packageIds: ['nodejs', 'git', 'vscode', 'python', 'pnpm']
  }
]
