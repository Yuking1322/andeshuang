const action = (installCommands, uninstallCommands = [], extra = {}) => ({
  installCommands,
  uninstallCommands,
  ...extra
})

const managerActions = (chocolatey, scoop) => ({
  chocolatey,
  scoop
})

const manualAction = (note, url, extra = {}) =>
  action([], [], {
    note,
    url,
    ...extra
  })

const pythonCommand = (pythonArgs) =>
  `powershell -NoProfile -Command "$py = if (Test-Path \\\"$env:USERPROFILE\\\\.local\\\\bin\\\\python.exe\\\") { \\\"$env:USERPROFILE\\\\.local\\\\bin\\\\python.exe\\\" } else { 'python' }; & $py ${pythonArgs}"`

const pythonViaUv = (version, summary, extra = {}) =>
  action(
    [
      'powershell -NoProfile -ExecutionPolicy Bypass -Command "irm https://astral.sh/uv/install.ps1 | iex"',
      `"%USERPROFILE%\\.local\\bin\\uv.exe" python install ${version} --default`
    ],
    [
      `powershell -NoProfile -Command "if (Test-Path \\\"$env:USERPROFILE\\\\.local\\\\bin\\\\uv.exe\\\") { & \\\"$env:USERPROFILE\\\\.local\\\\bin\\\\uv.exe\\\" python uninstall ${version} }"`
    ],
    {
      summary,
      note: 'Python 版本通过 uv 管理，适合需要多版本切换的开发环境。',
      ...extra
    }
  )

const dotnetViaWinget = (channel, summary) =>
  action(
    [
      `winget install ${channel} --accept-source-agreements --accept-package-agreements --silent --disable-interactivity`
    ],
    [
      `winget uninstall ${channel} --silent --disable-interactivity`
    ],
    {
      summary,
      note: '使用 winget 安装 .NET SDK，版本会按官方渠道维护。'
    }
  )

const rustToolchain = (channel, summary) =>
  managerActions(
    action(
      [
        'choco install rustup.install -y --no-progress',
        `rustup toolchain install ${channel}`,
        `rustup default ${channel}`
      ],
      [
        'rustup self uninstall -y'
      ],
      {
        summary,
        note: 'Rust 会通过 rustup 安装，并把当前默认工具链切到所选通道。'
      }
    ),
    action(
      [
        `powershell -NoProfile -Command "$b = scoop bucket list 2>$null; if (-not ($b -match 'versions')) { scoop bucket add versions }"`,
        'scoop install rustup-msvc',
        `rustup toolchain install ${channel}`,
        `rustup default ${channel}`
      ],
      [
        'rustup self uninstall -y'
      ],
      {
        summary,
        note: 'Rust 会通过 rustup 安装，并把当前默认工具链切到所选通道。'
      }
    )
  )

export const automationMeta = {
  'one-click': {
    label: '真一键',
    tone: 'success'
  },
  guided: {
    label: '半自动',
    tone: 'warning'
  },
  manual: {
    label: '手动补充',
    tone: 'info'
  }
}

