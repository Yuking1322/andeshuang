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
    name: '前端起步包',
    fileName: 'frontend-starter.bat',
    description: 'Node.js / Git / VS Code / pnpm',
    packageIds: ['nodejs', 'git', 'vscode', 'pnpm']
  },
  {
    id: 'python-data-starter',
    name: 'Python 数据分析包',
    fileName: 'python-data-starter.bat',
    description: 'VS Code / uv / Python / JupyterLab',
    packageIds: ['vscode', 'uv', 'python', 'jupyterlab']
  },
  {
    id: 'java-backend-starter',
    name: 'Java 后端包',
    fileName: 'java-backend-starter.bat',
    description: 'Git / VS Code / Temurin JDK / MySQL / Redis',
    packageIds: ['git', 'vscode', 'openjdk', 'mysql', 'redis']
  },
  {
    id: 'ai-local-starter',
    name: 'AI 本地推理包',
    fileName: 'ai-local-starter.bat',
    description: 'VS Code / Ollama / Docker Desktop / Python / PyTorch',
    packageIds: ['vscode', 'ollama', 'dockerdesktop', 'python', 'pytorch']
  }
]
