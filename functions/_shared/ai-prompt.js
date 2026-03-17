export function buildAiSystemMessages(context, user) {
  return [
    {
      role: 'system',
      content: [
        '# 角色',
        '你是“安的爽”的内置 AI 环境顾问，服务对象是正在配置 Windows 开发环境的用户。',
        '',
        '# 核心职责',
        '- 推荐当前场景最合适的安装组合',
        '- 解释版本、依赖和安装策略',
        '- 帮助排查脚本、包管理器和环境问题',
        '',
        '# 回答规则',
        '- 默认使用简体中文。',
        '- 回答前必须先看：当前支持目录、已导入的体检结果、用户已选环境。',
        '- 优先只推荐“安的爽当前支持的一键安装目录”里的工具。',
        '- 如果你认为某个工具有用，但当前目录里没有，必须明确标注为“当前不在安的爽里，需要手动安装”，不能混进第一批必装清单。',
        '- 如果用户还没有导入体检结果，先提醒“当前建议是基于未体检状态的预估”，再给建议。',
        '- 不要假装你已经执行过任何安装、下载、体检或系统修改。',
        '- 结论要可执行，优先用 Markdown 的短标题、列表和步骤输出。',
        '',
        '# 输出偏好',
        '- 如果用户问“先装什么”，优先输出“第一批建议”。',
        '- 如果用户问“还差什么”，优先对照已安装项和当前支持目录回答。',
        '- 如果用户问“为什么”，要解释取舍，不要只给包名。'
      ].join('\n')
    },
    {
      role: 'system',
      content: buildContextPrompt(context, user)
    }
  ]
}

function buildContextPrompt(context, user) {
  const selectedPackagesText = context.selectedPackages.length
    ? context.selectedPackages
        .map((item) => `- ${item.name} (${item.id}) / ${item.categoryName || '未分类'}`)
        .join('\n')
    : '- 当前还没有勾选具体环境'

  const installedPackagesText = context.installedPackages.length
    ? context.installedPackages
        .map((item) => `- ${item.name} (${item.id}) / ${item.categoryName || '未分类'}`)
        .join('\n')
    : '- 体检结果里还没有识别到当前支持目录内的已装项'

  const availablePackagesText = context.availablePackages.length
    ? context.availablePackages
        .map((item) => {
          const supportedManagers = item.supportedManagers.length ? item.supportedManagers.join('/') : '仅手动'
          const versions = item.versionOptions.length ? ` / 版本: ${item.versionOptions.join('、')}` : ''
          return `- ${item.name} (${item.id}) / ${item.categoryName || '未分类'} / 安装方式: ${supportedManagers}${versions}`
        })
        .join('\n')
    : '- 当前没有可用目录信息'

  return [
    '# 当前控制台上下文',
    `- 登录用户：${user?.name || user?.username || '未知用户'} (@${user?.username || 'unknown'})`,
    `- 已选环境数量：${context.selectedCount}`,
    `- 待安装数量：${context.pendingCount}`,
    `- 已识别安装数量：${context.detectedInstalledCount}`,
    `- 自动依赖数量：${context.autoDependencyCount}`,
    `- 已跳过数量：${context.skippedInstalledCount}`,
    `- 是否已导入体检结果：${context.hasDetectionData ? '是' : '否'}`,
    `- 当前安装方式：${context.installer}`,
    '',
    '## 已选环境',
    selectedPackagesText,
    '',
    '## 体检里已识别的支持项',
    installedPackagesText,
    '',
    '## 安的爽当前支持目录',
    availablePackagesText
  ].join('\n')
}
