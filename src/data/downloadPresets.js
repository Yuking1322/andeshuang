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
    id: 'python-workbench',
    name: 'Python 工作台',
    fileName: 'python-workbench.bat',
    description: 'uv / Python / pipx / JupyterLab',
    packageIds: ['uv', 'python', 'pipx', 'jupyterlab']
  },
  {
    id: 'backend-starter',
    name: '后端基础包',
    fileName: 'backend-starter.bat',
    description: 'Temurin JDK / .NET SDK / Go',
    packageIds: ['openjdk', 'dotnet', 'go']
  },
  {
    id: 'data-science-starter',
    name: '数据科学包',
    fileName: 'data-science-starter.bat',
    description: 'Python / Miniconda / JupyterLab',
    packageIds: ['python', 'miniconda', 'jupyterlab']
  },
  {
    id: 'deep-learning-starter',
    name: '深度学习包',
    fileName: 'deep-learning-starter.bat',
    description: 'Python / PyTorch / Ollama',
    packageIds: ['python', 'pytorch', 'ollama']
  },
  {
    id: 'fullstack-starter',
    name: '全栈常用包',
    fileName: 'fullstack-starter.bat',
    description: 'Node.js / Git / VS Code / Python / PostgreSQL',
    packageIds: ['nodejs', 'git', 'vscode', 'python', 'postgresql']
  }
]