export const environments = {
  frontend: {
    name: '前端 / Web',
    icon: '🖥️',
    description: '面向前端工程、Web 工具链与现代 JavaScript 运行时。',
    packages: [
      {
        id: 'nodejs',
        name: 'Node.js',
        description: 'JavaScript 运行时，Vue / React / Next / Vite 的基础依赖。',
        popular: true,
        automation: 'one-click',
        officialUrl: 'https://nodejs.org/en/about/releases/',
        tags: ['JavaScript', '运行时', 'npm'],
        searchTerms: ['node', 'nodejs', 'npm', 'javascript', 'vite', 'react', 'vue', 'next'],
        recommendedVersion: 'lts',
        versionOptions: [
          {
            id: 'lts',
            label: '22 LTS',
            summary: '长期支持，适合绝大多数项目',
            managerActions: managerActions(
              action(
                ['choco install nodejs-lts -y --no-progress'],
                ['choco uninstall nodejs-lts -y --no-progress']
              ),
              action(
                ['scoop install nodejs-lts'],
                ['scoop uninstall nodejs-lts']
              )
            )
          },
          {
            id: 'current',
            label: '25 Current',
            summary: '最新特性，适合尝鲜或新项目',
            managerActions: managerActions(
              action(
                ['choco install nodejs -y --no-progress'],
                ['choco uninstall nodejs -y --no-progress']
              ),
              action(
                ['scoop install nodejs'],
                ['scoop uninstall nodejs']
              )
            )
          }
        ]
      },
      {
        id: 'bun',
        name: 'Bun',
        description: '更快的 JavaScript / TypeScript 运行时与包管理器。',
        automation: 'one-click',
        officialUrl: 'https://bun.sh/docs/installation',
        tags: ['JavaScript', 'TypeScript', '运行时'],
        searchTerms: ['bun', 'javascript', 'typescript'],
        managerActions: managerActions(
          action(
            ['choco install bun -y --no-progress'],
            ['choco uninstall bun -y --no-progress']
          ),
          action(
            ['scoop install bun'],
            ['scoop uninstall bun']
          )
        )
      },
      {
        id: 'deno',
        name: 'Deno',
        description: '现代 JavaScript / TypeScript 运行时，适合脚本和边缘应用。',
        automation: 'one-click',
        officialUrl: 'https://docs.deno.com/runtime/manual/getting_started/installation/',
        tags: ['JavaScript', 'TypeScript', '运行时'],
        searchTerms: ['deno', 'javascript', 'typescript'],
        managerActions: managerActions(
          action(
            ['choco install deno -y --no-progress'],
            ['choco uninstall deno -y --no-progress']
          ),
          action(
            ['scoop install deno'],
            ['scoop uninstall deno']
          )
        )
      },
      {
        id: 'git',
        name: 'Git',
        description: '版本控制工具，团队协作必备。',
        popular: true,
        automation: 'one-click',
        officialUrl: 'https://git-scm.com/downloads/win',
        tags: ['版本控制'],
        searchTerms: ['git', 'github', 'source control'],
        managerActions: managerActions(
          action(
            ['choco install git -y --no-progress'],
            ['choco uninstall git -y --no-progress']
          ),
          action(
            ['scoop install git'],
            ['scoop uninstall git']
          )
        )
      },
      {
        id: 'vscode',
        name: 'Visual Studio Code',
        description: '轻量高效的代码编辑器，适合绝大多数开发场景。',
        popular: true,
        automation: 'one-click',
        officialUrl: 'https://code.visualstudio.com/download',
        tags: ['编辑器', 'IDE'],
        searchTerms: ['code', 'vscode', 'visual studio code', '编辑器'],
        managerActions: managerActions(
          action(
            ['choco install vscode -y --no-progress'],
            ['choco uninstall vscode -y --no-progress']
          ),
          action(
            [`powershell -NoProfile -Command "$b = scoop bucket list 2>$null; if (-not ($b -match 'extras')) { scoop bucket add extras }"`, 'scoop install vscode'],
            ['scoop uninstall vscode']
          )
        )
      },
      {
        id: 'yarn',
        name: 'Yarn',
        description: '经典 JavaScript 包管理器，适合维护旧项目或 monorepo。',
        automation: 'one-click',
        officialUrl: 'https://yarnpkg.com/getting-started/install',
        tags: ['包管理器'],
        searchTerms: ['yarn', 'package manager'],
        dependencies: ['nodejs'],
        managerActions: managerActions(
          action(
            ['choco install yarn -y --no-progress'],
            ['choco uninstall yarn -y --no-progress']
          ),
          action(
            ['scoop install yarn'],
            ['scoop uninstall yarn']
          )
        )
      },
      {
        id: 'pnpm',
        name: 'pnpm',
        description: '节省磁盘空间的高性能包管理器。',
        popular: true,
        automation: 'one-click',
        officialUrl: 'https://pnpm.io/installation',
        tags: ['包管理器'],
        searchTerms: ['pnpm', 'package manager'],
        dependencies: ['nodejs'],
        managerActions: managerActions(
          action(
            ['choco install pnpm -y --no-progress'],
            ['choco uninstall pnpm -y --no-progress']
          ),
          action(
            ['scoop install pnpm'],
            ['scoop uninstall pnpm']
          )
        )
      }
    ]
  },

  python: {
    name: 'Python / 数据开发',
    icon: '🐍',
    description: '聚焦 Python、版本管理、数据分析与 Notebook 工作流。',
    packages: [
      {
        id: 'python',
        name: 'Python',
        description: '可通过 uv 管理多个 Python 版本，适合长期开发和切换项目。',
        popular: true,
        automation: 'guided',
        officialUrl: 'https://docs.astral.sh/uv/guides/install-python/',
        tags: ['Python', '运行时', '解释器'],
        searchTerms: ['python', 'py', '解释器', '数据分析'],
        dependencies: ['uv'],
        recommendedVersion: '3.13',
        versionOptions: [
          {
            id: '3.12',
            label: '3.12',
            summary: '兼容不少旧项目',
            managerActions: managerActions(
              pythonViaUv('3.12', '兼容旧项目'),
              pythonViaUv('3.12', '兼容旧项目')
            )
          },
          {
            id: '3.13',
            label: '3.13 推荐',
            summary: '当前最均衡，建议默认选它',
            managerActions: managerActions(
              pythonViaUv('3.13', '当前推荐版本'),
              pythonViaUv('3.13', '当前推荐版本')
            )
          },
          {
            id: '3.14',
            label: '3.14 新版',
            summary: '适合尝鲜最新语言特性',
            managerActions: managerActions(
              pythonViaUv('3.14', '最新语言特性'),
              pythonViaUv('3.14', '最新语言特性')
            )
          }
        ]
      },
      {
        id: 'uv',
        name: 'uv',
        description: '新一代 Python 包与版本管理工具，也是推荐的 Python 版本安装器。',
        popular: true,
        automation: 'guided',
        officialUrl: 'https://docs.astral.sh/uv/getting-started/installation/',
        tags: ['Python', '包管理器', '版本管理'],
        searchTerms: ['uv', 'python manager', 'virtualenv', 'venv'],
        managerActions: managerActions(
          action(
            ['powershell -NoProfile -ExecutionPolicy Bypass -Command "irm https://astral.sh/uv/install.ps1 | iex"'],
            [
              'powershell -NoProfile -Command "Remove-Item -Force -ErrorAction SilentlyContinue \\\"$env:USERPROFILE\\\\.local\\\\bin\\\\uv.exe\\\",\\\"$env:USERPROFILE\\\\.local\\\\bin\\\\uvx.exe\\\",\\\"$env:USERPROFILE\\\\.local\\\\bin\\\\uvw.exe\\\""'
            ],
            {
              note: 'uv 使用官方安装脚本，安装后可直接管理 Python 与依赖。'
            }
          ),
          action(
            ['powershell -NoProfile -ExecutionPolicy Bypass -Command "irm https://astral.sh/uv/install.ps1 | iex"'],
            [
              'powershell -NoProfile -Command "Remove-Item -Force -ErrorAction SilentlyContinue \\\"$env:USERPROFILE\\\\.local\\\\bin\\\\uv.exe\\\",\\\"$env:USERPROFILE\\\\.local\\\\bin\\\\uvx.exe\\\",\\\"$env:USERPROFILE\\\\.local\\\\bin\\\\uvw.exe\\\""'
            ],
            {
              note: 'uv 使用官方安装脚本，安装后可直接管理 Python 与依赖。'
            }
          )
        )
      },
      {
        id: 'pipx',
        name: 'pipx',
        description: '把 Python CLI 工具隔离安装到独立环境，适合装 ruff、black 这类命令行工具。',
        automation: 'guided',
        officialUrl: 'https://pipx.pypa.io/stable/installation/',
        tags: ['Python', '工具'],
        searchTerms: ['pipx', 'python tools', 'ruff', 'black'],
        dependencies: ['python'],
        managerActions: managerActions(
          action(
            [
              pythonCommand('-m pip install --user --break-system-packages pipx'),
              pythonCommand('-m pipx ensurepath')
            ],
            [
              pythonCommand('-m pip uninstall -y pipx')
            ],
            {
              note: '需要当前系统已经能调用 python。'
            }
          ),
          action(
            [
              pythonCommand('-m pip install --user --break-system-packages pipx'),
              pythonCommand('-m pipx ensurepath')
            ],
            [
              pythonCommand('-m pip uninstall -y pipx')
            ],
            {
              note: '需要当前系统已经能调用 python。'
            }
          )
        )
      },
      {
        id: 'jupyterlab',
        name: 'JupyterLab',
        description: '适合数据分析、实验记录和教学演示的 Notebook 环境。',
        automation: 'guided',
        officialUrl: 'https://jupyter.org/install',
        tags: ['Notebook', '数据分析'],
        searchTerms: ['jupyter', 'jupyterlab', 'notebook'],
        dependencies: ['python'],
        managerActions: managerActions(
          action(
            [pythonCommand('-m pip install --break-system-packages jupyterlab')],
            [pythonCommand('-m pip uninstall -y jupyterlab')]
          ),
          action(
            [pythonCommand('-m pip install --break-system-packages jupyterlab')],
            [pythonCommand('-m pip uninstall -y jupyterlab')]
          )
        )
      },
      {
        id: 'miniconda',
        name: 'Miniconda',
        description: '轻量版 Conda 发行版，适合科研环境和多环境切换。',
        popular: true,
        automation: 'one-click',
        officialUrl: 'https://www.anaconda.com/docs/getting-started/miniconda/install',
        tags: ['Conda', '数据科学'],
        searchTerms: ['miniconda', 'conda', 'data science'],
        managerActions: managerActions(
          action(
            ['choco install miniconda3 -y --no-progress'],
            ['choco uninstall miniconda3 -y --no-progress']
          ),
          action(
            ['scoop install miniconda3'],
            ['scoop uninstall miniconda3']
          )
        )
      },
      {
        id: 'anaconda',
        name: 'Anaconda',
        description: '大而全的数据科学发行版，适合偏科研或教学的整包安装。',
        automation: 'guided',
        officialUrl: 'https://www.anaconda.com/download',
        tags: ['Conda', '数据科学'],
        searchTerms: ['anaconda', 'conda', 'scientific python'],
        size: '大型安装包（约 3GB）',
        managerActions: managerActions(
          action(
            ['choco install anaconda3 -y --no-progress'],
            ['choco uninstall anaconda3 -y --no-progress']
          ),
          action(
            ['scoop install anaconda3'],
            ['scoop uninstall anaconda3']
          )
        )
      }
    ]
  },

  backend: {
    name: '后端 / 通用开发',
    icon: '🧩',
    description: '覆盖 Java、.NET、Go、Rust 等主流后端和基础开发环境。',
    packages: [
      {
        id: 'openjdk',
        name: 'Temurin JDK',
        description: '更适合企业和通用开发的 Java 发行版。',
        popular: true,
        automation: 'guided',
        officialUrl: 'https://adoptium.net/support/',
        tags: ['Java', 'JDK'],
        searchTerms: ['java', 'jdk', 'temurin', 'adoptium'],
        recommendedVersion: '21',
        versionOptions: [
          {
            id: '17',
            label: '17 LTS',
            summary: '兼容旧项目更稳',
            managerActions: managerActions(
              action(
                ['choco install temurin17jdk -y --no-progress'],
                ['choco uninstall temurin17jdk -y --no-progress']
              ),
              action(
                [`powershell -NoProfile -Command "$b = scoop bucket list 2>$null; if (-not ($b -match 'java')) { scoop bucket add java }"`, 'scoop install temurin17-jdk'],
                ['scoop uninstall temurin17-jdk']
              )
            )
          },
          {
            id: '21',
            label: '21 LTS 推荐',
            summary: '当前主流长期支持版本',
            managerActions: managerActions(
              action(
                ['choco install temurin21jdk -y --no-progress'],
                ['choco uninstall temurin21jdk -y --no-progress']
              ),
              action(
                [`powershell -NoProfile -Command "$b = scoop bucket list 2>$null; if (-not ($b -match 'java')) { scoop bucket add java }"`, 'scoop install temurin21-jdk'],
                ['scoop uninstall temurin21-jdk']
              )
            )
          },
          {
            id: '25',
            label: '25 LTS',
            summary: '适合新项目或较新的 Java 生态',
            managerActions: managerActions(
              action(
                ['choco install temurin25jdk -y --no-progress'],
                ['choco uninstall temurin25jdk -y --no-progress']
              ),
              action(
                [`powershell -NoProfile -Command "$b = scoop bucket list 2>$null; if (-not ($b -match 'java')) { scoop bucket add java }"`, 'scoop install temurin25-jdk'],
                ['scoop uninstall temurin25-jdk']
              )
            )
          }
        ]
      },
      {
        id: 'dotnet',
        name: '.NET SDK',
        description: '适合 ASP.NET、桌面工具和跨平台 CLI 开发。',
        automation: 'guided',
        officialUrl: 'https://dotnet.microsoft.com/en-us/download',
        tags: ['.NET', 'C#'],
        searchTerms: ['dotnet', '.net', 'csharp', 'asp.net'],
        recommendedVersion: '10',
        versionOptions: [
          {
            id: '10',
            label: '10 LTS 推荐',
            summary: '建议新项目默认使用',
            managerActions: managerActions(
              dotnetViaWinget('Microsoft.DotNet.SDK.10', '使用 winget 安装 .NET 10 SDK'),
              dotnetViaWinget('Microsoft.DotNet.SDK.10', '使用 winget 安装 .NET 10 SDK')
            )
          },
          {
            id: '9',
            label: '9',
            summary: '适合跟已有项目版本保持一致',
            managerActions: managerActions(
              dotnetViaWinget('Microsoft.DotNet.SDK.9', '使用 winget 安装 .NET 9 SDK'),
              dotnetViaWinget('Microsoft.DotNet.SDK.9', '使用 winget 安装 .NET 9 SDK')
            )
          }
        ]
      },
      {
        id: 'go',
        name: 'Go',
        description: '适合后端服务、CLI 和工具型应用开发。',
        automation: 'one-click',
        officialUrl: 'https://go.dev/doc/install',
        tags: ['Go', '后端'],
        searchTerms: ['go', 'golang'],
        managerActions: managerActions(
          action(
            ['choco install golang -y --no-progress'],
            ['choco uninstall golang -y --no-progress']
          ),
          action(
            ['scoop install go'],
            ['scoop uninstall go']
          )
        )
      },
      {
        id: 'rust',
        name: 'Rust',
        description: '适合系统工具、CLI、服务端和高性能场景。',
        automation: 'guided',
        officialUrl: 'https://rustup.rs/',
        tags: ['Rust', '系统开发'],
        searchTerms: ['rust', 'rustup', 'cargo'],
        recommendedVersion: 'stable',
        versionOptions: [
          {
            id: 'stable',
            label: 'stable 推荐',
            summary: '适合正式开发',
            managerActions: rustToolchain('stable', '默认安装稳定版工具链')
          },
          {
            id: 'beta',
            label: 'beta',
            summary: '适合提前验证即将进入稳定版的能力',
            managerActions: rustToolchain('beta', '默认安装 beta 工具链')
          },
          {
            id: 'nightly',
            label: 'nightly',
            summary: '适合实验性特性和高级编译选项',
            managerActions: rustToolchain('nightly', '默认安装 nightly 工具链')
          }
        ]
      }
    ]
  },

  databases: {
    name: '数据库 / 服务',
    icon: '🗄️',
    description: '本地数据库、缓存和开发常用服务。',
    packages: [
      {
        id: 'mysql',
        name: 'MySQL',
        description: '经典关系型数据库，适合大多数 Web 后端。',
        automation: 'guided',
        officialUrl: 'https://dev.mysql.com/downloads/installer/',
        tags: ['数据库'],
        searchTerms: ['mysql', 'database'],
        note: '安装后通常还需要初始化 root 密码和服务配置。',
        managerActions: managerActions(
          action(
            ['choco install mysql -y --no-progress'],
            ['choco uninstall mysql -y --no-progress']
          ),
          action(
            [`powershell -NoProfile -Command "$b = scoop bucket list 2>$null; if (-not ($b -match 'versions')) { scoop bucket add versions }"`, 'scoop install mysql'],
            ['scoop uninstall mysql']
          )
        )
      },
      {
        id: 'postgresql',
        name: 'PostgreSQL',
        description: '功能强大的关系型数据库，适合中大型后端与分析场景。',
        automation: 'guided',
        officialUrl: 'https://www.postgresql.org/download/windows/',
        tags: ['数据库'],
        searchTerms: ['postgres', 'postgresql', 'database'],
        note: '安装后通常要确认端口、超级用户和服务状态。',
        managerActions: managerActions(
          action(
            ['choco install postgresql -y --no-progress'],
            ['choco uninstall postgresql -y --no-progress']
          ),
          action(
            ['scoop install postgresql'],
            ['scoop uninstall postgresql']
          )
        )
      },
      {
        id: 'mongodb',
        name: 'MongoDB',
        description: '适合灵活数据结构和文档型开发场景。',
        automation: 'guided',
        officialUrl: 'https://www.mongodb.com/docs/manual/tutorial/install-mongodb-on-windows/',
        tags: ['数据库', 'NoSQL'],
        searchTerms: ['mongodb', 'mongo', 'nosql'],
        note: '安装后建议确认服务启动方式和数据目录。',
        managerActions: managerActions(
          action(
            ['choco install mongodb -y --no-progress'],
            ['choco uninstall mongodb -y --no-progress']
          ),
          action(
            [`powershell -NoProfile -Command "$b = scoop bucket list 2>$null; if (-not ($b -match 'versions')) { scoop bucket add versions }"`, 'scoop install mongodb'],
            ['scoop uninstall mongodb']
          )
        )
      },
      {
        id: 'redis',
        name: 'Redis',
        description: '适合缓存、队列和本地服务依赖。',
        automation: 'guided',
        officialUrl: 'https://redis.io/docs/latest/operate/oss_and_stack/install/install-stack/windows/',
        tags: ['缓存', '数据库'],
        searchTerms: ['redis', 'cache'],
        note: 'Windows 环境下更适合作为本地开发依赖，正式生产建议使用 Linux 服务。',
        managerActions: managerActions(
          action(
            ['choco install redis-64 -y --no-progress'],
            ['choco uninstall redis-64 -y --no-progress']
          ),
          action(
            ['scoop install redis'],
            ['scoop uninstall redis']
          )
        )
      }
    ]
  },

  ai: {
    name: 'AI / 容器',
    icon: '🤖',
    description: '本地 AI 推理、深度学习与容器环境。',
    packages: [
      {
        id: 'ollama',
        name: 'Ollama',
        description: '适合本地运行大模型，做 AI 原型和私有推理。',
        popular: true,
        automation: 'guided',
        officialUrl: 'https://docs.ollama.com/windows',
        tags: ['AI', 'LLM', '本地模型'],
        searchTerms: ['ollama', 'llm', 'local ai', '大模型'],
        note: '安装完程序后，模型文件仍需按需下载。',
        managerActions: managerActions(
          manualAction('建议使用 Ollama 官方 Windows 安装器，装完后再按需下载模型。', 'https://ollama.com/download/windows'),
          manualAction('建议使用 Ollama 官方 Windows 安装器，装完后再按需下载模型。', 'https://ollama.com/download/windows')
        )
      },
      {
        id: 'dockerdesktop',
        name: 'Docker Desktop',
        description: '适合容器开发、Dev Container 和本地服务编排。',
        automation: 'guided',
        officialUrl: 'https://docs.docker.com/desktop/setup/install/windows-install/',
        tags: ['Docker', '容器'],
        searchTerms: ['docker', 'container', 'devcontainer'],
        note: '通常还会涉及 WSL2 / Hyper-V、首次启动和 docker-users 组设置。',
        managerActions: managerActions(
          manualAction('建议按 Docker 官方 Windows 文档安装，避免 WSL2 / Hyper-V 细节被一键脚本掩盖。', 'https://docs.docker.com/desktop/setup/install/windows-install/'),
          manualAction('建议按 Docker 官方 Windows 文档安装，避免 WSL2 / Hyper-V 细节被一键脚本掩盖。', 'https://docs.docker.com/desktop/setup/install/windows-install/')
        )
      },
      {
        id: 'pytorch',
        name: 'PyTorch',
        description: '主流深度学习框架，适合研究和工程实验。',
        automation: 'guided',
        officialUrl: 'https://pytorch.org/get-started/locally/',
        tags: ['AI', '深度学习', 'Python'],
        searchTerms: ['pytorch', 'torch', 'deep learning'],
        dependencies: ['python'],
        managerActions: managerActions(
          action(
            [pythonCommand('-m pip install torch torchvision torchaudio')],
            [pythonCommand('-m pip uninstall -y torch torchvision torchaudio')],
            {
              note: '默认安装 CPU 版本；如需 CUDA，请在官方安装页选择精确命令。'
            }
          ),
          action(
            [pythonCommand('-m pip install torch torchvision torchaudio')],
            [pythonCommand('-m pip uninstall -y torch torchvision torchaudio')],
            {
              note: '默认安装 CPU 版本；如需 CUDA，请在官方安装页选择精确命令。'
            }
          )
        )
      },
      {
        id: 'tensorflow',
        name: 'TensorFlow',
        description: '工业常见深度学习框架，Windows 下更适合 CPU 或 WSL2 路线。',
        automation: 'guided',
        officialUrl: 'https://www.tensorflow.org/install/pip',
        tags: ['AI', '深度学习', 'Python'],
        searchTerms: ['tensorflow', 'machine learning'],
        dependencies: ['python'],
        note: 'Windows 上 GPU 路线更适合走 WSL2；纯 Windows 推荐先装 CPU 版。',
        managerActions: managerActions(
          action(
            [pythonCommand('-m pip install tensorflow')],
            [pythonCommand('-m pip uninstall -y tensorflow')]
          ),
          action(
            [pythonCommand('-m pip install tensorflow')],
            [pythonCommand('-m pip uninstall -y tensorflow')]
          )
        )
      },
      {
        id: 'cuda',
        name: 'CUDA Toolkit',
        description: 'NVIDIA GPU 加速工具链，适合深度学习与本地推理。',
        automation: 'manual',
        officialUrl: 'https://developer.nvidia.com/cuda-downloads',
        tags: ['GPU', 'AI'],
        searchTerms: ['cuda', 'nvidia', 'gpu'],
        note: '强依赖显卡型号、驱动和系统环境，当前不建议对外承诺真一键。',
        managerActions: managerActions(
          manualAction('请按 NVIDIA 官方页面选择显卡和系统后安装 CUDA。', 'https://developer.nvidia.com/cuda-downloads'),
          manualAction('请按 NVIDIA 官方页面选择显卡和系统后安装 CUDA。', 'https://developer.nvidia.com/cuda-downloads')
        )
      }
    ]
  }
}

