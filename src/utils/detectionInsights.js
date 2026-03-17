import { getPackageById } from '../data/environments.js'

const baselineBlueprint = {
  label: '通用开发基础',
  packageIds: ['git', 'vscode']
}

const sceneBlueprints = [
  {
    id: 'frontend',
    name: '前端入门',
    icon: '🌐',
    suggestedPackageIds: ['nodejs', 'git', 'pnpm'],
    baseRequirements: [
      createRequirement('Node.js', ['nodejs'])
    ],
    recommendedRequirements: [
      createRequirement('Git', ['git']),
      createRequirement('pnpm', ['pnpm'])
    ],
    buildCapability(state) {
      if (!state.hasPackage('nodejs')) {
        return '还不能开始常见前端项目，Node.js 这一层还没打通。'
      }

      if (state.hasPackage('git') && state.hasPackage('pnpm')) {
        return '已经能开始写、跑和管理基础前端项目了。'
      }

      if (state.hasPackage('git')) {
        return '已经能开始写和跑基础前端项目，但依赖管理还不够顺手。'
      }

      if (state.hasPackage('pnpm')) {
        return '已经能开始写和跑基础前端项目，但版本管理链路还没补齐。'
      }

      return '已经能开始跑基础前端项目，但开发链路还可以更顺。'
    },
    buildNextStep(state) {
      if (!state.hasPackage('nodejs')) {
        return '先补 Node.js，它是这个场景的入口。'
      }

      if (!state.hasPackage('pnpm') && !state.hasPackage('git')) {
        return '下一步先补 pnpm 和 Git，装依赖、拉代码和切项目都会顺很多。'
      }

      if (!state.hasPackage('pnpm')) {
        return '下一步先补 pnpm，装依赖和切项目会更顺。'
      }

      if (!state.hasPackage('git')) {
        return '下一步先补 Git，不然后续拉代码和版本管理会很别扭。'
      }

      return '可以直接试跑一个 Vite / Vue / React 新项目。'
    }
  },
  {
    id: 'python',
    name: 'Python 数据分析',
    icon: '📊',
    suggestedPackageIds: ['uv', 'python', 'jupyterlab', 'miniconda'],
    baseRequirements: [
      createRequirement('Python 解释器', ['python', 'miniconda'])
    ],
    recommendedRequirements: [
      createRequirement('JupyterLab', ['jupyterlab']),
      createRequirement('uv', ['uv']),
      createRequirement('Miniconda', ['miniconda'])
    ],
    buildCapability(state) {
      if (!state.hasPackage('python') && !state.hasPackage('miniconda')) {
        return '还没有可用的 Python 运行环境，数据分析和 Notebook 路线暂时起不来。'
      }

      if (!state.hasPackage('jupyterlab')) {
        return '已经有 Python 路线了，但 Notebook 工作流还没打通。'
      }

      if (state.hasPackage('uv')) {
        return '已经能开始做 Notebook、课程作业和小型数据实验了。'
      }

      return '已经能开始做 Notebook 和基础分析，但版本管理路线还不够清晰。'
    },
    buildNextStep(state) {
      if (!state.hasPackage('python') && !state.hasPackage('miniconda')) {
        return '先补 Python 或 Miniconda，再决定走 uv 还是 conda 路线。'
      }

      if (!state.hasPackage('jupyterlab')) {
        return '下一步先补 JupyterLab，Notebook 路线才算真正打通。'
      }

      if (!state.hasPackage('uv') && !state.hasPackage('miniconda')) {
        return '下一步先补 uv，后续版本管理和虚拟环境会轻松很多。'
      }

      if (!state.hasPackage('uv')) {
        return '如果你主要不是走 conda 体系，下一步可以补 uv。'
      }

      if (!state.hasPackage('miniconda')) {
        return '如果课程、教材或团队流程依赖 conda，再补 Miniconda。'
      }

      return '可以直接开一个 Notebook 试跑数据集。'
    }
  },
  {
    id: 'backend',
    name: 'Java 后端',
    icon: '☕',
    suggestedPackageIds: ['openjdk', 'intellijidea', 'maven', 'mysql', 'redis'],
    baseRequirements: [
      createRequirement('JDK', ['openjdk']),
      createRequirement('Maven 或 Gradle', ['maven', 'gradle'])
    ],
    recommendedRequirements: [
      createRequirement('IntelliJ IDEA 或 VS Code', ['intellijidea', 'vscode']),
      createRequirement('MySQL 或 PostgreSQL', ['mysql', 'postgresql']),
      createRequirement('Redis', ['redis'])
    ],
    buildCapability(state) {
      const hasDatabase = state.hasPackage('mysql') || state.hasPackage('postgresql')
      const hasBuildTool = state.hasPackage('maven') || state.hasPackage('gradle')

      if (!state.hasPackage('openjdk')) {
        return 'Java 项目还跑不起来，服务端入口环境还没打通。'
      }

      if (!hasBuildTool) {
        return '已经有 JDK 了，但构建链路还没打通，项目还不算能真正开工。'
      }

      if (hasDatabase && state.hasPackage('redis')) {
        return '已经能开始写、构建和运行 Java 服务，并做本地数据库和缓存联调。'
      }

      if (hasDatabase) {
        return '已经能开始写、构建和运行 Java 服务，并做本地数据库联调。'
      }

      return '已经能开始写和构建 Java 服务，但本地数据库联调还没打通。'
    },
    buildNextStep(state) {
      const hasDatabase = state.hasPackage('mysql') || state.hasPackage('postgresql')
      const hasBuildTool = state.hasPackage('maven') || state.hasPackage('gradle')

      if (!state.hasPackage('openjdk')) {
        return '先补 JDK，Java 项目还跑不起来。'
      }

      if (!hasBuildTool) {
        return '下一步先补 Maven；如果团队已有 Gradle 规范，再改成补 Gradle。'
      }

      if (!state.hasPackage('intellijidea') && !state.hasPackage('vscode')) {
        return '下一步补一个 IDE，优先 IntelliJ IDEA，也可以先用 VS Code 起步。'
      }

      if (!hasDatabase) {
        return '下一步先补 MySQL 或 PostgreSQL，数据库联调才打得通。'
      }

      if (!state.hasPackage('redis')) {
        return '如果项目涉及缓存、验证码或会话，再补 Redis。'
      }

      return '可以直接试一个 Spring Boot + 数据库联调。'
    }
  },
  {
    id: 'ai',
    name: 'AI 本地推理',
    icon: '🤖',
    suggestedPackageIds: ['ollama', 'python', 'pytorch', 'dockerdesktop', 'cuda'],
    baseRequirements: [
      createRequirement('Ollama', ['ollama'])
    ],
    recommendedRequirements: [
      createRequirement('Python', ['python']),
      createRequirement('PyTorch', ['pytorch']),
      createRequirement('Docker Desktop', ['dockerdesktop']),
      createRequirement('CUDA', ['cuda'])
    ],
    buildCapability(state) {
      if (!state.hasPackage('ollama')) {
        return '本地跑模型这一步还没打通，目前还不能把 AI 实验真正落到电脑上。'
      }

      if (state.hasPackage('python') && state.hasPackage('pytorch')) {
        if (state.hasPackage('cuda')) {
          return '已经能在本地跑模型，也能继续做脚本化推理和 GPU 路线实验。'
        }

        return '已经能在本地跑模型，也能开始做脚本化推理实验。'
      }

      return '已经能开始拉模型、跑对话和做 Prompt 实验。'
    },
    buildNextStep(state) {
      if (!state.hasPackage('ollama')) {
        return '先补 Ollama，先把本地跑模型这件事打通。'
      }

      if (!state.hasPackage('python')) {
        return '下一步先补 Python，后续脚本化实验才方便。'
      }

      if (!state.hasPackage('pytorch')) {
        return '如果你要写推理脚本或课程实验，再补 PyTorch。'
      }

      if (!state.hasPackage('dockerdesktop')) {
        return '如果你要跑 Web UI 或周边服务，再补 Docker Desktop。'
      }

      if (!state.hasPackage('cuda')) {
        return 'GPU 不是第一步，先把 CPU 路线跑通；确认需要再补 CUDA。'
      }

      return '基础实验链路已经很完整，可以开始做本地推理原型。'
    }
  }
]

