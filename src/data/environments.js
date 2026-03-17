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

const wingetPackage = (packageId, summary, extra = {}) =>
  action(
    [
      `winget install --id ${packageId} --exact --accept-source-agreements --accept-package-agreements --silent --disable-interactivity`
    ],
    [
      `winget uninstall --id ${packageId} --exact --silent --disable-interactivity`
    ],
    {
      summary,
      note: '当前会通过 winget 安装，适合需要官方 Windows 安装器的工具。',
      ...extra
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
        note: 'Rust 会通过 rustup 安装，并把默认工具链切到所选通道。'
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
        note: 'Rust 会通过 rustup 安装，并把默认工具链切到所选通道。'
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
    name: '前端入门',
    icon: '🌐',
    description: '面向课程作业、作品集和第一套 Web 项目的 Windows 起步环境。',
    packages: [
      {
        id: 'nodejs',
        name: 'Node.js',
        description: 'Vue / React / Vite 这类前端项目最核心的运行时。',
        popular: true,
        automation: 'one-click',
        officialUrl: 'https://nodejs.org/en/about/releases/',
        tags: ['JavaScript', '运行时', 'npm'],
        searchTerms: ['node', 'nodejs', 'npm', 'javascript', 'vite', 'react', 'vue', 'next', '前端'],
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
        id: 'git',
        name: 'Git',
        description: '建议第一台开发机就装上的版本控制工具。',
        popular: true,
        automation: 'one-click',
        officialUrl: 'https://git-scm.com/downloads/win',
        tags: ['版本控制'],
        searchTerms: ['git', 'github', 'source control', '版本控制'],
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
        description: '对学生和新手最友好的通用编辑器，前端、Python、Java 都能先用它起步。',
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
        id: 'pnpm',
        name: 'pnpm',
        description: '多数现代前端项目都会直接用它来安装依赖。',
        popular: true,
        automation: 'one-click',
        officialUrl: 'https://pnpm.io/installation',
        tags: ['包管理器'],
        searchTerms: ['pnpm', 'package manager', '前端'],
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
    name: 'Python 数据分析',
    icon: '📊',
    description: '面向 Notebook、数据分析和实验记录的入门环境。',
    packages: [
      {
        id: 'uv',
        name: 'uv',
        description: '推荐优先安装，用来管理 Python 版本、虚拟环境和依赖。',
        popular: true,
        automation: 'guided',
        officialUrl: 'https://docs.astral.sh/uv/getting-started/installation/',
        tags: ['Python', '包管理器', '版本管理'],
        searchTerms: ['uv', 'python manager', 'virtualenv', 'venv', '数据分析'],
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
        id: 'python',
        name: 'Python',
        description: '建议和 uv 配合使用，兼顾课程作业、数据分析和长期项目。',
        popular: true,
        automation: 'guided',
        officialUrl: 'https://docs.astral.sh/uv/guides/install-python/',
        tags: ['Python', '运行时', '解释器'],
        searchTerms: ['python', 'py', '解释器', '数据分析', 'notebook'],
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
        id: 'jupyterlab',
        name: 'JupyterLab',
        description: '做 Notebook、实验记录和课堂演示时最直接的一步。',
        popular: true,
        automation: 'guided',
        officialUrl: 'https://jupyter.org/install',
        tags: ['Notebook', '数据分析'],
        searchTerms: ['jupyter', 'jupyterlab', 'notebook', '数据分析'],
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
        description: '如果课程、教材或团队流程大量使用 conda，再选它作为替代路线。',
        automation: 'one-click',
        officialUrl: 'https://www.anaconda.com/docs/getting-started/miniconda/install',
        tags: ['Conda', '数据科学'],
        searchTerms: ['miniconda', 'conda', 'data science', '数据分析'],
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
    ]
  },

  backend: {
    name: 'Java 后端',
    icon: '☕',
    description: 'Java 优先，也补齐 Go、Rust、.NET 和常用后端开发工具。',
    packages: [
      {
        id: 'openjdk',
        name: 'Temurin JDK',
        description: 'Java 后端课程和 Spring Boot 项目的基础依赖。',
        popular: true,
        automation: 'guided',
        officialUrl: 'https://adoptium.net/support/',
        tags: ['Java', 'JDK'],
        searchTerms: ['java', 'jdk', 'temurin', 'adoptium', 'spring boot', '后端'],
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
        id: 'intellijidea',
        name: 'IntelliJ IDEA Community',
        description: 'Java 后端最常见的 IDE 之一，适合课程、练习和多数 Spring Boot 项目。',
        popular: true,
        automation: 'guided',
        officialUrl: 'https://www.jetbrains.com/help/idea/installation-guide.html',
        tags: ['Java', 'IDE'],
        searchTerms: ['intellij', 'idea', 'jetbrains', 'java ide', 'spring boot'],
        managerActions: managerActions(
          wingetPackage('JetBrains.IntelliJIDEA.Community', '通过 winget 安装 IntelliJ IDEA Community'),
          wingetPackage('JetBrains.IntelliJIDEA.Community', '通过 winget 安装 IntelliJ IDEA Community')
        )
      },
      {
        id: 'maven',
        name: 'Apache Maven',
        description: 'Java 后端覆盖面最广的构建工具，不确定团队规范时优先选它。',
        popular: true,
        automation: 'one-click',
        officialUrl: 'https://maven.apache.org/install.html',
        tags: ['Java', '构建工具'],
        searchTerms: ['maven', 'apache maven', 'java build', 'spring boot'],
        dependencies: ['openjdk'],
        managerActions: managerActions(
          action(
            ['choco install maven -y --no-progress'],
            ['choco uninstall maven -y --no-progress']
          ),
          action(
            ['scoop install maven'],
            ['scoop uninstall maven']
          )
        )
      },
      {
        id: 'gradle',
        name: 'Gradle',
        description: '很多现代 Java / Kotlin 项目会用它；如果团队已有 Gradle 规范再选它。',
        automation: 'one-click',
        officialUrl: 'https://docs.gradle.org/current/userguide/installation.html',
        tags: ['Java', '构建工具'],
        searchTerms: ['gradle', 'java build', 'kotlin build', 'spring boot'],
        dependencies: ['openjdk'],
        managerActions: managerActions(
          action(
            ['choco install gradle -y --no-progress'],
            ['choco uninstall gradle -y --no-progress']
          ),
          action(
            ['scoop install gradle'],
            ['scoop uninstall gradle']
          )
        )
      },
      {
        id: 'mysql',
        name: 'MySQL',
        description: '学校课程和中小型 Java Web 项目最常见的数据库选择。',
        popular: true,
        automation: 'guided',
        officialUrl: 'https://dev.mysql.com/downloads/installer/',
        tags: ['数据库'],
        searchTerms: ['mysql', 'database', 'java backend', 'spring boot'],
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
        description: '如果你更偏现代服务开发，也可以选它作为本地数据库路线。',
        automation: 'guided',
        officialUrl: 'https://www.postgresql.org/download/windows/',
        tags: ['数据库'],
        searchTerms: ['postgres', 'postgresql', 'database', 'java backend'],
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
        id: 'dbeaver',
        name: 'DBeaver Community',
        description: '轻量好用的数据库客户端，适合连 MySQL、PostgreSQL 等本地库。',
        automation: 'guided',
        officialUrl: 'https://dbeaver.io/download/',
        tags: ['数据库', '客户端'],
        searchTerms: ['dbeaver', 'database client', 'mysql client', 'postgres client'],
        managerActions: managerActions(
          action(
            ['choco install dbeaver -y --no-progress'],
            ['choco uninstall dbeaver -y --no-progress']
          ),
          manualAction('当前建议使用 DBeaver 官方安装器或切换到 Chocolatey 方案安装。', 'https://dbeaver.io/download/')
        )
      },
      {
        id: 'powershell7',
        name: 'PowerShell 7',
        description: '比系统自带 PowerShell 更现代，很多脚本和开发命令跑起来会更顺。',
        popular: true,
        automation: 'guided',
        officialUrl: 'https://learn.microsoft.com/en-us/windows/package-manager/winget/',
        tags: ['终端', '脚本'],
        searchTerms: ['powershell 7', 'pwsh', 'terminal', 'shell'],
        managerActions: managerActions(
          wingetPackage('Microsoft.PowerShell', '通过 winget 安装 PowerShell 7'),
          wingetPackage('Microsoft.PowerShell', '通过 winget 安装 PowerShell 7')
        )
      },
      {
        id: 'windowsterminal',
        name: 'Windows Terminal',
        description: '更适合开发者的多标签终端，配合 Git、PowerShell 和 WSL 体验更好。',
        automation: 'guided',
        officialUrl: 'https://learn.microsoft.com/zh-tw/windows/terminal/install',
        tags: ['终端'],
        searchTerms: ['windows terminal', 'terminal', 'wt'],
        managerActions: managerActions(
          wingetPackage('Microsoft.WindowsTerminal', '通过 winget 安装 Windows Terminal'),
          wingetPackage('Microsoft.WindowsTerminal', '通过 winget 安装 Windows Terminal')
        )
      },
      {
        id: 'dotnet',
        name: '.NET SDK',
        description: '如果你同时会碰 C#、ASP.NET 或公司内部工具链，可以一起补上。',
        automation: 'guided',
        officialUrl: 'https://dotnet.microsoft.com/en-us/download',
        tags: ['.NET', 'C#'],
        searchTerms: ['dotnet', '.net', 'csharp', 'asp.net'],
        recommendedVersion: '10',
        versionOptions: [
          {
            id: '10',
            label: '10 LTS 推荐',
            summary: '当前长期支持版本，适合新项目',
            managerActions: managerActions(
              wingetPackage('Microsoft.DotNet.SDK.10', '通过 winget 安装 .NET 10 SDK'),
              wingetPackage('Microsoft.DotNet.SDK.10', '通过 winget 安装 .NET 10 SDK')
            )
          },
          {
            id: '9',
            label: '9',
            summary: '适合跟已有项目保持一致',
            managerActions: managerActions(
              wingetPackage('Microsoft.DotNet.SDK.9', '通过 winget 安装 .NET 9 SDK'),
              wingetPackage('Microsoft.DotNet.SDK.9', '通过 winget 安装 .NET 9 SDK')
            )
          }
        ]
      },
      {
        id: 'go',
        name: 'Go',
        description: '当前很主流的后端和 CLI 语言，如果你会做服务或工具开发，可以一起补上。',
        popular: true,
        automation: 'one-click',
        officialUrl: 'https://go.dev/doc/install',
        tags: ['Go', '后端'],
        searchTerms: ['go', 'golang', 'backend', 'cli'],
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
        description: '想做高性能服务、CLI 或系统工具时，它也是很主流的选择。',
        automation: 'guided',
        officialUrl: 'https://www.rust-lang.org/tools/install',
        tags: ['Rust', '系统开发'],
        searchTerms: ['rust', 'rustup', 'cargo', 'backend', 'cli'],
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
            summary: '适合提前验证新能力',
            managerActions: rustToolchain('beta', '默认安装 beta 工具链')
          },
          {
            id: 'nightly',
            label: 'nightly',
            summary: '适合实验性特性和高级编译选项',
            managerActions: rustToolchain('nightly', '默认安装 nightly 工具链')
          }
        ]
      },
      {
        id: 'redis',
        name: 'Redis',
        description: '做缓存、验证码、会话或本地消息队列实验时常会用到。',
        automation: 'guided',
        officialUrl: 'https://redis.io/docs/latest/operate/oss_and_stack/install/install-stack/windows/',
        tags: ['缓存', '数据库'],
        searchTerms: ['redis', 'cache', 'java backend', 'spring boot'],
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
    name: 'AI 本地推理',
    icon: '🤖',
    description: '适合本地跑模型、做 Prompt 原型和轻量实验的 Windows 起步环境。',
    packages: [
      {
        id: 'ollama',
        name: 'Ollama',
        description: '本地跑大模型最直接的入口，适合快速做 AI 原型和私有推理。',
        popular: true,
        automation: 'guided',
        officialUrl: 'https://docs.ollama.com/windows',
        tags: ['AI', 'LLM', '本地模型'],
        searchTerms: ['ollama', 'llm', 'local ai', '大模型', '本地推理'],
        note: '安装完程序后，模型文件仍需按需下载。',
        managerActions: managerActions(
          manualAction('建议使用 Ollama 官方 Windows 安装器，装完后再按需下载模型。', 'https://ollama.com/download/windows'),
          manualAction('建议使用 Ollama 官方 Windows 安装器，装完后再按需下载模型。', 'https://ollama.com/download/windows')
        )
      },
      {
        id: 'dockerdesktop',
        name: 'Docker Desktop',
        description: '跑 Web UI、向量库或相关服务依赖时，经常会需要它。',
        automation: 'guided',
        officialUrl: 'https://docs.docker.com/desktop/setup/install/windows-install/',
        tags: ['Docker', '容器'],
        searchTerms: ['docker', 'container', 'devcontainer', '本地推理'],
        note: '通常还会涉及 WSL2 / Hyper-V、首次启动和 docker-users 组设置。',
        managerActions: managerActions(
          manualAction('建议按 Docker 官方 Windows 文档安装，避免 WSL2 / Hyper-V 细节被一键脚本掩盖。', 'https://docs.docker.com/desktop/setup/install/windows-install/'),
          manualAction('建议按 Docker 官方 Windows 文档安装，避免 WSL2 / Hyper-V 细节被一键脚本掩盖。', 'https://docs.docker.com/desktop/setup/install/windows-install/')
        )
      },
      {
        id: 'pytorch',
        name: 'PyTorch',
        description: '如果你要写本地模型实验、推理脚本或课程作业，通常会先装它。',
        automation: 'guided',
        officialUrl: 'https://pytorch.org/get-started/locally/',
        tags: ['AI', '深度学习', 'Python'],
        searchTerms: ['pytorch', 'torch', 'deep learning', '本地推理'],
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
        id: 'cuda',
        name: 'CUDA Toolkit',
        description: '只有在你明确需要 GPU 加速时再补它，先跑通 CPU 路线会更稳。',
        automation: 'manual',
        officialUrl: 'https://developer.nvidia.com/cuda-downloads',
        tags: ['GPU', 'AI'],
        searchTerms: ['cuda', 'nvidia', 'gpu', '本地推理'],
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