export function getAllPackages() {
  const allPackages = []

  Object.entries(environments).forEach(([category, env]) => {
    env.packages.forEach((pkg) => {
      allPackages.push({
        ...pkg,
        category,
        categoryName: env.name
      })
    })
  })

  return allPackages
}

export function getPackageById(packageId) {
  return getAllPackages().find((pkg) => pkg.id === packageId) || null
}

export function getPackageVersionOptions(pkg) {
  return Array.isArray(pkg?.versionOptions) ? pkg.versionOptions : []
}

export function getDefaultVersionId(pkg) {
  const versionOptions = getPackageVersionOptions(pkg)
  if (!versionOptions.length) {
    return ''
  }

  if (pkg.recommendedVersion && versionOptions.some((item) => item.id === pkg.recommendedVersion)) {
    return pkg.recommendedVersion
  }

  return versionOptions[0].id
}

export function resolvePackageConfig(packageOrId, selectedVersions = {}) {
  const pkg = typeof packageOrId === 'string' ? getPackageById(packageOrId) : packageOrId
  if (!pkg) return null

  const versionOptions = getPackageVersionOptions(pkg)
  const requestedVersionId = selectedVersions[pkg.id]
  const selectedVersion =
    versionOptions.find((item) => item.id === requestedVersionId) ||
    versionOptions.find((item) => item.id === getDefaultVersionId(pkg)) ||
    null

  return {
    ...pkg,
    versionSelectable: versionOptions.length > 0,
    selectedVersionId: selectedVersion?.id || '',
    selectedVersionLabel: selectedVersion?.label || '',
    selectedVersionSummary: selectedVersion?.summary || '',
    managerActions: selectedVersion?.managerActions || pkg.managerActions || {}
  }
}