export function getDetectionBaselineInsight(snapshot) {
  const installedNames = baselineBlueprint.packageIds
    .filter((id) => isInstalled(snapshot, id))
    .map(getPackageLabel)
  const missingNames = baselineBlueprint.packageIds
    .filter((id) => !isInstalled(snapshot, id))
    .map(getPackageLabel)

  if (!missingNames.length) {
    return {
      label: baselineBlueprint.label,
      tone: 'success',
      summary: '通用基础已具备：Git、VS Code。大多数场景都能直接往下走。',
      actionablePackageIds: []
    }
  }

  if (!installedNames.length) {
    return {
      label: baselineBlueprint.label,
      tone: 'warning',
      summary: '通用基础还没补齐：建议至少先装 Git 和 VS Code，后续学习和协作会省很多事。',
      actionablePackageIds: [...baselineBlueprint.packageIds]
    }
  }

  return {
    label: baselineBlueprint.label,
    tone: 'warning',
    summary: `通用基础还差 ${missingNames.join('、')}。它不会阻塞所有场景，但补上后会更顺。`,
    actionablePackageIds: baselineBlueprint.packageIds.filter((id) => !isInstalled(snapshot, id))
  }
}

export function getDetectionSceneInsights(snapshot) {
  return sceneBlueprints.map((scene) => {
    const state = buildSceneState(scene, snapshot)
    const status = resolveSceneStatus(state)
    const actionablePackageIds = scene.suggestedPackageIds.filter((id) => !isInstalled(snapshot, id))

    return {
      id: scene.id,
      name: scene.name,
      icon: scene.icon,
      statusLabel: status.label,
      tone: status.tone,
      progressText: `${state.installedSuggestedCount}/${scene.suggestedPackageIds.length}`,
      capability: scene.buildCapability(state),
      nextStep: scene.buildNextStep(state),
      presentText: state.presentLabels.length ? state.presentLabels.join('、') : '暂时还没有形成可用组合',
      missingText: state.missingLabels.length ? state.missingLabels.join('、') : '当前主推组合已经补齐',
      actionablePackageIds,
      actionLabel: !actionablePackageIds.length
        ? '已就绪'
        : status.tone === 'success'
          ? '补齐增强项'
          : '加入待补齐列表'
    }
  })
}

