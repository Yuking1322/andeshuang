export const environments = {
  frontend: {
    name: '前端开发',
    icon: '🖥️',
    description: '包含 Node.js、包管理器与常用编辑工具。',
    packages: [
      {
        id: 'nodejs',
        name: 'Node.js 20 LTS',
        description: 'JavaScript 运行时环境，前端工具链基础。',
        choco: 'nodejs-lts',
        scoop: 'nodejs-lts',
        popular: true
      },
      {
        id: 'git',
        name: 'Git',
        description: '版本控制工具，团队协作必备。',
        choco: 'git',
        scoop: 'git',
        popular: true
      },
      {
        id: 'vscode',
        name: 'Visual Studio Code',
        description: '轻量高效的代码编辑器。',
        choco: 'vscode',
        scoop: 'vscode',
        popular: true
      },
      {
        id: 'yarn',
        name: 'Yarn',
        description: '快速稳定的 JavaScript 包管理器。',
        choco: 'yarn',
        scoop: 'yarn',
        dependencies: ['nodejs']
      },
      {
        id: 'pnpm',
        name: 'pnpm',
        description: '高性能包管理器，节省磁盘空间。',
        choco: 'pnpm',
        scoop: 'pnpm',
        dependencies: ['nodejs']
      }
    ]
  },

  backend: {
    name: '后端开发',
    icon: '🧩',
    description: '覆盖 Python、Java 与主流数据库。',
    packages: [
      {
        id: 'python',
        name: 'Python 3.11',
        description: '通用编程语言，生态完善。',
        choco: 'python311',
        scoop: 'python',
        popular: true
      },
      {
        id: 'openjdk',
        name: 'OpenJDK 17',
        description: 'Java 开发工具链。',
        choco: 'openjdk17',
        scoop: 'openjdk17',
        popular: true
      },
      {
        id: 'mysql',
        name: 'MySQL 8.0',
        description: '经典关系型数据库。',
        choco: 'mysql',
        scoop: 'mysql'
      },
      {
        id: 'redis',
        name: 'Redis',
        description: '高性能内存数据库。',
        choco: 'redis',
        scoop: 'redis'
      },
      {
        id: 'postgresql',
        name: 'PostgreSQL',
        description: '功能强大的关系型数据库。',
        choco: 'postgresql',
        scoop: 'postgresql'
      },
      {
        id: 'mongodb',
        name: 'MongoDB',
        description: '文档型数据库，适合灵活数据结构。',
        choco: 'mongodb',
        scoop: 'mongodb'
      }
    ]
  },

  datascience: {
    name: '数据科学',
    icon: '📊',
    description: '用于数据分析、实验与科研开发。',
    packages: [
      {
        id: 'anaconda',
        name: 'Anaconda',
        description: '数据科学常用发行版，集成丰富。',
        choco: 'anaconda3',
        scoop: 'anaconda3',
        popular: true,
        size: '大型安装包（约 3GB）'
      },
      {
        id: 'miniconda',
        name: 'Miniconda',
        description: 'Anaconda 的轻量版本。',
        choco: 'miniconda3',
        scoop: 'miniconda3',
        popular: true
      }
    ]
  },

  deeplearning: {
    name: '深度学习',
    icon: '🧠',
    description: '常见深度学习框架与 GPU 相关依赖。',
    packages: [
      {
        id: 'pytorch',
        name: 'PyTorch',
        description: '流行的深度学习框架（需要 Python）。',
        installMethod: 'pip',
        command: 'pip install torch torchvision torchaudio',
        dependencies: ['python'],
        popular: true
      },
      {
        id: 'tensorflow',
        name: 'TensorFlow',
        description: '工业常用深度学习框架（需要 Python）。',
        installMethod: 'pip',
        command: 'pip install tensorflow',
        dependencies: ['python']
      },
      {
        id: 'cuda',
        name: 'CUDA Toolkit',
        description: 'NVIDIA GPU 加速工具链（需手动安装）。',
        installMethod: 'manual',
        url: 'https://developer.nvidia.com/cuda-downloads',
        note: '需要 NVIDIA 显卡支持'
      }
    ]
  }
}

export function getAllPackages() {
  const allPackages = []

  Object.keys(environments).forEach((category) => {
    environments[category].packages.forEach((pkg) => {
      allPackages.push({
        ...pkg,
        category
      })
    })
  })

  return allPackages
}

export function resolveDependencies(selectedIds) {
  const allPackages = getAllPackages()
  const resolved = new Set(selectedIds)

  selectedIds.forEach((id) => {
    const pkg = allPackages.find((item) => item.id === id)
    if (!pkg?.dependencies?.length) return

    pkg.dependencies.forEach((depId) => resolved.add(depId))
  })

  return Array.from(resolved)
}