export function getSupportedManagers(pkg) {
  const resolved = resolvePackageConfig(pkg)
  return Object.entries(resolved?.managerActions || {})
    .filter(([, value]) => Array.isArray(value?.installCommands) && value.installCommands.length > 0)
    .map(([key]) => key)
}

export function getPackageSearchText(pkg) {
  const baseItems = [
    pkg.name,
    pkg.description,
    pkg.categoryName,
    ...(pkg.tags || []),
    ...(pkg.searchTerms || [])
  ]

  if (pkg.versionOptions?.length) {
    pkg.versionOptions.forEach((version) => {
      baseItems.push(version.label, version.summary)
    })
  }

  return baseItems
    .filter(Boolean)
    .join(' ')
    .toLowerCase()
}

export function resolveDependencies(selectedIds) {
  const ordered = []
  const visited = new Set()
  const visiting = new Set()
  const packageMap = new Map(getAllPackages().map((pkg) => [pkg.id, pkg]))

  function visit(packageId) {
    if (visited.has(packageId) || visiting.has(packageId)) {
      return
    }

    visiting.add(packageId)

    const pkg = packageMap.get(packageId)
    const dependencies = Array.isArray(pkg?.dependencies) ? pkg.dependencies : []
    dependencies.forEach((dependencyId) => visit(dependencyId))

    visiting.delete(packageId)
    visited.add(packageId)
    ordered.push(packageId)
  }

  selectedIds.forEach((packageId) => visit(packageId))
  return ordered
}