function createRequirement(label, anyOf) {
  return { label, anyOf }
}

function buildSceneState(scene, snapshot) {
  const baseMet = scene.baseRequirements
    .map((requirement) => resolveRequirement(requirement, snapshot))
  const recommendedMet = scene.recommendedRequirements
    .map((requirement) => resolveRequirement(requirement, snapshot))

  const presentLabels = uniqueLabels([
    ...baseMet.filter((item) => item.met).map((item) => item.label),
    ...recommendedMet.filter((item) => item.met).map((item) => item.label)
  ])
  const missingLabels = uniqueLabels([
    ...baseMet.filter((item) => !item.met).map((item) => item.label),
    ...recommendedMet.filter((item) => !item.met).map((item) => item.label)
  ])

  return {
    baseMetCount: baseMet.filter((item) => item.met).length,
    baseTotalCount: baseMet.length,
    installedSuggestedCount: scene.suggestedPackageIds.filter((id) => isInstalled(snapshot, id)).length,
    presentLabels,
    missingLabels,
    hasPackage: (packageId) => isInstalled(snapshot, packageId)
  }
}

function resolveRequirement(requirement, snapshot) {
  const matchedId = requirement.anyOf.find((packageId) => isInstalled(snapshot, packageId))

  return {
    met: Boolean(matchedId),
    label: matchedId ? getPackageLabel(matchedId) : requirement.label
  }
}

function resolveSceneStatus(state) {
  if (state.baseMetCount === 0) {
    return {
      label: '未起步',
      tone: 'danger'
    }
  }

  if (state.baseMetCount < state.baseTotalCount) {
    return {
      label: '还差关键项',
      tone: 'warning'
    }
  }

  if (state.missingLabels.length > 0) {
    return {
      label: '基础就绪',
      tone: 'steady'
    }
  }

  return {
    label: '完整就绪',
    tone: 'success'
  }
}

function uniqueLabels(labels) {
  return [...new Set(labels.filter(Boolean))]
}

function isInstalled(snapshot, packageId) {
  return Boolean(snapshot?.results?.[packageId]?.installed)
}

function getPackageLabel(packageId) {
  return getPackageById(packageId)?.name || packageId
}
